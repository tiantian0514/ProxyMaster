// ProxyMaster 性能监控模块
class PerformanceMonitor {
  constructor() {
    this.isEnabled = false;
    this.dataBuffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 30000; // 30秒刷新一次
    this.retentionDays = 30;
    this.init();
  }

  async init() {
    // 检查是否启用性能监控
    const settings = await chrome.storage.sync.get(['enablePerformanceMonitoring']);
    this.isEnabled = settings.enablePerformanceMonitoring !== false;
    
    if (this.isEnabled) {
      this.startMonitoring();
    }
  }

  startMonitoring() {
    console.log('🔍 Performance monitoring started');
    
    // 定期刷新数据到存储
    setInterval(() => {
      this.flushData();
    }, this.flushInterval);
    
    // 定期清理过期数据
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // 每天清理一次
  }

  // 记录请求数据
  recordRequest(data) {
    if (!this.isEnabled) return;
    
    const record = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type: 'request',
      url: data.url,
      domain: this.extractDomain(data.url),
      proxy: data.proxy || 'direct',
      method: data.method || 'GET',
      responseTime: data.responseTime || 0,
      success: data.success !== false,
      errorCode: data.errorCode || null,
      errorMessage: data.errorMessage || null,
      userAgent: data.userAgent || '',
      tabId: data.tabId || null,
      navigationType: data.navigationType || null,
      isUserInitiated: data.isUserInitiated || false
    };
    
