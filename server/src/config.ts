import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

const envPaths = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
const envPath = envPaths.find((candidate) => existsSync(candidate));

if (envPath !== undefined) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function getPort(): number {
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export const config = {
  port: getPort(),
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgresql://${encodeURIComponent(process.env.POSTGRES_USER ?? 'api_inspector')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${encodeURIComponent(process.env.POSTGRES_DB ?? 'api_inspector')}`,
  corsOrigins: process.env.CORS_ORIGIN ?? '*',
};
