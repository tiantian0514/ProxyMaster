// V2Ray订阅管理器
class V2RaySubscriptionManager {
  constructor() {
    this.nodes = [];
    this.subscriptions = [];
  }

  // 添加订阅链接
  async addSubscription(url, name = '') {
    try {
      const nodes = await this.fetchAndParseSubscription(url);
      
      const subscription = {
        id: Date.now().toString(),
        name: name || this.extractDomainFromUrl(url),
        url: url,
        nodes: nodes,
        lastUpdate: Date.now(),
        enabled: true
      };
      
      this.subscriptions.push(subscription);
      await this.saveSubscriptions();
      
      return { success: true, subscription, nodeCount: nodes.length };
    } catch (error) {
      console.error('Failed to add subscription:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取并解析订阅内容
  async fetchAndParseSubscription(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    return this.parseSubscriptionContent(content);
  }

  // 解析订阅内容
  parseSubscriptionContent(content) {
    const nodes = [];
    
    // 尝试Base64解码
    let decodedContent;
    try {
      decodedContent = atob(content.trim());
    } catch (e) {
      decodedContent = content;
    }
    
    const lines = decodedContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const node = this.parseNodeUrl(line.trim());
      if (node) {
        nodes.push(node);
      }
    }
    
    return nodes;
  }

  // 解析节点URL
  parseNodeUrl(url) {
    if (url.startsWith('vmess://')) {
      return this.parseVmessUrl(url);
    } else if (url.startsWith('vless://')) {
      return this.parseVlessUrl(url);
    } else if (url.startsWith('trojan://')) {
      return this.parseTrojanUrl(url);
    } else if (url.startsWith('ss://')) {
      return this.parseShadowsocksUrl(url);
    }
    return null;
  }

  // 解析VMess URL
  parseVmessUrl(vmessUrl) {
    try {
      const base64 = vmessUrl.substring(8);
      const config = JSON.parse(atob(base64));
      
      return {
        type: 'vmess',
        name: config.ps || `${config.add}:${config.port}`,
        address: config.add,
        port: parseInt(config.port),
        id: config.id,
        alterId: parseInt(config.aid) || 0,
        security: config.scy || 'auto',
        network: config.net || 'tcp',
        path: config.path || '',
        host: config.host || '',
        tls: config.tls || '',
        originalUrl: vmessUrl
      };
    } catch (error) {
      console.error('Failed to parse VMess URL:', error);
      return null;
    }
  }

  // 解析VLESS URL
  parseVlessUrl(vlessUrl) {
    try {
      const url = new URL(vlessUrl);
      const params = new URLSearchParams(url.search);
      
      return {
        type: 'vless',
        name: decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`,
        address: url.hostname,
        port: parseInt(url.port),
        id: url.username,
        encryption: params.get('encryption') || 'none',
        flow: params.get('flow') || '',
        network: params.get('type') || 'tcp',
        security: params.get('security') || '',
        originalUrl: vlessUrl
      };
    } catch (error) {
      console.error('Failed to parse VLESS URL:', error);
      return null;
    }
  }

  // 解析Trojan URL
  parseTrojanUrl(trojanUrl) {
    try {
      const url = new URL(trojanUrl);
      const params = new URLSearchParams(url.search);
      
      return {
        type: 'trojan',
        name: decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`,
        address: url.hostname,
        port: parseInt(url.port),
        password: url.username,
        sni: params.get('sni') || url.hostname,
        allowInsecure: params.get('allowInsecure') === '1',
        originalUrl: trojanUrl
      };
    } catch (error) {
      console.error('Failed to parse Trojan URL:', error);
      return null;
    }
  }

  // 解析Shadowsocks URL
  parseShadowsocksUrl(ssUrl) {
    try {
      const url = new URL(ssUrl);
      const userInfo = atob(url.username);
      const [method, password] = userInfo.split(':');
      
      return {
        type: 'shadowsocks',
        name: decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`,
        address: url.hostname,
        port: parseInt(url.port),
        method: method,
        password: password,
        originalUrl: ssUrl
      };
    } catch (error) {
      console.error('Failed to parse Shadowsocks URL:', error);
      return null;
    }
  }

  // 生成本地代理配置
  generateLocalProxyConfig(node) {
    // 这里返回的是本地SOCKS代理配置
    // 实际的V2Ray配置需要用户在本地客户端中设置
    return {
      scheme: 'socks5',
      host: '127.0.0.1',
      port: 1080, // 假设本地V2Ray监听1080端口
      nodeInfo: node
    };
  }

  // 生成V2Ray配置文件（供用户下载）
  generateV2RayConfig(node) {
    const config = {
      log: {
        loglevel: "warning"
      },
      inbounds: [{
        port: 1080,
        protocol: "socks",
        settings: {
          auth: "noauth",
          udp: true
        }
      }],
      outbounds: []
    };

    // 根据节点类型生成outbound配置
    switch (node.type) {
      case 'vmess':
        config.outbounds.push({
          protocol: "vmess",
          settings: {
            vnext: [{
              address: node.address,
              port: node.port,
              users: [{
                id: node.id,
                alterId: node.alterId,
                security: node.security
              }]
            }]
          },
          streamSettings: {
            network: node.network,
            security: node.tls ? "tls" : ""
          }
        });
        break;
        
      case 'vless':
        config.outbounds.push({
          protocol: "vless",
          settings: {
            vnext: [{
              address: node.address,
              port: node.port,
              users: [{
                id: node.id,
                encryption: node.encryption,
                flow: node.flow
              }]
            }]
          }
        });
        break;
        
      // 其他协议类似...
    }

    return config;
  }

  // 保存订阅数据
  async saveSubscriptions() {
    await chrome.storage.sync.set({
      v2raySubscriptions: this.subscriptions
    });
  }

  // 加载订阅数据
  async loadSubscriptions() {
    const result = await chrome.storage.sync.get(['v2raySubscriptions']);
    this.subscriptions = result.v2raySubscriptions || [];
    return this.subscriptions;
  }

  // 更新订阅
  async updateSubscription(subscriptionId) {
    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    try {
      const nodes = await this.fetchAndParseSubscription(subscription.url);
      subscription.nodes = nodes;
      subscription.lastUpdate = Date.now();
      
      await this.saveSubscriptions();
      return { success: true, nodeCount: nodes.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 辅助方法
  extractDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown';
    }
  }

  // 获取所有节点
  getAllNodes() {
    const allNodes = [];
    for (const subscription of this.subscriptions) {
      if (subscription.enabled) {
        allNodes.push(...subscription.nodes);
      }
    }
    return allNodes;
  }
}

// 导出管理器
window.V2RaySubscriptionManager = V2RaySubscriptionManager; 