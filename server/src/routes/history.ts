import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { HttpError } from '../errors';
import type { ApiRequest, ApiResponse } from '../types';
import { httpMethods } from '../types';
import { parseBody, parseUuid } from '../validation';

const executionSchema = z.object({
  request: z.object({
    method: z.enum(httpMethods),
    url: z.string().trim().min(1).max(8192),
    headers: z.record(z.string()).default({}),
    body: z.string().optional(),
  }),
  response: z.object({
    status: z.number().int().min(100).max(599),
    statusText: z.string().max(512),
    ok: z.boolean(),
    headers: z.record(z.string()).default({}),
    body: z.string(),
    durationMs: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
  }),
});

const savedStateSchema = z.object({
  isSaved: z.boolean(),
  collectionId: z.string().uuid().nullable().optional(),
});

interface HistoryRow {
  id: string;
  method: string;
  url: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  status_code: number;
  status_text: string;
  duration_ms: number;
  size_bytes: number;
  response_headers: Record<string, string>;
  response_body: string;
  executed_at: Date;
  saved_request_id: string | null;
  collection_id: string | null;
}

function mapHistory(row: HistoryRow) {
  const request: ApiRequest = {
    method: row.method as ApiRequest['method'],
    url: row.url,
    headers: row.request_headers,
    ...(row.request_body !== null ? { body: row.request_body } : {}),
  };
  const response: ApiResponse = {
    status: row.status_code,
    statusText: row.status_text,
    ok: row.status_code >= 200 && row.status_code < 300,
    headers: row.response_headers,
    body: row.response_body,
    durationMs: row.duration_ms,
    sizeBytes: row.size_bytes,
  };

  return {
    id: row.id,
    request,
    response,
    createdAt: row.executed_at.getTime(),
    isSaved: row.saved_request_id !== null,
    collectionId: row.collection_id,
  };
}

async function insertSavedHistory(
  client: PoolClient,
  id: string,
  collectionId: string | null | undefined,
): Promise<void> {
  await client.query(
    `INSERT INTO saved_requests
      (collection_id, name, method, url, headers, query_params, body, history_id)
     SELECT $2, LEFT(method || ' ' || url, 160), method, url, request_headers,
       '{}'::jsonb, request_body, id
     FROM history WHERE id = $1
     ON CONFLICT (history_id) DO UPDATE SET collection_id = EXCLUDED.collection_id`,
    [id, collectionId ?? null],
  );
}

export function createHistoryRouter(
  database: Pick<Pool, 'query' | 'connect'>,
): Router {
  const router = Router();

  router.get('/', async (request, response, next) => {
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
    const savedOnly = request.query.saved_only === 'true';

    try {
      const result = await database.query<HistoryRow>(
        `SELECT h.*, sr.id AS saved_request_id, sr.collection_id
         FROM history h
         LEFT JOIN saved_requests sr ON sr.history_id = h.id
         WHERE ($1 = '' OR h.url ILIKE $2 OR h.method ILIKE $2
           OR h.request_body ILIKE $2 OR h.response_body ILIKE $2)
           AND (NOT $3::boolean OR sr.id IS NOT NULL)
         ORDER BY h.executed_at DESC, h.id DESC`,
        [search, `%${search}%`, savedOnly],
      );
      response.json(result.rows.map(mapHistory));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    const input = parseBody(executionSchema, request, response);
    if (input === undefined) return;

    try {
      const result = await database.query<HistoryRow>(
        `INSERT INTO history
          (method, url, request_headers, request_body, status_code, status_text,
           duration_ms, size_bytes, response_headers, response_body)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10)
         RETURNING *, NULL::uuid AS saved_request_id, NULL::uuid AS collection_id`,
        [
          input.request.method,
          input.request.url,
          JSON.stringify(input.request.headers),
          input.request.body ?? null,
          input.response.status,
          input.response.statusText,
          input.response.durationMs,
          input.response.sizeBytes,
          JSON.stringify(input.response.headers),
          input.response.body,
        ],
      );
      response.status(201).json(mapHistory(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'History id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query<HistoryRow>(
        `SELECT h.*, sr.id AS saved_request_id, sr.collection_id
         FROM history h
         LEFT JOIN saved_requests sr ON sr.history_id = h.id
         WHERE h.id = $1`,
        [id],
      );
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'History record not found.' });
        return;
      }
      response.json(mapHistory(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/saved', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'History id must be a UUID.'));
      return;
    }
    const input = parseBody(savedStateSchema, request, response);
    if (input === undefined) return;

    let client: PoolClient;
    try {
      client = await database.connect();
    } catch (error) {
      next(error);
      return;
    }

    try {
      await client.query('BEGIN');
      const historyResult = await client.query('SELECT id FROM history WHERE id = $1', [id]);
      if (historyResult.rowCount === 0) {
        await client.query('ROLLBACK');
        response.status(404).json({ error: 'History record not found.' });
        return;
      }

      if (input.isSaved) {
        await insertSavedHistory(client, id, input.collectionId);
      } else {
        await client.query('DELETE FROM saved_requests WHERE history_id = $1', [id]);
      }

      await client.query('COMMIT');
      response.json({ isSaved: input.isSaved, collectionId: input.collectionId ?? null });
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Could not roll back history save transaction:', rollbackError);
      }
      next(error);
    } finally {
      client.release();
    }
  });

  router.delete('/:id', async (request, response, next) => {
    const id = parseUuid(request.params.id);
    if (id === null) {
      next(new HttpError(400, 'History id must be a UUID.'));
      return;
    }

    try {
      const result = await database.query('DELETE FROM history WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        response.status(404).json({ error: 'History record not found.' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
