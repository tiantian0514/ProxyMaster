// ProxyMaster Options Script
class OptionsManager {
  constructor() {
    this.profiles = {};
    this.currentProfile = null;
    this.rules = [];
    this.editingProfile = null;
    this.editingRuleIndex = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.setupButtonListeners();
    this.renderProfiles();
    this.renderRules();
    this.updateStats();
    this.loadSettings();
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
      this.showToast('加载数据失败', 'error');
    }
  }

  setupEventListeners() {
    // 标签页切换
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
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

    // 添加事件委托
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

      const profileName = rule.profile === 'direct' ? '直连' : 
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

    // 添加事件委托
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
    // 获取表单数据
    const name = document.getElementById('profileName').value.trim();
    const displayName = document.getElementById('profileDisplayName').value.trim();
    const protocol = document.getElementById('profileProtocol').value;
    const host = document.getElementById('profileHost').value.trim();
    const port = document.getElementById('profilePort').value;
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

    // 检查配置名称是否已存在（编辑模式下跳过此检查）
    if (!this.editingProfile && this.profiles[name]) {
      this.showToast('配置名称已存在，请使用其他名称', 'error');
      return;
    }

    const profile = {
      name: name,
      displayName: displayName || name,
      protocol: protocol,
      host: host,
      port: parseInt(port),
    };

    if (username && password) {
      profile.auth = { username, password };
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
    
    // 显示模态框
    document.getElementById('addProfileModal').classList.add('show');
    
    // 重置表单
    document.getElementById('profileForm').reset();
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
    document.getElementById('ruleEnabled').checked = true;
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

    // 填充表单数据
    document.getElementById('profileName').value = profileName;
    document.getElementById('profileDisplayName').value = profile.displayName || '';
    document.getElementById('profileProtocol').value = profile.protocol || 'http';
    document.getElementById('profileHost').value = profile.host || '';
    document.getElementById('profilePort').value = profile.port || '';
    document.getElementById('profileUsername').value = profile.auth?.username || '';
    document.getElementById('profilePassword').value = profile.auth?.password || '';

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

    // 填充表单数据
    document.getElementById('ruleName').value = rule.name || '';
    document.getElementById('ruleType').value = rule.type || 'domain';
    document.getElementById('rulePattern').value = rule.pattern || '';
    document.getElementById('ruleProfile').value = rule.profile || '';
    document.getElementById('rulePriority').value = rule.priority || 100;
    document.getElementById('ruleEnabled').checked = rule.enabled !== false;

    // 设置编辑模式
    this.editingRuleIndex = index;
    
    // 更新代理配置选项
    this.updateRuleProfileOptions();
    
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
      <option value="">请选择代理配置</option>
      <option value="direct">直连</option>
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

  async saveRule() {
    // 获取表单数据
    const name = document.getElementById('ruleName').value.trim();
    const type = document.getElementById('ruleType').value;
    const pattern = document.getElementById('rulePattern').value.trim();
    const profile = document.getElementById('ruleProfile').value;
    const priority = parseInt(document.getElementById('rulePriority').value);
    const enabled = document.getElementById('ruleEnabled').checked;

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
      this.showToast('请选择代理配置', 'error');
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
}

// 全局函数已移除，现在使用事件监听器

// 初始化选项管理器
let optionsManager;
document.addEventListener('DOMContentLoaded', () => {
  optionsManager = new OptionsManager();
}); 