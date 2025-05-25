// ProxyMaster Inject Script
// 这个脚本运行在页面的JavaScript环境中

(function() {
  'use strict';

  // 检测WebRTC泄露
  function detectWebRTCLeak() {
    if (!window.RTCPeerConnection) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.createDataChannel('');
    pc.createOffer().then(offer => pc.setLocalDescription(offer));

    pc.onicecandidate = function(event) {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          console.log('ProxyMaster: Detected potential IP leak:', ipMatch[1]);
          // 可以发送消息到content script报告泄露
        }
      }
    };

    // 清理
    setTimeout(() => {
      pc.close();
    }, 1000);
  }

  // 监控网络请求
  function monitorNetworkRequests() {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    // 拦截fetch请求
    window.fetch = function(...args) {
      console.log('ProxyMaster: Fetch request to:', args[0]);
      return originalFetch.apply(this, args);
    };

    // 拦截XMLHttpRequest
    const originalOpen = originalXHR.prototype.open;
    originalXHR.prototype.open = function(method, url, ...args) {
      console.log('ProxyMaster: XHR request to:', url);
      return originalOpen.apply(this, [method, url, ...args]);
    };
  }

  // 初始化
  function init() {
    console.log('ProxyMaster inject script loaded');
    
    // 检测WebRTC泄露
    detectWebRTCLeak();
    
    // 监控网络请求（可选，用于调试）
    // monitorNetworkRequests();
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(); 