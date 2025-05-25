// ProxyMaster Popup Script
class PopupManager {
  constructor() {
    this.profiles = {};
    this.currentProfile = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.renderProfiles();
    this.updateStatus(); // 确保状态更新
    this.updateStats();
    this.hideLoading();
  }

  async loadData() {
    try {
      // 添加超时和重试机制
      const response = await this.sendMessageWithRetry({ action: 'getProfiles' });
      
      console.log('Raw response from background:', response);
      
      this.profiles = response.profiles || {};
      this.currentProfile = response.currentProfile || 'direct';
      
      // 确保直连配置存在
      if (!this.profiles.direct) {
      this.profiles.direct = {
        name: 'direct',
          displayName: i18n('directConnection'),
        type: 'direct'
      };
      }
      
      console.log('Loaded data:', {
        profiles: Object.keys(this.profiles),
        currentProfile: this.currentProfile,
        profilesData: this.profiles
      });
    } catch (error) {
      console.error('Failed to load profiles:', error);
      this.showError(i18n('loadFailed') + ': ' + error.message);
      
      // 设置默认值以防加载失败
      this.profiles = {
        direct: {
          name: 'direct',
          displayName: i18n('directConnection'),
          type: 'direct'
        }
      };
      this.currentProfile = 'direct';
    }
  }

  async sendMessageWithRetry(message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (response) {
          return response;
        }
        throw new Error('No response received');
      } catch (error) {
        console.warn(`Message attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          throw error;
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  setupEventListeners() {
    // 新建配置按钮
    document.getElementById('addProfileBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'options.html#new-profile' });
      window.close();
    });

    // 测试代理按钮
    document.getElementById('testProxyBtn').addEventListener('click', () => {
      this.testCurrentProxy();
    });

    // 智能切换按钮
    document.getElementById('autoSwitchBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'options.html#auto-switch' });
      window.close();
    });

    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'options.html' });
      window.close();
    });

    // 帮助按钮
    document.getElementById('helpBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/tiantian0514/ProxyMaster/wiki' });
      window.close();
    });

    // 关于按钮
    document.getElementById('aboutBtn').addEventListener('click', () => {
      this.showAbout();
    });

    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'profileSwitched') {
        console.log('Received profileSwitched message:', message.profileName);
        this.currentProfile = message.profileName;
        this.renderProfiles();
        this.updateStatus();
      }
    });
  }

  renderProfiles() {
    const profileList = document.getElementById('profileList');
    profileList.innerHTML = '';

    console.log('Rendering profiles:', {
      profileCount: Object.keys(this.profiles).length,
      currentProfile: this.currentProfile,
      profiles: this.profiles
    });

    if (Object.keys(this.profiles).length === 0) {
      this.showEmptyState();
      this.updateStatus();
      return;
    }

    // 确保直连配置存在
    if (!this.profiles.direct) {
      this.profiles.direct = {
        name: 'direct',
        displayName: i18n('directConnection'),
        type: 'direct'
      };
    }

    // 渲染直连配置
    this.renderProfileItem('direct', this.profiles.direct);

    // 渲染其他配置
    Object.entries(this.profiles).forEach(([name, profile]) => {
      if (name !== 'direct') {
        this.renderProfileItem(name, profile);
      }
    });

    this.updateStatus();
  }

  renderProfileItem(name, profile) {
    const profileList = document.getElementById('profileList');
    const isActive = name === this.currentProfile;
    
    const profileElement = document.createElement('div');
    profileElement.className = `profile-item ${isActive ? 'active' : ''}`;
    profileElement.dataset.profileName = name;

    const displayName = profile.displayName || profile.name || name;
    const details = this.getProfileDetails(profile);

    profileElement.innerHTML = `
      <div class="profile-info">
        <div class="profile-name">${displayName}</div>
        <div class="profile-details">${details}</div>
      </div>
      <div class="profile-status ${isActive ? 'active' : ''}"></div>
    `;

    profileElement.addEventListener('click', () => {
      this.switchProfile(name);
    });

    profileList.appendChild(profileElement);
  }

  getProfileDetails(profile) {
    if (profile.type === 'direct') {
      return i18n('directConnectionDesc');
    }
    
    const protocol = profile.protocol || 'http';
    const host = profile.host || '';
    const port = profile.port || '';
    
    if (host && port) {
      return `${protocol.toUpperCase()}://${host}:${port}`;
    }
    
    return i18n('incompleteConfig');
  }

