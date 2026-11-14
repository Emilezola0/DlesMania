#!/usr/bin/env node
// Builds src/data/specialist/lol-skins.json for the League of Legends Specialist "Skins" round: every
// champion's skins (not the base one, not chroma-only entries), with the skin's English and French names.
// Re-run it after a patch to pick up new skins.
//
//   node scripts/build-specialist-lol-skins.mjs
//
// Data Dragon (Riot's official static data): championFull in en_US and fr_FR. The splash itself is
// https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{id}_{num}.jpg, built in src/specialist/lol.ts.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getJson } from './lib.mjs';

const OUT = join(ROOT, 'src', 'data', 'specialist', 'lol-skins.json');
const version = (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
const CDN = `https://ddragon.leagueoflegends.com/cdn/${version}`;
console.log(`▶ Data Dragon ${version}`);
const en = (await getJson(`${CDN}/data/en_US/championFull.json`)).data;
const fr = (await getJson(`${CDN}/data/fr_FR/championFull.json`)).data;

const skins = {};
let count = 0;
for (const id of Object.keys(en).sort()) {
  const frNames = new Map((fr[id]?.skins ?? []).map((s) => [s.num, s.name]));
  const list = en[id].skins
    .filter((s) => s.num !== 0 && s.name !== 'default' && !/\(.*\)\s*$/.test(s.name)) // chromas share their skin's splash
    .map((s) => ({ num: s.num, name: s.name, ...(frNames.get(s.num) && frNames.get(s.num) !== s.name ? { fr: frNames.get(s.num) } : {}) }));
  if (list.length) {
    skins[id] = list;
    count += list.length;
  }
}

// Some skins have no splash on Data Dragon (legacy and event skins): those sit out.
const splash = (id, num) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_${num}.jpg`;
const all = Object.entries(skins).flatMap(([id, l]) => l.map((s) => ({ id, s })));
const missing = new Set();
for (let i = 0; i < all.length; i += 24) {
  await Promise.all(
    all.slice(i, i + 24).map(async ({ id, s }) => {
      const r = await fetch(splash(id, s.num), { method: 'HEAD' }).catch(() => null);
      if (!r?.ok) missing.add(`${id}_${s.num}`);
    }),
  );
}
for (const id of Object.keys(skins)) {
  skins[id] = skins[id].filter((s) => !missing.has(`${id}_${s.num}`));
  if (!skins[id].length) delete skins[id];
}
count -= missing.size;
console.log(`  ${missing.size} skins without a splash left out`);

const lines = Object.entries(skins).map(([id, l]) => `  ${JSON.stringify(id)}: ${JSON.stringify(l)}`);
const date = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, `{
 "generated": "${date}",
 "version": "${version}",
 "skins": {
${lines.join(',\n')}
 }
}
`);
console.log(`✓ ${count} skins for ${Object.keys(skins).length} champions → ${OUT}`);
