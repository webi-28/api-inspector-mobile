import type { ApiRequest, ApiResponse } from '../types';

function utf8ByteLength(value: string): number {
  let byteLength = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit <= 0x7f) {
      byteLength += 1;
    } else if (codeUnit <= 0x7ff) {
      byteLength += 2;
    } else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      byteLength += 4;
      index += 1;
    } else {
      byteLength += 3;
    }
  }

  return byteLength;
}

export async function executeRequest(request: ApiRequest): Promise<ApiResponse> {
  const startTime = globalThis.performance?.now() ?? Date.now();
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body !== undefined ? { body: request.body } : {}),
  });
  const body = await response.text();
  const endTime = globalThis.performance?.now() ?? Date.now();
  const headers: Record<string, string> = {};

  response.headers.forEach((value, name) => {
    headers[name] = value;
  });

  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers,
    body,
    durationMs: Math.max(0, endTime - startTime),
    sizeBytes: utf8ByteLength(body),
  };
}
