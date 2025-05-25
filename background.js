// ProxyMaster Background Service Worker
class ProxyManager {
  constructor() {
    this.profiles = new Map();
    this.currentProfile = null;
    this.autoSwitchRules = [];
    this.performanceStats = new Map();
    this.contextMenuListenerAdded = false;
    this.tabStates = new Map(); // 记录每个标签页的代理状态
    this.proxyConfigCache = new Map(); // 缓存代理配置
    this._switching = false; // 防止并发切换
    this._switchPromise = null;
    this.init();
  }

  async init() {
    // 加载保存的配置
    await this.loadProfiles();
    await this.loadAutoSwitchRules();
    
    // 设置事件监听器
    this.setupEventListeners();
    
    // 初始化上下文菜单
    this.setupContextMenus();
    
    // 预热代理连接（异步，不阻塞初始化）
    this.warmupProxyConnections();
    
    console.log('ProxyMaster initialized');
  }

  async loadProfiles() {
    const result = await chrome.storage.sync.get(['profiles', 'currentProfile']);
    if (result.profiles) {
      this.profiles = new Map(Object.entries(result.profiles));
    }
    
    // 确保直连配置存在
    if (!this.profiles.has('direct')) {
      this.profiles.set('direct', {
        name: 'direct',
        displayName: chrome.i18n.getMessage('directConnection'),
        type: 'direct'
      });
    }
    
    this.currentProfile = result.currentProfile || 'direct';
    console.log('Loaded profiles:', Array.from(this.profiles.keys()));
    console.log('Current profile:', this.currentProfile);
    
    // 预热：预构建所有代理配置缓存
    this.preloadProxyConfigs();
  }

