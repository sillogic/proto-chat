const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://Sillogic:Sillogic@123@pgm-wz9d9326yqi0j9i27o.pg.rds.aliyuncs.com:5432/lobechat'
  });

  await client.connect();
  console.log('Connected to database');

  const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'protochat%'");

  console.log('Existing ProtoChat tables:', JSON.stringify(result.rows));

  await client.end();
}

run().catch(e => console.error('Error:', e.message));
