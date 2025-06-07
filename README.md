# ProxyMaster - 智能代理管理器

## Chrome Web Store 上架说明

ProxyMaster是一个专业的代理服务器管理工具，专为需要使用代理服务器的用户设计。本扩展严格遵守Chrome Web Store政策，不包含任何恶意代码或隐私侵犯功能。

### 核心功能
- **代理配置管理**：支持HTTP、HTTPS、SOCKS4、SOCKS5代理协议
- **智能切换**：基于用户定义的规则自动切换代理
- **一键切换**：通过弹窗快速切换代理配置
- **右键菜单**：便捷的网站代理管理
- **配置导入导出**：方便备份和分享配置

### 权限说明
- `proxy`：管理浏览器代理设置（核心功能）
- `storage`：存储用户的代理配置和规则
- `activeTab`：获取当前标签页信息用于智能切换
- `contextMenus`：提供右键菜单功能
- `notifications`：显示代理切换通知
- `<all_urls>`：为所有网站提供代理功能

### 隐私保护
- 所有数据本地存储，不上传到任何服务器
- 不收集用户个人信息或浏览历史
- 开源代码，接受社区审查
- 完整的隐私政策说明

---

## 功能介绍

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/tiantian0514/ProxyMaster/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 🚀 更强大的Chrome代理扩展程序，超越SwitchyOmega的现代化替代方案

## ✨ 特色功能

### 🔥 相比SwitchyOmega的优势

| 功能 | SwitchyOmega | ProxyMaster |
|------|-------------|-------------|
| Manifest版本 | V2 (已过时) | ✅ V3 (最新标准) |
| 维护状态 | ❌ 停止维护 | ✅ 积极维护 |
| 智能学习 | ❌ 无 | ✅ AI驱动的规则学习 |
| 性能监控 | ❌ 基础 | ✅ 详细的性能分析 |
| 现代UI | ❌ 老旧界面 | ✅ 现代化设计 |
| 云同步 | ❌ 有限 | ✅ 完整的云同步 |

### 🎯 核心功能

- **🧠 智能代理切换** - AI学习用户习惯，自动选择最佳代理
- **⚡ 性能优化** - 实时监控代理性能，自动优化连接
- **🔄 无缝切换** - 毫秒级代理切换，不中断浏览体验
- **📊 详细统计** - 全面的使用统计和性能分析
- **🎨 现代界面** - 简洁美观的用户界面
- **☁️ 云同步** - 配置在多设备间自动同步
- **🛡️ 隐私保护** - 本地加密存储，保护用户隐私

### 🚀 增强功能

- **规则学习引擎** - 自动学习用户访问模式
- **负载均衡** - 多代理服务器智能负载分配
- **故障转移** - 代理失效时自动切换备用服务器
- **地理位置优化** - 根据目标网站位置选择最优代理
- **流量分析** - 详细的网络流量分析和报告

## 🛠️ 安装指南

### 开发者安装

1. **克隆项目**
```bash
git clone https://github.com/tiantian0514/ProxyMaster.git
cd ProxyMaster
```

2. **安装依赖**
```bash
npm install
```

3. **构建项目**
```bash
npm run build
```

4. **加载到Chrome**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目根目录

### 用户安装

1. 从Chrome Web Store安装（即将上线）
2. 或下载发布版本的CRX文件手动安装

## 📖 使用指南

### 快速开始

1. **添加代理配置**
   - 点击扩展图标
   - 选择"新建配置"
   - 填入代理服务器信息

2. **设置自动切换规则**
   - 进入设置页面
   - 添加网站规则
   - 选择对应的代理配置

3. **享受智能代理**
   - 扩展会自动学习你的使用习惯
   - 智能选择最佳代理服务器

### 高级功能

#### 智能学习模式
```javascript
// 扩展会自动分析以下数据：
- 访问频率最高的网站
- 不同代理的响应速度
- 用户的手动切换行为
- 网络质量和稳定性
```

#### 性能优化
- **连接池管理** - 复用连接减少延迟
- **DNS预解析** - 提前解析域名
- **智能缓存** - 缓存代理配置和规则

## 🔧 配置说明

### 代理配置格式

```json
{
  "name": "my-proxy",
  "displayName": "我的代理",
  "protocol": "http",
  "host": "proxy.example.com",
  "port": 8080,
  "auth": {
    "username": "user",
    "password": "pass"
  },
  "enabled": true
}
```

### 自动切换规则

```json
{
  "type": "domain",
  "pattern": "*.google.com",
  "profile": "my-proxy",
  "enabled": true
}
```

## 🎨 界面预览

### 弹出窗口
- 现代化的毛玻璃效果
- 一键切换代理配置
- 实时性能统计

### 设置页面
- 直观的配置管理
- 可视化规则编辑器
- 详细的性能报告

## 🔒 隐私与安全

- **本地存储** - 敏感信息仅存储在本地
- **加密传输** - 配置同步使用端到端加密
- **无数据收集** - 不收集任何用户数据
- **开源透明** - 代码完全开源，接受社区审查

## 🚀 开发计划

### v1.1 (计划中)
- [ ] 代理服务器测速功能
- [ ] 更多规则类型支持
- [ ] 导入/导出SwitchyOmega配置
- [ ] 暗色主题支持

### v1.2 (计划中)
- [ ] 代理链支持
- [ ] WebRTC泄露保护
- [ ] 更详细的统计报告
- [ ] 移动端支持

### v2.0 (远期)
- [ ] 内置代理服务器
- [ ] P2P代理网络
- [ ] AI驱动的网络优化

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发环境

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 代码检查
npm run lint

# 格式化代码
npm run format

# 运行测试
npm test
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢 SwitchyOmega 项目的启发
- 感谢所有贡献者和用户的支持
- 特别感谢开源社区的无私奉献

## 📞 联系我们

- 🐛 [报告Bug](https://github.com/tiantian0514/ProxyMaster/issues)
- 💡 [功能建议](https://github.com/tiantian0514/ProxyMaster/discussions)
- 📧 邮箱: hkhuangym@gmail.com
- 💬 QQ群: 545380701

---

⭐ 如果这个项目对你有帮助，请给我们一个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=tiantian0514/ProxyMaster&type=Date)](https://star-history.com/#tiantian0514/ProxyMaster&Date) 