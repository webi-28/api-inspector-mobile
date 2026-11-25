import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { executeRequest } from '../src/core/http/client';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('executeRequest', () => {
  it('returns response metadata and measures the UTF-8 payload size', async () => {
    const responseBody = 'café 🌍';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(responseBody, {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const response = await executeRequest({
      method: 'GET',
      url: 'https://api.example.test/items',
    });

    expect(response).toMatchObject({
      status: 201,
      statusText: 'Created',
      ok: true,
      body: responseBody,
      sizeBytes: 10,
    });
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
    expect(response.headers['content-type']).toBe('text/plain');
  });
});