  async testCurrentProxy() {
    try {
      this.showLoading();
      
      // 通过background script进行代理测试
      const response = await this.sendMessageWithRetry({
        action: 'testProxy',
        profileName: this.currentProfile
      });
      
      if (response && response.success) {
        this.showSuccess(`${i18n('testSuccess')} - IP: ${response.ip || i18n('unknownError')}`);
      } else {
        this.showError(i18n('testFailed') + ': ' + (response?.error || i18n('unknownError')));
      }
    } catch (error) {
      console.error('Proxy test failed:', error);
      this.showError(i18n('testFailed') + ': ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async switchProfile(profileName) {
    console.log(`Attempting to switch to profile: ${profileName}`);
    
    if (profileName === this.currentProfile) {
      console.log('Already using this profile');
      return;
    }

    try {
      this.showLoading();
      
      // 获取当前活跃标签页信息
      let currentTabId = null;
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
          currentTabId = tabs[0].id;
        }
      } catch (error) {
        console.warn('Could not get current tab:', error);
      }
      
      const response = await this.sendMessageWithRetry({
        action: 'switchProfile',
        profileName: profileName,
        tabId: currentTabId,
        isManual: true
      });

      console.log('Switch response:', response);

      if (response && response.success) {
        // 立即更新当前代理状态
        this.currentProfile = response.currentProfile || profileName;
        console.log('Switch successful, updating to:', this.currentProfile);
        
        // 立即更新显示
        this.renderProfiles();
        this.updateStatus();
        
        const displayName = profileName === 'direct' ? i18n('directConnection') : 
          (this.profiles[profileName]?.displayName || profileName);
        this.showSuccess(`${i18n('switchSuccess')}: ${displayName}`);
        
        // 更新切换计数
        await this.incrementSwitchCount();
      } else {
        this.showError(i18n('switchFailed') + ': ' + (response?.error || i18n('unknownError')));
      }
    } catch (error) {
      console.error('Failed to switch profile:', error);
      this.showError(i18n('switchFailed') + ': ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async incrementSwitchCount() {
    try {
      const result = await chrome.storage.local.get(['dailySwitchCount', 'lastResetDate']);
      const today = new Date().toDateString();
      
      let switchCount = result.dailySwitchCount || 0;
      
      if (result.lastResetDate !== today) {
        switchCount = 1;
        await chrome.storage.local.set({
          dailySwitchCount: switchCount,
          lastResetDate: today
        });
      } else {
        switchCount++;
        await chrome.storage.local.set({
          dailySwitchCount: switchCount
        });
      }
      
      document.getElementById('switchCount').textContent = this.formatNumber(switchCount);
    } catch (error) {
      console.error('Failed to update switch count:', error);
    }
  }

  updateStatus() {
    const statusElement = document.getElementById('currentStatus');
    
    console.log('Updating status:', {
      currentProfile: this.currentProfile,
      profiles: Object.keys(this.profiles)
    });
    
    if (!this.currentProfile) {
      statusElement.textContent = i18n('loading');
      return;
    }
    
    if (this.currentProfile === 'direct') {
      statusElement.textContent = `${i18n('currentStatus')}: ${i18n('directConnection')}`;
    } else {
      const currentProfileData = this.profiles[this.currentProfile];
      if (currentProfileData) {
        const displayName = currentProfileData.displayName || currentProfileData.name || this.currentProfile;
        // 提取前2个字符作为简短显示
        const shortName = this.currentProfile.substring(0, 2).toUpperCase();
        statusElement.innerHTML = `${i18n('currentStatus')}: <span style="font-size: 16px; font-weight: bold; color: #667eea;">${shortName}</span> (${displayName})`;
      } else {
        // 如果找不到配置数据，显示配置名称的前2个字符
        const shortName = this.currentProfile.substring(0, 2).toUpperCase();
        statusElement.innerHTML = `${i18n('currentStatus')}: <span style="font-size: 16px; font-weight: bold; color: #667eea;">${shortName}</span>`;
      }
    }
  }

  async updateStats() {
    try {
      const stats = await this.sendMessageWithRetry({ action: 'getPerformanceStats' });
      
      // 计算今日请求数
      const totalRequests = Object.values(stats).reduce((sum, stat) => sum + stat.requests, 0);
      document.getElementById('requestCount').textContent = this.formatNumber(totalRequests);
      
      // 从存储中获取切换次数
      const result = await chrome.storage.local.get(['dailySwitchCount', 'lastResetDate']);
      const today = new Date().toDateString();
      
      if (result.lastResetDate !== today) {
        // 新的一天，重置计数
        await chrome.storage.local.set({
          dailySwitchCount: 0,
          lastResetDate: today
        });
        document.getElementById('switchCount').textContent = '0';
      } else {
        document.getElementById('switchCount').textContent = this.formatNumber(result.dailySwitchCount || 0);
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  showEmptyState() {
    const profileList = document.getElementById('profileList');
    profileList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔧</div>
        <div>${i18n('noProfiles')}</div>
        <div style="font-size: 10px; margin-top: 4px;">${i18n('noProfilesDesc')}</div>
      </div>
    `;
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    // 创建简单的toast通知
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#f44336' : '#4CAF50'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      animation: slideDown 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  showAbout() {
    const aboutHtml = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      " id="aboutModal">
        <div style="
          background: white;
          padding: 24px;
          border-radius: 8px;
          max-width: 280px;
          text-align: center;
        ">
          <h3 style="margin-bottom: 16px; color: #333;">ProxyMaster</h3>
          <p style="margin-bottom: 12px; font-size: 14px; color: #666;">
            ${i18n('version')} 1.0.0
          </p>
          <p style="margin-bottom: 16px; font-size: 12px; color: #999;">
            ${i18n('moreFeatures')}<br>
            ${i18n('supportFeatures')}
          </p>
          <button onclick="document.getElementById('aboutModal').remove()" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">${i18n('confirm')}</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', aboutHtml);
  }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;
document.head.appendChild(style);

// 初始化弹出窗口管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 