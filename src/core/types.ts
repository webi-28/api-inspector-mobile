export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
}

export interface EnvVariable {
  name: string;
  value: string;
}

export type JsonDiffType = 'added' | 'removed' | 'modified';

export interface JsonDiffEntry {
  path: string;
  type: JsonDiffType;
  left?: unknown;
  right?: unknown;
}
