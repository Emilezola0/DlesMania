#!/usr/bin/env node
// Copies French names into the dataset:
//   - scripts/data/french-titles.mjs → `nameFr` on works (skipped when same as the English name)
//   - scripts/data/boss-french.mjs   → extra spellings on Boss Battle answers, Final Blow and Radar cards
//   node scripts/add-french-titles.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOSS_FRENCH } from './data/boss-french.mjs';
import { FRENCH_TITLES } from './data/french-titles.mjs';
import { DOMAINS, ROOT, loadWorks, saveWorks } from './lib.mjs';

const same = (a, b) => a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') ===
  b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const unknown = new Set(Object.keys(FRENCH_TITLES));
let added = 0;
for (const d of DOMAINS) {
  const works = loadWorks(d);
  for (const w of works) {
    const fr = FRENCH_TITLES[w.id];
    if (!fr) continue;
    unknown.delete(w.id);
    if (same(fr, w.name)) delete w.nameFr;
    else if (w.nameFr !== fr) (w.nameFr = fr), added++;
  }
  saveWorks(d, works);
}
console.log(`${added} French titles set`);
if (unknown.size) console.log(`unknown ids: ${[...unknown].join(', ')}`);

// ---------------------------------------------------------------- Boss Battle answers

const BOSS_SEARCH = { dbz: ['freezer'], starwars: ['dark vador', 'la guerre des etoiles'], lotr: ['le seigneur des anneaux'] };
const bossFile = join(ROOT, 'src', 'data', 'bosses.json');
const bosses = JSON.parse(readFileSync(bossFile, 'utf8'));
let merged = 0;
const used = new Set();
for (const b of bosses) {
  const fr = BOSS_FRENCH[b.id] ?? {};
  const extra = (name) => {
    const names = fr[name];
    if (names) used.add(`${b.id}/${name}`);
    return names ?? [];
  };
  for (const p of b.blitz) {
    p.answers = p.answers.map((a) => {
      const parts = a.split('|');
      const add = extra(parts[0]).filter((n) => !parts.includes(n));
      merged += add.length;
      return [...parts, ...add].join('|');
    });
  }
  b.finale = b.finale.map((c) => {
    const card = typeof c === 'string' ? { label: c } : c;
    const add = extra(card.label).filter((n) => !(card.aliases ?? []).includes(n));
    if (!add.length) return c;
    merged += add.length;
    return { ...card, aliases: [...(card.aliases ?? []), ...add] };
  });
  // Radar cards (the best-known faces, also used by Crossroads and Summit): the French spellings as
  // aliases, and the first one as `fr`, the name shown when names are in French.
  for (const side of ['members', 'impostors']) {
    b.radar[side] = b.radar[side].map((c) => {
      const card = typeof c === 'string' ? { label: c } : c;
      const names = extra(card.label);
      if (!names.length) return c;
      const add = names.filter((n) => !(card.aliases ?? []).includes(n));
      merged += add.length;
      return { ...card, fr: names[0], aliases: [...(card.aliases ?? []), ...add] };
    });
  }
  for (const s of BOSS_SEARCH[b.id] ?? []) if (!b.aliases?.includes(s)) b.aliases = [...(b.aliases ?? []), s];
}
writeFileSync(bossFile, JSON.stringify(bosses, null, 2) + '\n');
console.log(`${merged} French boss answers merged`);
const unused = Object.entries(BOSS_FRENCH).flatMap(([id, m]) => Object.keys(m).map((k) => `${id}/${k}`)).filter((k) => !used.has(k));
if (unused.length) console.log(`no matching answer for: ${unused.join(', ')}`);
