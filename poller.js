import mysql from 'mysql2/promise';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  QUEUE_URL,
  REGION
} = process.env;

const sqs = new SQSClient({ region: REGION });

async function sendToQueue(mc_id) {
  const params = {
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ mc_id }),
  };
  await sqs.send(new SendMessageCommand(params));
  console.log(`✅ Queued mc_id: ${mc_id}`);
}

async function runPoller() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });

  const [rows] = await connection.execute("SELECT mc_id FROM enhanced_profile_statuses WHERE ep_status != 'Complete'");
  console.log(`📦 Fetched ${rows.length} records`);

  for (const row of rows) {
    try {
      await sendToQueue(row.mc_id);
    } catch (error) {
      console.error(`❌ Error queueing ${row.mc_id}:`, error.message);
    }
  }

  await connection.end();
  console.log("🏁 Poller finished.");
}

runPoller();

setTimeout(() => {
  console.log("🛑 Time limit reached (5 minutes). Exiting gracefully...");
  process.exit(0);
}, 5 * 60 * 1000);
