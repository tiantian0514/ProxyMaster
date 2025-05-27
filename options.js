// ProxyMaster Options Script
class OptionsManager {
  constructor() {
    this.profiles = {};
    this.currentProfile = null;
    this.rules = [];
    this.editingProfile = null;
    this.editingRuleIndex = null;
    this.rulesListenerAdded = false;
    this.profilesListenerAdded = false;
    this.v2rayManager = null;
    this.subscriptions = [];
    this.selectedNode = null;
    this.init();
  }

  async init() {
    // 初始化V2Ray管理器
    if (typeof V2RaySubscriptionManager !== 'undefined') {
      this.v2rayManager = new V2RaySubscriptionManager();
      await this.loadV2RayData();
    }
    
    await this.loadData();
    this.setupEventListeners();
    this.setupButtonListeners();
    this.renderProfiles();
    this.renderRules();
    this.renderV2RaySubscriptions();
    this.updateStats();
    this.loadSettings();
    this.handleUrlHash(); // 处理URL锚点
  }

  async loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProfiles' });
      this.profiles = response.profiles || {};
      this.currentProfile = response.currentProfile || 'direct';

      const rulesResult = await chrome.storage.sync.get(['autoSwitchRules']);
      this.rules = rulesResult.autoSwitchRules || [];
    } catch (error) {
      console.error('Failed to load data:', error);
              this.showToast(chrome.i18n.getMessage('loadFailed'), 'error');
    }
  }

  setupEventListeners() {
    // 标签页切换
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // 监听浏览器前进/后退按钮
    window.addEventListener('hashchange', () => {
      this.handleUrlHash();
    });

    // 配置表单提交
    document.getElementById('profileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveProfile();
    });

    // 规则表单提交
    document.getElementById('ruleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRule();
    });

    // 规则类型变化时更新帮助文本
    document.getElementById('ruleType').addEventListener('change', (e) => {
      this.updatePatternHelp(e.target.value);
    });

    // 协议类型变化时切换配置字段
    document.getElementById('profileProtocol').addEventListener('change', (e) => {
      this.toggleProtocolFields(e.target.value);
    });

    // 模态框外部点击关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
  }

  setupButtonListeners() {
    // 新建配置按钮
    document.getElementById('addProfileBtn')?.addEventListener('click', () => {
      this.showAddProfileModal();
    });

    // 新建规则按钮
    document.getElementById('addRuleBtn')?.addEventListener('click', () => {
      this.showAddRuleModal();
    });

    // 导出配置按钮
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportData();
    });

    // 导入配置按钮
    document.getElementById('importBtn')?.addEventListener('click', () => {
      this.importData();
    });

    // 清除数据按钮
    document.getElementById('clearDataBtn')?.addEventListener('click', () => {
      this.clearAllData();
    });

    // 保存设置按钮
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // 模态框关闭按钮
    document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => {
      this.closeModal('addProfileModal');
    });

    document.getElementById('cancelProfileBtn')?.addEventListener('click', () => {
      this.closeModal('addProfileModal');
    });

    // 规则模态框关闭按钮
    document.getElementById('closeRuleModalBtn')?.addEventListener('click', () => {
      this.closeModal('addRuleModal');
    });

    document.getElementById('cancelRuleBtn')?.addEventListener('click', () => {
      this.closeModal('addRuleModal');
    });

    // V2Ray订阅相关按钮
    document.getElementById('addSubscriptionBtn')?.addEventListener('click', () => {
      this.showAddSubscriptionModal();
    });

    document.getElementById('closeSubscriptionModalBtn')?.addEventListener('click', () => {
      this.closeModal('addSubscriptionModal');
    });

    document.getElementById('cancelSubscriptionBtn')?.addEventListener('click', () => {
      this.closeModal('addSubscriptionModal');
    });

    document.getElementById('closeNodeDetailModalBtn')?.addEventListener('click', () => {
      this.closeModal('nodeDetailModal');
    });

    // V2Ray订阅表单提交
    document.getElementById('subscriptionForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addSubscription();
    });

    // 订阅添加方式切换
    document.querySelectorAll('input[name="addMethod"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleSubscriptionInputMethod(e.target.value);
      });
    });
  }

  switchTab(tabName) {
    // 更新标签按钮状态
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
  }

  // 处理URL锚点，自动跳转到对应标签页
  handleUrlHash() {
    const hash = window.location.hash.substring(1); // 移除 # 号
    console.log('Current URL hash:', hash);
    
    // 定义锚点到标签页的映射
    const hashToTab = {
      'auto-switch': 'rules',
      'rules': 'rules',
      'profiles': 'profiles',
      'v2ray': 'v2ray',
      'stats': 'stats',
      'settings': 'settings',
      'new-profile': 'profiles'
    };
    
    if (hash && hashToTab[hash]) {
      console.log(`Switching to tab: ${hashToTab[hash]} based on hash: ${hash}`);
      this.switchTab(hashToTab[hash]);
      
      // 如果是新建配置的锚点，自动打开新建配置模态框
      if (hash === 'new-profile') {
        setTimeout(() => {
          this.showAddProfileModal();
        }, 100);
      }
    } else {
      // 默认显示第一个标签页（代理配置）
      this.switchTab('profiles');
    }
  }

  renderProfiles() {
    const profileList = document.getElementById('profileList');
    profileList.innerHTML = '';

    if (Object.keys(this.profiles).length === 0) {
      profileList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔧</div>
          <h4>还没有代理配置</h4>
          <p>点击"新建配置"按钮开始添加你的第一个代理服务器</p>
        </div>
      `;
      return;
    }

    Object.entries(this.profiles).forEach(([name, profile]) => {
      if (name === 'direct') return; // 跳过直连配置

      const isActive = name === this.currentProfile;
      const profileElement = document.createElement('div');
      profileElement.className = `profile-item ${isActive ? 'active' : ''}`;

      profileElement.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div class="status-indicator ${isActive ? '' : 'inactive'}"></div>
          <div class="profile-info">
            <h4>${profile.displayName || profile.name}</h4>
            <p>${profile.protocol?.toUpperCase() || 'HTTP'}://${profile.host}:${profile.port}</p>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-primary" data-action="switch" data-profile="${name}">
            ${isActive ? '当前' : '切换'}
          </button>
          <button class="btn btn-secondary" data-action="edit" data-profile="${name}">编辑</button>
          <button class="btn btn-danger" data-action="delete" data-profile="${name}">删除</button>
        </div>
      `;

      profileList.appendChild(profileElement);
    });

    // 只在第一次渲染时添加事件委托
    if (!this.profilesListenerAdded) {
    profileList.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const profileName = button.dataset.profile;

      switch (action) {
        case 'switch':
          this.switchToProfile(profileName);
          break;
        case 'edit':
          this.editProfile(profileName);
          break;
        case 'delete':
          this.deleteProfile(profileName);
          break;
      }
    });
      this.profilesListenerAdded = true;
    }
  }

  renderRules() {
    const rulesList = document.getElementById('rulesList');
    rulesList.innerHTML = '';

    if (this.rules.length === 0) {
      rulesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔄</div>
          <h4>还没有自动切换规则</h4>
          <p>添加规则让ProxyMaster自动为不同网站选择合适的代理</p>
        </div>
      `;
      return;
    }

    this.rules.forEach((rule, index) => {
      const ruleElement = document.createElement('div');
      ruleElement.className = `profile-item ${rule.enabled ? '' : 'inactive'}`;

      const typeNames = {
        'domain': '域名',
        'url': 'URL',
        'wildcard': '通配符',
        'regex': '正则'
      };

      const profileName = rule.profile === 'direct' ? chrome.i18n.getMessage('direct') : 
                         (this.profiles[rule.profile]?.displayName || rule.profile);

      ruleElement.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div class="status-indicator ${rule.enabled ? '' : 'inactive'}"></div>
          <div class="profile-info">
            <h4>${rule.name || rule.pattern}</h4>
            <p>${typeNames[rule.type] || rule.type}: ${rule.pattern}</p>
            <p style="font-size: 12px; color: #888;">代理: ${profileName} | 优先级: ${rule.priority}</p>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-secondary" data-action="toggle-rule" data-index="${index}">
            ${rule.enabled ? '禁用' : '启用'}
          </button>
          <button class="btn btn-secondary" data-action="edit-rule" data-index="${index}">编辑</button>
          <button class="btn btn-danger" data-action="delete-rule" data-index="${index}">删除</button>
        </div>
      `;

      rulesList.appendChild(ruleElement);
    });

    // 只在第一次渲染时添加事件委托
    if (!this.rulesListenerAdded) {
    rulesList.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const index = parseInt(button.dataset.index);

      switch (action) {
        case 'toggle-rule':
          this.toggleRule(index);
          break;
        case 'edit-rule':
          this.editRule(index);
          break;
        case 'delete-rule':
          this.deleteRule(index);
          break;
      }
    });
      this.rulesListenerAdded = true;
    }
  }

  async updateStats() {
    try {
      const stats = await chrome.runtime.sendMessage({ action: 'getPerformanceStats' });
      
      // 计算统计数据
      const totalRequests = Object.values(stats).reduce((sum, stat) => sum + stat.requests, 0);
      const activeProfiles = Object.keys(this.profiles).length;
      
      document.getElementById('totalRequests').textContent = this.formatNumber(totalRequests);
      document.getElementById('activeProfiles').textContent = activeProfiles;
      
      // 从存储中获取切换次数
      const result = await chrome.storage.local.get(['totalSwitchCount']);
      document.getElementById('totalSwitches').textContent = this.formatNumber(result.totalSwitchCount || 0);
      
      // 计算平均响应时间（模拟数据）
      document.getElementById('avgResponseTime').textContent = '120ms';
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

  async switchToProfile(profileName) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'switchProfile',
        profileName: profileName
      });

      if (response.success) {
        this.currentProfile = profileName;
        this.renderProfiles();
        this.showToast(`已切换到: ${this.profiles[profileName]?.displayName || profileName}`, 'success');
      } else {
        this.showToast('切换失败', 'error');
      }
    } catch (error) {
      console.error('Failed to switch profile:', error);
      this.showToast('切换失败', 'error');
    }
  }

  async saveProfile() {
    const protocol = document.getElementById('profileProtocol').value;
    const isV2RayProtocol = ['vmess', 'vless', 'trojan', 'shadowsocks'].includes(protocol);
    
    // 获取基本表单数据
    const name = document.getElementById('profileName').value.trim();
    const displayName = document.getElementById('profileDisplayName').value.trim();
    
    let host, port, profile;
    
    if (isV2RayProtocol) {
      // V2Ray协议配置
      host = document.getElementById('v2rayHost').value.trim();
      port = document.getElementById('v2rayPort').value;
      const id = document.getElementById('v2rayId').value.trim();
      const network = document.getElementById('v2rayNetwork').value;
      const tls = document.getElementById('v2rayTls').checked;
      
      // 验证必填字段
      if (!name) {
        this.showToast('请输入配置名称', 'error');
        return;
      }
      if (!host) {
        this.showToast('请输入服务器地址', 'error');
        return;
      }
      if (!port || isNaN(port) || port < 1 || port > 65535) {
        this.showToast('请输入有效的端口号 (1-65535)', 'error');
        return;
      }
      if (!id) {
        this.showToast('请输入用户ID或密码', 'error');
        return;
      }
      
      // 构建V2Ray配置
      profile = {
        name: name,
        displayName: displayName || name,
        protocol: protocol,
        host: host,
        port: parseInt(port),
        type: 'v2ray',
        v2rayConfig: {
          id: id,
          network: network,
          tls: tls
        }
      };
      
      // 添加协议特定配置
      if (protocol === 'vmess') {
        const alterId = parseInt(document.getElementById('v2rayAlterId').value) || 0;
        profile.v2rayConfig.alterId = alterId;
        profile.v2rayConfig.security = 'auto';
      } else if (protocol === 'shadowsocks') {
        const method = document.getElementById('v2rayMethod').value;
        profile.v2rayConfig.method = method;
        profile.v2rayConfig.password = id; // 对于SS，id字段存储密码
      } else if (protocol === 'trojan') {
        profile.v2rayConfig.password = id;
      }
      
      // 添加WebSocket配置
      if (network === 'ws') {
        const wsPath = document.getElementById('v2rayWsPath').value.trim();
        profile.v2rayConfig.wsPath = wsPath || '/';
      }
      
      // 对于需要客户端的协议，设置本地代理
      if (['vmess', 'vless'].includes(protocol)) {
        profile.requiresClient = true;
        profile.localProxy = {
          host: '127.0.0.1',
          port: 1080,
          protocol: 'socks5'
        };
      }
      
    } else {
      // 传统代理协议配置
      host = document.getElementById('profileHost').value.trim();
      port = document.getElementById('profilePort').value;
      const username = document.getElementById('profileUsername').value.trim();
      const password = document.getElementById('profilePassword').value;
      
      // 验证必填字段
      if (!name) {
        this.showToast('请输入配置名称', 'error');
        return;
      }
      if (!host) {
        this.showToast('请输入服务器地址', 'error');
        return;
      }
      if (!port || isNaN(port) || port < 1 || port > 65535) {
        this.showToast('请输入有效的端口号 (1-65535)', 'error');
        return;
      }
      
      profile = {
        name: name,
        displayName: displayName || name,
        protocol: protocol,
        host: host,
        port: parseInt(port),
      };

      if (username && password) {
        profile.auth = { username, password };
      }
    }

    // 检查配置名称是否已存在（编辑模式下跳过此检查）
    if (!this.editingProfile && this.profiles[name]) {
      this.showToast('配置名称已存在，请使用其他名称', 'error');
      return;
    }

    try {
      console.log('Saving profile:', profile);
      const response = await chrome.runtime.sendMessage({
        action: 'addProfile',
        profile: profile
      });

      console.log('Save response:', response);

      if (response && response.success) {
        this.profiles[profile.name] = profile;
        this.renderProfiles();
        this.closeModal('addProfileModal');
        
        const action = this.editingProfile ? '更新' : '保存';
        this.showToast(`配置${action}成功`, 'success');
        
        // 重置编辑模式
        this.editingProfile = null;
        document.getElementById('profileName').disabled = false;
        
        document.getElementById('profileForm').reset();
      } else {
        this.showToast(response?.error || '保存失败', 'error');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      this.showToast('保存失败: ' + error.message, 'error');
    }
  }

  async deleteProfile(profileName) {
    if (!confirm(`确定要删除配置 "${profileName}" 吗？`)) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteProfile',
        profileName: profileName
      });

      if (response.success) {
        delete this.profiles[profileName];
        this.renderProfiles();
        this.showToast('配置删除成功', 'success');
      } else {
        this.showToast('删除失败', 'error');
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
      this.showToast('删除失败', 'error');
    }
  }

  async toggleRule(index) {
    if (index < 0 || index >= this.rules.length) return;
    
    this.rules[index].enabled = !this.rules[index].enabled;
    
    try {
      await chrome.storage.sync.set({ autoSwitchRules: this.rules });
      
      // 通知background script更新规则
      await chrome.runtime.sendMessage({
        action: 'updateRules',
        rules: this.rules
      });
      
      this.renderRules();
      this.showToast(`规则已${this.rules[index].enabled ? '启用' : '禁用'}`, 'success');
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      this.showToast('操作失败', 'error');
    }
  }

  async deleteRule(index) {
    if (!confirm('确定要删除这条规则吗？')) {
      return;
    }

    this.rules.splice(index, 1);
    
    try {
      await chrome.storage.sync.set({ autoSwitchRules: this.rules });
      
      // 通知background script更新规则
      await chrome.runtime.sendMessage({
        action: 'updateRules',
        rules: this.rules
      });
      
      this.renderRules();
      this.showToast('规则删除成功', 'success');
    } catch (error) {
      console.error('Failed to delete rule:', error);
      this.showToast('删除失败', 'error');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'enableNotifications',
        'enableAutoSwitch',
        'enableAutoFallback',
        'enablePerformanceMonitoring'
      ]);

      document.getElementById('enableNotifications').checked = result.enableNotifications !== false;
      document.getElementById('enableAutoSwitch').checked = result.enableAutoSwitch !== false;
      document.getElementById('enableAutoFallback').checked = result.enableAutoFallback !== false;
      document.getElementById('enablePerformanceMonitoring').checked = result.enablePerformanceMonitoring !== false;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    const settings = {
      enableNotifications: document.getElementById('enableNotifications').checked,
      enableAutoSwitch: document.getElementById('enableAutoSwitch').checked,
      enableAutoFallback: document.getElementById('enableAutoFallback').checked,
      enablePerformanceMonitoring: document.getElementById('enablePerformanceMonitoring').checked
    };

    try {
      await chrome.storage.sync.set(settings);
      this.showToast('设置保存成功', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('保存失败', 'error');
    }
  }

  async exportData() {
    try {
      // 获取当前设置
      const settings = await chrome.storage.sync.get([
        'enableNotifications',
        'enableAutoSwitch', 
        'enableAutoFallback',
        'enablePerformanceMonitoring'
      ]);

      const data = {
        // 基本信息
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        
        // 代理配置
        profiles: this.profiles,
        
        // 自动切换规则
        autoSwitchRules: this.rules,
        
        // 扩展设置
        settings: {
          enableNotifications: settings.enableNotifications !== false,
          enableAutoSwitch: settings.enableAutoSwitch !== false,
          enableAutoFallback: settings.enableAutoFallback !== false,
          enablePerformanceMonitoring: settings.enablePerformanceMonitoring !== false
        },
        
        // 统计信息
        statistics: {
          profileCount: Object.keys(this.profiles).length,
          ruleCount: this.rules.length,
          enabledRuleCount: this.rules.filter(rule => rule.enabled).length
        }
      };

      console.log('Exporting data:', data);

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxymaster-config-${new Date().toISOString().split('T')[0]}.json`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);

      this.showToast(`配置导出成功 - ${data.statistics.profileCount}个配置, ${data.statistics.ruleCount}个规则`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('导出失败: ' + error.message, 'error');
    }
  }

  importData() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          console.log('No file selected');
          return;
        }

        console.log('Selected file:', file.name, file.size, 'bytes');

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const jsonText = e.target.result;
            console.log('File content:', jsonText);
            
            const data = JSON.parse(jsonText);
            console.log('Parsed data:', data);
            
            if (!data || typeof data !== 'object') {
              throw new Error('无效的配置文件格式');
            }

            let importedProfiles = 0;
            let importedRules = 0;
            let importedSettings = false;

            // 导入代理配置
            if (data.profiles && typeof data.profiles === 'object') {
              // 合并配置，避免覆盖现有配置
              Object.entries(data.profiles).forEach(([name, profile]) => {
                if (name !== 'direct' && profile && typeof profile === 'object') {
                  this.profiles[name] = profile;
                  importedProfiles++;
                }
              });
            }
            
            // 导入自动切换规则
            const rules = data.autoSwitchRules;
            if (rules && Array.isArray(rules)) {
              // 合并规则
              rules.forEach(rule => {
                if (rule && typeof rule === 'object') {
                  this.rules.push(rule);
                  importedRules++;
                }
              });
            }

            // 导入设置（如果存在）
            if (data.settings && typeof data.settings === 'object') {
              await chrome.storage.sync.set(data.settings);
              await this.loadSettings(); // 重新加载设置到界面
              importedSettings = true;
            }

            // 保存到存储
            await chrome.storage.sync.set({
              profiles: this.profiles,
              autoSwitchRules: this.rules
            });

            // 通知background script更新
            await chrome.runtime.sendMessage({
              action: 'reloadProfiles'
            });

            this.renderProfiles();
            this.renderRules();
            
            let message = `导入成功: ${importedProfiles}个配置, ${importedRules}个规则`;
            if (importedSettings) {
              message += ', 扩展设置';
            }
            this.showToast(message, 'success');
          } catch (error) {
            console.error('Failed to import data:', error);
            this.showToast('导入失败: ' + error.message, 'error');
          }
        };

        reader.onerror = () => {
          console.error('File read error');
          this.showToast('文件读取失败', 'error');
        };

        reader.readAsText(file);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    } catch (error) {
      console.error('Import setup failed:', error);
      this.showToast('导入功能初始化失败', 'error');
    }
  }

  async clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      return;
    }

    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      this.profiles = {};
      this.rules = [];
      this.currentProfile = 'direct';
      
      this.renderProfiles();
      this.renderRules();
      this.updateStats();
      
      this.showToast('所有数据已清除', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showToast('清除失败', 'error');
    }
  }

  showAddProfileModal() {
    // 重置编辑模式
    this.editingProfile = null;
    
    // 启用配置名称输入框
    document.getElementById('profileName').disabled = false;
    
    // 恢复模态框标题
    document.querySelector('#addProfileModal .modal-header h3').textContent = '新建代理配置';
    
    // 重置表单
    document.getElementById('profileForm').reset();
    
    // 重置协议字段显示（默认显示传统代理字段）
    this.toggleProtocolFields('http');
    
    // 显示模态框
    document.getElementById('addProfileModal').classList.add('show');
  }

  showAddRuleModal() {
    // 重置编辑模式
    this.editingRuleIndex = null;
    
    // 恢复模态框标题
    document.querySelector('#addRuleModal .modal-header h3').textContent = '新建自动切换规则';
    
    // 更新代理配置选项
    this.updateRuleProfileOptions();
    // 显示模态框
    document.getElementById('addRuleModal').classList.add('show');
    // 重置表单
    document.getElementById('ruleForm').reset();
    document.getElementById('rulePriority').value = '100';
    // 更新帮助文本
    this.updatePatternHelp('domain');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
  }

  editProfile(profileName) {
    const profile = this.profiles[profileName];
    if (!profile) {
      this.showToast('配置不存在', 'error');
      return;
    }

    // 填充基本表单数据
    document.getElementById('profileName').value = profileName;
    document.getElementById('profileDisplayName').value = profile.displayName || '';
    document.getElementById('profileProtocol').value = profile.protocol || 'http';
    
    // 根据协议类型填充不同的字段
    const isV2RayProtocol = ['vmess', 'vless', 'trojan', 'shadowsocks'].includes(profile.protocol);
    
    if (isV2RayProtocol && profile.v2rayConfig) {
      // V2Ray协议配置
      document.getElementById('v2rayHost').value = profile.host || '';
      document.getElementById('v2rayPort').value = profile.port || '';
      document.getElementById('v2rayId').value = profile.v2rayConfig.id || profile.v2rayConfig.password || '';
      document.getElementById('v2rayNetwork').value = profile.v2rayConfig.network || 'tcp';
      document.getElementById('v2rayTls').checked = profile.v2rayConfig.tls || false;
      
      // 协议特定字段
      if (profile.protocol === 'vmess') {
        document.getElementById('v2rayAlterId').value = profile.v2rayConfig.alterId || 0;
      } else if (profile.protocol === 'shadowsocks') {
        document.getElementById('v2rayMethod').value = profile.v2rayConfig.method || 'aes-256-gcm';
      }
      
      // WebSocket配置
      if (profile.v2rayConfig.network === 'ws') {
        document.getElementById('v2rayWsPath').value = profile.v2rayConfig.wsPath || '/';
      }
    } else {
      // 传统代理协议配置
      document.getElementById('profileHost').value = profile.host || '';
      document.getElementById('profilePort').value = profile.port || '';
      document.getElementById('profileUsername').value = profile.auth?.username || '';
      document.getElementById('profilePassword').value = profile.auth?.password || '';
    }

    // 切换字段显示
    this.toggleProtocolFields(profile.protocol || 'http');

    // 设置编辑模式
    this.editingProfile = profileName;
    
    // 禁用配置名称输入框（编辑时不允许修改名称）
    document.getElementById('profileName').disabled = true;
    
    // 更改模态框标题
    document.querySelector('#addProfileModal .modal-header h3').textContent = '编辑代理配置';
    
    // 显示模态框
    document.getElementById('addProfileModal').classList.add('show');
  }

  editRule(index) {
    const rule = this.rules[index];
    if (!rule) {
      this.showToast('规则不存在', 'error');
      return;
    }

    // 设置编辑模式
    this.editingRuleIndex = index;
    
    // 先更新代理配置选项
    this.updateRuleProfileOptions();
    
    // 然后填充表单数据
    document.getElementById('ruleName').value = rule.name || '';
    document.getElementById('ruleType').value = rule.type || 'domain';
    document.getElementById('rulePattern').value = rule.pattern || '';
    document.getElementById('ruleProfile').value = rule.profile || '';
    document.getElementById('rulePriority').value = rule.priority || 100;
    
    // 更新帮助文本
    this.updatePatternHelp(rule.type || 'domain');
    
    // 更改模态框标题
    document.querySelector('#addRuleModal .modal-header h3').textContent = '编辑自动切换规则';
    
    // 显示模态框
    document.getElementById('addRuleModal').classList.add('show');
  }

  updateRuleProfileOptions() {
    const select = document.getElementById('ruleProfile');
    // 清空现有选项，保留默认选项
    select.innerHTML = `
              <option value="">${chrome.i18n.getMessage('selectProxy')}</option>
              <option value="direct">${chrome.i18n.getMessage('direct')}</option>
    `;
    
    // 添加所有代理配置
    Object.entries(this.profiles).forEach(([name, profile]) => {
      if (name !== 'direct') {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = profile.displayName || name;
        select.appendChild(option);
      }
    });
  }

  updatePatternHelp(type) {
    const helpText = document.getElementById('patternHelp');
    const patternInput = document.getElementById('rulePattern');
    
    switch (type) {
      case 'domain':
        helpText.textContent = '域名匹配：支持通配符，如 *.google.com 或 google.com';
        patternInput.placeholder = '例如：*.google.com';
        break;
      case 'url':
        helpText.textContent = 'URL匹配：匹配完整URL，支持通配符，如 https://*.example.com/*';
        patternInput.placeholder = '例如：https://*.google.com/*';
        break;
      case 'wildcard':
        helpText.textContent = '通配符匹配：使用 * 和 ? 进行模式匹配';
        patternInput.placeholder = '例如：*google*';
        break;
      case 'regex':
        helpText.textContent = '正则表达式：使用正则表达式进行高级匹配';
        patternInput.placeholder = '例如：^https?://.*\\.google\\.com/.*';
        break;
    }
  }

  toggleProtocolFields(protocol) {
    const traditionalFields = document.getElementById('traditionalProxyFields');
    const v2rayFields = document.getElementById('v2rayProxyFields');
    const vmessFields = document.getElementById('vmessFields');
    const ssFields = document.getElementById('ssFields');
    const wsFields = document.getElementById('wsFields');

    const isV2RayProtocol = ['vmess', 'vless', 'trojan', 'shadowsocks'].includes(protocol);

    if (isV2RayProtocol) {
      traditionalFields.style.display = 'none';
      v2rayFields.style.display = 'block';
      
      // 根据具体协议显示/隐藏特定字段
      vmessFields.style.display = protocol === 'vmess' ? 'block' : 'none';
      ssFields.style.display = protocol === 'shadowsocks' ? 'block' : 'none';
      
      // WebSocket字段根据传输协议动态显示
      this.updateV2RayNetworkFields();
      
      // 为网络类型选择添加事件监听器
      const networkSelect = document.getElementById('v2rayNetwork');
      if (networkSelect && !networkSelect.hasAttribute('data-listener-added')) {
        networkSelect.addEventListener('change', () => {
          this.updateV2RayNetworkFields();
        });
        networkSelect.setAttribute('data-listener-added', 'true');
      }
    } else {
      traditionalFields.style.display = 'block';
      v2rayFields.style.display = 'none';
    }
  }

  updateV2RayNetworkFields() {
    const networkSelect = document.getElementById('v2rayNetwork');
    const wsFields = document.getElementById('wsFields');
    
    if (networkSelect && wsFields) {
      const network = networkSelect.value;
      wsFields.style.display = network === 'ws' ? 'block' : 'none';
    }
  }

  async saveRule() {
    // 获取表单数据
    const name = document.getElementById('ruleName').value.trim();
    const type = document.getElementById('ruleType').value;
    const pattern = document.getElementById('rulePattern').value.trim();
    const profile = document.getElementById('ruleProfile').value;
    const priority = parseInt(document.getElementById('rulePriority').value);
    const enabled = this.editingRuleIndex !== null ? this.rules[this.editingRuleIndex].enabled : true;

    // 验证必填字段
    if (!name) {
      this.showToast('请输入规则名称', 'error');
      return;
    }
    if (!pattern) {
      this.showToast('请输入匹配模式', 'error');
      return;
    }
    if (!profile) {
      this.showToast(chrome.i18n.getMessage('selectProxy'), 'error');
      return;
    }
    if (isNaN(priority) || priority < 1 || priority > 1000) {
      this.showToast('优先级必须在1-1000之间', 'error');
      return;
    }

    // 验证正则表达式
    if (type === 'regex') {
      try {
        new RegExp(pattern);
      } catch (e) {
        this.showToast('正则表达式格式错误', 'error');
        return;
      }
    }

    const rule = {
      id: Date.now().toString(),
      name: name,
      type: type,
      pattern: pattern,
      profile: profile,
      priority: priority,
      enabled: enabled,
      createdAt: new Date().toISOString()
    };

    try {
      console.log('Saving rule:', rule);
      
      if (this.editingRuleIndex !== null) {
        // 编辑模式：更新现有规则
        this.rules[this.editingRuleIndex] = rule;
      } else {
        // 新建模式：添加到规则列表
      this.rules.push(rule);
      }
      
      // 按优先级排序
      this.rules.sort((a, b) => b.priority - a.priority);
      
      // 保存到存储
      await chrome.storage.sync.set({ autoSwitchRules: this.rules });
      
      // 通知background script更新规则
      await chrome.runtime.sendMessage({
        action: 'updateRules',
        rules: this.rules
      });

      this.renderRules();
      this.closeModal('addRuleModal');
      
      const action = this.editingRuleIndex !== null ? '更新' : '保存';
      this.showToast(`规则${action}成功`, 'success');
      
      // 重置编辑模式
      this.editingRuleIndex = null;
      
      document.getElementById('ruleForm').reset();
    } catch (error) {
      console.error('Failed to save rule:', error);
      this.showToast('保存失败: ' + error.message, 'error');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // 强制重排以确保动画生效
    toast.offsetHeight;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // V2Ray订阅管理方法
  async loadV2RayData() {
    if (!this.v2rayManager) return;
    
    try {
      this.subscriptions = await this.v2rayManager.loadSubscriptions();
    } catch (error) {
      console.error('Failed to load V2Ray data:', error);
    }
  }

  renderV2RaySubscriptions() {
    if (!this.v2rayManager) return;
    
    const subscriptionsList = document.getElementById('subscriptionsList');
    const nodesList = document.getElementById('nodesList');
    
    if (!subscriptionsList || !nodesList) return;

    // 渲染订阅列表
    if (this.subscriptions.length === 0) {
      subscriptionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <h4>还没有V2Ray订阅</h4>
          <p>点击"添加订阅"按钮开始添加你的第一个V2Ray订阅链接</p>
        </div>
      `;
    } else {
      subscriptionsList.innerHTML = '';
      this.subscriptions.forEach((subscription, index) => {
        const subscriptionElement = document.createElement('div');
        subscriptionElement.className = `profile-item ${subscription.enabled ? '' : 'inactive'}`;
        
        const lastUpdate = new Date(subscription.lastUpdate).toLocaleString();
        
        subscriptionElement.innerHTML = `
          <div style="display: flex; align-items: center;">
            <div class="status-indicator ${subscription.enabled ? '' : 'inactive'}"></div>
            <div class="profile-info">
              <h4>${subscription.name}</h4>
              <p>节点数量: ${subscription.nodes.length} | 最后更新: ${lastUpdate}</p>
            </div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-secondary" data-action="update-subscription" data-id="${subscription.id}">更新</button>
            <button class="btn btn-secondary" data-action="toggle-subscription" data-id="${subscription.id}">${subscription.enabled ? '禁用' : '启用'}</button>
            <button class="btn btn-danger" data-action="delete-subscription" data-id="${subscription.id}">删除</button>
          </div>
        `;
        
        subscriptionsList.appendChild(subscriptionElement);
      });
    }

    // 添加订阅列表事件监听器
    if (!subscriptionsList.hasAttribute('data-listener-added')) {
      subscriptionsList.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        switch (action) {
          case 'update-subscription':
            this.updateSubscription(id);
            break;
          case 'toggle-subscription':
            this.toggleSubscription(id);
            break;
          case 'delete-subscription':
            this.deleteSubscription(id);
            break;
        }
      });
      subscriptionsList.setAttribute('data-listener-added', 'true');
    }

    // 渲染节点列表
    const allNodes = this.v2rayManager.getAllNodes();
    if (allNodes.length === 0) {
      nodesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌐</div>
          <h4>没有可用节点</h4>
          <p>请先添加订阅链接以获取节点列表</p>
        </div>
      `;
    } else {
      nodesList.innerHTML = '';
      allNodes.forEach((node, index) => {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'profile-item';
        
        const typeColors = {
          'vmess': '#667eea',
          'vless': '#764ba2',
          'trojan': '#f093fb',
          'shadowsocks': '#4facfe'
        };
        
        nodeElement.innerHTML = `
          <div style="display: flex; align-items: center;">
            <div class="status-indicator" style="background: ${typeColors[node.type] || '#6c757d'}"></div>
            <div class="profile-info">
              <h4>${node.name}</h4>
              <p>${node.type.toUpperCase()} | ${node.address}:${node.port}</p>
            </div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-secondary" data-action="show-node-detail" data-index="${index}">详情</button>
            <button class="btn btn-primary" data-action="use-node" data-index="${index}">使用</button>
          </div>
        `;
        
        nodesList.appendChild(nodeElement);
      });
    }

    // 添加节点列表事件监听器
    if (!nodesList.hasAttribute('data-listener-added')) {
      nodesList.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const index = button.dataset.index;

        switch (action) {
          case 'show-node-detail':
            this.showNodeDetail(index);
            break;
          case 'use-node':
            this.useNode(index);
            break;
        }
      });
      nodesList.setAttribute('data-listener-added', 'true');
    }
  }

  showAddSubscriptionModal() {
    document.getElementById('addSubscriptionModal').classList.add('show');
    document.getElementById('subscriptionForm').reset();
    // 默认显示URL输入方式
    this.toggleSubscriptionInputMethod('url');
  }

  toggleSubscriptionInputMethod(method) {
    const urlGroup = document.getElementById('urlInputGroup');
    const contentGroup = document.getElementById('contentInputGroup');
    const autoUpdateGroup = document.getElementById('autoUpdateGroup');
    const urlInput = document.getElementById('subscriptionUrl');
    const contentInput = document.getElementById('subscriptionContent');

    if (method === 'url') {
      urlGroup.style.display = 'block';
      contentGroup.style.display = 'none';
      autoUpdateGroup.style.display = 'block';
      urlInput.required = true;
      contentInput.required = false;
    } else {
      urlGroup.style.display = 'none';
      contentGroup.style.display = 'block';
      autoUpdateGroup.style.display = 'none';
      urlInput.required = false;
      contentInput.required = true;
    }
  }

  async addSubscription() {
    if (!this.v2rayManager) {
      this.showToast('V2Ray管理器未初始化', 'error');
      return;
    }

    const name = document.getElementById('subscriptionName').value.trim();
    const addMethod = document.querySelector('input[name="addMethod"]:checked').value;
    
    if (!name) {
      this.showToast('请输入订阅名称', 'error');
      return;
    }

    try {
      let result;
      
      if (addMethod === 'url') {
        const url = document.getElementById('subscriptionUrl').value.trim();
        if (!url) {
          this.showToast('请输入订阅链接', 'error');
          return;
        }
        
        this.showToast('正在获取订阅内容...', 'info');
        result = await this.v2rayManager.addSubscription(url, name);
      } else {
        const content = document.getElementById('subscriptionContent').value.trim();
        if (!content) {
          this.showToast('请输入订阅内容', 'error');
          return;
        }
        
        this.showToast('正在解析订阅内容...', 'info');
        result = await this.v2rayManager.addSubscriptionFromContent(content, name);
      }
      
      if (result.success) {
        this.subscriptions = await this.v2rayManager.loadSubscriptions();
        this.renderV2RaySubscriptions();
        this.closeModal('addSubscriptionModal');
        this.showToast(`订阅添加成功，共获取 ${result.nodeCount} 个节点`, 'success');
      } else {
        this.showToast(`添加失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to add subscription:', error);
      this.showToast(`添加失败: ${error.message}`, 'error');
    }
  }

  async updateSubscription(subscriptionId) {
    if (!this.v2rayManager) return;

    try {
      this.showToast('正在更新订阅...', 'info');
      
      const result = await this.v2rayManager.updateSubscription(subscriptionId);
      
      if (result.success) {
        this.subscriptions = await this.v2rayManager.loadSubscriptions();
        this.renderV2RaySubscriptions();
        this.showToast(`订阅更新成功，共获取 ${result.nodeCount} 个节点`, 'success');
      } else {
        this.showToast(`更新失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
      this.showToast(`更新失败: ${error.message}`, 'error');
    }
  }

  async toggleSubscription(subscriptionId) {
    if (!this.v2rayManager) return;

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    subscription.enabled = !subscription.enabled;
    
    try {
      await this.v2rayManager.saveSubscriptions();
      this.renderV2RaySubscriptions();
      this.showToast(`订阅已${subscription.enabled ? '启用' : '禁用'}`, 'success');
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
      this.showToast('操作失败', 'error');
    }
  }

  async deleteSubscription(subscriptionId) {
    if (!confirm('确定要删除这个订阅吗？')) return;
    
    if (!this.v2rayManager) return;

    const index = this.subscriptions.findIndex(s => s.id === subscriptionId);
    if (index === -1) return;

    this.subscriptions.splice(index, 1);
    
    try {
      await this.v2rayManager.saveSubscriptions();
      this.renderV2RaySubscriptions();
      this.showToast('订阅删除成功', 'success');
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      this.showToast('删除失败', 'error');
    }
  }

  showNodeDetail(nodeIndex) {
    if (!this.v2rayManager) return;

    const allNodes = this.v2rayManager.getAllNodes();
    const node = allNodes[nodeIndex];
    if (!node) return;

    this.selectedNode = node;
    
    // 检查节点是否需要客户端
    const proxyConfig = this.v2rayManager.generateDirectProxyConfig(node);
    const needsClient = proxyConfig.requiresClient;
    
    const detailContent = document.getElementById('nodeDetailContent');
    detailContent.innerHTML = `
      <div class="form-group">
        <label>节点名称</label>
        <input type="text" value="${node.name}" readonly>
      </div>
      <div class="form-group">
        <label>协议类型</label>
        <input type="text" value="${node.type.toUpperCase()}" readonly>
      </div>
      <div class="form-group">
        <label>服务器地址</label>
        <input type="text" value="${node.address}" readonly>
      </div>
      <div class="form-group">
        <label>端口</label>
        <input type="text" value="${node.port}" readonly>
      </div>
      ${needsClient ? `
        <div class="form-group">
          <label style="color: #ff6b35;">⚠️ 使用说明</label>
          <div style="background: #fff3f0; border: 1px solid #ffcdd2; border-radius: 4px; padding: 10px; font-size: 14px;">
            <p style="margin: 0 0 8px 0; color: #d32f2f;">此节点需要V2Ray客户端支持：</p>
            <ol style="margin: 0; padding-left: 20px; color: #666;">
              <li>下载V2Ray客户端</li>
              <li>导入节点配置文件</li>
              <li>启动客户端监听1080端口</li>
              <li>使用扩展连接到本地代理</li>
            </ol>
          </div>
        </div>
      ` : `
        <div class="form-group">
          <label style="color: #28a745;">✅ 使用说明</label>
          <div style="background: #f0fff4; border: 1px solid #c3e6cb; border-radius: 4px; padding: 10px; font-size: 14px;">
            <p style="margin: 0; color: #155724;">此节点可直接使用，无需额外客户端配置</p>
          </div>
        </div>
      `}
      ${node.type === 'vmess' ? `
        <div class="form-group">
          <label>用户ID</label>
          <input type="text" value="${node.id}" readonly>
        </div>
        <div class="form-group">
          <label>加密方式</label>
          <input type="text" value="${node.security}" readonly>
        </div>
        <div class="form-group">
          <label>传输协议</label>
          <input type="text" value="${node.network}" readonly>
        </div>
      ` : ''}
      ${node.type === 'shadowsocks' ? `
        <div class="form-group">
          <label>加密方法</label>
          <input type="text" value="${node.method}" readonly>
        </div>
      ` : ''}
    `;

    // 设置按钮事件
    const downloadBtn = document.getElementById('downloadConfigBtn');
    const useBtn = document.getElementById('useNodeBtn');
    
    // 更新按钮文本
    if (needsClient) {
      downloadBtn.textContent = '下载V2Ray配置';
      useBtn.textContent = '添加配置（需客户端）';
    } else {
      downloadBtn.textContent = '导出配置';
      useBtn.textContent = '直接使用';
    }
    
    // 移除之前的事件监听器
    downloadBtn.replaceWith(downloadBtn.cloneNode(true));
    useBtn.replaceWith(useBtn.cloneNode(true));
    
    // 重新获取按钮引用并添加事件监听器
    document.getElementById('downloadConfigBtn').addEventListener('click', () => {
      this.downloadNodeConfig(node);
    });

    document.getElementById('useNodeBtn').addEventListener('click', () => {
      this.useNode(nodeIndex);
    });

    document.getElementById('nodeDetailModal').classList.add('show');
  }

  downloadNodeConfig(node) {
    if (!this.v2rayManager) return;

    try {
      const config = this.v2rayManager.generateV2RayConfig(node);
      const configJson = JSON.stringify(config, null, 2);
      
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // 生成安全的文件名
      const safeName = node.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `v2ray_${safeName}_${timestamp}.json`;
      
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showToast('配置文件下载成功', 'success');
    } catch (error) {
      console.error('Failed to download config:', error);
      this.showToast('下载失败', 'error');
    }
  }

  async useNode(nodeIndex) {
    if (!this.v2rayManager) return;

    const allNodes = this.v2rayManager.getAllNodes();
    const node = allNodes[nodeIndex];
    if (!node) return;

    // 生成直接代理配置
    const proxyConfig = this.v2rayManager.generateDirectProxyConfig(node);
    
    if (proxyConfig.requiresClient) {
      // 需要客户端的节点类型（VMess/VLESS）
      const confirmMessage = `
${proxyConfig.clientInfo.message}

此节点类型需要您：
1. 下载并安装V2Ray客户端
2. 导入节点配置
3. 启动客户端并监听1080端口
4. 然后使用本扩展连接到127.0.0.1:1080

是否继续添加此配置？
      `.trim();
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // 创建需要客户端的代理配置
      const safeName = node.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const profileName = `v2ray_${safeName}_${Date.now()}`;
      const profile = {
        name: profileName,
        displayName: `V2Ray: ${node.name}`,
        protocol: proxyConfig.scheme,
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: 'v2ray',
        nodeInfo: node,
        requiresClient: true
      };

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'addProfile',
          profile: profile
        });

        if (response && response.success) {
          this.profiles[profileName] = profile;
          this.renderProfiles();
          this.closeModal('nodeDetailModal');
          
          // 提供详细的设置说明
          this.showToast(`节点已添加: ${profile.displayName}`, 'success');
          
          setTimeout(() => {
            this.showToast('⚠️ 请先配置V2Ray客户端并启动1080端口', 'info');
          }, 2000);
          
          setTimeout(() => {
            this.showToast('💡 可点击"详情"按钮下载配置文件', 'info');
          }, 4000);
        } else {
          const errorMsg = response?.error || '添加失败';
          console.error('Failed to add V2Ray profile:', response);
          this.showToast(`添加失败: ${errorMsg}`, 'error');
        }
      } catch (error) {
        console.error('Failed to use node:', error);
        this.showToast('使用节点失败', 'error');
      }
    } else {
      // 可以直接使用的节点类型（Shadowsocks/Trojan）
      const safeName = node.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const profileName = `${node.type}_${safeName}_${Date.now()}`;
      const profile = {
        name: profileName,
        displayName: `${node.type.toUpperCase()}: ${node.name}`,
        protocol: proxyConfig.scheme,
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: node.type,
        nodeInfo: node,
        requiresClient: false
      };

      // 如果有认证信息，添加到配置中
      if (proxyConfig.auth) {
        profile.auth = proxyConfig.auth;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'addProfile',
          profile: profile
        });

        if (response && response.success) {
          this.profiles[profileName] = profile;
          this.renderProfiles();
          this.closeModal('nodeDetailModal');
          this.showToast(`节点已添加: ${profile.displayName}`, 'success');
          
          setTimeout(() => {
            this.showToast('✅ 此节点可直接使用，无需额外客户端', 'success');
          }, 2000);
        } else {
          const errorMsg = response?.error || '添加失败';
          console.error('Failed to add direct proxy profile:', response);
          this.showToast(`添加失败: ${errorMsg}`, 'error');
        }
      } catch (error) {
        console.error('Failed to use node:', error);
        this.showToast('使用节点失败', 'error');
      }
    }
  }
}

// 全局函数已移除，现在使用事件监听器

// 初始化选项管理器
let optionsManager;
document.addEventListener('DOMContentLoaded', () => {
  optionsManager = new OptionsManager();
}); 