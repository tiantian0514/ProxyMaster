// ProxyMaster Background Service Worker
class ProxyManager {
  constructor() {
    this.profiles = new Map();
    this.currentProfile = null;
    this.autoSwitchRules = [];
    this.performanceStats = new Map();
    this.contextMenuListenerAdded = false;
    this.tabProxyStates = new Map(); // 存储每个标签页的代理状态
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
    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        console.log(`Tab updated: ${tab.url}`);
        this.handleTabUpdate(tab);
      }
    });

    // 监听标签页关闭，清理状态
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabProxyStates.delete(tabId);
      console.log(`Tab ${tabId} closed, proxy state cleaned up`);
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
    // 检查是否启用了自动切换
    const settings = await chrome.storage.sync.get(['enableAutoSwitch', 'enableAutoFallback']);
    if (settings.enableAutoSwitch === false) {
      console.log('Auto switch is disabled');
      return;
    }

    // 获取当前标签页的代理状态
    const currentTabProxy = this.tabProxyStates.get(tab.id);
    console.log(`Tab ${tab.id} current proxy state:`, currentTabProxy);

    // 智能代理切换逻辑
    const matchedRule = this.findMatchingRule(tab.url);
    
    if (matchedRule) {
      // 找到匹配规则，为该标签页设置指定代理
      const targetProfile = matchedRule.profile;
      if (!currentTabProxy || currentTabProxy.profile !== targetProfile) {
        console.log(`Auto switching tab ${tab.id} from ${currentTabProxy?.profile || 'unknown'} to ${targetProfile} for ${tab.url}`);
        await this.setTabProxy(tab.id, targetProfile, 'auto');
        this.showNotification(`已自动切换到代理: ${targetProfile}`);
      }
    } else {
      // 没有找到匹配规则，检查是否需要回退到直连
      const enableAutoFallback = settings.enableAutoFallback !== false; // 默认启用
      
      if (enableAutoFallback && currentTabProxy && currentTabProxy.profile !== 'direct') {
        console.log(`No rule matched for ${tab.url}, falling back to direct connection for tab ${tab.id}`);
        await this.setTabProxy(tab.id, 'direct', 'auto');
        this.showNotification('已自动切换到直连');
      } else if (!currentTabProxy) {
        // 新标签页，没有规则匹配，设置为直连
        await this.setTabProxy(tab.id, 'direct', 'auto');
      }
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

  async setTabProxy(tabId, profileName, switchType = 'manual') {
    console.log(`Setting tab ${tabId} proxy to: ${profileName} (${switchType})`);
    
    // 记录标签页的代理状态
    this.tabProxyStates.set(tabId, {
      profile: profileName,
      switchType: switchType,
      timestamp: Date.now()
    });

    // 更新全局代理设置（这里仍然需要全局设置，但我们会在网络请求时进行过滤）
    return await this.switchToProfile(profileName);
  }

  async switchToProfile(profileName) {
    console.log(`Switching to profile: ${profileName}`);
    
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
    const badgeText = profileName === 'direct' ? '' : profileName.substring(0, 3);
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
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

    // 处理按标签页的代理逻辑
    if (details.tabId && details.tabId > 0) {
      const tabProxyState = this.tabProxyStates.get(details.tabId);
      if (tabProxyState) {
        console.log(`Request from tab ${details.tabId} (${details.url}) using proxy: ${tabProxyState.profile}`);
        
        // 如果当前全局代理与标签页代理不一致，需要切换
        if (tabProxyState.profile !== this.currentProfile) {
          console.log(`Switching global proxy from ${this.currentProfile} to ${tabProxyState.profile} for tab ${details.tabId}`);
          await this.switchToProfile(tabProxyState.profile);
        }
      }
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getProfiles':
          sendResponse({
            profiles: Object.fromEntries(this.profiles),
            currentProfile: this.currentProfile
          });
          break;
          
        case 'switchProfile':
          const success = await this.switchToProfile(message.profileName);
          
          // 如果是手动切换，获取当前活跃标签页并记录状态
          if (success && message.tabId) {
            await this.setTabProxy(message.tabId, message.profileName, 'manual');
          } else if (success) {
            // 如果没有指定tabId，获取当前活跃标签页
            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0) {
                await this.setTabProxy(tabs[0].id, message.profileName, 'manual');
              }
            } catch (error) {
              console.warn('Could not get active tab for manual switch:', error);
            }
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
          // 获取所有标签页的代理状态
          const tabStates = Object.fromEntries(this.tabProxyStates);
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