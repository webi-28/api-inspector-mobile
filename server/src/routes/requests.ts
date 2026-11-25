import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError } from '../errors';
import { httpMethods } from '../types';
import { parseBody, parseUuid } from '../validation';

const requestSchema = z.object({
  method: z.enum(httpMethods),
  url: z.string().trim().min(1).max(8192),
  headers: z.record(z.string()).default({}),
  queryParams: z.record(z.string()).default({}),
  body: z.string().nullable().optional(),
});

const savedRequestSchema = requestSchema.extend({
  name: z.string().trim().min(1).max(160),
  collectionId: z.string().uuid().nullable().optional(),
});

interface SavedRequestRow {
  id: string;
  collection_id: string | null;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: string | null;
  created_at: Date;
}

function mapSavedRequest(row: SavedRequestRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    request: {
      method: row.method,
      url: row.url,
      headers: row.headers,
      ...(row.body !== null ? { body: row.body } : {}),
    },
    queryParams: row.query_params,
    createdAt: row.created_at.getTime(),
  };
}

export function createRequestsRouter(database: Pick<Pool, 'query'>): Router {
  const router = Router();

  router.get('/', async (request, response, next) => {
    const collectionId = request.query.collection_id;
    if (collectionId !== undefined && typeof collectionId !== 'string') {
      response.status(400).json({ error: 'collection_id must be a UUID.' });
      return;
    }
    if (typeof collectionId === 'string' && parseUuid(collectionId) === null) {
      response.status(400).json({ error: 'collection_id must be a UUID.' });
      return;
    }
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';

    try {
      const result = await database.query<SavedRequestRow>(
        `SELECT id, collection_id, name, method, url, headers, query_params, body, created_at
         FROM saved_requests
         WHERE ($1::uuid IS NULL OR collection_id = $1)
           AND ($2 = '' OR name ILIKE $3 OR url ILIKE $3)
         ORDER BY created_at DESC`,
        [collectionId ?? null, search, `%${search}%`],
      );
      response.json(result.rows.map(mapSavedRequest));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    const input = parseBody(savedRequestSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<SavedRequestRow>(
        `INSERT INTO saved_requests
          (collection_id, name, method, url, headers, query_params, body)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
         RETURNING id, collection_id, name, method, url, headers, query_params, body, created_at`,
        [
          input.collectionId ?? null,
          input.name,
          input.method,
          input.url,
          JSON.stringify(input.headers),
          JSON.stringify(input.queryParams),
          input.body ?? null,
        ],
      );
      response.status(201).json(mapSavedRequest(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Saved request id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query<SavedRequestRow>(
        `SELECT id, collection_id, name, method, url, headers, query_params, body, created_at
         FROM saved_requests WHERE id = $1`,
        [id],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Saved request not found.' });
        return;
      }
      response.json(mapSavedRequest(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Saved request id must be a UUID.'));
      return;
    }
    const input = parseBody(savedRequestSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<SavedRequestRow>(
        `UPDATE saved_requests
         SET collection_id = $1, name = $2, method = $3, url = $4,
             headers = $5::jsonb, query_params = $6::jsonb, body = $7
         WHERE id = $8
         RETURNING id, collection_id, name, method, url, headers, query_params, body, created_at`,
        [
          input.collectionId ?? null,
          input.name,
          input.method,
          input.url,
          JSON.stringify(input.headers),
          JSON.stringify(input.queryParams),
          input.body ?? null,
          id,
        ],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Saved request not found.' });
        return;
      }
      response.json(mapSavedRequest(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'Saved request id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query('DELETE FROM saved_requests WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'Saved request not found.' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
