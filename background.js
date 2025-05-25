// ProxyMaster Background Service Worker
class ProxyManager {
  constructor() {
    this.profiles = new Map();
    this.currentProfile = null;
    this.autoSwitchRules = [];
    this.performanceStats = new Map();
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
  }

  setupEventListeners() {
    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tab);
      }
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

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  async handleTabUpdate(tab) {
    // 智能代理切换逻辑
    const matchedRule = this.findMatchingRule(tab.url);
    if (matchedRule && matchedRule.profile !== this.currentProfile) {
      await this.switchToProfile(matchedRule.profile);
      this.showNotification(`已自动切换到代理: ${matchedRule.profile}`);
    }
  }

  findMatchingRule(url) {
    // 只处理启用的规则，按优先级排序
    const enabledRules = this.autoSwitchRules
      .filter(rule => rule.enabled)
      .sort((a, b) => (b.priority || 100) - (a.priority || 100));
    
    for (const rule of enabledRules) {
      if (this.matchesRule(url, rule)) {
        console.log(`Rule matched: ${rule.name} for ${url}`);
        return rule;
      }
    }
    return null;
  }

  matchesRule(url, rule) {
    try {
      const urlObj = new URL(url);
      switch (rule.type) {
        case 'domain':
          return this.matchDomain(urlObj.hostname, rule.pattern);
        case 'url':
          return this.wildcardMatch(url, rule.pattern);
        case 'wildcard':
          return this.wildcardMatch(url, rule.pattern);
        case 'regex':
          return new RegExp(rule.pattern).test(url);
        default:
          return false;
      }
    } catch (e) {
      console.error('Rule matching error:', e);
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

  handleWebRequest(details) {
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
          sendResponse({
            profiles: Object.fromEntries(this.profiles),
            currentProfile: this.currentProfile
          });
          break;
          
        case 'switchProfile':
          const success = await this.switchToProfile(message.profileName);
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