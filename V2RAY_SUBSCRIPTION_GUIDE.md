# 📡 V2Ray订阅解析使用指南

## 🔗 支持的订阅格式

### 1. 订阅URL（推荐）
- **格式**: `https://example.com/subscription.txt`
- **说明**: 指向包含节点配置的文本文件
- **使用**: 在"订阅URL测试"区域输入链接，点击"获取并解析订阅"

### 2. 直接订阅内容
- **Base64编码**: 大多数订阅服务提供的格式
- **原始内容**: 未编码的节点链接列表
- **使用**: 在"订阅内容测试"区域粘贴内容

## 🛠️ 支持的节点协议

### VMess
```
vmess://eyJ2IjoiMiIsInBzIjoi...
```

### VLESS  
```
vless://uuid@server:port?encryption=none&security=tls#name
```

### Trojan
```
trojan://password@server:port?sni=domain#name
```

### Shadowsocks
```
ss://method:password@server:port#name
```

## 🚀 使用步骤

### 方法1：使用订阅URL
1. 获取V2Ray订阅链接（通常以.txt结尾）
2. 在"订阅URL测试"区域输入链接
3. 点击"获取并解析订阅"
4. 查看解析结果

### 方法2：使用订阅内容
1. 访问订阅链接，复制页面内容
2. 在"订阅内容测试"区域粘贴内容
3. 点击"解析订阅"
4. 查看解析结果

### 方法3：测试单个节点
1. 在"单个节点URL测试"区域输入节点链接
2. 点击"解析节点"
3. 查看节点详情

## ⚠️ 常见问题

### CORS跨域限制
**问题**: 直接访问订阅URL时出现CORS错误
**解决**: 
1. 手动访问订阅链接
2. 复制页面内容
3. 使用"订阅内容测试"功能

### Base64解码失败
**问题**: 订阅内容无法正确解码
**解决**:
1. 确认内容完整（没有截断）
2. 检查是否包含特殊字符
3. 尝试使用原始内容而非Base64

### 节点解析失败
**问题**: 部分节点无法解析
**原因**:
- 节点链接格式不标准
- 协议版本不兼容
- 参数缺失或错误

## 🔧 配置文件生成

解析成功后，可以：
1. 点击"生成配置文件"下载V2Ray配置
2. 将配置导入V2Ray客户端
3. 设置本地代理端口（默认1080）

## 📝 测试示例

### 示例订阅内容（Base64）
```
dm1lc3M6Ly9leUoySWpvaU1pSXNJbkJ6SWpvaWRHVnpkQzF1YjJSbElpd2lZV1JrSWpvaVpYaGhiWEJzWlM1amIyMGlMQ0p3YjNKMElqb2lORFF6SWl3aWFXUWlPaUl4TWpNME5UWTNPQzB4TWpNMExURXlNelF0TVRJek5DMHhNak0wTlRZM09EbGhZbU1pZlE9PQ==
```

### 示例原始内容
```
vmess://eyJ2IjoiMiIsInBzIjoidGVzdC1ub2RlIiwiYWRkIjoiZXhhbXBsZS5jb20iLCJwb3J0IjoiNDQzIiwiaWQiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODlhYmMifQ==
```

## 🔒 安全提醒

1. **仅用于测试**: 此工具仅用于解析测试，不会连接服务器
2. **隐私保护**: 不要在公共环境中输入真实的订阅信息
3. **配置安全**: 生成的配置文件包含敏感信息，请妥善保管

## 🆘 故障排除

### 1. 无法获取订阅
- 检查网络连接
- 确认订阅链接有效
- 尝试手动访问链接

### 2. 解析结果为空
- 检查订阅内容格式
- 确认协议支持
- 查看浏览器控制台错误信息

### 3. 配置生成失败
- 确认节点信息完整
- 检查必要参数是否存在
- 尝试重新解析节点

---

**更新时间**: 2024年12月  
**版本**: v1.0  
**支持协议**: VMess, VLESS, Trojan, Shadowsocks 