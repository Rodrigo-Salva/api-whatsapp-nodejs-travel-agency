import { Router } from 'express';
import { messageQueue } from '../queues/messageQueue.js';
import { campaignQueue } from '../queues/campaignQueue.js';

const router = Router();

// POST /api/queue/message — Encolar un mensaje con delay opcional
router.post('/queue/message', async (req, res) => {
  const { chatId, text, messageId, delayMs = 0, priority = 5 } = req.body;

  if (!chatId || !text || !messageId) {
    return res.status(400).json({ error: 'chatId, text y messageId son requeridos' });
  }

  const job = await messageQueue.add(
    'send',
    { chatId, text, messageId },
    { delay: delayMs, priority }
  );

  res.json({ jobId: job.id, status: 'queued', delayMs });
});

// POST /api/queue/campaign — Encolar una campaña masiva
router.post('/queue/campaign', async (req, res) => {
  const { campaignId, contacts, messageTemplate, delayBetweenMs = 5000 } = req.body;

  if (!campaignId || !contacts?.length || !messageTemplate) {
    return res.status(400).json({ error: 'campaignId, contacts y messageTemplate son requeridos' });
  }

  const job = await campaignQueue.add('launch', {
    campaignId,
    contacts,
    messageTemplate,
    delayBetweenMs,
  });

  res.json({ jobId: job.id, status: 'queued', contactCount: contacts.length });
});

// GET /api/queue/status/:jobId — Estado de un job
router.get('/queue/status/:jobId', async (req, res) => {
  const job = await messageQueue.getJob(req.params.jobId)
    || await campaignQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job no encontrado' });
  }

  const state = await job.getState();
  res.json({ jobId: job.id, state, data: job.data, returnValue: job.returnvalue });
});

// DELETE /api/queue/cancel/:jobId — Cancelar un mensaje programado
router.delete('/queue/cancel/:jobId', async (req, res) => {
  const job = await messageQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job no encontrado o ya procesado' });
  }

  const state = await job.getState();
  if (state === 'completed' || state === 'active') {
    return res.status(409).json({ error: `No se puede cancelar: estado '${state}'` });
  }

  await job.remove();
  res.json({ jobId: req.params.jobId, cancelled: true });
});

// GET /api/queue/stats — Estadísticas de las colas
router.get('/queue/stats', async (req, res) => {
  const [msgCounts, campCounts] = await Promise.all([
    messageQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed'),
    campaignQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed'),
  ]);

  res.json({
    messages: msgCounts,
    campaigns: campCounts,
  });
});

export default router;
