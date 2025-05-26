# ProxyMaster v1.0.2 发布步骤指南

## 📋 发布前检查清单

### ✅ 代码准备
- [x] 版本号已更新（manifest.json: 1.0.2）
- [x] package.json版本号已同步
- [x] 所有功能测试通过
- [x] 代码已提交到main分支
- [x] Git标签已创建（v1.0.2）
- [x] 发布包已生成（ProxyMaster-v1.0.2.zip）

### ✅ 文档准备
- [x] README.md已更新
- [x] 发布说明已编写
- [x] 变更日志已记录
- [x] 用户指南已完善

### ✅ 质量保证
- [x] 扩展在Chrome中正常加载
- [x] 核心功能验证通过
- [x] V2Ray订阅功能测试
- [x] 多语言界面检查
- [x] 权限配置验证

## 🚀 发布步骤

### 第一步：GitHub Release发布

#### 1.1 创建GitHub Release
```bash
# 确保所有更改已推送
git push origin main
git push origin v1.0.2

# 访问GitHub仓库
# https://github.com/tiantian0514/ProxyMaster/releases
```

#### 1.2 填写Release信息
- **Tag version**: `v1.0.2`
- **Release title**: `ProxyMaster v1.0.2 - 突破存储限制，智能节点识别`
- **Description**: 复制`RELEASE_NOTES_v1.0.2.md`内容
- **Attach files**: 上传`ProxyMaster-v1.0.2.zip`

#### 1.3 Release描述模板
```markdown
## 🚀 重要更新

ProxyMaster v1.0.2 解决了V2Ray订阅存储限制问题，支持大型订阅数据，并新增智能节点识别功能。

## ✨ 主要特性
- 🔓 突破Chrome扩展8KB存储限制
- 🧠 智能识别节点类型（直接可用 vs 需要客户端）
- 📝 支持手动输入订阅内容，解决CORS限制
- 🎨 优化用户界面和错误提示

## 📦 安装方式
1. **Chrome Web Store**: 等待审核通过后自动更新
2. **手动安装**: 下载zip包，开发者模式加载

## 🔗 相关链接
- [完整发布说明](./RELEASE_NOTES_v1.0.2.md)
- [使用文档](./README.md)
- [问题反馈](https://github.com/tiantian0514/ProxyMaster/issues)

**下载**: ProxyMaster-v1.0.2.zip
```

### 第二步：Chrome Web Store发布

#### 2.1 准备Store资料
- **扩展包**: `ProxyMaster-v1.0.2.zip`
- **版本说明**: 简化版发布说明
- **截图**: 更新功能截图（如有新界面）

#### 2.2 登录Chrome Web Store
```
访问: https://chrome.google.com/webstore/devconsole/
使用开发者账号登录
```

#### 2.3 上传新版本
1. 选择ProxyMaster扩展
2. 点击"Package"标签
3. 上传`ProxyMaster-v1.0.2.zip`
4. 填写版本更新说明

#### 2.4 版本更新说明（Store用）
```
v1.0.2 重要更新：

✨ 新功能：
• 解决V2Ray订阅存储限制，支持大型订阅数据
• 智能识别节点类型，提供清晰使用指导
• 新增手动输入订阅功能，解决网络限制问题
• 优化用户界面和错误提示

🐛 修复：
• 修复大型订阅无法保存的问题
• 解决CORS跨域访问限制
• 改进错误处理和用户反馈

🔧 技术改进：
• 重构存储机制，支持分块存储
• 优化性能和内存使用
• 增强代码稳定性

完全向后兼容，现有配置自动迁移。
```

#### 2.5 提交审核
1. 检查所有信息无误
2. 点击"Submit for review"
3. 等待Google审核（通常1-3个工作日）

### 第三步：社区推广

#### 3.1 更新项目文档
- [x] README.md添加v1.0.2特性说明
- [x] 更新安装指南
- [x] 添加新功能使用示例

#### 3.2 社交媒体宣传
```markdown
🎉 ProxyMaster v1.0.2 发布！

主要亮点：
🔓 突破存储限制，支持大型V2Ray订阅
🧠 智能节点识别，使用更简单
📝 手动输入功能，解决网络限制
🎨 界面优化，体验更流畅

GitHub: https://github.com/tiantian0514/ProxyMaster
Chrome Store: [等待审核通过]

#ProxyMaster #Chrome扩展 #代理管理 #V2Ray
```

#### 3.3 用户通知
- 在GitHub Issues中发布更新通知
- 回复相关问题，告知已在新版本中修复
- 更新项目Wiki（如有）

### 第四步：发布后监控

#### 4.1 监控指标
- GitHub Release下载量
- Chrome Web Store安装量
- 用户反馈和评分
- 新Issue报告

#### 4.2 问题响应
- 及时回复用户问题
- 收集功能建议
- 记录发现的Bug
- 准备热修复（如需要）

#### 4.3 数据收集
```bash
# 检查发布包下载情况
# GitHub Insights -> Traffic

# 监控用户反馈
# Issues, Discussions, Reviews
```

## 📊 发布时间线

### 预计时间安排
- **Day 0**: GitHub Release发布 ✅
- **Day 0**: Chrome Web Store提交审核 ⏳
- **Day 1-3**: 等待Chrome Store审核
- **Day 3-7**: 用户逐步更新，收集反馈
- **Day 7+**: 根据反馈准备下一版本

### 关键里程碑
1. ✅ **代码完成**: 2024-05-26
2. ✅ **GitHub发布**: 2024-05-26
3. ⏳ **Store提交**: 待执行
4. ⏳ **审核通过**: 预计2024-05-29
5. ⏳ **用户更新**: 预计2024-05-30

## 🔧 应急预案

### 如果发现严重Bug
1. 立即在GitHub标记Issue为Critical
2. 准备热修复版本（v1.0.2.1）
3. 紧急发布修复版本
4. 通知用户更新

### 如果Chrome Store审核被拒
1. 仔细阅读拒绝原因
2. 修复相关问题
3. 重新提交审核
4. 在GitHub说明延迟原因

### 如果用户反馈负面
1. 及时回应用户关切
2. 收集详细问题信息
3. 评估是否需要回滚
4. 制定改进计划

## 📞 联系信息

### 发布负责人
- **GitHub**: @tiantian0514
- **Email**: [项目邮箱]

### 紧急联系
- 发现严重问题请立即创建GitHub Issue
- 标记为`urgent`或`critical`标签
- 在Issue中@提及维护者

---

**文档版本**: v1.0.2  
**最后更新**: 2024-05-26  
**下次更新**: 发布完成后 