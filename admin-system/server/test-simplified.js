const http = require('http');

// 测试简化后的系统功能
async function testSimplifiedSystem() {
  console.log('🚀 测试简化后的后台管理系统...\n');

  try {
    // 1. 测试本地管理员登录
    console.log('1. 测试本地管理员登录...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (loginResponse.statusCode === 200) {
      const loginData = JSON.parse(loginResponse.body);
      console.log('   ✅ 本地管理员登录成功');
      console.log(`   用户: ${loginData.data.user.username}`);
      console.log(`   权限: ${loginData.data.user.permissions.join(', ')}\n`);
      const token = loginData.data.token;

      // 2. 测试管理员管理功能
      console.log('2. 测试管理员管理功能...');
      const adminUsersResponse = await makeRequest('GET', '/api/admin/users', null, 'localhost', 8002, {
        'Authorization': `Bearer ${token}`
      });

      if (adminUsersResponse.statusCode === 200) {
        const adminData = JSON.parse(adminUsersResponse.body);
        console.log('   ✅ 管理员列表获取成功');
        console.log(`   当前管理员数量: ${adminData.data.users.length}\n`);
      } else {
        console.log('   ❌ 管理员列表获取失败');
        console.log(`   状态码: ${adminUsersResponse.statusCode}`);
      }

      // 3. 测试仪表盘功能
      console.log('3. 测试仪表盘功能...');
      const dashboardResponse = await makeRequest('GET', '/api/dashboard/stats', null, 'localhost', 8002, {
        'Authorization': `Bearer ${token}`
      });

      if (dashboardResponse.statusCode === 200) {
        const dashboardData = JSON.parse(dashboardResponse.body);
        console.log('   ✅ 仪表盘数据获取成功');
        console.log(`   总用户数: ${dashboardData.data.totalUsers}`);
        console.log(`   活跃用户数: ${dashboardData.data.activeUsers}\n`);
      } else {
        console.log('   ❌ 仪表盘数据获取失败');
        console.log(`   状态码: ${dashboardResponse.statusCode}`);
      }

    } else {
      console.log('   ❌ 本地管理员登录失败');
      console.log(`   状态码: ${loginResponse.statusCode}`);
      console.log(`   响应: ${loginResponse.body}\n`);
      return;
    }

    console.log('🎉 简化后的系统测试完成！');
    console.log('\n📋 系统特点总结:');
    console.log('✅ 移除了Casdoor依赖，降低复杂度');
    console.log('✅ 保留本地JWT认证，简单可靠');
    console.log('✅ 完整的RBAC权限管理');
    console.log('✅ 管理员用户CRUD功能');
    console.log('✅ 与主系统共享数据库');
    console.log('\n👥 用户管理方式:');
    console.log('• 通过后台管理界面创建管理员用户');
    console.log('• 支持重置密码、启用/禁用用户');
    console.log('• 基于角色的权限控制');
    console.log('\n🔒 安全特性:');
    console.log('• BCrypt密码哈希 (12轮)');
    console.log('• JWT令牌认证');
    console.log('• 登录失败次数限制');
    console.log('• CORS安全配置');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
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

testSimplifiedSystem();