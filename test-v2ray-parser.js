let manager;
let parsedNodes = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    manager = new V2RaySubscriptionManager();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    // 解析节点按钮
    document.getElementById('parseNodeBtn').addEventListener('click', parseNodeUrl);
    
    // 加载示例节点按钮
    document.getElementById('loadExampleNodeBtn').addEventListener('click', loadExampleNode);
    
    // 解析订阅按钮
    document.getElementById('parseSubscriptionBtn').addEventListener('click', parseSubscription);
    
    // 加载示例订阅按钮
    document.getElementById('loadExampleSubscriptionBtn').addEventListener('click', loadExampleSubscription);
    
    // 获取订阅URL按钮
    document.getElementById('fetchSubscriptionBtn').addEventListener('click', fetchSubscriptionUrl);
    
    // 加载示例URL按钮
    document.getElementById('loadExampleUrlBtn').addEventListener('click', loadExampleUrl);
    
    // 配置生成区域的事件委托
    document.getElementById('configGeneration').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action="generate-config"]');
        if (button) {
            const nodeData = button.getAttribute('data-node');
            if (nodeData) {
                try {
                    const node = JSON.parse(nodeData);
                    generateConfig(node);
                } catch (error) {
                    console.error('Failed to parse node data:', error);
                }
            }
        }
    });
    
    // 节点结果区域的事件委托
    document.getElementById('nodeResult').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action="generate-config"]');
        if (button) {
            const nodeData = button.getAttribute('data-node');
            if (nodeData) {
                try {
                    const node = JSON.parse(nodeData);
                    generateConfig(node);
                } catch (error) {
                    console.error('Failed to parse node data:', error);
                }
            }
        }
    });
}

