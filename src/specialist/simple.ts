// The lighter Specialist universes, built from what the boss battles already know: For Honor, Forts
// and Avatar: The Last Airbender. Each has a Picture round (the card art, zoomed in), a Clue round
// (the boss's Signature clues: a hero's weapon, a commander's ability, a character's story) and,
// where every character's traits are known for sure, a Classic round.
import { BOSSES } from '../data/bosses';
import { CARDS } from '../gacha/cards';

export interface SimpleCharacter {
  id: string;
  name: string;
  aliases: string[];
  /** The card art ('' when there's none: still a possible answer, never a picture to guess). */
  image: string;
  /** Traits for the Classic grid and the hints, in column order. */
  traits: Record<string, string>;
}

export interface SimpleUniverse {
  id: 'forhonor' | 'forts' | 'avatar';
  characters: SimpleCharacter[];
  /** Columns of the Classic grid (empty: no Classic round). */
  columns: string[];
  /** Text clues and the character each one names. */
  clues: { text: string; answer: string }[];
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const boss = (id: string) => BOSSES.find((b) => b.id === id)!;
/** A set's cards by name: their pictures, with the framing fixes (Forts' commanders out of their banners). */
const cardImage = (set: string, name: string) => CARDS.find((c) => c.set === set && c.name === name && c.rarity !== 'mythic' && c.rarity !== 'omni')?.image ?? '';

// ── For Honor: the five factions and four classes (For Honor wiki categories). ──
const FH_FACTION: Record<string, string[]> = {
  Knights: ['Warden', 'Conqueror', 'Peacekeeper', 'Lawbringer', 'Centurion', 'Gladiator', 'Black Prior', 'Warmonger', 'Gryphon'],
  Vikings: ['Raider', 'Warlord', 'Berserker', 'Valkyrie', 'Highlander', 'Shaman', 'Jormungandr', 'Varangian Guard'],
  Samurai: ['Kensei', 'Shugoki', 'Orochi', 'Nobushi', 'Shinobi', 'Aramusha', 'Hitokiri', 'Kyoshin', 'Sohei', 'Arakure'],
  'Wu Lin': ['Tiandi', 'Jiang Jun', 'Nuxia', 'Shaolin', 'Zhanhu', 'Juren'],
  Outlanders: ['Pirate', 'Medjay', 'Afeera', 'Ocelotl', 'Khatun', 'Virtuosa'],
};
const FH_CLASS: Record<string, string[]> = {
  Vanguard: ['Warden', 'Warmonger', 'Raider', 'Kensei', 'Tiandi'],
  Assassin: ['Peacekeeper', 'Gladiator', 'Berserker', 'Shaman', 'Orochi', 'Shinobi', 'Nuxia', 'Khatun', 'Arakure'],
  Heavy: ['Conqueror', 'Black Prior', 'Warlord', 'Jormungandr', 'Shugoki', 'Hitokiri', 'Sohei', 'Jiang Jun'],
  Hybrid: ['Lawbringer', 'Centurion', 'Gryphon', 'Valkyrie', 'Highlander', 'Nobushi', 'Aramusha', 'Kyoshin', 'Shaolin', 'Zhanhu', 'Juren', 'Pirate', 'Medjay', 'Afeera', 'Ocelotl', 'Virtuosa'],
};
const groupOf = (groups: Record<string, string[]>, name: string) => Object.entries(groups).find(([, xs]) => xs.includes(name))?.[0] ?? 'Unknown';

function forHonor(): SimpleUniverse {
  const b = boss('forhonor');
  const heroes = Object.values(FH_FACTION).flat();
  const pics = new Map([...b.radar.members, ...b.finale].map((c) => [c.label, c.image ?? '']));
  return {
    id: 'forhonor',
    columns: [],
    characters: heroes.map((name) => ({ id: slug(name), name, aliases: [], image: pics.get(name) ?? '', traits: { Faction: groupOf(FH_FACTION, name), Class: groupOf(FH_CLASS, name) } })),
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
  };
}

// ── Forts: the commanders (by faction, from the Forts wiki) and the weapons and devices of the cards. ──
const FORTS_FACTION: Record<string, string[]> = {
  'Eagle Empire': ['Eagle Eye', 'Firebird', 'Warthog'],
  'Dragon Army': ['Architect', 'Overdrive', 'Hurricane'],
  'Iron Bear Alliance': ['Pinchfist', 'Spook', 'Armourdillo'],
  'Black Penguin Oil': ['Scattershot', 'Seep', 'Shockenaugh'],
  'The Coalition': ['Buster', 'Moonshine', 'Phantom'],
};

function forts(): SimpleUniverse {
  const b = boss('forts');
  const commanders = Object.values(FORTS_FACTION).flat();
  // Pictures with the commander's name printed on them can't be a Picture round.
  const BANNER = new Set(['Eagle Eye']);
  const things = CARDS.filter((c) => c.set === 'forts' && c.rarity !== 'mythic' && c.rarity !== 'omni' && !commanders.includes(c.name) && c.id !== 'forts:howitzer-legendary');
  return {
    id: 'forts',
    columns: [],
    characters: [
      ...commanders.map((name) => ({ id: slug(name), name, aliases: name === 'Armourdillo' ? ['Armordillo'] : [], image: BANNER.has(name) ? '' : cardImage('forts', name), traits: { Kind: 'Commander', Faction: groupOf(FORTS_FACTION, name) } })),
      ...things.map((c) => ({ id: slug(c.name), name: c.name, aliases: [], image: c.image, traits: { Kind: 'Weapon or device' } })),
    ],
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
  };
}

// ── Avatar: nation, bending, gender and kind of every character with a card. ──
const ATLA: [string, string, string, string, string][] = [
  // name, nation, bending, gender, kind
  ['Aang', 'Air Nomads', 'Avatar', 'Male', 'Human'],
  ['Katara', 'Water Tribe', 'Water', 'Female', 'Human'],
  ['Sokka', 'Water Tribe', 'None', 'Male', 'Human'],
  ['Toph', 'Earth Kingdom', 'Earth', 'Female', 'Human'],
  ['Zuko', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Iroh', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Azula', 'Fire Nation', 'Fire', 'Female', 'Human'],
  ['Ozai', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Appa', 'Air Nomads', 'Air', 'Male', 'Animal'],
  ['Momo', 'Air Nomads', 'None', 'Male', 'Animal'],
  ['Suki', 'Earth Kingdom', 'None', 'Female', 'Human'],
  ['Ty Lee', 'Fire Nation', 'None', 'Female', 'Human'],
  ['Mai', 'Fire Nation', 'None', 'Female', 'Human'],
  ['Roku', 'Fire Nation', 'Avatar', 'Male', 'Human'],
  ['Kyoshi', 'Earth Kingdom', 'Avatar', 'Female', 'Human'],
  ['Kuruk', 'Water Tribe', 'Avatar', 'Male', 'Human'],
  ['Yangchen', 'Air Nomads', 'Avatar', 'Female', 'Human'],
  ['Bumi', 'Earth Kingdom', 'Earth', 'Male', 'Human'],
  ['Jet', 'Earth Kingdom', 'None', 'Male', 'Human'],
  ['Zhao', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Yue', 'Water Tribe', 'None', 'Female', 'Human'],
  ['Hakoda', 'Water Tribe', 'None', 'Male', 'Human'],
  ['Pakku', 'Water Tribe', 'Water', 'Male', 'Human'],
  ['Hama', 'Water Tribe', 'Water', 'Female', 'Human'],
  ['Long Feng', 'Earth Kingdom', 'Earth', 'Male', 'Human'],
  ['Haru', 'Earth Kingdom', 'Earth', 'Male', 'Human'],
  ['Kuei', 'Earth Kingdom', 'None', 'Male', 'Human'],
  ['Cabbage merchant', 'Earth Kingdom', 'None', 'Male', 'Human'],
  ['Smellerbee', 'Earth Kingdom', 'None', 'Female', 'Human'],
  ['Teo', 'Earth Kingdom', 'None', 'Male', 'Human'],
  ['Combustion Man', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Sozin', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Ursa', 'Fire Nation', 'None', 'Female', 'Human'],
  ['Jeong Jeong', 'Fire Nation', 'Fire', 'Male', 'Human'],
  ['Piandao', 'Fire Nation', 'None', 'Male', 'Human'],
  ['Gyatso', 'Air Nomads', 'Air', 'Male', 'Human'],
  ['Wan Shi Tong', 'Spirit World', 'None', 'Male', 'Spirit'],
  ['Koh', 'Spirit World', 'None', 'Male', 'Spirit'],
  ['Hei Bai', 'Spirit World', 'None', 'Unknown', 'Spirit'],
];
const ATLA_ALIASES: Record<string, string[]> = { Toph: ['Toph Beifong'], Iroh: ['Uncle Iroh'], Ozai: ['Fire Lord Ozai'], Roku: ['Avatar Roku'], Kyoshi: ['Avatar Kyoshi'], Bumi: ['King Bumi'], Zhao: ['Admiral Zhao'], Yue: ['Princess Yue'], Kuei: ['Earth King'], 'Cabbage merchant': ['Cabbage man'], Gyatso: ['Monk Gyatso'] };

function avatar(): SimpleUniverse {
  const b = boss('avatar');
  const pics = new Map([b.boss, ...b.radar.members, ...b.finale].map((c) => ['label' in c ? c.label : c.name, c.image ?? '']));
  return {
    id: 'avatar',
    columns: ['Nation', 'Bending', 'Gender', 'Kind'],
    characters: ATLA.map(([name, nation, bending, gender, kind]) => ({ id: slug(name), name, aliases: ATLA_ALIASES[name] ?? [], image: pics.get(name) ?? '', traits: { Nation: nation, Bending: bending, Gender: gender, Kind: kind } })),
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
  };
}

export const SIMPLE: Record<SimpleUniverse['id'], SimpleUniverse> = { forhonor: forHonor(), forts: forts(), avatar: avatar() };

export const simpleCharacter = (u: SimpleUniverse['id'], id: string) => SIMPLE[u].characters.find((c) => c.id === id);

/** What each round type draws from: every character with a picture, every clue with a known answer, everyone for Classic. */
export function simplePools(u: SimpleUniverse['id']) {
  const x = SIMPLE[u];
  const ids = new Set(x.characters.map((c) => c.id));
  return {
    picture: x.characters.filter((c) => c.image).map((c) => c.id),
    // A clue round's id is its clue's index (two clues can name the same character).
    clue: x.clues.flatMap((c, i) => (ids.has(c.answer) ? [String(i)] : [])),
    ...(x.columns.length ? { classic: x.characters.map((c) => c.id) } : {}),
  };
}
