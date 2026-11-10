#!/usr/bin/env node
// Measures every card's picture (and an omni's awakened one) and lists in src/data/card-opaque.json the
// ones with no transparency: rectangular pictures (art, screenshots, splashes) that a card shows filling
// its frame, where a cut-out render is shown whole. Drawn SVG pictures (JLPT, Unreal) are left out.
// Pictures already measured are kept; run after adding cards:  npm run cards:measure
// (`--again` measures every picture again.)
import { existsSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

const file = join(process.cwd(), 'src', 'data', 'card-opaque.json');
const again = process.argv.includes('--again');
/** What was measured: by picture, whether it's opaque (a picture that couldn't be read isn't listed, so it's tried again). */
const cacheFile = join(process.cwd(), 'scripts', 'data', 'card-pictures-measured.json');
const measured = !again && existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

// The cards as the site builds them (bundled, so the TypeScript and JSON imports resolve).
const dir = mkdtempSync(join(tmpdir(), 'cards-'));
const out = join(dir, 'cards.mjs');
await build({ entryPoints: ['src/gacha/cards.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { CARDS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

/** Every picture to look at: [the key the site reads, its address]. */
const jobs = [];
for (const c of CARDS) {
  jobs.push([c.id, c.image]);
  if (c.awaken) jobs.push([`${c.id}@awake`, c.awaken.image]);
}

async function bytesOf(src) {
  // The site's own pictures ("./art/…", "/art/…"): from public/.
  if (!/^https?:/.test(src)) return readFileSync(join(process.cwd(), 'public', src.replace(/^\.?\//, '')));
  const res = await fetch(src, { headers: { 'User-Agent': 'OmnidleCardPictures/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Opaque: no alpha channel, or every pixel's alpha (nearly) full. */
async function isOpaque(src) {
  const img = sharp(await bytesOf(src), { animated: false });
  const meta = await img.metadata();
  if (!meta.hasAlpha) return true;
  const stats = await img.stats();
  return stats.channels[3].min >= 250;
}

const todo = jobs.filter(([, src]) => !src.startsWith('data:') && !/\.svg(\?|$)/i.test(src) && !(src in measured));
let done = 0;
let failed = 0;
const queue = [...todo];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [, src] = job;
      try {
        measured[src] = await isOpaque(src);
      } catch (e) {
        // A JPEG can't hold transparency: opaque, read or not.
        if (/\.jpe?g(\?|$)/i.test(src)) measured[src] = true;
        failed++;
        if (failed <= 20) console.warn(`  couldn't read ${src}: ${e.message}`);
      }
      if (++done % 200 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }),
);

writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(measured).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
// Some wikis (Fandom) refuse a script: their pictures were measured in a browser, where the site shows them
// (scripts/data/card-opaque-from-browser.json, by card). Kept for every picture this script can't read.
const browserFile = join(process.cwd(), 'scripts', 'data', 'card-opaque-from-browser.json');
const fromBrowser = new Set(existsSync(browserFile) ? JSON.parse(readFileSync(browserFile, 'utf8')) : []);
const opaque = jobs.filter(([key, src]) => (src in measured ? measured[src] === true : fromBrowser.has(key))).map(([key]) => key).sort();
writeFileSync(file, JSON.stringify(opaque) + '\n');
console.log(`${todo.length} pictures measured (${failed} couldn't be read). ${opaque.length} opaque, of ${jobs.length}: src/data/card-opaque.json`);
