/**
 * Start ngrok tunnel for local development
 *
 * This script creates a public URL for your local server
 * so Alipay can send payment notifications to your localhost
 */

const ngrok = require('ngrok');

async function startNgrok() {
  try {
    console.log('\n🚀 启动 ngrok 隧道...\n');

    const url = await ngrok.connect({
      addr: 3010,
      region: 'jp', // Use Japan region for faster connection in China
    });

    console.log('✅ ngrok 隧道已建立！\n');
    console.log('📍 公网地址:', url);
    console.log('\n请复制上面的 URL，然后：');
    console.log('1. 更新 .env 文件中的 ALIPAY_NOTIFY_URL');
    console.log('2. 重启开发服务器 (bun run dev)');
    console.log('3. 重新测试支付流程\n');
    console.log('⚠️  保持此窗口打开，关闭将断开隧道\n');
    console.log('按 Ctrl+C 可以停止 ngrok\n');

  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

startNgrok();

// Keep the process running
process.on('SIGINT', async () => {
  console.log('\n\n🛑 正在关闭 ngrok...');
  await ngrok.kill();
  console.log('✅ ngrok 已关闭');
  process.exit(0);
});
