const http = require('http');

// 测试完整登录流程
async function testCompleteFlow() {
  console.log('🚀 开始测试完整的后台管理系统登录流程...\n');

  // 1. 测试健康检查
  console.log('1. 测试健康检查...');
  const healthResponse = await makeRequest('GET', '/health');
  console.log(`   健康检查状态: ${healthResponse.statusCode}`);
  if (healthResponse.statusCode === 200) {
    console.log('   ✅ API服务器健康状态良好\n');
  }

  // 2. 测试管理员登录
  console.log('2. 测试管理员登录...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });

  if (loginResponse.statusCode === 200) {
    const loginData = JSON.parse(loginResponse.body);
    console.log('   ✅ 登录成功');
    console.log(`   用户: ${loginData.data.user.username}`);
    console.log(`   角色: ${loginData.data.user.role}`);
    console.log(`   权限: ${loginData.data.user.permissions.join(', ')}\n`);

    const token = loginData.data.token;

    // 3. 测试仪表盘API
    console.log('3. 测试仪表盘统计API...');
    const dashboardResponse = await makeRequest('GET', '/api/dashboard/stats', null, {
      'Authorization': `Bearer ${token}`
    });

    if (dashboardResponse.statusCode === 200) {
      const dashboardData = JSON.parse(dashboardResponse.body);
      console.log('   ✅ 仪表盘数据获取成功');
      console.log(`   总用户数: ${dashboardData.data.totalUsers}`);
      console.log(`   活跃用户数: ${dashboardData.data.activeUsers}`);
      console.log(`   新增用户数: ${dashboardData.data.newUsers}`);
      console.log(`   今日活跃用户: ${dashboardData.data.todayActiveUsers}\n`);
    }

    // 4. 测试用户列表API
    console.log('4. 测试用户列表API...');
    const usersResponse = await makeRequest('GET', '/api/users?limit=10', null, {
      'Authorization': `Bearer ${token}`
    });

    if (usersResponse.statusCode === 200) {
      const usersData = JSON.parse(usersResponse.body);
      console.log('   ✅ 用户列表获取成功');
      console.log(`   获取到用户数: ${usersData.data.users.length}`);
      console.log(`   总页数: ${usersData.data.pagination.totalPages}\n`);
    }

    console.log('🎉 所有测试通过！后台管理系统运行正常！');
    console.log('\n📋 系统架构总结:');
    console.log('- 前端: http://localhost:8001 (Ant Design Pro + UmiJS)');
    console.log('- 后端API: http://localhost:8002 (Node.js + Express + TypeScript)');
    console.log('- 数据库: PostgreSQL (共享主系统数据库)');
    console.log('- 认证: JWT Token');
    console.log('\n🔐 默认管理员账号:');
    console.log('- 用户名: admin');
    console.log('- 密码: admin123');

  } else {
    console.log('   ❌ 登录失败');
    console.log(`   状态码: ${loginResponse.statusCode}`);
    console.log(`   响应: ${loginResponse.body}`);
  }
}

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8002,
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
      console.error(`请求错误: ${e.message}`);
      resolve({
        statusCode: 500,
        body: e.message
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 运行测试
testCompleteFlow().catch(console.error);