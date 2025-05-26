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

  // 从内容添加订阅
  async addSubscriptionFromContent(content, name = '') {
    try {
      const nodes = this.parseSubscriptionContent(content);
      
      const subscription = {
        id: Date.now().toString(),
        name: name || '手动添加的订阅',
        url: '',  // 空URL表示这是手动添加的订阅
        nodes: nodes,
        lastUpdate: Date.now(),
        enabled: true
      };
      
      this.subscriptions.push(subscription);
      await this.saveSubscriptions();
      
      return { success: true, subscription, nodeCount: nodes.length };
    } catch (error) {
      console.error('Failed to add subscription from content:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取并解析订阅内容
  async fetchAndParseSubscription(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      
      // 检查内容是否为空
      if (!content || content.trim().length === 0) {
        throw new Error('订阅内容为空');
      }
      
      return this.parseSubscriptionContent(content);
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('网络请求失败，可能是CORS限制或网络问题');
      }
      throw error;
    }
  }

  // 解析订阅内容
  parseSubscriptionContent(content) {
    const nodes = [];
    let decodedContent = content.trim();
    
    // 尝试Base64解码
    if (this.isBase64(decodedContent)) {
      try {
        decodedContent = atob(decodedContent);
        console.log('Successfully decoded Base64 content');
      } catch (e) {
        console.log('Base64 decode failed, treating as plain text');
      }
    }
    
    // 分割行并过滤空行
    const lines = decodedContent.split(/[\r\n]+/).filter(line => line.trim());
    
    console.log(`Processing ${lines.length} lines from subscription`);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        const node = this.parseNodeUrl(trimmedLine);
        if (node) {
          nodes.push(node);
          console.log(`Parsed node: ${node.name} (${node.type})`);
        } else {
          console.log(`Failed to parse line: ${trimmedLine.substring(0, 50)}...`);
        }
      }
    }
    
    console.log(`Total parsed nodes: ${nodes.length}`);
    return nodes;
  }
  
  // 检查字符串是否为Base64编码
  isBase64(str) {
    try {
      // Base64字符串只包含A-Z, a-z, 0-9, +, /, =
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }
      
      // 尝试解码并重新编码，看是否一致
      const decoded = atob(str);
      const reencoded = btoa(decoded);
      return reencoded === str;
    } catch (e) {
      return false;
    }
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
        tls: config.tls || ''
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
        security: params.get('security') || ''
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
        allowInsecure: params.get('allowInsecure') === '1'
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
        password: password
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

  // 生成直接代理配置（不需要本地V2Ray客户端）
  generateDirectProxyConfig(node) {
    // 对于某些简单的协议，可以直接使用
    switch (node.type) {
      case 'shadowsocks':
        // Shadowsocks可以通过一些代理工具直接使用
        return {
          scheme: 'socks5',
          host: node.address,
          port: node.port,
          auth: {
            username: node.method,
            password: node.password
          },
          nodeInfo: node,
          requiresClient: false
        };
        
      case 'trojan':
        // Trojan也可以在某些情况下直接使用
        return {
          scheme: 'https',
          host: node.address,
          port: node.port,
          auth: {
            username: '',
            password: node.password
          },
          nodeInfo: node,
          requiresClient: false
        };
        
      default:
        // VMess和VLESS需要专门的客户端
        return {
          scheme: 'socks5',
          host: '127.0.0.1',
          port: 1080,
          nodeInfo: node,
          requiresClient: true,
          clientInfo: {
            message: '此节点需要V2Ray客户端支持',
            downloadUrl: 'https://github.com/v2fly/v2ray-core/releases',
            configFile: this.generateV2RayConfig(node)
          }
        };
    }
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
    try {
      // 将订阅数据序列化
      const dataString = JSON.stringify(this.subscriptions);
      
      // 如果数据较小，直接存储
      if (dataString.length < 7000) { // 留一些余量
        await chrome.storage.sync.set({
          v2raySubscriptions: this.subscriptions,
          v2raySubscriptionsChunked: false
        });
        return;
      }
      
      // 数据较大时，分块存储
      const chunkSize = 7000; // 每块7KB，留余量
      const chunks = [];
      
      for (let i = 0; i < dataString.length; i += chunkSize) {
        chunks.push(dataString.slice(i, i + chunkSize));
      }
      
      // 清除旧的分块数据
      const keysToRemove = [];
      for (let i = 0; i < 50; i++) { // 最多清除50个分块
        keysToRemove.push(`v2raySubscriptionsChunk_${i}`);
      }
      await chrome.storage.sync.remove(keysToRemove);
      
      // 保存新的分块数据
      const saveData = {
        v2raySubscriptions: null, // 清除旧的单一存储
        v2raySubscriptionsChunked: true,
        v2raySubscriptionsChunkCount: chunks.length
      };
      
      chunks.forEach((chunk, index) => {
        saveData[`v2raySubscriptionsChunk_${index}`] = chunk;
      });
      
      await chrome.storage.sync.set(saveData);
      console.log(`Subscriptions saved in ${chunks.length} chunks`);
    } catch (error) {
      console.error('Failed to save subscriptions:', error);
      throw error;
    }
  }

  // 加载订阅数据
  async loadSubscriptions() {
    try {
      const result = await chrome.storage.sync.get([
        'v2raySubscriptions', 
        'v2raySubscriptionsChunked', 
        'v2raySubscriptionsChunkCount'
      ]);
      
      // 如果不是分块存储，直接返回
      if (!result.v2raySubscriptionsChunked) {
        this.subscriptions = result.v2raySubscriptions || [];
        return this.subscriptions;
      }
      
      // 加载分块数据
      const chunkCount = result.v2raySubscriptionsChunkCount || 0;
      if (chunkCount === 0) {
        this.subscriptions = [];
        return this.subscriptions;
      }
      
      const chunkKeys = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkKeys.push(`v2raySubscriptionsChunk_${i}`);
      }
      
      const chunkData = await chrome.storage.sync.get(chunkKeys);
      
      // 重组数据
      let dataString = '';
      for (let i = 0; i < chunkCount; i++) {
        const chunk = chunkData[`v2raySubscriptionsChunk_${i}`];
        if (chunk) {
          dataString += chunk;
        }
      }
      
      if (dataString) {
        this.subscriptions = JSON.parse(dataString);
      } else {
        this.subscriptions = [];
      }
      
      console.log(`Subscriptions loaded from ${chunkCount} chunks`);
      return this.subscriptions;
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      this.subscriptions = [];
      return this.subscriptions;
    }
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