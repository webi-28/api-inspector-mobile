import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import { config } from '../config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function initializeSchema(): Promise<void> {
  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  await pool.query(schema);
}
