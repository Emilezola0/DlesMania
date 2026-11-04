// The files the dev-only admin page may edit (schema/admin-files.json) and the checks every write
// must pass: its JSON Schema, its policy (append-only, read-only), the value types of a file with no
// schema, and a few rules a schema can't say. Shared by the dev server (scripts/admin-server.ts) and
// `npm run data:validate`, so a file the admin saved always validates.
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadRegistry(root) {
  return JSON.parse(readFileSync(join(root, 'schema', 'admin-files.json'), 'utf8'));
}

/** Ajv with the admin's own keywords: x-widget (a hint for the editor) and x-sumTo (the values add up to it). */
export function makeAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false, verbose: true });
  ajv.addKeyword({ keyword: 'x-widget' });
  ajv.addKeyword({
    keyword: 'x-sumTo',
    type: 'object',
    errors: false,
    validate: (total, data) => Math.abs(Object.values(data).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) - total) < 1e-6,
  });
  return ajv;
}

const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** A file with no schema keeps its shape: every value keeps its type (null may become anything and back), and every key. */
function sameTypes(prev, next, at, out) {
  if (prev === null || next === null) return;
  if (kind(prev) !== kind(next)) return void out.push(`${at || '/'}: was ${kind(prev)}, now ${kind(next)}`);
  if (kind(prev) === 'object') for (const k of Object.keys(prev)) if (!(k in next)) out.push(`${at}/${k}: can't be removed (no schema says it's optional)`);
  if (!at && kind(prev) === 'object') for (const k of Object.keys(next)) if (!(k in prev)) out.push(`/${k}: no new top-level keys without a schema`);
  if (Array.isArray(prev)) {
    const tpl = prev.find((x) => x !== null);
    if (tpl !== undefined) next.forEach((x, i) => sameTypes(prev[i] ?? tpl, x, `${at}/${i}`, out));
  } else if (kind(prev) === 'object') {
    for (const k of Object.keys(next)) if (k in prev) sameTypes(prev[k], next[k], `${at}/${k}`, out);
  }
}

/** append-only: every value that was there is still there, unchanged (new keys and new array items are fine). */
function nothingChanged(prev, next, at, out) {
  if (kind(prev) !== 'object' && kind(prev) !== 'array') {
    if (prev !== next) out.push(`${at}: locked (was ${JSON.stringify(prev)})`);
    return;
  }
  if (kind(prev) !== kind(next)) return void out.push(`${at || '/'}: locked`);
  for (const k of Object.keys(prev)) {
    if (!(k in next)) out.push(`${at}/${k}: locked, can't be removed`);
    else nothingChanged(prev[k], next[k], `${at}/${k}`, out);
  }
}

/** Rules across a file's values. */
function crossChecks(id, d, root) {
  const out = [];
  if (id === 'grades') {
    if (d.hellGrade > d.maxGrade) out.push('/hellGrade: higher than maxGrade');
    for (let g = 1; g <= d.maxGrade; g++) if (!d.grades[g]) out.push(`/grades/${g}: missing (maxGrade is ${d.maxGrade})`);
    for (let g = 2; g <= d.maxGrade; g++) if (d.rewardShare[g] === undefined) out.push(`/rewardShare/${g}: missing`);
    if (d.elementGrade > d.maxGrade) out.push('/elementGrade: higher than maxGrade');
    const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');
    for (const k of Object.keys(d.elements ?? {})) if (!css.includes(`.card-element-${k}`)) out.push(`/elements/${k}: no .card-element-${k} look in src/index.css`);
  }
  if (id === 'packs') {
    const pos = Object.values(d.odds).every((v) => v >= 0);
    if (!pos) out.push('/odds: negative odds');
  }
  if (id === 'anomalies') {
    const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');
    for (const [k, a] of Object.entries(d.anomalies)) if (!css.includes(`.${a.className}`)) out.push(`/anomalies/${k}/className: no .${a.className} in src/index.css`);
  }
  return out;
}

/**
 * Every problem with writing `next` over `prev` for a registry entry ([] = fine). `schemas` caches
 * the compiled schemas by path.
 */
export function checkFile(root, entry, next, prev, ajv = makeAjv(), schemas = new Map()) {
  const policy = entry.policy ?? 'edit';
  if (policy === 'read-only' && prev !== undefined && JSON.stringify(prev) !== JSON.stringify(next)) return ['read-only file'];
  const out = [];
  if (entry.schema) {
    let validate = schemas.get(entry.schema);
    if (!validate) schemas.set(entry.schema, (validate = ajv.compile(JSON.parse(readFileSync(join(root, entry.schema), 'utf8')))));
    if (!validate(next)) for (const e of validate.errors) out.push(`${e.instancePath || '/'}: ${e.keyword === 'x-sumTo' ? `must add up to ${e.schema}` : e.message}`);
  } else if (prev !== undefined) sameTypes(prev, next, '', out);
  if (policy === 'append-only' && prev !== undefined) nothingChanged(prev, next, '', out);
  if (!out.length) out.push(...crossChecks(entry.id, next, root));
  return out;
}
