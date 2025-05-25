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
    this.updateStats();
    this.hideLoading();
  }

  async loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProfiles' });
      this.profiles = response.profiles || {};
      this.currentProfile = response.currentProfile || 'direct';
      
      // 添加默认的直连配置
      if (!this.profiles.direct) {
        this.profiles.direct = {
          name: 'direct',
          displayName: '直接连接',
          type: 'direct'
        };
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
      this.showError('加载配置失败');
    }
  }

  setupEventListeners() {
    // 新建配置按钮
    document.getElementById('addProfileBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'options.html#new-profile' });
      window.close();
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
      chrome.tabs.create({ url: 'https://github.com/your-username/proxymaster/wiki' });
      window.close();
    });

    // 关于按钮
    document.getElementById('aboutBtn').addEventListener('click', () => {
      this.showAbout();
    });
  }

  renderProfiles() {
    const profileList = document.getElementById('profileList');
    profileList.innerHTML = '';

    if (Object.keys(this.profiles).length === 0) {
      this.showEmptyState();
      return;
    }

    // 渲染直连配置
    this.renderProfileItem('direct', this.profiles.direct || {
      name: 'direct',
      displayName: '直接连接',
      type: 'direct'
    });

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
      return '直接连接到互联网';
    }
    
    const protocol = profile.protocol || 'http';
    const host = profile.host || '';
    const port = profile.port || '';
    
    if (host && port) {
      return `${protocol.toUpperCase()}://${host}:${port}`;
    }
    
    return '配置不完整';
  }

  async switchProfile(profileName) {
    if (profileName === this.currentProfile) {
      return;
    }

    try {
      this.showLoading();
      
      const response = await chrome.runtime.sendMessage({
        action: 'switchProfile',
        profileName: profileName
      });

      if (response.success) {
        this.currentProfile = profileName;
        this.renderProfiles();
        this.showSuccess(`已切换到: ${this.profiles[profileName]?.displayName || profileName}`);
      } else {
        this.showError('切换失败');
      }
    } catch (error) {
      console.error('Failed to switch profile:', error);
      this.showError('切换失败');
    } finally {
      this.hideLoading();
    }
  }

  updateStatus() {
    const statusElement = document.getElementById('currentStatus');
    const currentProfileData = this.profiles[this.currentProfile];
    
    if (this.currentProfile === 'direct') {
      statusElement.textContent = '当前: 直接连接';
    } else if (currentProfileData) {
      statusElement.textContent = `当前: ${currentProfileData.displayName || currentProfileData.name}`;
    } else {
      statusElement.textContent = '状态未知';
    }
  }

  async updateStats() {
    try {
      const stats = await chrome.runtime.sendMessage({ action: 'getPerformanceStats' });
      
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
        <div>还没有代理配置</div>
        <div style="font-size: 10px; margin-top: 4px;">点击"新建配置"开始使用</div>
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
            版本 1.0.0
          </p>
          <p style="margin-bottom: 16px; font-size: 12px; color: #999;">
            更强大的代理管理工具<br>
            支持智能切换和性能优化
          </p>
          <button onclick="document.getElementById('aboutModal').remove()" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">确定</button>
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