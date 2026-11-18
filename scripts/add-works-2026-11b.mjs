#!/usr/bin/env node
// Merges the second November 2026 batch (scripts/data/new-works-2026-11b.mjs) into games.json, skipping ids or names that
// already exist, and gives each a `from` date: three a day from the day after the first batch's last ones (16 December
// 2026), the best-known first. The dailies pick answers never used before first, so many at once would fill whole days.
//   node scripts/add-works-2026-11b.mjs
// Then: node scripts/enrich-media.mjs --domain=games --no-youtube (covers, items, locations).
import { loadWorks, saveWorks } from './lib.mjs';
import { NEW_GAMES_2026_11B } from './data/new-works-2026-11b.mjs';

const START = '2026-12-17';
const PER_DAY = 3;
/** These come first (the most widely known); the rest follow in a fixed shuffled order, so alike games don't arrive together. */
const FIRST = [
  'g-pvz', 'g-dota2', 'g-pubg', 'g-hearthstone', 'g-re2', 'g-cod4', 'g-oblivion', 'g-farcry3', 'g-rust', 'g-hitman', 'g-overcooked2', 'g-goosegame',
  'g-geometrydash', 'g-ffxiv', 'g-mk11', 'g-deadspace', 'g-mirrorsedge', 'g-stanleyparable', 'g-factorio', 'g-palworld', 'g-dbfz', 'g-supermeatboy',
  'g-forzahorizon5', 'g-citiesskylines', 'g-ksp', 'g-honkaistarrail', 'g-bayonetta', 'g-amnesia', 'g-outlast', 'g-darkestdungeon', 'g-pizzatower',
  'g-superhot', 'g-dredge', 'g-humanfallflat', 'g-poppyplaytime', 'g-gearsofwar', 'g-xcom2', 'g-ftl', 'g-rimworld', 'g-enterthegungeon',
];

const day = (n) => new Date(Date.UTC(+START.slice(0, 4), +START.slice(5, 7) - 1, +START.slice(8) + n)).toISOString().slice(0, 10);
const works = loadWorks('games');
const ids = new Set(works.map((w) => w.id));
const norm = (s) => s.toLowerCase();
const names = new Map(works.flatMap((w) => [w.name, ...(w.aliases ?? [])].map((n) => [norm(n), w.name])));
const fresh = [];
for (const row of NEW_GAMES_2026_11B) {
  const clash = [row.name, ...(row.aliases ?? [])].map(norm).find((n) => names.has(n));
  if (ids.has(row.id) || clash) {
    console.log(`  ${row.name}: already there (${ids.has(row.id) ? row.id : `"${clash}" is ${names.get(clash)}`})`);
    continue;
  }
  fresh.push(row);
  ids.add(row.id);
  for (const n of [row.name, ...(row.aliases ?? [])]) names.set(norm(n), row.name);
}
let seed = 20261217;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rest = fresh.filter((w) => !FIRST.includes(w.id));
for (let i = rest.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [rest[i], rest[j]] = [rest[j], rest[i]];
}
const order = [...FIRST.map((id) => fresh.find((w) => w.id === id)).filter(Boolean), ...rest];
order.forEach((row, i) => works.push({ ...row, domain: 'games', from: day(Math.floor(i / PER_DAY)) }));
saveWorks('games', works);
console.log(`games: +${order.length} (${works.length} in all), in the dailies from ${START} to ${day(Math.floor((order.length - 1) / PER_DAY))}`);
