#!/usr/bin/env node
// Freezes every card's rarity into src/data/card-rarities.json, so it can never change: what a
// player pulled as a rare stays a rare, whatever the rules in src/gacha/cards.ts become. Only cards
// not in the file yet are added (with the rarity the rules give them); existing ones are never
// touched. Run after adding cards:  npm run cards:freeze
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const file = join(process.cwd(), 'src', 'data', 'card-rarities.json');
const frozen = JSON.parse(readFileSync(file, 'utf8'));

// The cards as the site builds them (bundled, so the TypeScript and JSON imports resolve).
const dir = mkdtempSync(join(tmpdir(), 'cards-'));
const out = join(dir, 'cards.mjs');
await build({ entryPoints: ['src/gacha/cards.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { CARDS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let added = 0;
for (const c of CARDS) {
  if (frozen[c.id]) continue;
  frozen[c.id] = c.rarity;
  added++;
}
const sorted = Object.fromEntries(Object.entries(frozen).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
const gone = Object.keys(frozen).filter((id) => !CARDS.some((c) => c.id === id));
console.log(`${added} card${added === 1 ? '' : 's'} frozen, ${Object.keys(sorted).length} in all.`);
if (gone.length) console.log(`Kept for players who own them, though no longer built: ${gone.join(', ')}`);
