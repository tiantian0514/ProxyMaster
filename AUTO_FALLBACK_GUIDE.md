# ProxyMaster 自动回退功能说明

## 🎯 功能概述

自动回退功能解决了一个重要的用户体验问题：当用户访问需要代理的网站（如Google）后，再访问不需要代理的网站（如百度）时，扩展会自动切换回直连模式，而不是继续使用代理。

## 🔄 工作原理

### 传统行为（问题）
1. 用户当前状态：**直连**
2. 访问 `google.com` → 匹配到代理规则 → 切换到**代理**
3. 访问 `baidu.com` → 没有匹配规则 → **保持代理状态** ❌

### 新的自动回退行为（解决方案）
1. 用户当前状态：**直连**
2. 访问 `google.com` → 匹配到代理规则 → 切换到**代理**
3. 访问 `baidu.com` → 没有匹配规则 → **自动回退到直连** ✅

## ⚙️ 设置方法

1. 打开 ProxyMaster 设置页面
2. 切换到"高级设置"标签页
3. 找到"启用自动回退到直连"选项
4. 勾选该选项并保存设置

## 🧪 测试功能

### 使用调试工具测试
1. 打开 `debug-autoswitch.html` 调试页面
2. 点击"运行回退测试"按钮
3. 查看测试结果和预期行为

### 手动测试步骤
1. 确保启用了"智能切换"和"自动回退"
2. 创建一个针对 `*.google.com` 的代理规则
3. 当前状态设为直连
4. 访问 `https://www.google.com` → 应该切换到代理
5. 访问 `https://www.baidu.com` → 应该自动回退到直连

## 📋 配置选项

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 启用智能切换 | ✅ 启用 | 必须启用才能使用自动回退 |
| 启用自动回退到直连 | ✅ 启用 | 控制是否在无匹配规则时回退到直连 |

## 🔍 调试信息

当启用调试模式时，控制台会显示详细的切换日志：

```
Tab updated: https://www.google.com
Finding matching rule for URL: https://www.google.com
Rule matched: Google服务 for https://www.google.com
Auto switching from direct to proxy1 for https://www.google.com

Tab updated: https://www.baidu.com
Finding matching rule for URL: https://www.baidu.com
No matching rule found for https://www.baidu.com
No rule matched for https://www.baidu.com, falling back to direct connection
Auto switching from proxy1 to direct for https://www.baidu.com
```

## 🎛️ 高级用法

### 禁用自动回退
如果您希望保持传统行为（切换到代理后不自动回退），可以：
1. 取消勾选"启用自动回退到直连"
2. 保存设置

### 自定义回退行为
目前自动回退只支持回退到"直连"模式。如果需要回退到特定代理，可以：
1. 创建一个优先级较低的通配符规则 `*`
2. 将其指向您的默认代理配置

## 🚀 版本信息

- 引入版本：v1.0.3
- 功能状态：稳定
- 兼容性：Chrome Manifest V3

## 💡 使用建议

1. **推荐启用**：对于大多数用户，建议启用自动回退功能以获得更好的用户体验
2. **规则设计**：设计代理规则时，只为真正需要代理的网站创建规则
3. **性能考虑**：自动回退功能对性能影响极小，可以放心使用

## 🔧 故障排除

### 自动回退不工作
1. 检查"启用智能切换"是否开启
2. 检查"启用自动回退到直连"是否开启
3. 使用调试工具测试规则匹配情况
4. 查看浏览器控制台的调试日志

### 意外的切换行为
1. 检查是否有通配符规则意外匹配了网站
2. 查看规则优先级设置
3. 使用"测试URL匹配"功能验证规则

## 📞 技术支持

如果遇到问题，请：
1. 使用调试工具收集详细信息
2. 查看浏览器控制台日志
3. 联系开发者：hkhuangym@gmail.com
4. 加入QQ群：545380701 