#!/usr/bin/env node
// One command to grow and refresh the dataset:
//
//   node scripts/seed-database.mjs                                   # media + checks for what's already there
//   node scripts/seed-database.mjs --import=anilist:anime.txt --import=musicbrainz:albums.txt
//   node scripts/seed-database.mjs --import=file:my-entries.json --force
//
// Steps:
//   1. Import  — optional, `--import=<provider>:<file>` (anilist, musicbrainz, tmdb, igdb, file). Repeatable.
//                Importers fill the factual fields; clue fields (emoji, quote/tracks, item, location,
//                audio.clue + audio.query, visual) are creative and written by hand.
//   1b. French — French titles and boss answer spellings from scripts/data/.
//   2. Wikis   — checks every `fandom` slug / `fandom:` source exists (renamed wikis show their new slug).
//   3. Media   — covers, item and location images (Wikipedia + Fandom), YouTube clips with YOUTUBE_API_KEY.
//   4. Puzzles — Connections tile images, then Boss Battle portraits and cards.
//   5. Check   — schema + per-mini-game coverage (scripts/validate-data.mjs).
//
// Flags: --force (re-resolve media), --no-media, --no-clips, --skip-wikis.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { DOMAINS, ROOT, loadWorks, parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const imports = [process.argv.slice(2).filter((a) => a.startsWith('--import=')).map((a) => a.slice('--import='.length))].flat();

function run(script, args = []) {
  console.log(`\n▶ node scripts/${script} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${script} exited with ${r.status}`);
}

async function checkWikis() {
  const slugs = new Map(); // slug -> example work id
  for (const d of DOMAINS) {
    for (const w of loadWorks(d)) {
      if (w.fandom) slugs.set(w.fandom, w.id);
      for (const k of ['item', 'location']) {
        const src = w[k]?.src;
        if (src?.startsWith('fandom:')) slugs.set(src.split(':')[1], w.id);
      }
    }
  }
  console.log(`\n▶ checking ${slugs.size} Fandom wikis`);
  let bad = 0;
  for (const [slug, id] of slugs) {
    const res = await fetch(`https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`, {
      headers: { 'User-Agent': 'OmnidleDataScripts/0.2 (https://github.com/Emilezola0/DlesMania)' },
      redirect: 'manual',
    });
    if (res.status === 200) continue;
    bad++;
    const moved = res.headers.get('location')?.match(/https:\/\/([^.]+)\.fandom\.com/)?.[1];
    console.log(`  ✗ ${slug} (e.g. ${id}): ${moved ? `renamed → "${moved}"` : `HTTP ${res.status}`}`);
  }
  if (!bad) console.log('  ✓ all wikis reachable');
}

try {
  for (const spec of imports) {
    const [provider, file] = spec.split(':');
    run('import.mjs', provider === 'file' ? ['file', file] : [provider, `--list=${file}`]);
  }
  run('add-french-titles.mjs');
  if (!flags['skip-wikis']) await checkWikis();
  if (!flags['no-media']) {
    const mediaArgs = [flags.force && '--force', flags['no-clips'] && '--no-youtube'].filter(Boolean);
    run('enrich-media.mjs', mediaArgs);
    run('enrich-connections.mjs', flags.force ? ['--force'] : []);
    run('enrich-bosses.mjs', flags.force ? ['--force'] : []);
  }
  run('validate-data.mjs');
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
}
