const http = require('http');

// 测试通过前端代理访问新API服务器
async function testProxy() {
  console.log('🔄 测试前端代理到新API服务器的连接...\n');

  // 测试通过前端代理访问登录API
  console.log('1. 测试前端代理的登录API...');

  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, 'localhost', 8001);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('   ✅ 前端代理连接正常！');
      console.log(`   登录成功，用户: ${data.data.user.username}`);
      console.log(`   返回Token: ${data.data.token.substring(0, 50)}...\n`);

      // 测试通过前端代理访问dashboard API
      console.log('2. 测试前端代理的仪表盘API...');

      const dashboardResponse = await makeRequest('GET', '/api/dashboard/stats', null, 'localhost', 8001, {
        'Authorization': `Bearer ${data.data.token}`
      });

      if (dashboardResponse.statusCode === 200) {
        const dashboardData = JSON.parse(dashboardResponse.body);
        console.log('   ✅ 仪表盘API也正常工作！');
        console.log(`   总用户数: ${dashboardData.data.totalUsers}`);
        console.log(`   活跃用户数: ${dashboardData.data.activeUsers}\n`);

        console.log('🎉 前端代理配置修复成功！');
        console.log('现在可以正常使用 http://localhost:8001 访问后台管理系统了');
      } else {
        console.log('   ❌ 仪表盘API访问失败');
        console.log(`   状态码: ${dashboardResponse.statusCode}`);
      }

    } else {
      console.log('   ❌ 登录失败');
      console.log(`   状态码: ${response.statusCode}`);
      console.log(`   响应: ${response.body}`);
    }
  } catch (error) {
    console.log('   ❌ 请求失败:', error.message);
  }
}

function makeRequest(method, path, data = null, hostname = 'localhost', port = 8002, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

testProxy();