import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app';
import { pool } from '../src/db/pool';

const app = createApp(pool);

after(async () => {
  await pool.end();
});

describe('API routes', () => {
  it('exposes a healthy server without requiring a database query', async () => {
    const response = await request(app).get('/health');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok' });
  });

  it('validates collection input before issuing a database query', async () => {
    const response = await request(app).post('/api/collections').send({ name: '  ' });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Validation failed');
    assert.ok(Array.isArray(response.body.details));
  });

  it('validates saved request HTTP methods', async () => {
    const response = await request(app).post('/api/requests').send({
      name: 'Bad request',
      method: 'TRACE',
      url: 'https://example.test',
      headers: {},
      queryParams: {},
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Validation failed');
  });

  it('validates history payload structure', async () => {
    const response = await request(app).post('/api/history').send({
      request: { method: 'GET', url: 'https://example.test' },
      response: { status: 'not-a-status' },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Validation failed');
  });

  it('validates environment variable names', async () => {
    const response = await request(app).post('/api/env').send({
      name: '',
      value: 'value',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Validation failed');
  });

  it('returns a useful 404 for unknown paths', async () => {
    const response = await request(app).get('/api/not-a-route');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Route not found.' });
  });
});
