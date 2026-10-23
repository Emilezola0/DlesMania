#!/usr/bin/env node
// Adds (or refreshes) the World of Warcraft boss in src/data/bosses.json: the Lich King. Knowledge
// Blitz prompts, Radar members, Final Blow faces and the Name Chain's characters come from the WoW
// Specialist data (src/data/specialist/wow.json, built by scripts/build-specialist-wow.mjs); the
// lines, the lore lists (Aspects, Warchiefs, races, classes, capitals, expansions) and the impostors
// (characters from Blizzard's other games and from Middle-earth) are written here. Then run
// `node scripts/enrich-bosses.mjs --boss=wow` for the impostors' pictures.
//
//   node scripts/data/wow-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';

const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const { characters } = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'wow.json'), 'utf8'));
const answer = (c) => [c.name, ...c.aliases].join('|');
const by = (key, value) => characters.filter((c) => c[key] === value).map(answer);
/** Two answer lists as one, an entry per name (the first spelling decides). */
const merge = (...lists) => [...new Map(lists.flat().map((a) => [a.split('|')[0], a])).values()];

const ASPECTS = ['Alexstrasza|Life-Binder', 'Ysera|Dreamer', 'Nozdormu|Timeless One', 'Malygos|Spell-Weaver', 'Deathwing|Neltharion|Earth-Warder', 'Kalecgos|Kalec', 'Merithra', 'Chromie|Chronormu'];
const WARCHIEFS = ['Blackhand', "Orgrim Doomhammer|Doomhammer|Orgrim", "Thrall|Go'el", 'Garrosh Hellscream|Garrosh', "Vol'jin|Voljin", 'Sylvanas Windrunner|Sylvanas', 'Ner\'zhul|Nerzhul', 'Gul\'dan|Guldan'];
const RACES = [
  'Human|Humans', 'Dwarf|Dwarves', 'Night elf|Night elves', 'Gnome|Gnomes', 'Draenei', 'Worgen', 'Orc|Orcs', 'Undead|Forsaken', 'Tauren', 'Troll|Trolls',
  'Blood elf|Blood elves', 'Goblin|Goblins', 'Pandaren', 'Dracthyr', 'Earthen', 'Void elf|Void elves', 'Lightforged draenei', 'Dark Iron dwarf|Dark Iron dwarves',
  "Kul Tiran|Kul Tirans", 'Mechagnome|Mechagnomes', 'Nightborne', 'Highmountain tauren', "Mag'har orc|Maghar orc|Mag'har orcs", 'Zandalari troll|Zandalari trolls', 'Vulpera',
];
const CLASSES = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid', 'Death Knight|DK', 'Monk', 'Demon Hunter|DH', 'Evoker'];
const CAPITALS = [
  'Stormwind|Stormwind City', 'Ironforge', 'Darnassus', 'The Exodar|Exodar', 'Gilneas|Gilneas City', 'Orgrimmar', 'Undercity', 'Thunder Bluff', 'Silvermoon|Silvermoon City',
  'Dalaran', 'Shattrath|Shattrath City', 'Boralus', "Dazar'alor|Dazaralor", 'Oribos', 'Valdrakken', 'Dornogal',
];
const EXPANSIONS = [
  'The Burning Crusade|Burning Crusade|TBC', 'Wrath of the Lich King|WotLK|Wrath', 'Cataclysm|Cata', 'Mists of Pandaria|MoP', 'Warlords of Draenor|WoD', 'Legion',
  'Battle for Azeroth|BfA', 'Shadowlands', 'Dragonflight', 'The War Within|War Within|TWW', 'Midnight', 'The Last Titan',
];
const OLD_GODS = ["C'Thun|Cthun", 'Yogg-Saron|Yogg Saron', "N'Zoth|Nzoth", "Y'Shaarj|Yshaarj"];

// Look-alikes from Blizzard's other worlds and from Middle-earth: they look the part, but they aren't from Azeroth.
const IMPOSTORS = [
  ['Tyrael', 'fandom:diablo:Tyrael'], ['Diablo', 'fandom:diablo:Diablo'], ['Deckard Cain', 'fandom:diablo:Deckard Cain'], ['Inarius', 'fandom:diablo:Inarius'],
  ['Lilith', 'fandom:diablo:Lilith'], ['Sarah Kerrigan', 'fandom:starcraft:Sarah Kerrigan'], ['Jim Raynor', 'fandom:starcraft:Jim Raynor'], ['Zeratul', 'fandom:starcraft:Zeratul'],
  ['Arcturus Mengsk', 'fandom:starcraft:Arcturus Mengsk'], ['Reinhardt', 'fandom:overwatch:Reinhardt'], ['Witch-king of Angmar', 'fandom:lotr:Witch-king of Angmar'],
  ['Sauron', 'fandom:lotr:Sauron'], ['Gandalf', 'fandom:lotr:Gandalf'], ['Thranduil', 'fandom:lotr:Thranduil'],
].map(([label, src]) => ({ label, src }));

