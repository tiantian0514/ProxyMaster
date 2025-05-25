// ProxyMaster Content Script
(function() {
  'use strict';

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'getPageInfo') {
        sendResponse({
          url: window.location.href,
          title: document.title,
          hostname: window.location.hostname
        });
      }
    });

    // 检测页面加载性能
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      
      // 发送性能数据到background
      chrome.runtime.sendMessage({
        action: 'reportPerformance',
        data: {
          url: window.location.href,
          loadTime: loadTime,
          timestamp: Date.now()
        }
      });
    }
  }

  // 注入页面脚本（如果需要）
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // 如果需要访问页面的JavaScript环境，可以调用injectScript()
  // injectScript();
})(); 