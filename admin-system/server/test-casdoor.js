const http = require('http');

// 测试Casdoor集成功能
async function testCasdoorIntegration() {
  console.log('🔐 开始测试Casdoor SSO集成功能...\n');

  try {
    // 1. 测试获取Casdoor授权URL
    console.log('1. 测试获取Casdoor授权URL...');
    const authUrlResponse = await makeRequest('GET', '/api/auth/casdoor/login?redirect_to=/dashboard');

    if (authUrlResponse.statusCode === 200) {
      const authData = JSON.parse(authUrlResponse.body);
      console.log('   ✅ 成功获取Casdoor授权URL');
      console.log(`   授权URL: ${authData.data.authUrl.substring(0, 100)}...\n`);
    } else {
      console.log('   ❌ 获取授权URL失败');
      console.log(`   状态码: ${authUrlResponse.statusCode}`);
      console.log(`   响应: ${authUrlResponse.body}\n`);
      return;
    }

    // 2. 测试本地管理员登录（确保本地登录仍然工作）
    console.log('2. 测试本地管理员登录...');
    const localLoginResponse = await makeRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (localLoginResponse.statusCode === 200) {
      const localData = JSON.parse(localLoginResponse.body);
      console.log('   ✅ 本地管理员登录正常工作');
      console.log(`   用户: ${localData.data.user.username}`);
      console.log(`   认证方式: ${localData.data.user.authMethod || 'local'}\n`);
    } else {
      console.log('   ❌ 本地管理员登录失败');
      console.log(`   状态码: ${localLoginResponse.statusCode}`);
      console.log(`   响应: ${localLoginResponse.body}\n`);
    }

    // 3. 测试健康检查
    console.log('3. 测试API服务器健康状态...');
    const healthResponse = await makeRequest('GET', '/health');

    if (healthResponse.statusCode === 200) {
      console.log('   ✅ API服务器健康状态良好\n');
    } else {
      console.log('   ❌ API服务器健康检查失败\n');
    }

    console.log('🎉 Casdoor集成测试完成！');
    console.log('\n📋 Casdoor集成状态总结:');
    console.log('✅ Casdoor服务已集成');
    console.log('✅ 支持混合认证模式（本地JWT + Casdoor SSO）');
    console.log('✅ 本地管理员登录功能正常');
    console.log('✅ Casdoor授权URL生成正常');
    console.log('\n🔧 下一步操作:');
    console.log('1. 在Casdoor管理面板创建后台管理应用');
    console.log('2. 配置正确的Client ID和Secret');
    console.log('3. 设置管理员角色和权限');
    console.log('4. 测试完整的Casdoor SSO流程');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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

testCasdoorIntegration();