    this.addToBuffer(record);
  }

  // 记录代理切换
  recordProxySwitch(data) {
    if (!this.isEnabled) return;
    
    const record = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type: 'proxy_switch',
      fromProxy: data.fromProxy || 'direct',
      toProxy: data.toProxy || 'direct',
      reason: data.reason || 'manual', // manual, auto, rule
      tabId: data.tabId || null,
      url: data.url || null,
      domain: data.url ? this.extractDomain(data.url) : null,
      switchTime: data.switchTime || 0
    };
    
    this.addToBuffer(record);
  }

  // 记录连接测试结果
  recordConnectionTest(data) {
    if (!this.isEnabled) return;
    
    const record = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type: 'connection_test',
      proxy: data.proxy,
      testUrl: data.testUrl || 'http://www.google.com',
      responseTime: data.responseTime || 0,
      success: data.success !== false,
      errorCode: data.errorCode || null,
      errorMessage: data.errorMessage || null
    };
    
    this.addToBuffer(record);
  }

  // 添加到缓冲区
  addToBuffer(record) {
    this.dataBuffer.push(record);
    
    // 如果缓冲区满了，立即刷新
    if (this.dataBuffer.length >= this.maxBufferSize) {
      this.flushData();
    }
  }

  // 刷新数据到存储
  async flushData() {
    if (this.dataBuffer.length === 0) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `performance_data_${today}`;
      
      // 获取今天已有的数据
      const result = await chrome.storage.local.get([storageKey]);
      const existingData = result[storageKey] || [];
      
      // 合并新数据
      const newData = [...existingData, ...this.dataBuffer];
      
      // 保存到存储
      await chrome.storage.local.set({
        [storageKey]: newData
      });
      
      console.log(`📊 Flushed ${this.dataBuffer.length} performance records`);
      
      // 清空缓冲区
      this.dataBuffer = [];
      
    } catch (error) {
      console.error('Failed to flush performance data:', error);
    }
  }

  // 清理过期数据
  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      // 获取所有性能数据键
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const key in allData) {
        if (key.startsWith('performance_data_')) {
          const dateStr = key.replace('performance_data_', '');
          const dataDate = new Date(dateStr);
          
          if (dataDate < cutoffDate) {
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`🗑️ Cleaned up ${keysToRemove.length} old performance data files`);
      }
      
    } catch (error) {
      console.error('Failed to cleanup old performance data:', error);
    }
  }

  // 获取性能统计
  async getPerformanceStats(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 默认7天
      endDate = new Date(),
      proxy = null,
      domain = null
    } = options;
    
    try {
      // 获取日期范围内的所有数据
      const data = await this.getDataInRange(startDate, endDate);
      
      // 过滤数据
      let filteredData = data;
      if (proxy) {
        filteredData = filteredData.filter(record => 
          record.proxy === proxy || record.toProxy === proxy
        );
      }
      if (domain) {
        filteredData = filteredData.filter(record => 
          record.domain === domain
        );
      }
      
      // 计算统计数据
      return this.calculateStats(filteredData);
      
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return null;
    }
  }

  // 获取日期范围内的数据
  async getDataInRange(startDate, endDate) {
    const allData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const storageKey = `performance_data_${dateStr}`;
      
      try {
        const result = await chrome.storage.local.get([storageKey]);
        const dayData = result[storageKey] || [];
        allData.push(...dayData);
      } catch (error) {
        console.warn(`Failed to load data for ${dateStr}:`, error);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return allData;
  }

  // 计算统计数据
  calculateStats(data) {
    const requests = data.filter(record => record.type === 'request');
    const switches = data.filter(record => record.type === 'proxy_switch');
    const tests = data.filter(record => record.type === 'connection_test');
    
    // 基础统计
    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests * 100) : 0;
    
    // 响应时间统计
    const responseTimes = requests
      .filter(r => r.responseTime > 0)
      .map(r => r.responseTime);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    
    // 代理使用统计
    const proxyUsage = {};
    requests.forEach(request => {
      const proxy = request.proxy || 'direct';
      proxyUsage[proxy] = (proxyUsage[proxy] || 0) + 1;
    });
    
    // 域名访问统计（只统计用户主动访问的页面）
    const domainStats = {};
    requests.forEach(request => {
      if (request.domain && request.isUserInitiated) {
        domainStats[request.domain] = (domainStats[request.domain] || 0) + 1;
      }
    });
    
    // 时间分布统计
    const hourlyStats = new Array(24).fill(0);
    requests.forEach(request => {
      const hour = new Date(request.timestamp).getHours();
      hourlyStats[hour]++;
    });
    
    return {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: Math.round(successRate * 100) / 100,
        totalSwitches: switches.length,
        totalTests: tests.length
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        minResponseTime: Math.round(minResponseTime),
        maxResponseTime: Math.round(maxResponseTime),
        responseTimes: responseTimes
      },
      usage: {
        proxyUsage,
        domainStats,
        hourlyStats
      },
      timeline: this.generateTimeline(data)
    };
  }

  // 生成时间线数据
  generateTimeline(data) {
    const timeline = {};
    
    data.forEach(record => {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = {
          requests: 0,
          switches: 0,
          tests: 0,
          errors: 0
        };
      }
      
      if (record.type === 'request') {
        timeline[date].requests++;
        if (!record.success) {
          timeline[date].errors++;
        }
      } else if (record.type === 'proxy_switch') {
        timeline[date].switches++;
      } else if (record.type === 'connection_test') {
        timeline[date].tests++;
      }
    });
    
    return timeline;
  }

  // 提取域名
  extractDomain(url) {
    try {
      if (!url) return 'unknown';
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // 统一处理www前缀：www.example.com 和 example.com 视为同一域名
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      return hostname;
    } catch {
      return 'unknown';
    }
  }

  // 启用/禁用监控
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    await chrome.storage.sync.set({ enablePerformanceMonitoring: enabled });
    
    if (enabled && !this.monitoringStarted) {
      this.startMonitoring();
    }
  }

  // 导出数据
  async exportData(options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      format = 'json'
    } = options;
    
    const data = await this.getDataInRange(startDate, endDate);
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      totalRecords: data.length,
      data: data
    };
  }

  // 转换为CSV格式
  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(record => 
        headers.map(header => 
          JSON.stringify(record[header] || '')
        ).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
}

// 导出性能监控器
// 在Service Worker环境中，使用globalThis而不是window
if (typeof globalThis !== 'undefined') {
  globalThis.PerformanceMonitor = PerformanceMonitor;
} else if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
} 