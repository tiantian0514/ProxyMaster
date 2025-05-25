# ProxyMaster v1.0.3 Bug修复说明

## 🐛 修复的问题

### 1. 代理测试功能失败
**问题**: `TypeError: Failed to fetch` 错误
**原因**: 在扩展popup中直接使用fetch API受到限制
**解决方案**: 
- 将代理测试逻辑移到background script中
- 使用chrome.tabs和chrome.scripting API创建隐藏标签页进行测试
- 通过注入脚本获取IP信息

### 2. Background Script连接错误
**问题**: `Could not establish connection. Receiving end does not exist`
**原因**: popup和background script之间的消息传递不稳定
**解决方案**:
- 添加消息重试机制（最多3次重试）
- 增加超时处理和错误恢复
- 改进错误信息显示

### 3. 右键菜单重复创建错误
**问题**: `Cannot create item with duplicate id` 错误
**原因**: 扩展重新加载时重复创建右键菜单项
**解决方案**:
- 添加contextMenuListenerAdded标志防止重复添加监听器
- 增强错误处理，捕获菜单创建异常
- 确保removeAll()完成后再创建新菜单

## 🔧 技术改进

### 消息传递优化
```javascript
async sendMessageWithRetry(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response) return response;
      throw new Error('No response received');
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}
```

### 代理测试实现
```javascript
async testProxyConnection(profileName) {
  // 创建隐藏标签页
  const tab = await chrome.tabs.create({
    url: 'https://httpbin.org/ip',
    active: false
  });
  
  // 等待加载完成并注入脚本获取结果
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const data = JSON.parse(document.body.innerText);
      return { success: true, ip: data.origin };
    }
  });
  
  await chrome.tabs.remove(tab.id);
  return results[0].result;
}
```

### 右键菜单管理
```javascript
setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    try {
      chrome.contextMenus.create({
        id: 'proxymaster-quick-switch',
        title: '快速切换代理',
        contexts: ['page']
      });
    } catch (error) {
      console.error('Error creating context menus:', error);
    }
  });
  
  // 防止重复添加监听器
  if (!this.contextMenuListenerAdded) {
    chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick);
    this.contextMenuListenerAdded = true;
  }
}
```

## 🧪 测试验证

### 测试步骤
1. **代理测试功能**:
   - 打开popup窗口
   - 点击"测试代理"按钮
   - 应该显示当前IP地址而不是错误

2. **配置切换功能**:
   - 在popup中切换不同代理配置
   - 应该能正常切换而不出现连接错误

3. **右键菜单功能**:
   - 右键点击网页
   - 应该看到ProxyMaster菜单项
   - 重新加载扩展后不应出现重复菜单错误

### 错误日志检查
打开Chrome开发者工具 → 扩展程序 → ProxyMaster → 检查视图，查看是否还有错误信息。

## 📦 版本信息

- **修复版本**: v1.0.3-bugfix
- **文件**: `ProxyMaster-v1.0.3-bugfix.zip`
- **兼容性**: Chrome Manifest V3
- **测试状态**: 已验证修复

## 🔄 升级说明

如果您正在使用之前的版本：
1. 卸载旧版本扩展
2. 安装新的修复版本
3. 重新配置代理设置（如果需要）
4. 测试所有功能是否正常工作

## 📞 问题反馈

如果仍然遇到问题，请：
1. 检查Chrome控制台是否有新的错误信息
2. 尝试重新加载扩展
3. 联系开发者：hkhuangym@gmail.com
4. 提供详细的错误截图和日志 