// The dev server's admin API (scripts/admin-server.ts). Only reached from the dev-only #/admin page.
import type { AdminFile, AdminRegistry } from '../../scripts/admin-files.mjs';

export type { AdminFile, AdminRegistry };
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** The subset of JSON Schema the editor reads, plus its own hints. */
export interface Schema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  required?: string[];
  items?: Schema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minItems?: number;
  maxItems?: number;
  'x-widget'?: 'color' | 'colors';
}

export interface LoadedFile {
  entry: AdminFile;
  data: Json;
  schema: Schema | null;
  version: string;
}

const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/__admin/api`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, errors: body.errors as string[] | undefined });
  return body as T;
}

export const listFiles = () => call<AdminRegistry>('/files');
export const loadFile = (id: string) => call<LoadedFile>(`/file?id=${encodeURIComponent(id)}`);

function put(id: string, data: Json, version: string, dry: boolean) {
  return call<{ ok: boolean; version?: string; errors?: string[] }>(`/file?id=${encodeURIComponent(id)}${dry ? '&dry=1' : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Omnidle-Admin': '1' },
    body: JSON.stringify({ data, version }),
  });
}
/** The server's checks without writing: the problems, [] if none. */
export const checkFile = (id: string, data: Json, version: string) => put(id, data, version, true).then((r) => r.errors ?? []);
export const saveFile = (id: string, data: Json, version: string) => put(id, data, version, false);
