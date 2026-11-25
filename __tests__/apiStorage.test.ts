import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createCollection, listHistory, setHistorySaved } from '../src/core/storage/apiStorage';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('apiStorage', () => {
  it('creates collections through the REST API', async () => {
    const collection = { id: 'collection-id', name: 'Production', createdAt: 123 };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(collection), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(createCollection('Production')).resolves.toEqual(collection);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/collections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Production' }),
      }),
    );
  });

  it('encodes history filters and reports API errors', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'History record not found.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(listHistory({ search: 'some URL', savedOnly: true })).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/history?search=some+URL&saved_only=true',
    );
    await expect(setHistorySaved('missing-id', true)).rejects.toThrow(
      'History record not found.',
    );
  });
});
