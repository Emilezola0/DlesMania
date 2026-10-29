#!/usr/bin/env node
// French names from the franchise wikis' own language links: for every name the games show (boss
// battles, Who's That?, card rosters, Specialist rosters), the wiki is asked for its French page,
// and the French title is kept when it differs. Written to src/data/french-names-wiki.json, which
// src/lib/french.ts reads after the hand-made list (that one wins where both have a name).
//   node scripts/find-french-names.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, sleep } from './lib.mjs';

const json = (p) => JSON.parse(readFileSync(join(ROOT, 'src', 'data', p), 'utf8'));
const WIKI = {
  lol: 'leagueoflegends.fandom.com', overwatch: 'overwatch.fandom.com', minecraft: 'minecraft.wiki', onepiece: 'onepiece.fandom.com', dbz: 'dragonball.fandom.com',
  naruto: 'naruto.fandom.com', starwars: 'starwars.fandom.com', harrypotter: 'harrypotter.fandom.com', lotr: 'lotr.fandom.com', mcu: 'marvelcinematicuniverse.fandom.com',
  smash: 'supersmashbros.fandom.com', genshin: 'genshin-impact.fandom.com', wow: 'wowpedia.fandom.com', inazuma: 'inazuma-eleven.fandom.com', forhonor: 'forhonor.fandom.com',
  avatar: 'avatar.fandom.com', pokemon: 'pokemon.fandom.com',
};
const first = (s) => s.split('|')[0];
const names = new Map(); // wiki → Set of names
const add = (set, name) => {
  if (!WIKI[set] || !name) return;
  if (!names.has(set)) names.set(set, new Set());
  names.get(set).add(name);
};
for (const b of json('bosses.json')) {
  add(b.id, b.boss.name);
  for (const c of [...b.radar.members, ...b.finale]) add(b.id, typeof c === 'string' ? c : c.label);
  for (const cat of b.secret?.categories ?? []) for (const e of cat.entities) add(b.id, first(e));
  for (const p of b.blitz) for (const a of p.answers) add(b.id, first(a));
}
for (const s of json('silhouettes.json')) for (const e of s.entries) if (!e.fr) add(s.id, e.name);
for (const [set, list] of Object.entries(json('card-rosters.json'))) for (const r of list) add(set, r.name);
for (const c of json('specialist/onepiece.json').characters) add('onepiece', c.name);
for (const c of json('specialist/marvel.json').characters) add('mcu', c.name);
for (const c of json('specialist/genshin.json').characters) add('genshin', c.name);
for (const c of json('specialist/wow.json').characters) add('wow', c.name);

const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s) => new Set(s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
/** Pages that are no French *name* for what the game shows (checked by hand on a first run). */
const NOT_A_NAME = new Set(['Goblins', 'Balrog', 'Anglachel', 'Combustionbending']);
function keep(set, en, fr) {
  const a = key(en);
  const b = key(fr);
  // Same name, or the same name with words added or dropped ("Cloud" / "Cloud Strife", "Dracule Mihawk" / "Mihawk") —
  // but a real change of spelling stays ("Thoma" / "Thomas").
  const we = words(en), wf = words(fr);
  if (a === b || [...wf].every((w) => we.has(w)) || [...we].every((w) => wf.has(w))) return false;
  if (NOT_A_NAME.has(en)) return false;
  // The French Inazuma wiki pairs some players with other characters' names.
  if (set === 'inazuma') return false;
  // The French MCU wiki is titled by real names (Black Widow → Yelena Belova): only things sharing a word.
  if (set === 'mcu' && ![...words(en)].some((w) => words(fr).has(w))) return false;
  // Harry Potter's spells keep their incantation in French ("Accio", not "Sortilège d'Attraction").
  if (set === 'harrypotter' && /^(sortil[eè]ge|mal[eé]fice|charme|enchantement|contre-sort|sort)\b/i.test(fr)) return false;
  return true;
}

const out = {};
for (const [set, list] of names) {
  const api = `https://${WIKI[set]}/api.php?`;
  const titles = [...list];
  let found = 0;
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    let j;
    try {
      j = await (await fetch(api + new URLSearchParams({ format: 'json', action: 'query', prop: 'langlinks', lllang: 'fr', lllimit: '500', redirects: '1', titles: batch.join('|') }))).json();
    } catch {
      console.log(`  ${set}: no answer for a batch`);
      continue;
    }
    // Back from the page found to the name asked for.
    const back = new Map();
    for (const r of [...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])]) back.set(r.to, back.get(r.from) ?? r.from);
    for (const p of Object.values(j.query?.pages ?? {})) {
      const fr = p.langlinks?.[0]?.['*'];
      if (!fr) continue;
      let asked = p.title;
      while (back.has(asked)) asked = back.get(asked);
      // "Freezer (personnage)" → "Freezer", "Ahri/Historique" → "Ahri"; a page that's about something broader ("Liste des…") is no name.
      const name = fr.replace(/\/.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (!name || /^(liste|list|catégorie|category)\b/i.test(name) || name.includes(':')) continue;
      if (!list.has(asked) || !keep(set, asked, name)) continue;
      out[asked] = name;
      found++;
    }
    await sleep(150);
  }
  console.log(`${set}: ${titles.length} names, ${found} French names`);
}
// By hand: wikis with no French links (Star Wars), and French pages that name something else.
const MANUAL = {
  'Darth Maul': 'Dark Maul', 'Darth Sidious': 'Dark Sidious', 'Darth Plagueis': 'Dark Plagueis', 'Darth Bane': 'Dark Bane', 'Darth Revan': 'Dark Revan', 'Darth Malak': 'Dark Malak',
  'Count Dooku': 'Comte Dooku', 'Jabba Desilijic Tiure': 'Jabba le Hutt', 'Millennium Falcon': 'Faucon Millenium', 'Death Star': 'Étoile de la Mort', 'Star Destroyer': 'Destroyer stellaire',
  'TIE Fighter': 'Chasseur TIE', 'TIE Interceptor': 'Intercepteur TIE', 'Sandcrawler': 'Rampeur des sables', 'Probe Droid': 'Droïde sonde', 'Mouse Droid': 'Droïde souris',
  'Super Battle Droid': 'Super droïde de combat', 'B1 Battle Droid': 'Droïde de combat B1', 'Starkiller Base': 'Base Starkiller', 'Jedi Starfighter': 'Chasseur Jedi',
  'Sith Infiltrator': 'Infiltrateur Sith', 'Slave I': 'Esclave I',
  "Hufflepuff's Cup": 'Coupe de Poufsouffle', "Slytherin's Locket": 'Médaillon de Serpentard', "Ravenclaw's Diadem": 'Diadème de Serdaigle',
};
Object.assign(out, MANUAL);
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(ROOT, 'src', 'data', 'french-names-wiki.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(Object.keys(sorted).length, 'in all');
