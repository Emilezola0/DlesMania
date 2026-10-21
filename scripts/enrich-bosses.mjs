#!/usr/bin/env node
// Resolves the pictures in src/data/bosses.json: the boss portrait, the Radar Defense cards
// (members and impostors) and the Final Blow faces.
//
//   node scripts/enrich-bosses.mjs [--boss=lol] [--force] [--dry]
//
// Each boss has a default `images` source for its own cards; a card can override it with
// `{ "label", "src" }`. Sources are the same as for Connections tiles:
//   wp | fandom:<wiki> | ddragon                                    (defaults, title = card label)
//   wp:Title | fandom:<wiki>:Title | ddragon:ChampionId | https://… (explicit `src`)
// Impostors come from other franchises, so they always carry an explicit `src`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, WIKIPEDIA_API, fandomApi, getJson, mediawikiImages, mediawikiSearchImage, parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const SIZE = 400;
const bosses = JSON.parse(readFileSync(FILE, 'utf8'));

const toObject = (card) => (typeof card === 'string' ? { label: card } : card);

/** Turns a card into { kind, site?, title } or { kind: 'url', url }. */
function parseSource(card, fallback) {
  const src = card.src;
  if (src?.startsWith('http')) return { kind: 'url', url: src };
  const spec = src && /^(wp|fandom|ddragon):/.test(src) ? src : `${fallback}:${src ?? card.label}`;
  const [kind, ...rest] = spec.split(':');
  if (kind === 'fandom') return { kind, site: rest[0], title: rest.slice(1).join(':') };
  return { kind, title: rest.join(':') };
}

let ddragonVersion;
async function ddragonUrl(id) {
  ddragonVersion ??= (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${id.replace(/[^A-Za-z]/g, '')}.png`;
}

const apiOf = (s) => (s.kind === 'wp' ? WIKIPEDIA_API : fandomApi(s.site));

// Every card slot that needs a picture: [boss, list owner, key, card].
const jobs = [];
for (const b of bosses) {
  if (flags.boss && b.id !== flags.boss) continue;
  const add = (owner, key) => {
    const card = toObject(owner[key]);
    if (card.image && !flags.force) return;
    jobs.push({ b, owner, key, card, source: parseSource(card, b.images ?? 'wp') });
  };
  add(b, 'boss');
  b.boss.label ??= b.boss.name;
  for (const list of [b.radar.members, b.radar.impostors, b.finale]) list.forEach((_, i) => add(list, i));
}

// Batch the wiki lookups per site.
const lookups = new Map();
for (const { source } of jobs) {
  if (source.kind !== 'wp' && source.kind !== 'fandom') continue;
  const api = apiOf(source);
  if (!lookups.has(api)) lookups.set(api, new Set());
  lookups.get(api).add(source.title);
}
const resolved = new Map();
for (const [api, titles] of lookups) {
  try {
    for (const [title, { image }] of await mediawikiImages(api, [...titles], SIZE)) resolved.set(`${api}|${title}`, image);
  } catch (e) {
    console.log(`✗ ${api}: ${e.message}`);
  }
}

for (const job of jobs) {
  const { owner, key, card, source } = job;
  let image = null;
  try {
    if (source.kind === 'url') image = source.url;
    else if (source.kind === 'ddragon') image = await ddragonUrl(source.title);
    else {
      image = resolved.get(`${apiOf(source)}|${source.title}`) ?? null;
      // Page titles drift; fall back to the wiki's search.
      if (!image) image = (await mediawikiSearchImage(apiOf(source), source.title, SIZE)).image;
    }
  } catch (e) {
    console.log(`✗ ${card.label}: ${e.message}`);
  }
  if (image) card.image = image;
  else delete card.image;
  if (key === 'boss') {
    delete card.label;
    owner.boss = card;
  } else owner[key] = Object.keys(card).length === 1 ? card.label : card;
}

console.log('\nboss         portrait members impostors finale  missing');
for (const b of bosses) {
  const count = (list) => list.map(toObject).filter((c) => c.image).length;
  const missing = [b.radar.members, b.radar.impostors, b.finale].flat().map(toObject).filter((c) => !c.image).map((c) => c.label);
  console.log(
    `${b.id.padEnd(12)} ${b.boss.image ? '   ✓    ' : '   ✗    '} ${`${count(b.radar.members)}/${b.radar.members.length}`.padStart(5)}  ${`${count(b.radar.impostors)}/${b.radar.impostors.length}`.padStart(7)}   ${`${count(b.finale)}/${b.finale.length}`.padStart(5)}  ${missing.join(', ')}`,
  );
}

if (!flags.dry) writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
