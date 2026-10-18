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

// ---------------------------------------------------------------- MediaWiki (Wikipedia, Fandom wikis)

export const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
export const fandomApi = (wiki) => `https://${wiki}.fandom.com/api.php`;

/** Wikimedia and Fandom rate-limit aggressively: retry 429s with exponential backoff. */
export async function mediawikiGet(api, params) {
  const url = `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    try {
      return await getJson(url);
    } catch (e) {
      if (!String(e.message).startsWith('429') || attempt >= 4) throw e;
      const wait = 5000 * 2 ** attempt;
      console.log(`  (rate-limited, retrying in ${wait / 1000}s)`);
      await sleep(wait);
    }
  }
}

/** Drops analytics parameters (utm_*) but keeps functional ones such as Fandom's cache-buster. */
function cleanUrl(url) {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  return u.toString();
}

/**
 * Resolves many page titles at once (50 per request) to lead-image URLs on any MediaWiki site.
 * Returns Map<requested title, { image, title }>; image is null for missing or disambiguation pages.
 * `pilicense=any` includes non-free images such as album covers and posters.
 */
export async function mediawikiImages(api, titles, size = 640) {
  const out = new Map();
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const d = await mediawikiGet(api, {
      action: 'query', prop: 'pageimages|pageprops', piprop: 'thumbnail', pithumbsize: String(size),
      pilicense: 'any', ppprop: 'disambiguation', redirects: '1', titles: batch.join('|'),
    });
    // Follow normalisation ("a b" → "A b") then redirects to find each requested title's page.
    const normalized = new Map((d.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((d.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((d.query?.pages ?? []).map((p) => [p.title, p]));
    for (const requested of batch) {
      const n = normalized.get(requested) ?? requested;
      const p = pages.get(redirects.get(n) ?? n);
      const src = !p || p.missing || p.pageprops?.disambiguation !== undefined ? null : p.thumbnail?.source;
      out.set(requested, { image: src ? cleanUrl(src) : null, title: p?.title ?? null });
    }
    await sleep(1000);
  }
  return out;
}
