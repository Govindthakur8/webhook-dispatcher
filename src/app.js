import express from 'express';
import healthRoutes from './modules/health/health.routes.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import webhookRoutes from './modules/webhooks/webhook.routes.js';

const app = express();

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
