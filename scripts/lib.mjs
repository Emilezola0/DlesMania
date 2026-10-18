// Shared helpers for the data scripts (Node 18+, no build step).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOMAINS = ['games', 'anime', 'cinema', 'music'];
export const PREFIX = { games: 'g', anime: 'a', cinema: 'c', music: 'm' };

const FIELD_ORDER = [
  'id', 'name', 'subtitle', 'aliases', 'domain', 'year', 'genres', 'studio', 'creator', 'origin', 'format', 'source',
  'platforms', 'characters', 'themes', 'credits', 'cover', 'quote', 'tracks', 'audio', 'emoji', 'item', 'location', 'visual',
];

export const worksPath = (domain) => join(ROOT, 'src', 'data', 'works', `${domain}.json`);

export function loadWorks(domain) {
  return JSON.parse(readFileSync(worksPath(domain), 'utf8'));
}

function isEmpty(v) {
  return v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

/** Writes works with a stable key order so diffs stay readable. */
export function saveWorks(domain, works) {
  const ordered = works.map((w) => {
    const out = {};
    for (const k of FIELD_ORDER) if (!isEmpty(w[k])) out[k] = w[k];
    return out;
  });
  writeFileSync(worksPath(domain), JSON.stringify(ordered, null, 2) + '\n');
}

export function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function makeId(domain, name, taken) {
  const base = `${PREFIX[domain]}-${slugify(name)}`;
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** Parses `--key=value` / `--flag` arguments; everything else is positional. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] ?? true;
    else positional.push(a);
  }
  return { flags, positional };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url, init) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': 'OmnidleDataScripts/0.2 (https://github.com/Emilezola0/DlesMania)', ...init?.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}
