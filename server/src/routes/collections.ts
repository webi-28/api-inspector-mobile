import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../errors';
import { parseBody, parseUuid } from '../validation';
import type { Pool } from 'pg';

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const updateCollectionSchema = createCollectionSchema;

interface CollectionRow {
  id: string;
  name: string;
  created_at: Date;
}

function mapCollection(row: CollectionRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.getTime(),
  };
}

export function createCollectionsRouter(database: Pick<Pool, 'query'>): Router {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const result = await database.query<CollectionRow>(
        'SELECT id, name, created_at FROM collections ORDER BY name',
      );
      response.json(result.rows.map(mapCollection));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    const input = parseBody(createCollectionSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<CollectionRow>(
        'INSERT INTO collections (name) VALUES ($1) RETURNING id, name, created_at',
        [input.name],
      );
      response.status(201).json(mapCollection(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Collection id must be a UUID.'));
      return;
    }
    const input = parseBody(updateCollectionSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<CollectionRow>(
        'UPDATE collections SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
        [input.name, id],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Collection not found.' });
        return;
      }
      response.json(mapCollection(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Collection id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query('DELETE FROM collections WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Collection not found.' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
