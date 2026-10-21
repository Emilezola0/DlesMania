#!/usr/bin/env node
// Validates every works file against schema/work.schema.json and checks that each domain
// has enough content for its daily challenge. Exit code 1 on any error.
//   npm run data:validate
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAINS, ROOT, loadWorks } from './lib.mjs';

const schema = JSON.parse(readFileSync(join(ROOT, 'schema', 'work.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const validate = ajv.compile(schema);

/** Minimum works per domain for each single-target mini-game, so dailies rarely repeat. */
const MIN_PER_GAME = 8;
// Mirrors HAS_CONTENT in src/data/index.ts: picture rounds only draw works that have the picture.
const COVERAGE = {
  quote: (w) => w.quote || w.tracks?.length,
  audio: (w) => w.audio && (w.audio.youtubeId || w.cover?.image),
  emoji: (w) => w.emoji,
  visual: (w) => w.cover?.image || w.visual,
  item: (w) => w.item?.image,
  location: (w) => w.location?.image,
  tiles: (w) => w.cover?.image,
};

let errors = 0;
let warnings = 0;
const ids = new Set();
const fail = (msg) => (errors++, console.error(`✗ ${msg}`));
const warn = (msg) => (warnings++, console.warn(`! ${msg}`));

for (const domain of DOMAINS) {
  const works = loadWorks(domain);
  for (const w of works) {
    if (!validate(w)) {
      for (const e of validate.errors) fail(`${domain}/${w.id ?? '?'}${e.instancePath}: ${e.message}`);
    }
    if (w.domain !== domain) fail(`${w.id}: domain "${w.domain}" in ${domain}.json`);
    if (ids.has(w.id)) fail(`${w.id}: duplicate id`);
    ids.add(w.id);
    if (domain === 'games' && !w.platforms?.length) warn(`${w.id}: no platforms (Classic falls back to format)`);
    if (w.audio && !w.audio.youtubeId) warn(`${w.id}: audio has no youtubeId (text clue only)`);
  }

  const years = new Set(works.map((w) => w.year));
  if (years.size < 4) fail(`${domain}: need at least 4 distinct years for Timeline`);

  const coverage = Object.entries(COVERAGE)
    .map(([game, has]) => [game, works.filter(has).length])
    .map(([game, n]) => {
      if (n === 0) fail(`${domain}: no works playable in "${game}"`);
      else if (n < MIN_PER_GAME) warn(`${domain}: only ${n} works for "${game}"`);
      return `${game}:${n}`;
    });
  const images = ['cover', 'item', 'location'].map((k) => `${k} img:${works.filter((w) => w[k]?.image).length}`);
  console.log(`${domain.padEnd(7)} ${String(works.length).padStart(3)} works | ${coverage.join(' ')} | ${images.join(' ')} | clips:${works.filter((w) => w.audio?.youtubeId).length}`);
}

// ---------------------------------------------------------------- Connections
const puzzles = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'connections.json'), 'utf8'));
const puzzleIds = new Set();
let withImages = 0;
for (const pz of puzzles) {
  if (puzzleIds.has(pz.id)) fail(`connections/${pz.id}: duplicate id`);
  puzzleIds.add(pz.id);
  if (![...DOMAINS, 'mixed'].includes(pz.domain)) fail(`connections/${pz.id}: bad domain "${pz.domain}"`);
  const levels = pz.groups.map((g) => g.level).sort().join();
  if (pz.groups.length !== 4 || levels !== '0,1,2,3') fail(`connections/${pz.id}: needs 4 groups with levels 0-3 (got ${levels})`);
  if (pz.groups.some((g) => g.items.length !== 4)) fail(`connections/${pz.id}: every group needs 4 tiles`);
  const tiles = pz.groups.flatMap((g) => g.items.map((t) => (typeof t === 'string' ? { label: t } : t)));
  const labels = tiles.map((t) => t.label.toLowerCase());
  if (new Set(labels).size !== labels.length) fail(`connections/${pz.id}: duplicate tile label`);
  const missing = tiles.filter((t) => !t.image).length;
  if (missing === 0) withImages++;
  else if (missing < tiles.length) warn(`connections/${pz.id}: ${missing} tile(s) without image — grid shows text only`);
}
const perDomain = [...DOMAINS, 'mixed'].map((d) => `${d}:${puzzles.filter((p) => p.domain === d).length}`).join(' ');
console.log(`connections ${puzzles.length} puzzles (${perDomain}) | fully illustrated: ${withImages}`);

console.log(`\n${ids.size} works, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