// The best-known characters on the radar (the data is ranked); the next ones for the Final Blow.
const card = (c) => ({ label: c.name, ...(c.aliases.length ? { aliases: c.aliases } : {}), image: c.image });
const ranked = [...characters].sort((a, b) => (b.render ? 1 : 0) - (a.render ? 1 : 0));
const members = ranked.filter((c) => c.name !== 'Arthas Menethil').slice(0, 20).map(card);
const finale = characters.filter((c) => !members.some((m) => m.label === c.name) && c.name !== 'Arthas Menethil').slice(0, 24).map(card);
const arthas = characters.find((c) => c.name === 'Arthas Menethil');

const boss = {
  id: 'wow',
  domain: 'games',
  franchise: 'World of Warcraft',
  aliases: ['wow', 'warcraft', 'azeroth'],
  images: 'fandom:wowpedia',
  boss: { name: 'The Lich King', title: 'Lord of the Scourge', src: arthas.art, color: '#38bdf8' },
  lines: {
    intro: 'Another hero climbs my citadel. Come, then — the cold has room for one more.',
    phase2: 'You remember names well. But can you tell Azeroth\'s own from the strangers at my gate?',
    phase3: 'Enough. Name the fallen as they rise before you — if you can keep up.',
    hit: ['A scratch.', 'The cold does not bleed.', 'Hmph. Again.'],
    hurt: ['Your warmth fades.', 'Kneel.', 'Another soul for the blade.'],
    win: 'So the ice cracks… There must always be a Lich King. Perhaps it will be you.',
    lose: 'Rise, champion — and serve the Scourge for eternity.',
    secret: 'One more game, champion. I name something of Azeroth — you name another of the same kind. Repeat nothing.',
    secretOk: ['Acceptable.', 'Go on.', 'The blade listens.'],
    secretLost: 'Wrong. The frost takes you.',
  },
  blitz: [
    { prompt: 'Name 5 Horde characters', count: 5, answers: by('faction', 'Horde') },
    { prompt: 'Name 5 Alliance characters', count: 5, answers: by('faction', 'Alliance') },
    { prompt: 'Name 5 orcs', count: 5, answers: by('race', 'Orc') },
    { prompt: 'Name 5 dragons', count: 5, answers: merge(by('race', 'Dragon'), ASPECTS) },
    { prompt: 'Name 4 Dragon Aspects', count: 4, answers: ASPECTS },
    { prompt: 'Name 4 Warchiefs of the Horde', count: 4, answers: WARCHIEFS },
    { prompt: 'Name 6 playable races', count: 6, answers: RACES },
    { prompt: 'Name 6 classes', count: 6, answers: CLASSES },
    { prompt: 'Name 5 capital cities', count: 5, answers: CAPITALS },
    { prompt: 'Name 5 expansions', count: 5, answers: EXPANSIONS },
    { prompt: 'Name 3 Old Gods', count: 3, answers: [...OLD_GODS, "G'huun|Ghuun"] },
    { prompt: 'Name 5 mages', count: 5, answers: by('class', 'Mage') },
  ],
  radar: { members, impostors: IMPOSTORS },
  finale,
  secret: {
    categories: [
      { label: 'Character', entities: characters.map(answer) },
      { label: 'Playable race', entities: RACES },
      { label: 'Class', entities: CLASSES },
      { label: 'Capital city', entities: CAPITALS },
      { label: 'Expansion', entities: EXPANSIONS },
    ],
  },
};

const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
const old = bosses.find((b) => b.id === 'wow');
// Keep pictures already resolved (impostors) and the Signature when refreshing.
for (const imp of boss.radar.impostors) {
  const prev = old?.radar.impostors.find((i) => (i.label ?? i) === imp.label);
  if (prev?.image) imp.image = prev.image;
}
if (old?.signature) boss.signature = old.signature;
boss.boss.image = arthas.art;
const at = bosses.findIndex((b) => b.id === 'wow');
if (at >= 0) bosses[at] = boss;
else bosses.splice(bosses.findIndex((b) => b.id === 'genshin') + 1, 0, boss);
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
console.log(`WoW boss written: ${boss.blitz.length} prompts, ${members.length} members, ${IMPOSTORS.length} impostors, ${finale.length} faces.`);
