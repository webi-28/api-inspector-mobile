import type { ApiRequest, ApiResponse, EnvVariable } from '../types';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

export interface CollectionRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface HistoryRecord {
  id: string;
  request: ApiRequest;
  response: ApiResponse;
  createdAt: number;
  isSaved: boolean;
  collectionId: string | null;
}

export interface HistoryFilter {
  search?: string;
  savedOnly?: boolean;
}

export interface EnvVariableRecord extends EnvVariable {
  id: string;
  createdAt: number;
  isSecret: boolean;
}

export interface SavedRequestRecord {
  id: string;
  collectionId: string | null;
  name: string;
  request: ApiRequest;
  queryParams: Record<string, string>;
  createdAt: number;
}

export interface SavedRequestInput {
  name: string;
  request: ApiRequest;
  queryParams?: Record<string, string>;
  collectionId?: string | null;
}

interface ApiError {
  error?: string;
  message?: string;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Could not reach the API at ${API_BASE_URL}.${detail} Check that the server is running and that EXPO_PUBLIC_API_URL is reachable from this device.`,
    );
  }

  if (!response.ok) {
    let apiError: ApiError = {};
    try {
      apiError = (await response.json()) as ApiError;
    } catch {
      apiError = {};
    }
    throw new Error(
      apiError.error ??
        apiError.message ??
        `API request failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export async function listCollections(): Promise<CollectionRecord[]> {
  return apiRequest<CollectionRecord[]>('/api/collections');
}

export async function createCollection(name: string): Promise<CollectionRecord> {
  return apiRequest<CollectionRecord>('/api/collections', {
    method: 'POST',
    body: jsonBody({ name }),
  });
}

export async function updateCollection(
  id: string,
  name: string,
): Promise<CollectionRecord> {
  return apiRequest<CollectionRecord>(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: jsonBody({ name }),
  });
}

export async function deleteCollection(id: string): Promise<void> {
  return apiRequest<void>(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function recordRequestExecution(
  request: ApiRequest,
  response: ApiResponse,
): Promise<string> {
  const record = await apiRequest<HistoryRecord>('/api/history', {
    method: 'POST',
    body: jsonBody({ request, response }),
  });
  return record.id;
}

export async function listHistory(filter: HistoryFilter = {}): Promise<HistoryRecord[]> {
  const query = new URLSearchParams();
  if (filter.search?.trim()) {
    query.set('search', filter.search.trim());
  }
  if (filter.savedOnly) {
    query.set('saved_only', 'true');
  }
  const queryString = query.toString();
  const suffix = queryString.length > 0 ? `?${queryString}` : '';
  return apiRequest<HistoryRecord[]>(`/api/history${suffix}`);
}

export async function getHistoryRecord(id: string): Promise<HistoryRecord | null> {
  try {
    return await apiRequest<HistoryRecord>(`/api/history/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'History record not found.') {
      return null;
    }
    throw error;
  }
}

export async function setHistorySaved(
  id: string,
  isSaved: boolean,
  collectionId?: string | null,
): Promise<void> {
  await apiRequest<{ isSaved: boolean }>(
    `/api/history/${encodeURIComponent(id)}/saved`,
    {
      method: 'PUT',
      body: jsonBody({
        isSaved,
        ...(collectionId !== undefined ? { collectionId } : {}),
      }),
    },
  );
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  return apiRequest<void>(`/api/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listSavedRequests(
  options: { search?: string; collectionId?: string } = {},
): Promise<SavedRequestRecord[]> {
  const query = new URLSearchParams();
  if (options.search?.trim()) {
    query.set('search', options.search.trim());
  }
  if (options.collectionId) {
    query.set('collection_id', options.collectionId);
  }
  const queryString = query.toString();
  const suffix = queryString.length > 0 ? `?${queryString}` : '';
  return apiRequest<SavedRequestRecord[]>(`/api/requests${suffix}`);
}

export async function createSavedRequest(
  input: SavedRequestInput,
): Promise<SavedRequestRecord> {
  return apiRequest<SavedRequestRecord>('/api/requests', {
    method: 'POST',
    body: jsonBody({
      name: input.name,
      method: input.request.method,
      url: input.request.url,
      headers: input.request.headers ?? {},
      queryParams: input.queryParams ?? {},
      body: input.request.body ?? null,
      collectionId: input.collectionId ?? null,
    }),
  });
}

export async function getSavedRequest(id: string): Promise<SavedRequestRecord> {
  return apiRequest<SavedRequestRecord>(`/api/requests/${encodeURIComponent(id)}`);
}

export async function updateSavedRequest(
  id: string,
  input: SavedRequestInput,
): Promise<SavedRequestRecord> {
  return apiRequest<SavedRequestRecord>(`/api/requests/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: jsonBody({
      name: input.name,
      method: input.request.method,
      url: input.request.url,
      headers: input.request.headers ?? {},
      queryParams: input.queryParams ?? {},
      body: input.request.body ?? null,
      collectionId: input.collectionId ?? null,
    }),
  });
}

export async function deleteSavedRequest(id: string): Promise<void> {
  return apiRequest<void>(`/api/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listEnvVariables(): Promise<EnvVariableRecord[]> {
  return apiRequest<EnvVariableRecord[]>('/api/env');
}

export async function saveEnvVariable(
  variable: EnvVariable,
  isSecret = false,
): Promise<EnvVariableRecord> {
  return apiRequest<EnvVariableRecord>('/api/env', {
    method: 'POST',
    body: jsonBody({ ...variable, isSecret }),
  });
}

export async function updateEnvVariable(
  id: string,
  variable: EnvVariable,
  isSecret = false,
): Promise<EnvVariableRecord> {
  return apiRequest<EnvVariableRecord>(`/api/env/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: jsonBody({ ...variable, isSecret }),
  });
}

export async function deleteEnvVariable(id: string): Promise<void> {
  return apiRequest<void>(`/api/env/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
