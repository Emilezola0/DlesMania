#!/usr/bin/env node
// Merges the October 2026 batch (scripts/data/new-works-2026-10.mjs) into the works files, skipping
// ids or names that already exist.
//   node scripts/add-works-2026-10.mjs
// Then: node scripts/enrich-media.mjs --no-youtube (covers, items, locations).
import { loadWorks, saveWorks } from './lib.mjs';
import { NEW_ANIME_2026_10, NEW_CINEMA_2026_10, NEW_GAMES_2026_10 } from './data/new-works-2026-10.mjs';

for (const [domain, rows] of [['games', NEW_GAMES_2026_10], ['anime', NEW_ANIME_2026_10], ['cinema', NEW_CINEMA_2026_10]]) {
  const works = loadWorks(domain);
  const ids = new Set(works.map((w) => w.id));
  const names = new Set(works.flatMap((w) => [w.name, ...(w.aliases ?? [])]).map((n) => n.toLowerCase()));
  let added = 0;
  for (const row of rows) {
    if (ids.has(row.id) || names.has(row.name.toLowerCase())) {
      console.log(`  ${domain}: ${row.name} is already there`);
      continue;
    }
    // Anime are all Japanese productions.
    works.push({ ...row, domain, ...(domain === 'anime' ? { origin: 'Japan' } : {}) });
    ids.add(row.id);
    added++;
  }
  saveWorks(domain, works);
  console.log(`${domain}: +${added} (${works.length} in all)`);
}
