// ProxyMaster 性能图表模块
class PerformanceCharts {
  constructor() {
    this.charts = {};
    this.colors = {
      primary: '#667eea',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      info: '#17a2b8',
      secondary: '#6c757d'
    };
  }

  // 创建响应时间趋势图
  createResponseTimeChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // 准备数据
    const timeline = data.timeline || {};
    const dates = Object.keys(timeline).sort();
    const responseTimes = dates.map(date => {
      const dayData = timeline[date];
      return dayData.avgResponseTime || 0;
    });
    
    this.drawLineChart(ctx, {
      labels: dates.map(date => new Date(date).toLocaleDateString()),
      data: responseTimes,
      title: '响应时间趋势',
      yLabel: '响应时间 (ms)',
      color: this.colors.primary
    });
    
    return canvas;
  }

  // 创建代理使用分布饼图
  createProxyUsageChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const proxyUsage = data.usage?.proxyUsage || {};
    
    const labels = Object.keys(proxyUsage);
    const values = Object.values(proxyUsage);
    const colors = this.generateColors(labels.length);
    
    this.drawPieChart(ctx, {
      labels,
      data: values,
      colors,
      title: '代理使用分布'
    });
    
    return canvas;
  }

  // 创建请求量柱状图
  createRequestVolumeChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    const timeline = data.timeline || {};
    const dates = Object.keys(timeline).sort();
    const requests = dates.map(date => timeline[date].requests || 0);
    const errors = dates.map(date => timeline[date].errors || 0);
    
    this.drawBarChart(ctx, {
      labels: dates.map(date => new Date(date).toLocaleDateString()),
      datasets: [
        {
          label: '成功请求',
          data: requests.map((req, i) => req - errors[i]),
          color: this.colors.success
        },
        {
          label: '失败请求',
          data: errors,
          color: this.colors.danger
        }
      ],
      title: '请求量统计',
      yLabel: '请求数'
    });
    
    return canvas;
  }

  // 创建24小时访问热力图
  createHourlyHeatmap(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const hourlyStats = data.usage?.hourlyStats || new Array(24).fill(0);
    
    this.drawHeatmap(ctx, {
      data: hourlyStats,
      title: '24小时访问分布',
      labels: Array.from({length: 24}, (_, i) => `${i}:00`)
    });
    
    return canvas;
  }

  // 创建域名访问排行
  createDomainRankingChart(container, data) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const domainStats = data.usage?.domainStats || {};
    
    // 取前10个最常访问的域名
    const sortedDomains = Object.entries(domainStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    const labels = sortedDomains.map(([domain]) => domain);
    const values = sortedDomains.map(([,count]) => count);
    
    this.drawHorizontalBarChart(ctx, {
      labels,
      data: values,
      title: '热门网站排行',
      xLabel: '访问次数',
      color: this.colors.info
    });
    
    return canvas;
  }

  // 绘制折线图
  drawLineChart(ctx, options) {
    const { labels, data, title, yLabel, color } = options;
    const padding = 60;
    const width = ctx.canvas.width - 2 * padding;
    const height = ctx.canvas.height - 2 * padding - 40; // 为标题留空间
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, ctx.canvas.width / 2, 30);
    
    // 计算数据范围
    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;
    
    // 绘制坐标轴
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
    
    // 绘制Y轴标签
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding + height - (i / 5) * height;
      const value = minValue + (i / 5) * range;
      ctx.fillText(Math.round(value), padding - 10, y + 4);
    }
    
    // 绘制X轴标签
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding + (i / (labels.length - 1)) * width;
      ctx.fillText(label, x, padding + height + 20);
    });
    
    // 绘制数据线
    if (data.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      data.forEach((value, i) => {
        const x = padding + (i / (data.length - 1)) * width;
        const y = padding + height - ((value - minValue) / range) * height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // 绘制数据点
      ctx.fillStyle = color;
      data.forEach((value, i) => {
        const x = padding + (i / (data.length - 1)) * width;
        const y = padding + height - ((value - minValue) / range) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    
    // Y轴标签
    ctx.save();
    ctx.translate(20, ctx.canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  // 绘制饼图
  drawPieChart(ctx, options) {
    const { labels, data, colors, title } = options;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2 + 20;
    const radius = Math.min(centerX, centerY - 40) - 20;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, centerX, 30);
    
    const total = data.reduce((sum, value) => sum + value, 0);
    if (total === 0) return;
    
    let currentAngle = -Math.PI / 2;
    
    data.forEach((value, i) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      // 绘制扇形
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      // 绘制标签
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 30);
      
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = labelX > centerX ? 'left' : 'right';
      const percentage = ((value / total) * 100).toFixed(1);
      ctx.fillText(`${labels[i]} (${percentage}%)`, labelX, labelY);
      
      currentAngle += sliceAngle;
    });
  }

  // 绘制柱状图
  drawBarChart(ctx, options) {
    const { labels, datasets, title, yLabel } = options;
    const padding = 60;
    const width = ctx.canvas.width - 2 * padding;
    const height = ctx.canvas.height - 2 * padding - 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, ctx.canvas.width / 2, 30);
    
    // 计算最大值
    const allData = datasets.flatMap(dataset => dataset.data);
    const maxValue = Math.max(...allData, 1);
    
    // 绘制坐标轴
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
    
    // 绘制数据
    const barWidth = width / labels.length / datasets.length * 0.8;
    const groupWidth = width / labels.length;
    
    datasets.forEach((dataset, datasetIndex) => {
      ctx.fillStyle = dataset.color;
      
      dataset.data.forEach((value, i) => {
        const barHeight = (value / maxValue) * height;
        const x = padding + i * groupWidth + datasetIndex * barWidth + groupWidth * 0.1;
        const y = padding + height - barHeight;
        
        ctx.fillRect(x, y, barWidth, barHeight);
      });
    });
    
    // 绘制标签
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding + i * groupWidth + groupWidth / 2;
      ctx.fillText(label, x, padding + height + 20);
    });
  }

  // 绘制热力图
  drawHeatmap(ctx, options) {
    const { data, title, labels } = options;
    const padding = 40;
    const width = ctx.canvas.width - 2 * padding;
    const height = ctx.canvas.height - 2 * padding - 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, ctx.canvas.width / 2, 30);
    
    const maxValue = Math.max(...data, 1);
    const cellWidth = width / data.length;
    
    data.forEach((value, i) => {
      const intensity = value / maxValue;
      const color = this.getHeatmapColor(intensity);
      
      ctx.fillStyle = color;
      ctx.fillRect(padding + i * cellWidth, padding, cellWidth - 1, height);
      
      // 绘制标签
      if (i % 4 === 0) { // 每4小时显示一个标签
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], padding + i * cellWidth + cellWidth / 2, padding + height + 15);
      }
    });
  }

  // 绘制水平柱状图
  drawHorizontalBarChart(ctx, options) {
    const { labels, data, title, xLabel, color } = options;
    const padding = 60;
    const width = ctx.canvas.width - 2 * padding - 100; // 为标签留更多空间
    const height = ctx.canvas.height - 2 * padding - 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, ctx.canvas.width / 2, 30);
    
    const maxValue = Math.max(...data, 1);
    const barHeight = height / labels.length * 0.8;
    const barSpacing = height / labels.length;
    
    data.forEach((value, i) => {
      const barWidth = (value / maxValue) * width;
      const y = padding + i * barSpacing + barSpacing * 0.1;
      
      // 绘制柱子
      ctx.fillStyle = color;
      ctx.fillRect(padding + 100, y, barWidth, barHeight);
      
      // 绘制标签
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(labels[i], padding + 95, y + barHeight / 2 + 4);
      
      // 绘制数值
      ctx.textAlign = 'left';
      ctx.fillText(value.toString(), padding + 105 + barWidth, y + barHeight / 2 + 4);
    });
  }

  // 生成颜色
  generateColors(count) {
    const baseColors = [
      this.colors.primary,
      this.colors.success,
      this.colors.warning,
      this.colors.danger,
      this.colors.info,
      this.colors.secondary
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  // 获取热力图颜色
  getHeatmapColor(intensity) {
    const r = Math.round(255 * intensity);
    const g = Math.round(255 * (1 - intensity));
    const b = 100;
    return `rgb(${r}, ${g}, ${b})`;
  }

  // 创建图例
  createLegend(container, items) {
    const legend = document.createElement('div');
    legend.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 10px;
      justify-content: center;
    `;
    
    items.forEach(item => {
      const legendItem = document.createElement('div');
      legendItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 5px;
      `;
      
      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 12px;
        height: 12px;
        background-color: ${item.color};
        border-radius: 2px;
      `;
      
      const label = document.createElement('span');
      label.textContent = item.label;
      label.style.fontSize = '12px';
      label.style.color = '#666';
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      legend.appendChild(legendItem);
    });
    
    container.appendChild(legend);
    return legend;
  }
}

// 导出图表类
// 在Service Worker环境中，使用globalThis而不是window
if (typeof globalThis !== 'undefined') {
  globalThis.PerformanceCharts = PerformanceCharts;
} else if (typeof window !== 'undefined') {
  window.PerformanceCharts = PerformanceCharts;
} 