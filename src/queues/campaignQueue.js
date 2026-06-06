import { Queue } from 'bullmq';
import { connection } from '../redis.js';

export const campaignQueue = new Queue('whatsapp-campaigns', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
