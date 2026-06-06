import 'dotenv/config';
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

import { messageQueue } from './queues/messageQueue.js';
import { campaignQueue } from './queues/campaignQueue.js';
import { messageWorker } from './workers/messageWorker.js';
import { campaignWorker } from './workers/campaignWorker.js';
import apiRouter from './routes/api.js';

const app = express();
app.use(express.json());

// Bull Board UI en /admin/queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(messageQueue),
    new BullMQAdapter(campaignQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
app.use('/api', apiRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[WhatsApp Service] Running on port ${PORT}`);
  console.log(`[Bull Board] UI available at http://localhost:${PORT}/admin/queues`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await messageWorker.close();
  await campaignWorker.close();
  process.exit(0);
});
