import { Worker } from 'bullmq';
import axios from 'axios';
import { connection } from '../redis.js';
import { messageQueue } from '../queues/messageQueue.js';

const DJANGO_DELIVERY_URL = process.env.DJANGO_DELIVERY_URL || 'http://localhost:8000/api/whatsapp/delivery/';

export const campaignWorker = new Worker(
  'whatsapp-campaigns',
  async (job) => {
    const { campaignId, contacts, messageTemplate, delayBetweenMs } = job.data;
    console.log(`[CampaignWorker] Launching campaign ${campaignId} for ${contacts.length} contacts`);

    for (let i = 0; i < contacts.length; i++) {
      const { chatId, messageId } = contacts[i];
      const delayMs = i * delayBetweenMs;

      await messageQueue.add(
        'send',
        { chatId, text: messageTemplate, messageId },
        { delay: delayMs, priority: 8 }
      );
    }

    try {
      await axios.post(DJANGO_DELIVERY_URL, {
        campaignId,
        status: 'queued',
      });
    } catch (err) {
      console.error('[CampaignWorker] Failed to notify Django:', err.message);
    }
  },
  { connection, concurrency: 2 }
);

campaignWorker.on('failed', async (job, err) => {
  console.error(`[CampaignWorker] Campaign ${job.data.campaignId} failed:`, err.message);
  try {
    await axios.post(DJANGO_DELIVERY_URL, {
      campaignId: job.data.campaignId,
      status: 'failed',
    });
  } catch {}
});
