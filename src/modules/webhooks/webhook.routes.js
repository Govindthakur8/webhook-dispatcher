import { Router } from 'express';
import { validateDispatchRequest } from './dispatch.validation.js';
import { createWebhookJob } from './webhook.service.js';

const router = Router();

router.post(
  '/dispatch',
  validateDispatchRequest,
  async (req, res, next) => {
    try {
      const job = await createWebhookJob(req.body);

      return res.status(202).json({
        status: 'queued',
        jobId: job.id,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
