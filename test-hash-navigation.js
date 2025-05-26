function updateHashDisplay() {
    const hash = window.location.hash || '无';
    document.getElementById('currentHash').textContent = `当前锚点: ${hash}`;
}

function testHash(hashValue) {
    window.location.hash = hashValue;
    updateHashDisplay();
}

// 监听锚点变化
window.addEventListener('hashchange', updateHashDisplay);

// 初始化显示
updateHashDisplay();

// 每秒更新一次显示（用于调试）
setInterval(updateHashDisplay, 1000);

// 设置事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', updateHashDisplay);
    
    // 测试按钮事件委托
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-hash]');
        if (button) {
            const hashValue = button.getAttribute('data-hash');
            if (hashValue) {
                testHash(hashValue);
            }
        }
    });
}); 