  preloadProxyConfigs() {
    console.log('🔥 Preloading proxy configurations...');
    let cachedCount = 0;
    
    for (const [profileName, profile] of this.profiles) {
      if (profileName !== 'direct' && profile.host && profile.port) {
        const config = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: {
              scheme: profile.protocol || 'http',
              host: profile.host,
              port: profile.port
            }
          }
        };
        this.proxyConfigCache.set(profileName, config);
        cachedCount++;
      }
    }
    
    console.log(`📦 Preloaded ${cachedCount} proxy configurations`);
  }

  async warmupProxyConnections() {
    console.log('🔥 Warming up proxy connections...');
    
    // 异步预热，不阻塞主流程
    setTimeout(async () => {
      for (const [profileName, profile] of this.profiles) {
        if (profileName !== 'direct' && profile.host && profile.port) {
          try {
            console.log(`🌡️ Warming up proxy: ${profileName}`);
            
            // 简单的连接测试：尝试建立TCP连接
            const testUrl = `http://${profile.host}:${profile.port}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时
            
            await fetch(testUrl, {
              method: 'HEAD',
              signal: controller.signal
            }).catch(() => {
              // 忽略错误，这只是预热
            });
            
            clearTimeout(timeoutId);
            console.log(`✅ Proxy ${profileName} warmed up`);
          } catch (error) {
            console.log(`⚠️ Proxy ${profileName} warmup failed:`, error.message);
          }
        }
      }
      console.log('🔥 Proxy warmup completed');
    }, 1000); // 延迟1秒开始预热，避免影响启动速度
  }

  async waitForProxySwitch(targetProfile, maxWaitTime = 3000) {
    console.log(`🔍 Confirming proxy switch to: ${targetProfile}`);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkInterval = 50; // 每50ms检查一次，更快响应
      let attempts = 0;
      const maxAttempts = Math.floor(maxWaitTime / checkInterval);
      
      const checkProxy = async () => {
        attempts++;
        
        try {
          // 获取当前代理设置
          const proxySettings = await chrome.proxy.settings.get({ incognito: false });
          const currentSettings = proxySettings.value;
          
          let isCorrectProxy = false;
          
          if (targetProfile === 'direct') {
            // 检查是否为直连
            isCorrectProxy = currentSettings.mode === 'direct';
          } else {
            // 检查是否为指定代理
            const profile = this.profiles.get(targetProfile);
            if (profile && currentSettings.mode === 'fixed_servers' && currentSettings.rules) {
              const singleProxy = currentSettings.rules.singleProxy;
              isCorrectProxy = singleProxy && 
                             singleProxy.host === profile.host && 
                             singleProxy.port === profile.port &&
                             singleProxy.scheme === profile.protocol;
            }
          }
          
          if (isCorrectProxy) {
            const waitTime = Date.now() - startTime;
            console.log(`✅ Proxy switch confirmed in ${waitTime}ms (${attempts} attempts)`);
            resolve(true);
            return;
          }
          
          // 如果还没有达到最大尝试次数，继续检查
          if (attempts < maxAttempts) {
            setTimeout(checkProxy, checkInterval);
          } else {
            const waitTime = Date.now() - startTime;
            console.warn(`⚠️ Proxy switch confirmation timeout after ${waitTime}ms (${attempts} attempts)`);
            // 即使超时也返回true，避免阻塞用户操作
            resolve(true);
          }
          
        } catch (error) {
          console.error('Error checking proxy settings:', error);
          if (attempts < maxAttempts) {
            setTimeout(checkProxy, checkInterval);
          } else {
            console.warn(`⚠️ Proxy switch confirmation failed after ${attempts} attempts`);
            // 即使失败也返回true，避免阻塞用户操作
            resolve(true);
          }
        }
      };
      
      // 开始检查
      checkProxy();
    });
  }

  async saveProfiles() {
    const profilesObj = Object.fromEntries(this.profiles);
    await chrome.storage.sync.set({
      profiles: profilesObj,
      currentProfile: this.currentProfile
    });
    
    // 只在配置真正改变时才清理缓存，而不是每次保存都清理
    // 这样可以保持性能优化
    console.log(`💾 Profiles saved to storage`);
  }

  async loadAutoSwitchRules() {
    const result = await chrome.storage.sync.get(['autoSwitchRules']);
    this.autoSwitchRules = result.autoSwitchRules || [];
    console.log('Loaded auto switch rules:', this.autoSwitchRules.length);
    this.autoSwitchRules.forEach((rule, index) => {
      console.log(`Rule ${index}: ${rule.name} (${rule.type}: ${rule.pattern}) -> ${rule.profile} [${rule.enabled ? 'enabled' : 'disabled'}]`);
    });
  }

  // 提取URL的域名，统一处理www前缀
  extractDomain(url) {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // 统一处理www前缀：www.example.com 和 example.com 视为同一域名
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      return hostname;
    } catch (error) {
      return null;
    }
  }

  // 判断是否应该拦截这个URL
  shouldInterceptUrl(url) {
    // 排除内部页面和扩展页面
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://') ||
        url.startsWith('moz-extension://') ||
        url.startsWith('edge://') ||
        url === 'about:blank' ||
        url === '') {
      return false;
    }
    return true;
  }

  setupEventListeners() {
    // 备用监听：标签页更新（仅用于状态同步）
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      // 只处理页面加载完成的状态同步，主要逻辑已在webRequest中处理
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // 确保标签页状态记录存在
        const tabState = this.tabStates.get(tabId);
        if (!tabState) {
          console.log(`📋 Syncing state for tab ${tabId}: ${tab.url}`);
          
          // 根据URL规则确定正确的代理，而不是使用当前全局代理
          const matchedRule = this.findMatchingRule(tab.url);
          const correctProxy = matchedRule ? matchedRule.profile : 'direct';
          
          this.tabStates.set(tabId, {
            proxy: correctProxy,
            setBy: 'auto',
            timestamp: Date.now(),
            lastProcessedUrl: tab.url,
            currentDomain: this.extractDomain(tab.url)
          });
          
          console.log(`📋 Tab ${tabId} synced with correct proxy: ${correctProxy}`);
        }
      }
    });

    // 监听标签页创建 - 新标签页立即处理
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.url && !tab.url.startsWith('chrome://') && tab.url !== 'chrome://newtab/') {
        console.log(`🆕 New tab created: ${tab.url}`);
        this.handleTabUpdate(tab);
      }
    });

    // 监听标签页切换 - 智能代理切换
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.handleTabActivated(activeInfo.tabId);
    });

    // 监听标签页关闭，清理状态
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabStates.delete(tabId);
      console.log(`Tab ${tabId} closed, state cleaned up`);
    });

    // 监听网络请求 - 用于性能统计
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleWebRequest(details),
      { urls: ['<all_urls>'] }
    );

    // 使用导航监听作为主要拦截点
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
      if (details.frameId === 0 && this.shouldInterceptUrl(details.url)) {
        console.log(`🚦 Navigation intercepted (onBeforeNavigate): Tab ${details.tabId} → ${details.url}`);
        console.log(`🔍 Navigation details:`, details);
        await this.handleNavigationIntercept(details.tabId, details.url);
      }
    });

    // 备用拦截点：onCommitted
    chrome.webNavigation.onCommitted.addListener(async (details) => {
      if (details.frameId === 0 && this.shouldInterceptUrl(details.url)) {
        console.log(`🚦 Navigation committed (onCommitted): Tab ${details.tabId} → ${details.url}`);
        // 只在onBeforeNavigate没有处理的情况下处理
        const tabState = this.tabStates.get(details.tabId);
        if (!tabState || tabState.lastProcessedUrl !== details.url) {
          console.log(`🔄 Processing navigation in onCommitted as backup`);
          await this.handleNavigationIntercept(details.tabId, details.url);
        }
      }
    });

    // 监听扩展消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  setupContextMenus() {
    // 先清除所有现有的右键菜单项，避免重复创建
    chrome.contextMenus.removeAll(() => {
      try {
    chrome.contextMenus.create({
      id: 'proxymaster-quick-switch',
      title: '快速切换代理',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'proxymaster-add-rule',
      title: '为此网站添加规则',
      contexts: ['page']
        });
      } catch (error) {
        console.error('Error creating context menus:', error);
      }
    });

    // 确保只添加一次点击监听器
    if (!this.contextMenuListenerAdded) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
      this.contextMenuListenerAdded = true;
    }
  }



  async handleNavigationIntercept(tabId, url) {
    try {
      console.log(`🚦 Intercepting navigation: Tab ${tabId} → ${url}`);
      
      // 快速检查：如果自动切换被禁用，直接返回
      const autoSwitchEnabled = await this.isAutoSwitchEnabled();
      if (!autoSwitchEnabled) {
        console.log('⏭️ Auto switch disabled, allowing navigation');
        return;
      }

      // 获取当前标签页状态
      const currentTabState = this.tabStates.get(tabId);
      console.log(`📋 Current tab state:`, currentTabState);

      // 防止重复处理：如果已经处理过相同URL，跳过（但延迟决策的除外）
      if (currentTabState && currentTabState.lastProcessedUrl === url && !currentTabState.deferred) {
        console.log(`✅ URL already processed: ${url}`);
        return;
      }
      
      // 检查是否是标签页切换导致的代理变更后的重新导航
      // 如果当前代理已经正确，且URL已经匹配，则跳过处理
      const matchedRule = this.findMatchingRule(url);
      const expectedProfile = matchedRule ? matchedRule.profile : 'direct';
      
      if (this.currentProfile === expectedProfile) {
        console.log(`✅ Proxy already correct for ${url}: ${expectedProfile}, skipping intercept`);
        // 更新标签页状态但不重定向
        this.tabStates.set(tabId, {
          proxy: expectedProfile,
          setBy: 'auto',
          timestamp: Date.now(),
          lastProcessedUrl: url,
          currentDomain: this.extractDomain(url)
        });
        return;
      }

      // 1. 使用已经找到的规则确定需要的代理
      let targetProfile = expectedProfile; // 使用之前计算的代理
      
      if (matchedRule) {
        console.log(`🎯 Rule matched: ${matchedRule.name} → ${targetProfile}`);
      } else {
        console.log(`🔍 No rule matched for ${url}, using direct connection`);
      }

      // 使用统一的代理切换函数，传入新的目标URL
      await this.unifiedProxySwitch(tabId, targetProfile, 'auto', url);
      
    } catch (error) {
      console.error('Error in handleNavigationIntercept:', error);
    }
  }

  async handleTabActivated(tabId) {
    try {
      console.log(`🔄 Tab ${tabId} activated`);
      
      // 获取标签页信息
      const tab = await chrome.tabs.get(tabId);
      
      // 跳过扩展页面和内部页面
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log(`⏭️ Skipping internal page: ${tab.url}`);
        return;
      }

      // 获取该标签页的代理状态
      const tabState = this.tabStates.get(tabId);
      
      if (tabState) {
        // 标签页有记录的代理状态
        const targetProxy = tabState.proxy;
        console.log(`📋 Tab ${tabId} has recorded proxy: ${targetProxy}`);
        
        // 检查是否需要切换全局代理
        if (this.currentProfile !== targetProxy) {
          console.log(`🔄 Switching global proxy from ${this.currentProfile} to ${targetProxy} for tab ${tabId}`);
          await this.switchToProfile(targetProxy, false, null, false); // 不刷新，不更新标签页状态
        } else {
          console.log(`✅ Global proxy already matches tab ${tabId} proxy: ${targetProxy}`);
        }
      } else {
        // 新标签页，延迟代理切换，等待用户输入URL后再决定
        console.log(`🆕 New tab ${tabId}, deferring proxy decision until navigation`);
        this.tabStates.set(tabId, {
          proxy: this.currentProfile, // 暂时使用当前代理，避免不必要的切换
          setBy: 'auto',
          timestamp: Date.now(),
          currentDomain: this.extractDomain(tab.url),
          deferred: true // 标记为延迟决策
        });
        
        // 不立即切换代理，等待导航时再决定
        console.log(`⏳ Proxy decision deferred for new tab ${tabId}`);
    }
    } catch (error) {
      console.error('Error in handleTabActivated:', error);
    }
  }



  findMatchingRule(url) {
    console.log(`Finding matching rule for URL: ${url}`);
    console.log(`Available rules: ${this.autoSwitchRules.length}`);
    
    // 只处理启用的规则，按优先级排序
    const enabledRules = this.autoSwitchRules
      .filter(rule => rule.enabled)
      .sort((a, b) => (b.priority || 100) - (a.priority || 100));
    
    console.log(`Enabled rules: ${enabledRules.length}`);
    
    for (const rule of enabledRules) {
      console.log(`Checking rule: ${rule.name} (${rule.type}: ${rule.pattern})`);
      if (this.matchesRule(url, rule)) {
        console.log(`Rule matched: ${rule.name} for ${url}`);
        return rule;
      }
    }
    console.log(`No matching rule found for ${url}`);
    return null;
  }

  matchesRule(url, rule) {
    try {
      const urlObj = new URL(url);
      let result = false;
      
      switch (rule.type) {
        case 'domain':
          result = this.matchDomain(urlObj.hostname, rule.pattern);
          console.log(`Domain match: ${urlObj.hostname} vs ${rule.pattern} = ${result}`);
          break;
        case 'url':
          result = this.wildcardMatch(url, rule.pattern);
          console.log(`URL match: ${url} vs ${rule.pattern} = ${result}`);
          break;
        case 'wildcard':
          result = this.wildcardMatch(url, rule.pattern);
          console.log(`Wildcard match: ${url} vs ${rule.pattern} = ${result}`);
          break;
        case 'regex':
          result = new RegExp(rule.pattern).test(url);
          console.log(`Regex match: ${url} vs ${rule.pattern} = ${result}`);
          break;
        default:
          console.log(`Unknown rule type: ${rule.type}`);
          return false;
      }
      
      return result;
    } catch (e) {
      console.error('Rule matching error:', e, rule);
      return false;
    }
  }

  matchDomain(hostname, pattern) {
    // 处理域名匹配，支持通配符
    if (pattern.startsWith('*.')) {
      // 通配符域名匹配，如 *.google.com
      const domain = pattern.substring(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    } else {
      // 精确域名匹配或包含匹配
      return hostname === pattern || hostname.endsWith('.' + pattern);
    }
  }

  wildcardMatch(str, pattern) {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(str);
  }

  // 缓存设置以提高性能
  async isAutoSwitchEnabled() {
    if (!this._autoSwitchCache || Date.now() - this._autoSwitchCache.timestamp > 5000) {
      const settings = await chrome.storage.sync.get(['enableAutoSwitch']);
      this._autoSwitchCache = {
        enabled: settings.enableAutoSwitch !== false,
        timestamp: Date.now()
      };
    }
    return this._autoSwitchCache.enabled;
  }

  async isAutoFallbackEnabled() {
    if (!this._autoFallbackCache || Date.now() - this._autoFallbackCache.timestamp > 5000) {
      const settings = await chrome.storage.sync.get(['enableAutoFallback']);
      this._autoFallbackCache = {
        enabled: settings.enableAutoFallback !== false,
        timestamp: Date.now()
      };
    }
    return this._autoFallbackCache.enabled;
  }

  // 自动添加规则
  async autoAddRule(domain, profile) {
    // 检查是否已存在相同域名的规则
    const existingRule = this.autoSwitchRules.find(rule => 
      rule.type === 'domain' && rule.pattern === domain
    );
    
    if (!existingRule) {
      // 创建新规则
      const newRule = {
        name: `${chrome.i18n.getMessage('autoRule') || 'Auto'}-${domain}`,
        type: 'domain',
        pattern: domain,
        profile: profile,
        enabled: true,
        priority: 100
      };
      this.autoSwitchRules.push(newRule);
      // 保存规则
      await chrome.storage.sync.set({ autoSwitchRules: this.autoSwitchRules });
      console.log(`✅ Auto-created rule: ${domain} → ${profile}`);
    }
  }

  // 统一的代理切换处理函数
  async unifiedProxySwitch(tabId, targetProfile, switchType, providedUrl = null) {
    try {
      console.log(`🔄 Unified proxy switch: Tab ${tabId} → ${targetProfile} (${switchType})`);
      
      // 1. 优先级检查：只在同一域名内保护手工设置
      const currentTabState = this.tabStates.get(tabId);
      if (switchType === 'auto' && currentTabState && currentTabState.setBy === 'manual') {
        // 检查是否是同一域名
        const currentDomain = currentTabState.currentDomain || this.extractDomain(currentTabState.lastProcessedUrl || '');
        const newDomain = this.extractDomain(providedUrl || targetUrl);
        
        if (currentDomain && newDomain && currentDomain === newDomain) {
          console.log(`🛡️ Same domain (${currentDomain}), keeping manual setting`);
          return false;
        } else {
          console.log(`🔄 Different domain: ${currentDomain} → ${newDomain}, allowing auto switch`);
        }
      }
      
      // 2. 获取目标URL：优先级顺序
      let targetUrl = providedUrl;
      if (!targetUrl) {
        // 对于手工切换，优先使用标签页状态中记录的最后尝试访问的URL
        if (switchType === 'manual' && currentTabState && currentTabState.lastProcessedUrl) {
          targetUrl = currentTabState.lastProcessedUrl;
          console.log(`📋 Using last processed URL from tab state: ${targetUrl}`);
        } else {
          // 否则获取当前标签页URL
          try {
            const tab = await chrome.tabs.get(tabId);
            targetUrl = tab.url;
            console.log(`📄 Using current tab URL: ${targetUrl}`);
          } catch (error) {
            console.error(`❌ Failed to get tab ${tabId}:`, error);
            return false;
          }
        }
      }
      
      console.log(`🎯 Target URL for redirect: ${targetUrl}`);
      
      // 3. 防止重复处理同一个URL和代理组合
      if (currentTabState && 
          currentTabState.lastProcessedUrl === targetUrl && 
          currentTabState.proxy === targetProfile) {
        console.log(`✅ URL already processed with correct proxy: ${targetUrl}`);
        return true;
      }
      
      // 4. 检查是否需要切换代理
      const needsSwitch = this.currentProfile !== targetProfile;
      
      if (needsSwitch) {
        // 切换代理
        const success = await this.switchToProfile(targetProfile, switchType === 'manual', null, false);
        if (!success) {
          console.error(`❌ Failed to switch proxy to ${targetProfile}`);
          return false;
        }
        
        // 对于自动切换，跳过等待确认以提升速度
        if (switchType === 'manual') {
          // 手工切换需要确认，确保用户操作的准确性
          console.log(`⏳ Waiting for manual proxy switch confirmation...`);
          const confirmed = await this.waitForProxySwitch(targetProfile);
          if (!confirmed) {
            console.error(`❌ Manual proxy switch confirmation failed for ${targetProfile}`);
          }
        } else {
          // 自动切换信任API返回，不等待确认，提升速度
          console.log(`⚡ Auto proxy switch completed, trusting API response`);
        }
        
        console.log(`✅ Proxy switched to ${targetProfile}`);
      } else {
        console.log(`✅ Proxy already correct: ${targetProfile}`);
      }
      
      // 5. 更新标签页状态
      this.tabStates.set(tabId, {
        proxy: targetProfile,
        setBy: switchType,
        timestamp: Date.now(),
        lastProcessedUrl: targetUrl,
        currentDomain: this.extractDomain(targetUrl)
        // 清除deferred标记
      });
      
      // 6. 只在需要切换代理时才重定向
      if (needsSwitch) {
        try {
          // 检查是否可以重定向
          if (!this.shouldInterceptUrl(targetUrl)) {
            console.log(`⏭️ Skipping redirect for internal URL: ${targetUrl}`);
            return true;
          }
          
          console.log(`🧭 Redirecting to: ${targetUrl}`);
          await chrome.tabs.update(tabId, { url: targetUrl });
          console.log(`✅ Redirected successfully`);
        } catch (error) {
          console.error('Error during redirect:', error);
        }
      } else {
        console.log(`⏭️ No redirect needed, proxy already correct`);
      }
      
      // 8. 手工切换成功后，自动添加规则
      if (switchType === 'manual') {
        const domain = this.extractDomain(targetUrl);
        if (domain) {
          this.autoAddRule(domain, targetProfile);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error in unifiedProxySwitch:', error);
      return false;
    }
  }

  // 保留原有函数作为兼容性接口，内部调用统一函数
  async setTabProxy(tabId, profileName, setBy = 'manual') {
    return await this.unifiedProxySwitch(tabId, profileName, setBy);
  }

  async switchToProfile(profileName, isManual = true, targetTabId = null, updateTabState = true) {
    const startTime = Date.now();
    console.log(`⚡ Fast switching to profile: ${profileName} (${isManual ? 'manual' : 'auto'})`);
    
    // 快速检查：如果已经是目标代理，直接返回
    if (this.currentProfile === profileName) {
      console.log(`✅ Already using ${profileName}, skipping switch`);
      return true;
    }
    
    // 防止并发切换
    if (this._switching) {
      console.log(`⏳ Switch already in progress, waiting...`);
      await this._switchPromise;
      return this.currentProfile === profileName;
    }
    
    // 标记正在切换
    this._switching = true;
    this._switchPromise = this._performSwitch(profileName, isManual, startTime);
    
    try {
      const result = await this._switchPromise;
      return result;
    } finally {
      this._switching = false;
      this._switchPromise = null;
    }
  }

  async _performSwitch(profileName, isManual, startTime) {
    // 保存之前的配置，用于错误恢复
    const previousProfile = this.currentProfile;
    
    try {
    // 对于直连模式，不需要检查profile是否存在
    if (profileName !== 'direct') {
      const profile = this.profiles.get(profileName);
      if (!profile) {
          console.error(`❌ Profile ${profileName} not found`);
        return false;
      }
    }

      // 立即更新当前配置，避免重复切换
      this.currentProfile = profileName;
      
      console.log(`🔄 Setting proxy configuration...`);
      
      if (profileName === 'direct') {
        // 直连模式 - 使用最快的方式，只设置一次
        await chrome.proxy.settings.set({
          value: { mode: 'direct' },
          scope: 'regular'
        });
        console.log('✅ Direct connection activated');
      } else {
        // 代理模式 - 使用缓存的配置，减少处理时间
        const profile = this.profiles.get(profileName);
        
        // 从缓存获取或构建配置
        let config = this.proxyConfigCache.get(profileName);
        if (!config) {
          config = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: {
              scheme: profile.protocol,
              host: profile.host,
              port: profile.port
            }
          }
        };
          this.proxyConfigCache.set(profileName, config);
          console.log(`📦 Cached config for ${profileName}`);
        }

        // 如果有认证，先设置认证（这个比较快）
        if (profile.auth) {
          this.setupProxyAuth(profile.auth);
        }

        // 设置代理配置（这是最耗时的操作）
        await chrome.proxy.settings.set({
          value: config,
          scope: 'regular'
        });
        
        console.log(`✅ Proxy activated: ${profile.host}:${profile.port}`);
      }

      const switchTime = Date.now() - startTime;
      console.log(`⏱️ Proxy switch API completed in ${switchTime}ms`);

      // 立即更新徽章（这个很快）
      this.updateBadge(profileName);
      
      // 立即发送状态更新消息给popup
      chrome.runtime.sendMessage({
        action: 'profileSwitched',
        profileName: profileName
      }).catch(() => {
        // 忽略错误，popup可能没有打开
      });
      
      // 异步保存配置，不阻塞
      setTimeout(() => {
        this.saveProfiles().catch(error => {
          console.warn('Failed to save profiles:', error);
        });
      }, 0);
      
      return true;
    } catch (error) {
      console.error('❌ Error switching profile:', error);
      // 恢复之前的状态
      this.currentProfile = previousProfile;
      return false;
    }
  }



  setupProxyAuth(auth) {
    // 避免重复添加认证监听器
    if (this._authListener) {
      chrome.webRequest.onAuthRequired.removeListener(this._authListener);
    }
    
    this._authListener = (details) => {
        return {
          authCredentials: {
            username: auth.username,
            password: auth.password
          }
        };
    };
    
    chrome.webRequest.onAuthRequired.addListener(
      this._authListener,
      { urls: ['<all_urls>'] },
      ['blocking']
    );
    
    console.log(`🔐 Proxy auth configured for user: ${auth.username}`);
  }

  updateBadge(profileName) {
    const badgeText = profileName === 'direct' ? '' : profileName.substring(0, 2).toUpperCase();
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    console.log(`Badge updated: ${profileName} -> ${badgeText}`);
  }





  async handleWebRequest(details) {
    // 记录性能统计
    const hostname = new URL(details.url).hostname;
    if (!this.performanceStats.has(hostname)) {
      this.performanceStats.set(hostname, {
        requests: 0,
        totalTime: 0,
        errors: 0
      });
    }
    
    const stats = this.performanceStats.get(hostname);
    stats.requests++;
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getProfiles':
          console.log('getProfiles called, currentProfile:', this.currentProfile);
          sendResponse({
            profiles: Object.fromEntries(this.profiles),
            currentProfile: this.currentProfile
          });
          break;
          
        case 'switchProfile':
          // 获取当前活跃标签页
          let currentTabId = message.tabId;
          
          if (!currentTabId) {
            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0 && !tabs[0].url.startsWith('chrome-extension://')) {
                currentTabId = tabs[0].id;
              } else {
                // 如果当前是扩展页面，查找最近的网页标签页
                const allTabs = await chrome.tabs.query({});
                const webTabs = allTabs.filter(tab => 
                  !tab.url.startsWith('chrome://') && 
                  !tab.url.startsWith('chrome-extension://') &&
                  tab.url !== ''
                ).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                
                if (webTabs.length > 0) {
                  currentTabId = webTabs[0].id;
                }
              }
            } catch (error) {
              console.warn('Could not get current tab:', error);
            }
          }

          let success;
          const isManual = message.isManual !== false; // 默认为手动
          
          if (currentTabId) {
            success = await this.setTabProxy(currentTabId, message.profileName, isManual ? 'manual' : 'auto');
          } else {
            success = await this.switchToProfile(message.profileName, isManual);
          }
          
          sendResponse({ 
            success: success,
            currentProfile: this.currentProfile 
          });
          break;
          
        case 'addProfile':
          if (!message.profile || !message.profile.name) {
            sendResponse({ success: false, error: 'Invalid profile data' });
            return;
          }
          this.profiles.set(message.profile.name, message.profile);
          // 清理缓存，因为添加了新的配置文件
          this.proxyConfigCache.clear();
          console.log(`🧹 Proxy config cache cleared due to profile addition`);
          await this.saveProfiles();
          console.log('Profile added:', message.profile.name);
          sendResponse({ success: true });
          break;
          
        case 'deleteProfile':
          if (!message.profileName) {
            sendResponse({ success: false, error: 'Profile name required' });
            return;
          }
          this.profiles.delete(message.profileName);
          // 清理缓存，因为删除了配置文件
          this.proxyConfigCache.delete(message.profileName);
          console.log(`🧹 Removed ${message.profileName} from proxy config cache`);
          await this.saveProfiles();
          console.log('Profile deleted:', message.profileName);
          sendResponse({ success: true });
          break;
          
        case 'addAutoSwitchRule':
          this.autoSwitchRules.push(message.rule);
          await chrome.storage.sync.set({ autoSwitchRules: this.autoSwitchRules });
          sendResponse({ success: true });
          break;
          
        case 'getPerformanceStats':
          sendResponse(Object.fromEntries(this.performanceStats));
          break;

        case 'reportPerformance':
          // 处理性能报告
          console.log('Performance data received:', message.data);
          sendResponse({ success: true });
          break;

        case 'updateRules':
          // 更新自动切换规则
          this.autoSwitchRules = message.rules || [];
          console.log('Rules updated:', this.autoSwitchRules.length);
          sendResponse({ success: true });
          break;

        case 'reloadProfiles':
          // 重新加载配置
          // 清理缓存，因为要重新加载配置
          this.proxyConfigCache.clear();
          console.log(`🧹 Proxy config cache cleared due to profile reload`);
          await this.loadProfiles();
          await this.loadAutoSwitchRules();
          console.log('Profiles reloaded');
          sendResponse({ success: true });
          break;

        case 'testAutoSwitch':
          // 测试自动切换功能
          if (message.url) {
            const matchedRule = this.findMatchingRule(message.url);
            sendResponse({ 
              success: true, 
              matchedRule: matchedRule,
              currentProfile: this.currentProfile,
              rulesCount: this.autoSwitchRules.length
            });
          } else {
            sendResponse({ success: false, error: 'URL required' });
          }
          break;

        case 'getTabProxyStates':
          // 返回所有标签页的代理状态
          const tabStates = Object.fromEntries(this.tabStates);
          sendResponse({ 
            success: true, 
            tabStates: tabStates,
            currentProfile: this.currentProfile
          });
          break;

        case 'testProxy':
          // 测试代理连接
          this.testProxyConnection(message.profileName).then(result => {
            sendResponse(result);
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          break;
          
        default:
          console.warn('Unknown action:', message.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  handleContextMenuClick(info, tab) {
    if (info.menuItemId === 'proxymaster-quick-switch') {
      // 打开快速切换面板
      chrome.action.openPopup();
    } else if (info.menuItemId === 'proxymaster-add-rule') {
      // 为当前网站添加规则
      const hostname = new URL(tab.url).hostname;
      chrome.tabs.create({
        url: `options.html#add-rule?domain=${hostname}`
      });
    }
  }

  async testProxyConnection(profileName) {
    try {
      // 创建一个新的标签页进行测试
      const tab = await chrome.tabs.create({
        url: 'https://httpbin.org/ip',
        active: false
      });

      // 等待页面加载完成
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // 注入脚本获取IP信息
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const bodyText = document.body.innerText;
            const data = JSON.parse(bodyText);
            return { success: true, ip: data.origin };
          } catch (e) {
            return { success: false, error: 'Failed to parse response' };
          }
        }
      });

      // 关闭测试标签页
      await chrome.tabs.remove(tab.id);

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        return { success: false, error: 'No result from test' };
      }
    } catch (error) {
      console.error('Proxy test error:', error);
      return { success: false, error: error.message };
    }
  }



  showNotification(message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ProxyMaster',
      message: message
    });
  }
}

// 初始化代理管理器
const proxyManager = new ProxyManager(); 