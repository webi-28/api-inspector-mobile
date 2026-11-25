import cors from 'cors';
import express from 'express';
import type { Pool } from 'pg';

import { config } from './config';
import { errorHandler } from './errors';
import { createCollectionsRouter } from './routes/collections';
import { createEnvRouter } from './routes/env';
import { createHistoryRouter } from './routes/history';
import { createRequestsRouter } from './routes/requests';

export function createApp(database: Pool) {
  const app = express();
  const allowedOrigins =
    config.corsOrigins === '*'
      ? true
      : config.corsOrigins.split(',').map((origin) => origin.trim());

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/collections', createCollectionsRouter(database));
  app.use('/api/requests', createRequestsRouter(database));
  app.use('/api/history', createHistoryRouter(database));
  app.use('/api/env', createEnvRouter(database));

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
  app.use(errorHandler);

  return app;
}
