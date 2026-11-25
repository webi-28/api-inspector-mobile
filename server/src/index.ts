import { createApp } from './app';
import { config } from './config';
import { initializeSchema, pool } from './db/pool';

async function startServer(): Promise<void> {
  await initializeSchema();

  const server = createApp(pool).listen(config.port, () => {
    console.info(`API Inspector server listening on port ${config.port}.`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void pool.end();
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch(async (error: unknown) => {
  console.error('Could not start the API Inspector server:', error);
  await pool.end();
  process.exitCode = 1;
});
