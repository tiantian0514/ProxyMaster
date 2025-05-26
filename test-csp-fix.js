// 测试CSP是否正常工作
function runCSPTest() {
    const resultDiv = document.getElementById('testResult');
    
    try {
        // 如果这段代码能正常运行，说明CSP没有阻止外部脚本
        resultDiv.innerHTML = '<div class="success">✅ CSP测试通过！没有违规错误。</div>';
        console.log('CSP test passed');
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ CSP测试失败: ${error.message}</div>`;
        console.error('CSP test failed:', error);
    }
}

// 设置事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 运行CSP测试
    runCSPTest();
    
    // 按钮1事件
    document.getElementById('testBtn1').addEventListener('click', () => {
        alert('按钮1点击成功！事件监听器正常工作。');
    });
    
    // 按钮2事件
    document.getElementById('testBtn2').addEventListener('click', () => {
        const resultDiv = document.getElementById('testResult');
        resultDiv.innerHTML += '<div class="success">✅ 按钮2点击成功！</div>';
    });
    
    // 事件委托测试
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action="test"]');
        if (button) {
            const value = button.getAttribute('data-value');
            const resultDiv = document.getElementById('testResult');
            resultDiv.innerHTML += `<div class="success">✅ 事件委托测试成功！值: ${value}</div>`;
        }
    });
});

// 检查控制台错误
window.addEventListener('error', (e) => {
    console.error('页面错误:', e.error);
    const resultDiv = document.getElementById('testResult');
    resultDiv.innerHTML += `<div class="error">❌ 页面错误: ${e.message}</div>`;
}); 