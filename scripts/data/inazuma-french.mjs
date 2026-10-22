#!/usr/bin/env node
// Shows the Inazuma Eleven boss in French: every answer, card and Name Chain entity takes its name
// from the French dub (checked on the French Inazuma Eleven wiki, inazuma-eleven.fandom.com/fr) as
// the displayed name, and keeps the Japanese and English names as accepted spellings.
// Cards keep their English wiki title in `src`, so `enrich-bosses.mjs` still finds their pictures.
// Safe to run again: names already in French are left as they are.
//
//   node scripts/data/inazuma-french.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';

/** Current first spelling → [French name, extra spellings to accept, spellings to drop]. */
const FRENCH = {
  // Players and staff (French dub names)
  'Endou Mamoru': ['Mark Evans'], 'Gouenji Shuuya': ['Axel Blaze'], 'Kidou Yuuto': ['Jude Sharp'], 'Kazemaru Ichirouta': ['Nathan Swift'],
  'Someoka Ryuugo': ['Kevin Dragonfly'], 'Kabeyama Heigorou': ['Jack Wallside'], 'Domon Asuka': ['Bobby Shearer'], 'Ichinose Kazuya': ['Erik Eagle'],
  'Fubuki Shirou': ['Shawn Froste'], 'Tsunami Jousuke': ['Hurley Kane'], 'Tachimukai Yuuki': ['Darren LaChance'], 'Kogure Yuuya': ['Scott Banyan', ['Scotty Banyan']],
  'Megane Kakeru': ['William Glass', ['Willy Glass']], 'Shishido Sakichi': ['Sam Kincaid', [], ['Steve Grim']], 'Kurimatsu Teppei': ['Tod Ironside'],
  'Matsuno Kuusuke': ['Maxwell Carson', ['Max Carson']], 'Handa Shinichi': ['Steve Grim', [], ['Sam Kincaid']],
  'Shourinji Ayumu': ['Tim Saunders', ['Timmy Saunders'], ['Timmy Sanders']], 'Kageno Jin': ['Jim Wraith'], 'Kiyama Hiroto': ['Xavier Foster'],
  'Midorikawa Ryuuji': ['Jordan Greenway'], 'Fudou Akio': ['Caleb Stonewall'], 'Sakuma Jirou': ['David Samford'], 'Utsunomiya Toramaru': ['Austin Hobbes'],
  'Hijikata Raiden': ['Thor Stoutberg'], 'Afuro Terumi': ['Byron Love'], 'Genda Koujirou': ['Joseph King'], 'Kino Aki': ['Silvia Woods'],
  'Raimon Natsumi': ['Nelly Raimon'], 'Otonashi Haruna': ['Celia Hills'], 'Kudou Michiya': ['Percival Travis'], 'Hibiki Seigou': ['Seymour Hillman'],
  'Kudou Fuyuka': ['Camellia Travis'], 'Endou Daisuke': ['David Evans'], 'Hitomiko Kira': ['Aquilina Schiller', ['Lina Schiller', 'Hitomiko']],
  // (Their English names used to be swapped here: Nagumo is Claude Beacons, Suzuno is Bryce Whitingale.)
  'Nagumo Haruya': ['Claude Beacons', [], ['Bryce Whitingale']], 'Suzuno Fuusuke': ['Bryce Whitingale', [], ['Claude Beacons']],
  // Aliea Academy captains: their French alien names
  Reize: ['Janus', ['Jordan Greenway']], Desarm: ['Dvalin', ['Dave Quagmire', 'Saginuma Osamu']], Gazel: ['Gazelle', ['Bryce Whitingale']], Burn: ['Torch', ['Claude Beacons']],
  Gran: ['Xene', ['Xavier Foster']],
  // Hissatsu techniques
  'God Hand': ['Main Céleste'], 'Majin The Hand': ['Main Magique'], 'Fire Tornado': ['Tornade de Feu'], 'Dragon Tornado': ['Tornade du Dragon'],
  'Inazuma Break': ['Éclair Pulvérisant'], 'Inazuma 1': ['Foudre'], 'Twin Boost': ['Tir Puissance 2'], 'Illusion Ball': ['Ballon Illusoire'],
  'Death Zone': ['Triangle de la Mort'], 'Eternal Blizzard': ['Blizzard Éternel'], 'Spinning Cut': ['Scie Circulaire'], 'The Wall': ['Le Mur'],
  'Fire Blizzard': ['Blizzard Enflammé'], Crossfire: ['Feu Glacé'], 'Grand Fire': ['Feu Tout-Puissant'], 'Bakunetsu Screw': ['Tourbillon de Feu'],
  'Dragon Crash': ['Choc du Dragon'], 'Koutei Penguin 2gou': ['Manchot Empereur N°2', ['Manchot Empereur']], 'Mugen The Hand': ["Mains de l'Infini"],
  'Heaven Drive': ['Tir Céleste'],
  // Teams
  'Teikoku Gakuen': ['Royal Academy', ['Royal Académie']], Occult: ['Occulte'], 'Gemini Storm': ['Tempête des Gémeaux'], Orpheus: ['Orphée'],
  Unicorn: ['Licornes'], 'The Kingdom': ['Rois du Football'], 'Fire Dragon': ['Dragons de Feu'], 'Little Gigant': ['Little Gigantes'],
  'Desert Lion': ['Lions du Désert'], 'Shuuyou Meito': ['Otaku'],
};
/** Answers the French wiki can't place (no such Aliea captain): removed. */
const DROP = ['Dark'];
/** The boss itself, and the names its lines mention. */
const BOSS_NAME = 'Ray Dark';
const LINES = [['Endou', 'Mark Evans'], ['Teikoku', 'the Royal Academy'], ['Raimon brats', 'Raimon kids']];

const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
const boss = bosses.find((b) => b.id === 'inazuma');
const uniq = (list) => [...new Set(list.filter(Boolean))];

/** [display, ...accepted] → the French name first, old names kept as aliases. */
function frenchSpellings([first, ...rest]) {
  const entry = FRENCH[first];
  if (!entry) return [first, ...rest];
  const [fr, extra = [], drop = []] = entry;
  return uniq([fr, first, ...rest, ...extra]).filter((s, i) => i === 0 || (s !== fr && !drop.includes(s)));
}
const answer = (s) => frenchSpellings(s.split('|')).join('|');
const card = (c) => {
  if (!FRENCH[c.label]) return c;
  const [label, ...aliases] = frenchSpellings([c.label, ...(c.aliases ?? [])]);
  return { ...c, label, aliases, src: c.src ?? `fandom:inazuma-eleven:${c.label}` };
};
const kept = (s) => !DROP.includes(s.split('|')[0]);

boss.boss.name = BOSS_NAME;
for (const p of boss.blitz) p.answers = p.answers.filter(kept).map(answer);
boss.radar.members = boss.radar.members.map(card);
boss.finale = boss.finale.map(card);
for (const c of boss.secret.categories) c.entities = c.entities.filter(kept).map(answer);
for (const [key, value] of Object.entries(boss.lines)) {
  const swap = (t) => LINES.reduce((s, [a, b]) => s.replaceAll(a, b), t);
  boss.lines[key] = Array.isArray(value) ? value.map(swap) : swap(value);
}
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
console.log('Inazuma Eleven boss now in French.');
