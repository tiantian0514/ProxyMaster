#!/usr/bin/env python3
"""
简单的HTTP服务器，用于测试HTML文件
避免直接打开文件时的CSP限制
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加CORS头部，允许跨域访问
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    # 确保在正确的目录中运行
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print(f"🚀 启动测试服务器...")
    print(f"📁 服务目录: {script_dir}")
    print(f"🌐 服务地址: http://localhost:{PORT}")
    print(f"📋 可用的测试页面:")
    print(f"   • V2Ray解析器测试: http://localhost:{PORT}/test-v2ray-parser.html")
    print(f"   • 锚点导航测试: http://localhost:{PORT}/test-hash-navigation.html")
    print(f"   • CSP修复验证: http://localhost:{PORT}/test-csp-fix.html")
    print(f"   • 扩展选项页面: http://localhost:{PORT}/options.html")
    print(f"\n按 Ctrl+C 停止服务器")
    
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            # 自动打开浏览器
            webbrowser.open(f'http://localhost:{PORT}/test-csp-fix.html')
            httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 服务器已停止")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 端口 {PORT} 已被占用，请尝试其他端口或关闭占用该端口的程序")
        else:
            print(f"❌ 启动服务器时出错: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 