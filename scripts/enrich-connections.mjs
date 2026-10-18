#!/usr/bin/env node
// Resolves tile images for src/data/connections.json.
//
//   node scripts/enrich-connections.mjs [--puzzle=cg-lol] [--force] [--dry]
//
// Each puzzle has a default `images` source; a tile can override it with `{ "label", "src" }`.
// Sources:
//   wp                      Wikipedia, page title = tile label (or `src`)
//   fandom:<wiki>           <wiki>.fandom.com, e.g. fandom:naruto
//   ddragon                 League of Legends Data Dragon champion squares (Riot's public CDN)
//   wp:Title | fandom:<wiki>:Title | ddragon:ChampionId | https://...   (explicit, in a tile's `src`)
//
// A grid shows pictures only when all 16 tiles have one (otherwise the text-only tiles would give
// their group away), so the report lists the misses to fix per puzzle.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, WIKIPEDIA_API, fandomApi, getJson, mediawikiImages, parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'connections.json');
const TILE_SIZE = 320;
const puzzles = JSON.parse(readFileSync(FILE, 'utf8'));

/** Turns a tile into { source kind, site, title }. */
function parseSource(tile, fallback) {
  const label = typeof tile === 'string' ? tile : tile.label;
  const src = typeof tile === 'string' ? undefined : tile.src;
  if (src?.startsWith('http')) return { kind: 'url', url: src };
  const spec = src && /^(wp|fandom|ddragon):/.test(src) ? src : `${fallback}:${src ?? label}`;
  const [kind, ...rest] = spec.split(':');
  if (kind === 'fandom') return { kind, site: rest[0], title: rest.slice(1).join(':') };
  return { kind, title: rest.join(':') };
}

const toObject = (tile) => (typeof tile === 'string' ? { label: tile } : tile);

let ddragonVersion;
async function ddragonUrl(id) {
  ddragonVersion ??= (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${id.replace(/[^A-Za-z]/g, '')}.png`;
}

// Group every wiki lookup by API endpoint so each site gets batched requests.
const lookups = new Map(); // api -> Set<title>
const jobs = [];
for (const pz of puzzles) {
  if (flags.puzzle && pz.id !== flags.puzzle) continue;
  pz.groups.forEach((g) =>
    g.items.forEach((tile, i) => {
      const t = toObject(tile);
      if (t.image && !flags.force) return;
      const source = parseSource(tile, pz.images ?? 'wp');
      jobs.push({ pz, g, i, t, source });
      if (source.kind === 'wp' || source.kind === 'fandom') {
        const api = source.kind === 'wp' ? WIKIPEDIA_API : fandomApi(source.site);
        if (!lookups.has(api)) lookups.set(api, new Set());
        lookups.get(api).add(source.title);
      }
    }),
  );
}

const resolved = new Map(); // `${api}|${title}` -> image
for (const [api, titles] of lookups) {
  try {
    const res = await mediawikiImages(api, [...titles], TILE_SIZE);
    for (const [title, { image }] of res) resolved.set(`${api}|${title}`, image);
  } catch (e) {
    console.log(`✗ ${api}: ${e.message}`);
  }
}

for (const { g, i, t, source } of jobs) {
  let image = null;
  if (source.kind === 'url') image = source.url;
  else if (source.kind === 'ddragon') image = await ddragonUrl(source.title);
  else image = resolved.get(`${source.kind === 'wp' ? WIKIPEDIA_API : fandomApi(source.site)}|${source.title}`) ?? null;
  if (image) t.image = image;
  else delete t.image;
  // Keep plain strings for tiles with nothing extra, so the file stays easy to edit.
  g.items[i] = Object.keys(t).length === 1 ? t.label : t;
}

console.log('\npuzzle        images  missing');
for (const pz of puzzles) {
  const tiles = pz.groups.flatMap((g) => g.items.map(toObject));
  const missing = tiles.filter((t) => !t.image).map((t) => t.label);
  const mark = missing.length === 0 ? '✓' : ' ';
  console.log(`${mark} ${pz.id.padEnd(12)} ${String(tiles.length - missing.length).padStart(2)}/16  ${missing.join(', ')}`);
}

if (!flags.dry) writeFileSync(FILE, JSON.stringify(puzzles, null, 2) + '\n');
