import type Ajv from 'ajv';

export interface AdminFile {
  id: string;
  section: string;
  title: string;
  file: string;
  schema?: string;
  policy?: 'edit' | 'append-only' | 'read-only';
  preview?: string;
  note?: string;
}
export interface AdminRegistry {
  sections: { id: string; title: string; icon: string }[];
  files: AdminFile[];
}
export function loadRegistry(root: string): AdminRegistry;
export function makeAjv(): Ajv;
export function checkFile(root: string, entry: AdminFile, next: unknown, prev: unknown, ajv?: Ajv, schemas?: Map<string, unknown>): string[];
