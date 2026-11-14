#!/usr/bin/env node
// Builds src/data/specialist/lol-fr.json: League of Legends in French, for the Specialist rounds when the game is in
// French — each champion's title and ability names as the French client has them (Data Dragon fr_FR).
//
//   node scripts/build-specialist-lol-fr.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getJson } from './lib.mjs';

const OUT = join(ROOT, 'src', 'data', 'specialist', 'lol-fr.json');
const version = (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
console.log(`▶ Data Dragon ${version}`);
const fr = (await getJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/championFull.json`)).data;

const titles = {};
const abilities = {};
for (const id of Object.keys(fr).sort()) {
  const c = fr[id];
  titles[id] = c.title;
  abilities[id] = { P: c.passive.name, Q: c.spells[0].name, W: c.spells[1].name, E: c.spells[2].name, R: c.spells[3].name };
}
const lines = (o) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
writeFileSync(OUT, `{\n "generated": "${new Date().toISOString().slice(0, 10)}",\n "version": "${version}",\n "titles": {\n${lines(titles)}\n },\n "abilities": {\n${lines(abilities)}\n }\n}\n`);
console.log(`✓ ${Object.keys(titles).length} champions → ${OUT}`);
