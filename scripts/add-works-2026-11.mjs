#!/usr/bin/env node
// Merges the November 2026 batch (scripts/data/new-works-2026-11.mjs, video games from the owner's Steam library) into
// games.json, skipping ids or names that already exist. Each one gets `from`: the dailies draw it from FROM on. The
// `from` dates were then spread in games.json, three games a day from 18 November to 16 December 2026, the best-known
// first: the dailies pick answers never used before first, so 85 at once would have filled nine days with nothing else.
//   node scripts/add-works-2026-11.mjs
// Then: node scripts/enrich-media.mjs --no-youtube (covers, items, locations).
import { loadWorks, saveWorks } from './lib.mjs';
import { NEW_GAMES_2026_11 } from './data/new-works-2026-11.mjs';

const FROM = '2026-11-18';
const works = loadWorks('games');
const ids = new Set(works.map((w) => w.id));
const names = new Map(works.flatMap((w) => [w.name, ...(w.aliases ?? [])].map((n) => [n.toLowerCase(), w.name])));
let added = 0;
for (const row of NEW_GAMES_2026_11) {
  const clash = [row.name, ...(row.aliases ?? [])].map((n) => n.toLowerCase()).find((n) => names.has(n));
  if (ids.has(row.id) || clash) {
    console.log(`  ${row.name}: already there (${ids.has(row.id) ? row.id : `"${clash}" is ${names.get(clash)}`})`);
    continue;
  }
  works.push({ ...row, domain: 'games', from: FROM });
  ids.add(row.id);
  for (const n of [row.name, ...(row.aliases ?? [])]) names.set(n.toLowerCase(), row.name);
  added++;
}
saveWorks('games', works);
console.log(`games: +${added} (${works.length} in all)`);
