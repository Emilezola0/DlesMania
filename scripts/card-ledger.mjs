#!/usr/bin/env node
// The card ledger: the day each card joined the game, and the day a card's rarity changed.
// Games that pick cards by the day (the Daily Choice, the Raid Boss, the Daily Card Shop) only see a card from the
// day it joined, and a card's old rarity before its change, so adding cards never changes a day that has already
// started: its questions, votes, boss and shelf stay as they were. New cards count from tomorrow.
//
//   npm run cards:ledger                  record new cards and rarity changes, from tomorrow (local time)
//   npm run cards:ledger -- --day 2026-12-01
//   npm run cards:ledger -- --check       exit 1 if something isn't recorded (the build runs this)
//
// It writes:
//   scripts/data/card-ids.json   every card the game had, with its rarity (the reference; not shipped)
//   src/data/card-since.json     { cards: { id: day }, rarity: { id: [[day, rarity before that day], …] } } (shipped)
//   src/data/daily-choice.json   "since" for a new franchise (the Daily Choice and the Raid Boss take it from that day)
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const IDS = join(ROOT, 'scripts/data/card-ids.json');
const SINCE = join(ROOT, 'src/data/card-since.json');
const CHOICE = join(ROOT, 'src/data/daily-choice.json');

const args = process.argv.slice(2);
const check = args.includes('--check');
const pad = (n) => String(n).padStart(2, '0');
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const day = args.includes('--day') ? args[args.indexOf('--day') + 1] : tomorrow();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day ${day}: expected YYYY-MM-DD`);

/** Every collectible card today: [id, rarity, set], read from src/gacha/cards.ts. */
async function currentCards() {
  const dir = mkdtempSync(join(tmpdir(), 'card-ledger-'));
  try {
    const out = join(dir, 'cards.mjs');
    const empty = Object.fromEntries(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp3', '.mp4', '.css'].map((e) => [e, 'empty']));
    await build({
      stdin: { contents: "export { COLLECTIBLE } from './src/gacha/cards';", resolveDir: ROOT, loader: 'ts' },
      bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: empty,
    });
    const { COLLECTIBLE } = await import(pathToFileURL(out).href);
    return COLLECTIBLE.map((c) => [c.id, c.rarity, c.set]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const read = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const known = read(IDS, null);
const since = read(SINCE, { cards: {}, rarity: {} });
const choice = read(CHOICE, null);
const cards = await currentCards();

if (!known) {
  // First run: everything there is now counts as always there.
  writeFileSync(IDS, `${JSON.stringify(Object.fromEntries(cards.map(([id, r]) => [id, r])), null, 0).replace(/,"/g, ',\n"')}\n`);
  console.log(`card-ids.json started with ${cards.length} cards.`);
  process.exit(0);
}

const added = cards.filter(([id]) => !(id in known));
const changed = cards.filter(([id, r]) => id in known && known[id] !== r);
const setsKnown = new Set([...choice.launchSets, ...Object.keys(choice.since)]);
const newSets = [...new Set(added.map(([, , s]) => s))].filter((s) => !setsKnown.has(s) && !cards.some(([id, , set]) => set === s && id in known));

if (check) {
  if (added.length || changed.length || newSets.length) {
    console.error(
      `card-ledger: ${added.length} new card(s), ${changed.length} rarity change(s), ${newSets.length} new franchise(s) not recorded` +
        ` (${[...added, ...changed].slice(0, 5).map(([id]) => id).join(', ')}${added.length + changed.length > 5 ? '…' : ''}).\n` +
        'Run `npm run cards:ledger` so they only count from tomorrow and today\'s Daily Choice, Raid Boss and shop stay the same.',
    );
    process.exit(1);
  }
  console.log('card-ledger: every card is recorded.');
  process.exit(0);
}

for (const [id] of added) since.cards[id] ??= day;
for (const [id] of changed) (since.rarity[id] ??= []).push([day, known[id]]);
for (const s of newSets) choice.since[s] = day;
for (const [id, r] of cards) known[id] = r;

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(SINCE, `${JSON.stringify({ cards: sorted(since.cards), rarity: sorted(since.rarity) }, null, 2)}\n`);
writeFileSync(IDS, `${JSON.stringify(known, null, 0).replace(/,"/g, ',\n"')}\n`);
if (newSets.length) {
  // Only the "since" line changes, the rest of the file keeps its layout.
  const text = readFileSync(CHOICE, 'utf8').replace(/"since": \{[^}]*\}/, `"since": ${JSON.stringify(choice.since).replace(/,"/g, ', "').replace(/":"/g, '": "').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`);
  writeFileSync(CHOICE, text);
}
console.log(`From ${day}: ${added.length} new card(s), ${changed.length} rarity change(s)${newSets.length ? `, new franchise(s) ${newSets.join(', ')}` : ''}.`);
