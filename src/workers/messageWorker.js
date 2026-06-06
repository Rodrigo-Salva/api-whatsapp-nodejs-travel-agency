import { Worker } from 'bullmq';
import axios from 'axios';
import { connection } from '../redis.js';
import { sendTextMessage } from '../services/wahaService.js';

const DJANGO_DELIVERY_URL = process.env.DJANGO_DELIVERY_URL || 'http://localhost:8000/api/whatsapp/delivery/';

async function notifyDjango(messageId, status, wahaMessageId = null) {
  try {
    await axios.post(DJANGO_DELIVERY_URL, { messageId, status, wahaMessageId });
  } catch (err) {
    console.error('[Worker] Failed to notify Django:', err.message);
  }
}

export const messageWorker = new Worker(
  'whatsapp-messages',
  async (job) => {
    const { chatId, text, messageId } = job.data;
    console.log(`[Worker] Sending message to ${chatId} (Django ID: ${messageId})`);

    const result = await sendTextMessage(chatId, text);
    // WAHA puede devolver id como string o como objeto {_serialized, id, ...}
    const rawId = result?.id;
    const wahaId = typeof rawId === 'string' ? rawId : (rawId?._serialized ?? rawId?.id ?? null);
    await notifyDjango(messageId, 'sent', wahaId);

    return { wahaMessageId: result?.id };
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

messageWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

messageWorker.on('failed', async (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
  if (job.attemptsMade >= job.opts.attempts) {
    await notifyDjango(job.data.messageId, 'failed');
  }
});
