# 网站排行统计功能修复说明

## 问题描述

用户反馈热门网站排行功能显示的是进程URL而不是用户输入的网址。经过深入分析发现，问题有两个层面：

1. **域名提取逻辑不一致**：不同文件中的域名提取方法处理www前缀的方式不同
2. **统计范围过于宽泛**：当前统计的是所有网络请求，包括页面中的广告、资源文件等，而不是用户主动访问的网站

## 问题原因

### 1. 域名提取逻辑不一致

在ProxyMaster扩展中，有多个文件都实现了域名提取功能，但实现方式不一致：

1. **background.js** 中的 `extractDomain()` 方法：
   - ✅ 正确处理了www前缀
   - 将 `www.google.com` 和 `google.com` 统一为 `google.com`

2. **performance-monitor.js** 中的 `extractDomain()` 方法：
   - ❌ 直接返回完整hostname
   - `www.google.com` 和 `google.com` 被视为不同域名

3. **v2ray-manager.js** 中的 `extractDomainFromUrl()` 方法：
   - ❌ 直接返回完整hostname
   - 同样存在www前缀处理问题

### 2. 统计范围过于宽泛

当前的实现通过`webRequest` API监听所有网络请求，这包括：
- ✅ 用户主动访问的页面（地址栏输入、点击链接）
- ❌ 页面中的广告请求（如`pubads.g.doubleclick.net`）
- ❌ 资源文件加载（CSS、JS、图片等）
- ❌ AJAX请求和API调用
- ❌ 第三方跟踪脚本

这导致热门网站排行中充斥着用户并未主动访问的域名。

## 修复方案

### 1. 统一域名提取逻辑

将所有域名提取方法统一为以下实现：

```javascript
extractDomain(url) {
  try {
    if (!url) return 'unknown'; // 或 'Unknown'
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // 统一处理www前缀：www.example.com 和 example.com 视为同一域名
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch {
    return 'unknown'; // 或 'Unknown'
  }
}
```

### 2. 改进统计范围：只统计用户主动访问

使用`webNavigation` API替代`webRequest` API来准确识别用户主动访问：

```javascript
// 在webNavigation.onCommitted中记录页面导航
recordPageNavigation(details) {
  const navigationData = {
    url: details.url,
    navigationType: details.transitionType, // typed, generated, reload等
    isUserInitiated: this.isUserInitiatedNavigation(details.transitionType)
  };
  
  this.performanceMonitor.recordRequest(navigationData);
}

// 判断是否为用户主动发起的导航
isUserInitiatedNavigation(transitionType) {
  const userInitiatedTypes = [
    'typed',        // 用户在地址栏输入
    'generated',    // 用户点击链接
    'reload',       // 用户刷新页面
    'form_submit'   // 表单提交
  ];
  
  return userInitiatedTypes.includes(transitionType);
}
```

### 3. 修复的文件

1. **performance-monitor.js** (第327行)
   - 修复 `extractDomain()` 方法
   - 更新域名统计逻辑，只统计`isUserInitiated`为true的记录

2. **v2ray-manager.js** (第563行)
   - 修复 `extractDomainFromUrl()` 方法
   - 确保V2Ray订阅管理中的域名处理一致

3. **background.js**
   - 添加 `recordPageNavigation()` 方法
   - 添加 `isUserInitiatedNavigation()` 方法
   - 更新 `shouldRecordRequest()` 方法，只记录主框架请求

### 4. 修复效果

修复后的效果：

#### 域名提取统一化：
| 原始URL | 修复前 | 修复后 |
|---------|--------|--------|
| `https://www.google.com` | `www.google.com` | `google.com` |
| `https://google.com` | `google.com` | `google.com` |
| `https://www.github.com/user/repo` | `www.github.com` | `github.com` |

#### 统计范围精准化：
| 请求类型 | 修复前 | 修复后 |
|---------|--------|--------|
| 用户在地址栏输入网址 | ✅ 统计 | ✅ 统计 |
| 用户点击链接跳转 | ✅ 统计 | ✅ 统计 |
| 页面中的广告请求 | ❌ 错误统计 | ✅ 不统计 |
| CSS/JS/图片资源 | ❌ 错误统计 | ✅ 不统计 |
| AJAX/API请求 | ❌ 错误统计 | ✅ 不统计 |

## 测试验证

创建了两个测试页面：

### 1. `test-domain-extraction.html` - 域名提取测试
- **预设测试用例**：验证各种URL格式的域名提取
- **自定义URL测试**：允许用户输入任意URL进行测试
- **性能数据测试**：查看当前存储的域名统计数据

### 2. `test-navigation-tracking.html` - 页面导航跟踪测试
- **导航数据分析**：查看最近的页面导航记录
- **用户行为识别**：区分用户主动访问和自动请求
- **域名统计验证**：确认只统计用户主动访问的网站
- **导航类型分析**：显示不同类型的导航行为

### 测试用例

- ✅ `https://www.google.com` → `google.com`
- ✅ `https://google.com` → `google.com`
- ✅ `https://www.github.com/user/repo` → `github.com`
- ✅ `https://github.com` → `github.com`
- ✅ `https://pubads.g.doubleclick.net/ads` → `pubads.g.doubleclick.net`
- ✅ `https://www.baidu.com/search?q=test` → `baidu.com`
- ✅ `https://127.0.0.1:8080` → `127.0.0.1`
- ✅ `https://localhost:3000` → `localhost`
- ✅ `invalid-url` → `unknown`
- ✅ 空字符串 → `unknown`

## 影响范围

这次修复影响以下功能：

1. **热门网站排行**：现在显示简洁的域名而不是完整hostname
2. **性能统计**：域名统计更加准确，www和非www版本会合并统计
3. **V2Ray订阅管理**：域名显示更加一致
4. **自动切换规则**：域名匹配更加智能

## 向后兼容性

- ✅ 不影响现有配置和规则
- ✅ 现有性能数据仍然可以正常读取
- ✅ 新旧数据会自动合并统计

## 部署说明

1. 重新加载扩展以应用修复
2. 新的网站访问会使用修复后的域名提取逻辑
3. 历史数据保持不变，新数据会使用统一的域名格式
4. 建议用户查看性能报告页面验证修复效果

## 相关文件

- `performance-monitor.js` - 性能监控核心逻辑
- `v2ray-manager.js` - V2Ray订阅管理
- `background.js` - 后台脚本，添加了页面导航跟踪
- `test-domain-extraction.html` - 域名提取功能测试页面
- `test-navigation-tracking.html` - 页面导航跟踪测试页面
- `DOMAIN_EXTRACTION_FIX.md` - 本修复说明文档 