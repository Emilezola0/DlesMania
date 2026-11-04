/// <reference types="node" />
// The dev-only admin API behind #/admin: reads and writes the files listed in schema/admin-files.json,
// nothing else. `apply: 'serve'` keeps it out of `vite build` (and so out of dist/); it only answers
// requests from this machine, and writes only with the admin's own header (which a page on another
// site can't send without a CORS preflight this server never grants). Every write passes the same
// checks as `npm run data:validate`; Vite then sees the file change and reloads the running app.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { checkFile, loadRegistry, makeAjv, type AdminFile } from './admin-files.mjs';

const API = '/__admin/api';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_BODY = 8 * 1024 * 1024;

const hostOf = (h: string | undefined) => (h ?? '').replace(/:\d+$/, '').toLowerCase();
const isLocal = (req: IncomingMessage) =>
  LOOPBACK.has(req.socket.remoteAddress ?? '') && LOCAL_HOSTS.has(hostOf(req.headers.host)) && (!req.headers.origin || LOCAL_HOSTS.has(hostOf(new URL(req.headers.origin).host)));

/** The file's own layout, kept on save: its indent, its line endings, a final newline or not. */
function layoutOf(text: string) {
  const indent = /\n([ \t]+)\S/.exec(text)?.[1] ?? '  ';
  return { indent, eol: text.includes('\r\n') ? '\r\n' : '\n', final: /\r?\n$/.test(text) };
}
function format(data: unknown, text: string) {
  const { indent, eol, final } = layoutOf(text);
  const out = JSON.stringify(data, null, indent).replace(/\n/g, eol);
  return final ? out + eol : out;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) (fail(new Error('too large')), req.destroy());
      else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

export function adminServer(root = process.cwd()): Plugin {
  const ajv = makeAjv();
  const schemas = new Map<string, unknown>();
  /** An entry's file, only if it resolves inside the project's src/data (the registry can't point elsewhere). */
  const pathOf = (e: AdminFile) => {
    const p = resolve(root, e.file);
    if (!p.startsWith(resolve(root, 'src', 'data')) || !p.endsWith('.json')) throw new Error(`${e.file} is outside src/data`);
    return p;
  };
  const read = (e: AdminFile) => {
    const p = pathOf(e);
    const text = readFileSync(p, 'utf8');
    return { text, data: JSON.parse(text), version: String(statSync(p).mtimeMs) };
  };

  return {
    name: 'omnidle-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(API, async (req, res) => {
        if (!isLocal(req)) return send(res, 403, { error: 'The admin only answers this machine.' });
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          // Read fresh each time: a new entry in schema/admin-files.json shows up without a restart.
          const registry = loadRegistry(root);
          if (url.pathname === '/files' && req.method === 'GET') return send(res, 200, registry);
          const entry = registry.files.find((f) => f.id === url.searchParams.get('id'));
          if (url.pathname !== '/file' || !entry) return send(res, 404, { error: 'Unknown file' });

          if (req.method === 'GET') {
            const { data, version } = read(entry);
            const schema = entry.schema ? JSON.parse(readFileSync(join(root, entry.schema), 'utf8')) : null;
            return send(res, 200, { entry, data, schema, version });
          }
          if (req.method === 'PUT') {
            if (req.headers['x-omnidle-admin'] !== '1' || !String(req.headers['content-type']).startsWith('application/json'))
              return send(res, 400, { error: 'Missing admin header' });
            if (entry.policy === 'read-only') return send(res, 403, { error: 'This file is read-only.' });
            const body = JSON.parse(await readBody(req)) as { data: unknown; version: string };
            const current = read(entry);
            if (body.version !== current.version) return send(res, 409, { error: 'The file changed on disk since you opened it: reload it first.', version: current.version });
            const errors = checkFile(root, entry, body.data, current.data, ajv, schemas);
            // ?dry=1: the checks only, for the editor's live errors.
            if (url.searchParams.has('dry')) return send(res, 200, { ok: !errors.length, errors });
            if (errors.length) return send(res, 422, { error: 'Not saved: the data has problems.', errors });
            writeFileSync(pathOf(entry), format(body.data, current.text));
            server.config.logger.info(`[admin] saved ${entry.file}`, { timestamp: true });
            return send(res, 200, { ok: true, version: read(entry).version });
          }
          return send(res, 405, { error: 'Method not allowed' });
        } catch (e) {
          return send(res, 400, { error: (e as Error).message });
        }
      });
    },
  };
}
