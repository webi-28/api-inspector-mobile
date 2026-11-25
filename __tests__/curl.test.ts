import { describe, expect, it } from '@jest/globals';
import { interpolateEnv, parseCurl, toCurl } from '../src/core/http/curl';
import type { ApiRequest, EnvVariable } from '../src/core/types';

describe('parseCurl', () => {
  it('parses method, URL, headers, and a quoted JSON body', () => {
    const request = parseCurl(
      `curl -X POST 'https://api.example.test/items' -H 'Content-Type: application/json' --data-raw '{"name":"Ada Lovelace"}'`,
    );

    expect(request).toEqual({
      method: 'POST',
      url: 'https://api.example.test/items',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Ada Lovelace"}',
    });
  });

  it('infers POST from data and appends --get data to the query string', () => {
    expect(parseCurl('curl https://api.example.test/items -d name=Ada').method).toBe('POST');
    expect(parseCurl('curl -G https://api.example.test/items -d name=Ada')).toEqual({
      method: 'GET',
      url: 'https://api.example.test/items?name=Ada',
      headers: {},
    });
  });

  it('round-trips shell-sensitive values through the cURL exporter', () => {
    const request: ApiRequest = {
      method: 'PATCH',
      url: "https://api.example.test/items?name=O'Reilly",
      headers: { 'X-Note': "it's fine" },
      body: `{"quote":"it's fine"}`,
    };

    expect(parseCurl(toCurl(request))).toEqual(request);
  });

  it('reports malformed commands rather than silently accepting them', () => {
    expect(() => parseCurl("curl 'https://example.test")).toThrow(/unmatched quote/i);
    expect(() => parseCurl('curl -X TRACE https://example.test')).toThrow(/unsupported HTTP method/i);
    expect(() => parseCurl('curl -H invalid https://example.test')).toThrow(/invalid cURL header/i);
  });
});

describe('interpolateEnv', () => {
  const vars: EnvVariable[] = [
    { name: 'host', value: 'https://api.example.test' },
    { name: 'token', value: 'secret-token' },
  ];

  it('substitutes known placeholders and preserves unknown placeholders', () => {
    expect(
      interpolateEnv('{{host}}/items?token={{ token }}&missing={{missing}}', vars),
    ).toBe('https://api.example.test/items?token=secret-token&missing={{missing}}');
  });
});