// 解析单个节点URL
function parseNodeUrl() {
    const url = document.getElementById('nodeUrl').value.trim();
    const resultDiv = document.getElementById('nodeResult');
    
    if (!url) {
        resultDiv.innerHTML = '<div class="error">请输入节点URL</div>';
        return;
    }

    try {
        const node = manager.parseNodeUrl(url);
        if (node) {
            resultDiv.innerHTML = `
                <div class="success">✅ 解析成功</div>
                <div class="node-item">
                    <div class="node-header">${node.name}</div>
                    <div class="node-details">
                        <strong>类型：</strong>${node.type}<br>
                        <strong>地址：</strong>${node.address}:${node.port}<br>
                        ${node.type === 'vmess' ? `<strong>ID：</strong>${node.id}<br><strong>加密：</strong>${node.security}<br>` : ''}
                        ${node.type === 'shadowsocks' ? `<strong>加密方法：</strong>${node.method}<br>` : ''}
                    </div>
                </div>
                <button class="btn" data-action="generate-config" data-node='${JSON.stringify(node)}'>生成配置文件</button>
            `;
            parsedNodes = [node];
            updateConfigGeneration();
        } else {
            resultDiv.innerHTML = '<div class="error">❌ 无法解析此URL，请检查格式是否正确</div>';
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ 解析错误: ${error.message}</div>`;
    }
}

// 解析订阅内容
function parseSubscription() {
    const content = document.getElementById('subscriptionContent').value.trim();
    const resultDiv = document.getElementById('subscriptionResult');
    
    if (!content) {
        resultDiv.innerHTML = '<div class="error">请输入订阅内容</div>';
        return;
    }

    try {
        const nodes = manager.parseSubscriptionContent(content);
        if (nodes.length > 0) {
            let html = `
                <div class="success">✅ 解析成功，共找到 ${nodes.length} 个节点</div>
                <button class="btn" id="addSubscriptionBtn">添加到订阅列表</button>
            `;
            
            nodes.forEach((node, index) => {
                html += `
                    <div class="node-item">
                        <div class="node-header">${node.name}</div>
                        <div class="node-details">
                            <strong>类型：</strong>${node.type} | 
                            <strong>地址：</strong>${node.address}:${node.port}
                        </div>
                    </div>
                `;
            });
            
            resultDiv.innerHTML = html;
            parsedNodes = nodes;
            updateConfigGeneration();

            // 添加订阅按钮事件监听
            document.getElementById('addSubscriptionBtn').addEventListener('click', async () => {
                const name = prompt('请输入订阅名称（可选）：', '手动添加的订阅');
                const result = await manager.addSubscriptionFromContent(content, name);
                
                if (result.success) {
                    alert(`✅ 订阅添加成功，共 ${result.nodeCount} 个节点`);
                } else {
                    alert(`❌ 添加失败: ${result.error}`);
                }
            });
        } else {
            resultDiv.innerHTML = '<div class="error">❌ 未找到有效的节点配置</div>';
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ 解析错误: ${error.message}</div>`;
    }
}

// 更新配置生成区域
function updateConfigGeneration() {
    const div = document.getElementById('configGeneration');
    if (parsedNodes.length === 0) {
        div.innerHTML = '<p style="color: #666;">请先解析一些节点</p>';
        return;
    }

    let html = '<div style="margin-bottom: 15px;">';
    parsedNodes.forEach((node, index) => {
        html += `
            <button class="btn btn-secondary" data-action="generate-config" data-node='${JSON.stringify(node)}'>
                生成 ${node.name} 配置
            </button>
        `;
    });
    html += '</div>';
    
    div.innerHTML = html;
}

// 生成配置文件
function generateConfig(node) {
    try {
        const config = manager.generateV2RayConfig(node);
        const configJson = JSON.stringify(config, null, 2);
        
        // 创建下载链接
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `v2ray-${node.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        // 显示配置内容
        const div = document.getElementById('configGeneration');
        div.innerHTML += `
            <div class="result">
                <strong>生成的V2Ray配置文件：</strong>
                ${configJson}
            </div>
        `;
    } catch (error) {
        alert('生成配置失败: ' + error.message);
    }
}

// 加载示例节点
function loadExampleNode() {
    // 这是一个示例VMess链接（无效的，仅用于测试解析）
    const exampleVmess = 'vmess://' + btoa(JSON.stringify({
        "v": "2",
        "ps": "测试节点-美国",
        "add": "example.com",
        "port": "443",
        "id": "12345678-1234-1234-1234-123456789abc",
        "aid": "0",
        "scy": "auto",
        "net": "ws",
        "type": "none",
        "host": "",
        "path": "/path",
        "tls": "tls"
    }));
    
    document.getElementById('nodeUrl').value = exampleVmess;
}

// 加载示例订阅
function loadExampleSubscription() {
    // 创建示例订阅内容
    const exampleNodes = [
        'vmess://' + btoa(JSON.stringify({
            "v": "2",
            "ps": "示例节点1-香港",
            "add": "hk.example.com",
            "port": "443",
            "id": "12345678-1234-1234-1234-123456789abc",
            "aid": "0",
            "scy": "auto",
            "net": "ws",
            "tls": "tls"
        })),
        'vmess://' + btoa(JSON.stringify({
            "v": "2", 
            "ps": "示例节点2-美国",
            "add": "us.example.com",
            "port": "80",
            "id": "87654321-4321-4321-4321-cba987654321",
            "aid": "0",
            "scy": "auto",
            "net": "tcp"
        }))
    ];
    
    const subscriptionContent = btoa(exampleNodes.join('\n'));
    document.getElementById('subscriptionContent').value = subscriptionContent;
}

// 获取并解析订阅URL
async function fetchSubscriptionUrl() {
    const url = document.getElementById('subscriptionUrl').value.trim();
    const resultDiv = document.getElementById('subscriptionUrlResult');
    
    if (!url) {
        resultDiv.innerHTML = '<div class="error">请输入订阅URL</div>';
        return;
    }

    // 显示加载状态
    resultDiv.innerHTML = '<div style="color: #666;">🔄 正在获取订阅内容...</div>';

    try {
        // 使用V2Ray管理器获取订阅
        const nodes = await manager.fetchAndParseSubscription(url);
        
        if (nodes.length > 0) {
            let html = `<div class="success">✅ 获取成功，共找到 ${nodes.length} 个节点</div>`;
            
            nodes.forEach((node, index) => {
                html += `
                    <div class="node-item">
                        <div class="node-header">${node.name}</div>
                        <div class="node-details">
                            <strong>类型：</strong>${node.type} | 
                            <strong>地址：</strong>${node.address}:${node.port}
                        </div>
                    </div>
                `;
            });
            
            resultDiv.innerHTML = html;
            parsedNodes = nodes;
            updateConfigGeneration();
        } else {
            resultDiv.innerHTML = '<div class="error">❌ 未找到有效的节点配置</div>';
        }
    } catch (error) {
        console.error('Fetch subscription error:', error);
        let errorMessage = error.message;
        
        // 处理常见的CORS错误
        if (error.message.includes('CORS') || error.message.includes('fetch')) {
            errorMessage = `网络请求失败: ${error.message}\n\n可能的原因：\n1. CORS跨域限制\n2. 订阅链接无效\n3. 网络连接问题\n\n建议：\n1. 手动访问订阅链接\n2. 复制页面内容\n3. 将内容粘贴到下方的"订阅内容测试"区域\n4. 点击"解析订阅"按钮`;
        }
        
        resultDiv.innerHTML = `
            <div class="error">
                <div>❌ 获取失败: ${errorMessage}</div>
                <div class="error-help">
                    <p><strong>解决方法：</strong></p>
                    <ol>
                        <li>手动访问订阅链接</li>
                        <li>复制页面内容</li>
                        <li>将内容粘贴到下方的"订阅内容测试"区域</li>
                        <li>点击"解析订阅"按钮</li>
                    </ol>
                </div>
            </div>
        `;
    }
}

// 加载示例订阅URL
function loadExampleUrl() {
    // 这是一个示例URL（实际不存在）
    const exampleUrl = 'https://example.com/v2ray-subscription.txt';
    document.getElementById('subscriptionUrl').value = exampleUrl;
    
    // 显示提示信息
    const resultDiv = document.getElementById('subscriptionUrlResult');
    resultDiv.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; color: #856404;">
            <strong>💡 提示：</strong>这是一个示例URL，实际不存在。<br>
            请替换为真实的V2Ray订阅链接，或者将订阅内容复制到下方的"订阅内容测试"区域。
        </div>
    `;
} 