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
        displayName: '直接连接',
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
    
    // 清理代理配置缓存，确保使用最新配置
    this.proxyConfigCache.clear();
    console.log(`🧹 Proxy config cache cleared`);
  }

  async loadAutoSwitchRules() {
    const result = await chrome.storage.sync.get(['autoSwitchRules']);
    this.autoSwitchRules = result.autoSwitchRules || [];
    console.log('Loaded auto switch rules:', this.autoSwitchRules.length);
    this.autoSwitchRules.forEach((rule, index) => {
      console.log(`Rule ${index}: ${rule.name} (${rule.type}: ${rule.pattern}) -> ${rule.profile} [${rule.enabled ? 'enabled' : 'disabled'}]`);
    });
  }

  setupEventListeners() {
    // 备用监听：标签页更新（仅用于状态同步）
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // 只处理页面加载完成的状态同步，主要逻辑已在webRequest中处理
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // 确保标签页状态记录存在
        const tabState = this.tabStates.get(tabId);
        if (!tabState) {
          console.log(`📋 Syncing state for tab ${tabId}: ${tab.url}`);
          this.tabStates.set(tabId, {
            proxy: this.currentProfile,
            setBy: 'auto',
            timestamp: Date.now(),
            lastProcessedUrl: tab.url
          });
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
      if (details.frameId === 0 && !details.url.startsWith('chrome://')) {
        console.log(`🚦 Navigation intercepted: ${details.url}`);
        await this.handleNavigationIntercept(details.tabId, details.url);
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

  async handleNavigationIntercept(tabId, url, forceProfile = null) {
    try {
      console.log(`🚦 Intercepting navigation: Tab ${tabId} → ${url}${forceProfile ? ` (forced: ${forceProfile})` : ''}`);
      
      // 获取当前标签页状态
      const currentTabState = this.tabStates.get(tabId);
      console.log(`📋 Current tab state:`, currentTabState);

      // 防止重复处理：如果正在重定向或已经处理过相同URL，跳过
      if (currentTabState) {
        if (currentTabState.redirecting) {
          console.log(`🔄 Tab ${tabId} is redirecting, skipping`);
          return;
        }
        if (currentTabState.lastProcessedUrl === url && !forceProfile) {
          console.log(`✅ URL already processed: ${url}`);
          return;
        }
      }

      let targetProfile;
      let setBy;
      
      if (forceProfile) {
        // 手工切换：使用强制指定的代理
        targetProfile = forceProfile;
        setBy = 'manual';
        console.log(`👆 Manual switch: forcing ${targetProfile}`);
      } else {
        // 自动切换：检查自动切换是否启用
        const autoSwitchEnabled = await this.isAutoSwitchEnabled();
        if (!autoSwitchEnabled) {
          console.log('⏭️ Auto switch disabled, allowing navigation');
          return;
        }
        
        // 检查URL，确定需要的代理
        const matchedRule = this.findMatchingRule(url);
        if (matchedRule) {
          targetProfile = matchedRule.profile;
          console.log(`🎯 Rule matched: ${matchedRule.name} → ${targetProfile}`);
        } else {
          targetProfile = 'direct';
          console.log(`🔍 No rule matched for ${url}, using direct connection`);
        }
        setBy = 'auto';
      }

      // 检查是否需要切换代理
      const needSwitchProxy = this.currentProfile !== targetProfile;
      
      if (needSwitchProxy) {
        console.log(`🔄 Need to switch proxy: ${this.currentProfile} → ${targetProfile} (${setBy})`);
        
        // 切换代理并重定向
        await this.switchProxyAndRedirect(tabId, targetProfile, url, setBy);
      } else {
        console.log(`✅ Proxy already correct (${targetProfile}), allowing navigation`);
        
        // 更新处理记录
        if (currentTabState) {
          currentTabState.lastProcessedUrl = url;
          if (forceProfile) {
            currentTabState.setBy = 'manual';
            currentTabState.timestamp = Date.now();
          }
        } else {
          this.tabStates.set(tabId, {
            proxy: targetProfile,
            setBy: setBy,
            timestamp: Date.now(),
            lastProcessedUrl: url
          });
        }
      }
      
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
        // 新标签页，默认使用直连
        console.log(`🆕 New tab ${tabId} has no state, setting to direct connection`);
        console.log(`🆕 Tab URL: ${tab.url}`);
        this.tabStates.set(tabId, {
          proxy: 'direct',
          setBy: 'auto',
          timestamp: Date.now()
        });
        console.log(`🆕 Set new tab ${tabId} state:`, this.tabStates.get(tabId));
        
        if (this.currentProfile !== 'direct') {
          console.log(`🔄 Switching global proxy to direct for new tab ${tabId}`);
          await this.switchToProfile('direct', false, null, false);
    }
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

  async setTabProxy(tabId, profileName, setBy = 'manual') {
    console.log(`🔧 setTabProxy called: tabId=${tabId}, profileName=${profileName}, setBy=${setBy}`);
    
    // 显示当前标签页状态
    const currentTabState = this.tabStates.get(tabId);
    console.log(`📋 Current tab state before setTabProxy:`, currentTabState);
    console.log(`🌐 Current global proxy:`, this.currentProfile);
    
    // 获取当前标签页信息
    let currentUrl = null;
    try {
      const tab = await chrome.tabs.get(tabId);
      currentUrl = tab.url;
      console.log(`📄 Current tab URL:`, currentUrl);
    } catch (error) {
      console.warn('Could not get tab URL:', error);
    }
    
    if (setBy === 'manual' && currentUrl && !currentUrl.startsWith('chrome://') && !currentUrl.startsWith('chrome-extension://')) {
      // 手工切换：直接调用统一的切换逻辑
      console.log(`🔄 Manual switch: forcing ${profileName} for ${currentUrl}`);
      await this.handleNavigationIntercept(tabId, currentUrl, profileName); // 传入强制的代理配置
      return true;
    } else {
      // 其他情况：只切换代理，不重定向
      const success = await this.switchToProfile(profileName, setBy === 'manual', null, true);
      if (success) {
        // 记录标签页状态
        this.tabStates.set(tabId, {
          proxy: profileName,
          setBy: setBy,
          timestamp: Date.now(),
          lastProcessedUrl: currentUrl
        });
      }
      return success;
    }
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
      
      // 异步更新其他状态，完全不阻塞
      setTimeout(() => {
        Promise.all([
          this.saveProfiles(),
      chrome.runtime.sendMessage({
        action: 'profileSwitched',
        profileName: profileName
      }).catch(() => {
        // 忽略错误，popup可能没有打开
          })
        ]).catch(error => {
          console.warn('Non-critical update failed:', error);
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

  async switchProxyAndRedirect(tabId, targetProfile, url, setBy) {
    try {
      console.log(`🔄 Switching proxy and redirecting: ${targetProfile} → ${url}`);
      
      // 防止重复处理同一个URL（手工切换除外）
      const tabState = this.tabStates.get(tabId);
      if (setBy !== 'manual' && tabState && tabState.lastProcessedUrl === url && tabState.proxy === targetProfile) {
        console.log(`✅ URL already processed with correct proxy: ${url}`);
        return;
      }
      
      // 1. 切换代理
      const success = await this.switchToProfile(targetProfile, false, null, false);
      if (!success) {
        console.error(`❌ Failed to switch proxy to ${targetProfile}`);
        return;
      }
      
      // 2. 等待代理切换确认生效
      console.log(`⏳ Waiting for proxy switch confirmation...`);
      const confirmed = await this.waitForProxySwitch(targetProfile);
      if (!confirmed) {
        console.error(`❌ Proxy switch confirmation failed for ${targetProfile}`);
        return;
      }
      
      // 3. 更新标签页状态
      console.log(`📝 About to update tab ${tabId} state: proxy=${targetProfile}, setBy=${setBy}, url=${url}`);
      this.tabStates.set(tabId, {
        proxy: targetProfile,
        setBy: setBy || 'auto', // 使用传入的setBy参数
        timestamp: Date.now(),
        lastProcessedUrl: url,
        redirecting: true // 标记正在重定向
      });
      console.log(`📝 Updated tab ${tabId} state:`, this.tabStates.get(tabId));
      
      // 4. 确认代理生效后再重新导航
      try {
        console.log(`🧭 Proxy confirmed, redirecting to: ${url}`);
        await chrome.tabs.update(tabId, { url: url });
        console.log(`✅ Proxy switched and redirected successfully`);
        
        // 清除重定向标记
        const currentState = this.tabStates.get(tabId);
        if (currentState) {
          delete currentState.redirecting;
        }
      } catch (error) {
        console.error('Error during redirect:', error);
        // 清除重定向标记
        const currentState = this.tabStates.get(tabId);
        if (currentState) {
          delete currentState.redirecting;
        }
      }
      
    } catch (error) {
      console.error('Error in switchProxyAndRedirect:', error);
    }
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