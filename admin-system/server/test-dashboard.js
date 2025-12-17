const http = require('http');

// 从登录测试中获取的token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJjZmMxMWE2LWZlYjgtNDMxMi05ZTM4LWM2NjkzYTZlYTBkMSIsInVzZXJuYW1lIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQHByb3RvY2hhdC5jb20iLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJ1c2Vycy5yZWFkIiwidXNlcnMud3JpdGUiLCJwbGFucy5yZWFkIiwicGxhbnMud3JpdGUiLCJhcGlfa2V5cy5yZWFkIiwiYXBpX2tleXMud3JpdGUiLCJzdGF0cy5yZWFkIiwic3lzdGVtLmFkbWluIl0sImlhdCI6MTc2NTk0MDkxMywiZXhwIjoxNzY2MDI3MzEzfQ.26EAzva5gUWrSsEh_UxCHyVKB-nwmn6VVHb7Qwhw0rk';

const options = {
  hostname: 'localhost',
  port: 8002,
  path: '/api/dashboard/stats',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers, null, 2)}`);

  res.setEncoding('utf8');
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`响应体: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`请求遇到问题: ${e.message}`);
});

req.end();