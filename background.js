// ProxyMaster Background Service Worker
class ProxyManager {
  constructor() {
    this.profiles = new Map();
    this.currentProfile = null;
    this.autoSwitchRules = [];
    this.performanceStats = new Map();
    this.contextMenuListenerAdded = false;
    this.tabStates = new Map(); // 记录每个标签页的代理状态
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
  }

  async saveProfiles() {
    const profilesObj = Object.fromEntries(this.profiles);
    await chrome.storage.sync.set({
      profiles: profilesObj,
      currentProfile: this.currentProfile
    });
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
    // 监听标签页更新 - 在页面开始加载时就切换代理
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // 当URL发生变化时立即处理（页面开始导航）
      if (changeInfo.url && !changeInfo.url.startsWith('chrome://')) {
        console.log(`Tab ${tabId} navigating to: ${changeInfo.url}`);
        this.handleTabUpdate({ id: tabId, url: changeInfo.url });
      }
      // 也处理页面加载完成的情况（兜底）
      else if (changeInfo.status === 'loading' && tab.url && !tab.url.startsWith('chrome://')) {
        console.log(`Tab ${tabId} loading: ${tab.url}`);
        this.handleTabUpdate(tab);
      }
    });

    // 监听标签页创建 - 新标签页立即处理
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.url && !tab.url.startsWith('chrome://') && tab.url !== 'chrome://newtab/') {
        console.log(`New tab created: ${tab.url}`);
        this.handleTabUpdate(tab);
      }
    });

    // 监听导航开始 - 确保在请求发出前切换代理
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0 && !details.url.startsWith('chrome://')) {
        console.log(`Navigation starting to: ${details.url}`);
        this.handleTabUpdate({ id: details.tabId, url: details.url });
      }
    });

    // 监听标签页关闭，清理状态
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabStates.delete(tabId);
      console.log(`Tab ${tabId} closed, state cleaned up`);
    });

    // 监听网络请求
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleWebRequest(details),
      { urls: ['<all_urls>'] },
      ['requestBody']
    );

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

  async handleTabUpdate(tab) {
    try {
      // 快速检查：如果自动切换被禁用，直接返回
      const autoSwitchEnabled = await this.isAutoSwitchEnabled();
      if (!autoSwitchEnabled) {
        console.log('Auto switch is disabled');
        return;
      }

      // 获取当前标签页状态
      const currentTabState = this.tabStates.get(tab.id);
      console.log(`Tab ${tab.id} current state:`, currentTabState);

      // 立即进行规则匹配
      const matchedRule = this.findMatchingRule(tab.url);
      
      if (matchedRule) {
        // 找到匹配规则
        const targetProfile = matchedRule.profile;
        
        // 检查是否可以更新：只有非手工设置的标签页才能被自动更新
        if (!currentTabState || currentTabState.setBy !== 'manual') {
          if (!currentTabState || currentTabState.proxy !== targetProfile) {
            console.log(`🚀 Auto switching tab ${tab.id} to ${targetProfile} for ${tab.url}`);
            await this.setTabProxy(tab.id, targetProfile, 'auto');
          }
        } else {
          console.log(`🛡️ Tab ${tab.id} is manually set to ${currentTabState.proxy}, skipping auto switch`);
        }
      } else {
        // 没有找到匹配规则，检查是否需要回退到直连
        const enableAutoFallback = await this.isAutoFallbackEnabled();
        
        if (enableAutoFallback) {
          // 只有非手工设置的标签页才能自动回退到直连
          if (!currentTabState || currentTabState.setBy !== 'manual') {
            if (!currentTabState || currentTabState.proxy !== 'direct') {
              console.log(`🔄 Auto fallback tab ${tab.id} to direct connection for ${tab.url}`);
              await this.setTabProxy(tab.id, 'direct', 'auto');
            }
          } else {
            console.log(`🛡️ Tab ${tab.id} is manually set to ${currentTabState.proxy}, skipping auto fallback`);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleTabUpdate:', error);
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
    console.log(`Setting tab ${tabId} proxy to: ${profileName} (${setBy})`);
    
    // 记录标签页状态
    this.tabStates.set(tabId, {
      proxy: profileName,
      setBy: setBy,
      timestamp: Date.now()
    });

    // 切换全局代理
    const success = await this.switchToProfile(profileName, setBy === 'manual');
    
    return success;
  }

  async switchToProfile(profileName, isManual = true) {
    console.log(`Switching to profile: ${profileName} (${isManual ? 'manual' : 'auto'})`);
    
    // 对于直连模式，不需要检查profile是否存在
    if (profileName !== 'direct') {
      const profile = this.profiles.get(profileName);
      if (!profile) {
        console.error(`Profile ${profileName} not found`);
        return false;
      }
    }

    try {
      this.currentProfile = profileName;
      
      if (profileName === 'direct') {
        // 直连模式 - 清除所有代理设置
        console.log('Clearing proxy settings for direct connection');
        await chrome.proxy.settings.clear({
          scope: 'regular'
        });
        
        // 额外确保清除代理
        await chrome.proxy.settings.set({
          value: { mode: 'direct' },
          scope: 'regular'
        });
        
        console.log('Direct connection activated');
      } else {
        // 代理模式
        const profile = this.profiles.get(profileName);
        console.log('Setting proxy config:', profile);
        
        const config = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: {
              scheme: profile.protocol,
              host: profile.host,
              port: profile.port
            }
          }
        };

        if (profile.auth) {
          // 处理代理认证
          this.setupProxyAuth(profile.auth);
        }

        await chrome.proxy.settings.set({
          value: config,
          scope: 'regular'
        });
        
        console.log('Proxy connection activated');
      }

      await this.saveProfiles();
      this.updateBadge(profileName);
      
      // 只有手工切换才刷新页面
      if (isManual) {
        await this.refreshCurrentTab();
      }
      
      // 发送通知给popup更新状态
      chrome.runtime.sendMessage({
        action: 'profileSwitched',
        profileName: profileName
      }).catch(() => {
        // 忽略错误，popup可能没有打开
      });
      
      return true;
    } catch (error) {
      console.error('Error switching profile:', error);
      return false;
    }
  }



  setupProxyAuth(auth) {
    chrome.webRequest.onAuthRequired.addListener(
      (details) => {
        return {
          authCredentials: {
            username: auth.username,
            password: auth.password
          }
        };
      },
      { urls: ['<all_urls>'] },
      ['blocking']
    );
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
    
    // 简化网络请求处理，不再需要复杂的标签页代理逻辑
    // 因为我们现在通过刷新页面来确保代理一致性
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
          let currentTabId = null;
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

          let success;
          if (currentTabId) {
            success = await this.setTabProxy(currentTabId, message.profileName, 'manual');
          } else {
            success = await this.switchToProfile(message.profileName, true);
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

  async refreshCurrentTab() {
    try {
      console.log('🔄 Starting refreshCurrentTab...');
      
      // 首先尝试获取当前活跃的标签页
      let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log(`Found ${tabs.length} active tabs in current window`);
      
      // 如果当前活跃的是扩展页面，尝试获取最近访问的网页标签页
      if (tabs.length === 0 || tabs[0].url.startsWith('chrome-extension://')) {
        console.log('Current tab is extension page, looking for web tabs...');
        // 获取所有标签页，按最近访问时间排序
        tabs = await chrome.tabs.query({});
        tabs = tabs
          .filter(tab => {
            const url = tab.url;
            return !url.startsWith('chrome://') && 
                   !url.startsWith('chrome-extension://') && 
                   !url.startsWith('edge://') && 
                   !url.startsWith('about:') && 
                   !url.startsWith('moz-extension://') && 
                   url !== 'chrome://newtab/' && 
                   url !== '';
          })
          .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        
        console.log(`Found ${tabs.length} web tabs`);
      }
      
      if (tabs.length > 0) {
        const targetTab = tabs[0];
        const url = targetTab.url;
        console.log(`Target tab URL: ${url}`);
        
        // 再次检查是否需要跳过
        const shouldSkip = 
          url.startsWith('chrome://') ||           // Chrome内部页面
          url.startsWith('chrome-extension://') ||  // 扩展页面
          url.startsWith('edge://') ||              // Edge内部页面
          url.startsWith('about:') ||               // Firefox内部页面
          url.startsWith('moz-extension://') ||     // Firefox扩展页面
          url === 'chrome://newtab/' ||             // 新标签页
          url === '';                               // 空页面
        
        if (!shouldSkip) {
          console.log(`🔄 Refreshing tab: ${url}`);
          await chrome.tabs.reload(targetTab.id);
          console.log('✅ Tab refreshed successfully');
          this.showNotification('代理已切换，页面已刷新');
        } else {
          console.log(`⏭️ Skipping refresh for: ${url}`);
          this.showNotification('代理已切换');
        }
      } else {
        console.log('❌ No suitable tabs found for refresh');
        this.showNotification('代理已切换');
      }
    } catch (error) {
      console.error('Error refreshing current tab:', error);
      // 即使刷新失败，也要通知用户代理已切换
      this.showNotification('代理已切换');
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