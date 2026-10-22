#!/usr/bin/env node
// Adds (or refreshes) the Genshin Impact boss in src/data/bosses.json: Il Dottore. Knowledge Blitz
// prompts, Radar members, Final Blow faces and the Name Chain's characters come from the Genshin
// Specialist data (src/data/specialist/genshin.json, built by scripts/build-specialist-genshin.mjs);
// the lines, the Archon and Harbinger lists and the impostors (characters from HoYoverse's other
// games) are written here. Then run `node scripts/enrich-bosses.mjs --boss=genshin` for the pictures.
//
//   node scripts/data/genshin-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';

const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const { characters } = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'genshin.json'), 'utf8'));
const answer = (c) => [c.name, ...c.aliases].join('|');
const by = (key, value) => characters.filter((c) => c[key] === value).map(answer);

const ARCHONS = ['Venti|Barbatos', 'Zhongli|Morax|Rex Lapis', 'Raiden Shogun|Ei|Raiden Ei|Beelzebul', 'Nahida|Kusanali|Lesser Lord Kusanali|Buer', 'Furina|Focalors|Furina de Fontaine', 'Mavuika'];
const HARBINGERS = [
  'Tartaglia|Childe|Ajax', 'Arlecchino|The Knave|Peruere', 'Il Dottore|Dottore|The Doctor|Zandik', 'La Signora|Signora|The Fair Lady|Rosalyne',
  'Pantalone|The Regrator', 'Pulcinella|The Rooster', 'Il Capitano|Capitano|The Captain', 'Sandrone|The Marionette', 'Columbina|The Damselette',
  'Pierro|The Jester', 'Scaramouche|The Balladeer|Wanderer|Kunikuzushi',
];
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Snezhnaya', 'Nod-Krai', "Khaenri'ah"];
const ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
const WEAPONS = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];

// Characters from HoYoverse's other games: they look the part, but they aren't from Teyvat.
const IMPOSTORS = [
  ['Kafka', 'fandom:honkai-star-rail:Kafka'], ['Silver Wolf', 'fandom:honkai-star-rail:Silver Wolf'], ['March 7th', 'fandom:honkai-star-rail:March 7th'],
  ['Dan Heng', 'fandom:honkai-star-rail:Dan Heng'], ['Himeko', 'fandom:honkai-star-rail:Himeko'], ['Welt', 'fandom:honkai-star-rail:Welt'],
  ['Acheron', 'fandom:honkai-star-rail:Acheron'], ['Firefly', 'fandom:honkai-star-rail:Firefly'], ['Sparkle', 'fandom:honkai-star-rail:Sparkle'],
  ['Black Swan', 'fandom:honkai-star-rail:Black Swan'], ['Jing Yuan', 'fandom:honkai-star-rail:Jing Yuan'], ['Ellen Joe', 'fandom:zenless-zone-zero:Ellen Joe'],
  ['Jane Doe', 'fandom:zenless-zone-zero:Jane Doe'], ['Kiana Kaslana', 'fandom:honkaiimpact3:Kiana Kaslana'],
].map(([label, src]) => ({ label, src }));

// The best-known characters (5★ and early ones first) on the radar; others for the Final Blow.
const famous = [...characters].sort((a, b) => b.rarity - a.rarity || a.version.localeCompare(b.version));
const card = (c) => ({ label: c.name, ...(c.aliases.length ? { aliases: c.aliases } : {}), image: c.image });
const members = famous.slice(0, 20).map(card);
const finale = famous.slice(20, 40).map(card);

const boss = {
  id: 'genshin',
  domain: 'games',
  franchise: 'Genshin Impact',
  aliases: ['genshin', 'gi', 'teyvat'],
  images: 'fandom:genshin-impact',
  boss: { name: 'Il Dottore', title: 'Second of the Fatui Harbingers', src: 'fandom:genshin-impact:Il Dottore', color: '#0ea5e9' },
  lines: {
    intro: 'A Traveler, wandering into my laboratory. How convenient — I was running short of test subjects.',
    phase2: 'Your memory holds. But can you tell a true Teyvat native from a clever imitation?',
    phase3: 'Fascinating. Now, the final experiment: name them before the data runs out.',
    hit: ['A minor setback.', 'Noted. Adjusting the parameters.', 'Hm. Unexpected.'],
    hurt: ['Another failed sample.', 'Your results are disappointing.', 'Back to the control group.'],
    win: 'Remarkable. I will be studying you for a very long time.',
    lose: 'As predicted. Record it and dispose of the subject.',
    secret: 'One last test, off the record. I name something from Teyvat — you name another of the same kind. Repeat nothing.',
    secretOk: ['Acceptable.', 'Continue.', 'The data agrees.'],
    secretLost: 'Wrong. The experiment is over.',
  },
  blitz: [
    { prompt: 'Name 5 Pyro characters', count: 5, answers: by('element', 'Pyro') },
    { prompt: 'Name 5 Hydro characters', count: 5, answers: by('element', 'Hydro') },
    { prompt: 'Name 5 Electro characters', count: 5, answers: by('element', 'Electro') },
    { prompt: 'Name 5 characters from Liyue', count: 5, answers: by('region', 'Liyue') },
    { prompt: 'Name 5 characters from Inazuma', count: 5, answers: by('region', 'Inazuma') },
    { prompt: 'Name 5 characters from Fontaine', count: 5, answers: by('region', 'Fontaine') },
    { prompt: 'Name 5 claymore users', count: 5, answers: by('weapon', 'Claymore') },
    { prompt: 'Name 4 Archons', count: 4, answers: ARCHONS },
    { prompt: 'Name 4 Fatui Harbingers', count: 4, answers: HARBINGERS },
  ],
  radar: { members, impostors: IMPOSTORS },
  finale,
  secret: {
    categories: [
      { label: 'Character', entities: characters.map(answer) },
      { label: 'Region', entities: REGIONS },
      { label: 'Element', entities: ELEMENTS },
      { label: 'Weapon type', entities: WEAPONS },
    ],
  },
};

const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
const old = bosses.find((b) => b.id === 'genshin');
// Keep pictures already resolved (the boss portrait, impostors) when refreshing.
if (old?.boss.image) boss.boss.image = old.boss.image;
for (const imp of boss.radar.impostors) {
  const prev = old?.radar.impostors.find((i) => (i.label ?? i) === imp.label);
  if (prev?.image) imp.image = prev.image;
}
const at = bosses.findIndex((b) => b.id === 'genshin');
if (at >= 0) bosses[at] = boss;
else bosses.splice(bosses.findIndex((b) => b.id === 'smash') + 1, 0, boss);
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
console.log(`Genshin boss written: ${boss.blitz.length} prompts, ${members.length} members, ${IMPOSTORS.length} impostors, ${finale.length} faces.`);
