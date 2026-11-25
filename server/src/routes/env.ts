import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError } from '../errors';
import { parseBody, parseUuid } from '../validation';

const envVariableSchema = z.object({
  name: z.string().trim().min(1).max(120),
  value: z.string(),
  isSecret: z.boolean().default(false),
});

interface EnvVariableRow {
  id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: Date;
}

function mapEnvVariable(row: EnvVariableRow) {
  return {
    id: row.id,
    name: row.key,
    value: row.value,
    isSecret: row.is_secret,
    createdAt: row.created_at.getTime(),
  };
}

export function createEnvRouter(database: Pick<Pool, 'query'>): Router {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const result = await database.query<EnvVariableRow>(
        'SELECT id, key, value, is_secret, created_at FROM env_variables ORDER BY key',
      );
      response.json(result.rows.map(mapEnvVariable));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    const input = parseBody(envVariableSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<EnvVariableRow>(
        `INSERT INTO env_variables (key, value, is_secret)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret
         RETURNING id, key, value, is_secret, created_at`,
        [input.name, input.value, input.isSecret],
      );
      response.status(201).json(mapEnvVariable(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Environment variable id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query<EnvVariableRow>(
        'SELECT id, key, value, is_secret, created_at FROM env_variables WHERE id = $1',
        [id],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Environment variable not found.' });
        return;
      }
      response.json(mapEnvVariable(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Environment variable id must be a UUID.'));
      return;
    }
    const input = parseBody(envVariableSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<EnvVariableRow>(
        `UPDATE env_variables
         SET key = $1, value = $2, is_secret = $3
         WHERE id = $4
         RETURNING id, key, value, is_secret, created_at`,
        [input.name, input.value, input.isSecret, id],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Environment variable not found.' });
        return;
      }
      response.json(mapEnvVariable(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Environment variable id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query('DELETE FROM env_variables WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Environment variable not found.' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
