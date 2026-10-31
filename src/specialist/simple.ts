// The lighter Specialist universes, built from what the boss battles already know: For Honor, Forts,
// Avatar: The Last Airbender and Destiny. Each has a Picture round (the card art, zoomed in), a Clue round
// (the boss's Signature clues: a hero's weapon, a commander's ability, a character's story) and,
// where every character's traits are known for sure, a Classic round.
import { BOSSES } from '../data/bosses';
import { CARDS } from '../gacha/cards';
import OW_VOICES from '../data/overwatch-voices.json';
import OW_ULTS from '../data/overwatch-ults.json';
import FH_EXECUTIONS from '../data/specialist/forhonor-executions.json';
import CLASSIC_TRAITS from '../data/specialist/classic-traits.json';

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
  id: 'forhonor' | 'forts' | 'avatar' | 'destiny' | 'overwatch' | 'ufouria';
  characters: SimpleCharacter[];
  /** Columns of the Classic grid (empty: no Classic round). */
  columns: string[];
  /** Columns that are numbers (▲▼, near within a tenth), and columns that can hold several values (" / ": some shared is near). */
  numeric?: string[];
  lists?: string[];
  /** Text clues and the character each one names. */
  clues: { text: string; answer: string }[];
  /** Characters whose picture has a transparent background: a Silhouette round. */
  silhouettes?: string[];
  /** Voice lines: who speaks, the original recording, and the French dub's when there is one. */
  voices?: { answer: string; en?: string; fr?: string }[];
  /** Executions (For Honor): a hero's finishing move, a short YouTube video played in silhouette. */
  executions?: { answer: string; name: string; youtubeId: string; seconds: number }[];
  /** Overwatch: each hero's ultimate and its charge cost, for the Ultimate Cost round. */
  ults?: { answer: string; ultimate: string; cost: number }[];
  /** Ufouria: the heroes cheering, cut out (the official art), for the Dance round: who is dancing in the shadow? */
  dances?: { answer: string; image: string }[];
  /** Things to name from their icon, apart from the characters (Destiny's Exotic weapons): an Exotic round. */
  items?: SimpleCharacter[];
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
    columns: ['Faction', 'Class', 'Gender', 'Health'],
    numeric: ['Health'],
    // Gender and health from the For Honor wiki (scripts/build-classic-traits.mjs); Nuxia's isn't in her infobox.
    characters: heroes.map((name) => {
      const w = (CLASSIC_TRAITS.forhonor as Record<string, Record<string, string>>)[name] ?? {};
      return { id: slug(name), name, aliases: [], image: pics.get(name) ?? '', traits: { Faction: groupOf(FH_FACTION, name), Class: groupOf(FH_CLASS, name), Gender: w.Gender ?? (name === 'Nuxia' ? 'Female' : 'Unknown'), Health: w.Health ?? '' } };
    }),
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
    // scripts/build-forhonor-executions.mjs: { hero, name, youtubeId, seconds }.
    executions: FH_EXECUTIONS.map((e) => ({ answer: slug(e.hero), name: e.name, youtubeId: e.youtubeId, seconds: e.seconds })),
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
  const things = CARDS.filter((c) => c.set === 'forts' && c.rarity !== 'mythic' && c.rarity !== 'omni' && !commanders.includes(c.name) && c.id !== 'forts:howitzer-legendary');
  return {
    id: 'forts',
    columns: [],
    characters: [
      ...commanders.map((name) => ({ id: slug(name), name, aliases: name === 'Armourdillo' ? ['Armordillo'] : [], image: cardImage('forts', name), traits: { Kind: 'Commander', Faction: groupOf(FORTS_FACTION, name) } })),
      ...things.map((c) => ({ id: slug(c.name), name: c.name, aliases: [], image: c.image, traits: { Kind: 'Weapon or device' } })),
    ],
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
    // The Forts RTS Wiki's portraits are cut out (the studio's three aren't checked: left out).
    silhouettes: ['Eagle Eye', 'Firebird', 'Warthog', 'Architect', 'Overdrive', 'Hurricane', 'Pinchfist', 'Spook', 'Armourdillo', 'Scattershot', 'Seep', 'Shockenaugh'].map(slug),
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
    // The original English voices (clips from myinstants); a French dub's recording goes in `fr` when found.
    voices: [
      { answer: 'zuko', en: 'https://www.myinstants.com/media/sounds/hello-zuko-here.mp3' },
      { answer: 'zuko', en: 'https://www.myinstants.com/media/sounds/thats-rough-buddy.mp3' },
      { answer: 'iroh', en: 'https://www.myinstants.com/media/sounds/atlat-hotleafjuice.mp3' },
      { answer: 'sokka', en: 'https://www.myinstants.com/media/sounds/cactus-juice-salesman-sokka-of-the-southern-water-tribe.mp3' },
      { answer: 'katara', en: 'https://www.myinstants.com/media/sounds/katara-water.mp3' },
      { answer: 'bumi', en: 'https://www.myinstants.com/media/sounds/bumi-strategy.mp3' },
      { answer: 'cabbage-merchant', en: 'https://www.myinstants.com/media/sounds/my_cabbages_mp3cut.mp3' },
    ],
  };
}

// ── Destiny: the best-known characters of both games, by species, side, Guardian class, gender and the game
// they first appeared in (in person); and every Exotic weapon of Destiny 2 by its icon (the boss's Signature). ──
const D: [string, string, string, string, string, string][] = [
  // name, species, side, Guardian, gender, debut
  ['Cayde-6', 'Exo', 'Ally', 'Hunter', 'Male', 'Destiny'],
  ['Zavala', 'Awoken', 'Ally', 'Titan', 'Male', 'Destiny'],
  ['Ikora Rey', 'Human', 'Ally', 'Warlock', 'Female', 'Destiny'],
  ['Lord Shaxx', 'Unknown', 'Ally', 'Titan', 'Male', 'Destiny'],
  ['Banshee-44', 'Exo', 'Ally', 'No', 'Male', 'Destiny'],
  ['Eris Morn', 'Human', 'Ally', 'Hunter', 'Female', 'Destiny'],
  ['Xûr', 'Unknown', 'Neutral', 'No', 'Male', 'Destiny'],
  ['Saint-14', 'Exo', 'Ally', 'Titan', 'Male', 'Destiny 2'],
  ['Osiris', 'Human', 'Ally', 'Warlock', 'Male', 'Destiny 2'],
  ['Mara Sov', 'Awoken', 'Ally', 'No', 'Female', 'Destiny'],
  ['Uldren Sov', 'Awoken', 'Enemy', 'No', 'Male', 'Destiny'],
  ['Crow', 'Awoken', 'Ally', 'Hunter', 'Male', 'Destiny 2'],
  ['Savathûn', 'Hive', 'Enemy', 'No', 'Female', 'Destiny 2'],
  ['Oryx', 'Hive', 'Enemy', 'No', 'Male', 'Destiny'],
  ['Crota', 'Hive', 'Enemy', 'No', 'Male', 'Destiny'],
  ['Xivu Arath', 'Hive', 'Enemy', 'No', 'Female', 'Destiny 2'],
  ['Rhulk', 'Other', 'Enemy', 'No', 'Male', 'Destiny 2'],
  ['Nezarec', 'Other', 'Enemy', 'No', 'Male', 'Destiny 2'],
  ['The Witness', 'Other', 'Enemy', 'No', 'Unknown', 'Destiny 2'],
  ['Calus', 'Cabal', 'Enemy', 'No', 'Male', 'Destiny 2'],
  ['Dominus Ghaul', 'Cabal', 'Enemy', 'No', 'Male', 'Destiny 2'],
  ['Caiatl', 'Cabal', 'Ally', 'No', 'Female', 'Destiny 2'],
  ['Riven', 'Ahamkara', 'Enemy', 'No', 'Female', 'Destiny 2'],
  ['Rasputin', 'AI', 'Ally', 'No', 'Unknown', 'Destiny'],
  ['Drifter', 'Human', 'Ally', 'Unknown', 'Male', 'Destiny 2'],
  ['Amanda Holliday', 'Human', 'Ally', 'No', 'Female', 'Destiny'],
  ['Ana Bray', 'Human', 'Ally', 'Hunter', 'Female', 'Destiny 2'],
  ['Elsie Bray', 'Exo', 'Ally', 'No', 'Female', 'Destiny'],
  ['Suraya Hawthorne', 'Human', 'Ally', 'No', 'Female', 'Destiny 2'],
  ['Petra Venj', 'Awoken', 'Ally', 'No', 'Female', 'Destiny'],
  ['The Speaker', 'Human', 'Ally', 'No', 'Male', 'Destiny'],
  ['Variks', 'Eliksni', 'Ally', 'No', 'Male', 'Destiny'],
  ['Mithrax', 'Eliksni', 'Ally', 'No', 'Male', 'Destiny 2'],
  ['Eramis', 'Eliksni', 'Enemy', 'No', 'Female', 'Destiny 2'],
  ['Taniks', 'Eliksni', 'Enemy', 'No', 'Male', 'Destiny'],
  ['Spider', 'Eliksni', 'Neutral', 'No', 'Male', 'Destiny 2'],
  ['Atheon', 'Vex', 'Enemy', 'No', 'Unknown', 'Destiny'],
  ['Master Rahool', 'Human', 'Ally', 'No', 'Male', 'Destiny'],
  ['Tess Everis', 'Human', 'Ally', 'No', 'Female', 'Destiny'],
  ['Eva Levante', 'Human', 'Ally', 'No', 'Female', 'Destiny'],
  ['Ada-1', 'Exo', 'Ally', 'No', 'Female', 'Destiny'],
  ['Lord Saladin', 'Human', 'Ally', 'Titan', 'Male', 'Destiny'],
  ['Devrim Kay', 'Human', 'Ally', 'No', 'Male', 'Destiny 2'],
  ['Failsafe', 'AI', 'Ally', 'No', 'Female', 'Destiny 2'],
  ['Asher Mir', 'Human', 'Ally', 'Warlock', 'Male', 'Destiny 2'],
  ['Ghost', 'Ghost', 'Ally', 'No', 'Male', 'Destiny'],
  ['Sagira', 'Ghost', 'Ally', 'No', 'Female', 'Destiny 2'],
];
const D_ALIASES: Record<string, string[]> = {
  'Cayde-6': ['Cayde', 'Cayde 6'], Zavala: ['Commander Zavala'], 'Ikora Rey': ['Ikora'], 'Lord Shaxx': ['Shaxx'], 'Banshee-44': ['Banshee', 'Banshee 44'], 'Eris Morn': ['Eris'], Xûr: ['Xur'],
  'Saint-14': ['Saint', 'Saint 14'], 'Mara Sov': ['Mara', 'Queen Mara'], 'Uldren Sov': ['Uldren'], Savathûn: ['Savathun'], 'The Witness': ['Witness'], Calus: ['Emperor Calus'], 'Dominus Ghaul': ['Ghaul'],
  Caiatl: ['Empress Caiatl'], Drifter: ['The Drifter'], 'Amanda Holliday': ['Amanda'], 'Ana Bray': ['Anastasia Bray'], 'Elsie Bray': ['Exo Stranger', 'The Stranger'], 'Suraya Hawthorne': ['Hawthorne'],
  'Petra Venj': ['Petra'], 'The Speaker': ['Speaker'], 'Master Rahool': ['Rahool'], 'Tess Everis': ['Tess'], 'Eva Levante': ['Eva'], 'Ada-1': ['Ada'], 'Lord Saladin': ['Saladin'], 'Devrim Kay': ['Devrim'], 'Asher Mir': ['Asher'],
};
// Clues written for the game: who they are, never their name.
const D_CLUES: [string, string][] = [
  ['The Hunter Vanguard who never stopped joking — until the Prison of Elders breakout', 'Cayde-6'],
  ['The Awoken Titan who commands the Vanguard', 'Zavala'],
  ['The Warlock Vanguard, a master of the Void', 'Ikora Rey'],
  ['The voice of the Crucible, roaring at every kill', 'Lord Shaxx'],
  ["The Tower's gunsmith, an Exo whose memory keeps slipping", 'Banshee-44'],
  ['She came back from the Hellmouth with three green eyes and a warning about the Hive', 'Eris Morn'],
  ['He turns up on weekends with Exotics to sell, on behalf of the Nine', 'Xûr'],
  ['A legendary Exo Titan brought back from the Infinite Forest, fond of pigeons', 'Saint-14'],
  ['The Warlock obsessed with the Vex and the Infinite Forest, once exiled from the City', 'Osiris'],
  ['Queen of the Awoken, who vanished into the Ascendant Plane and came back', 'Mara Sov'],
  ['The prince of the Reef who killed Cayde-6', 'Uldren Sov'],
  ['Raised as a Guardian with no memory of the prince he used to be', 'Crow'],
  ['The Witch Queen, Hive god of cunning, who stole the Light', 'Savathûn'],
  ['The Taken King, father of Crota, fought in his Dreadnaught', 'Oryx'],
  ['Son of Oryx, he waited for Guardians in the Hellmouth with his sword', 'Crota'],
  ['The Hive god of war, sister of Savathûn', 'Xivu Arath'],
  ['The Disciple of the Witness, met at the end of Vow of the Disciple', 'Rhulk'],
  ['The Final God of Pain, freed in Root of Nightmares', 'Nezarec'],
  ['The Darkness given a will, chasing the Final Shape', 'The Witness'],
  ['A Cabal emperor in exile, master of the Leviathan', 'Calus'],
  ['The Dominus of the Red Legion, who caged the Traveler and took the Light', 'Dominus Ghaul'],
  ['Empress of the Cabal, daughter of Calus', 'Caiatl'],
  ['The Ahamkara whose wishes wait at the heart of Last Wish', 'Riven'],
  ['The Warmind who watched over humanity, from Mars to the Moon', 'Rasputin'],
  ['He runs Gambit from the Annex, and plays both sides', 'Drifter'],
  ['The shipwright of the Tower hangar', 'Amanda Holliday'],
  ['Kell of Kells, who gathered the House of Light', 'Mithrax'],
  ['The Kell of Darkness who took up Stasis on Europa', 'Eramis'],
  ['The Eliksni who served the Queen of the Reef, the Loyal', 'Variks'],
  ['The crime lord of the Tangled Shore, always with a deal', 'Spider'],
  ['The Cryptarch who decodes your engrams', 'Master Rahool'],
  ['She sells Eververse engrams in the Tower plaza', 'Tess Everis'],
  ["The leader of the City's scouts, never without her falcon", 'Suraya Hawthorne'],
  ['The Iron Lord who keeps the forges of Felwinter Peak', 'Lord Saladin'],
  ['The little light who raised you from death', 'Ghost'],
  ["Osiris's Ghost, sharp-tongued and brave", 'Sagira'],
  ["The keeper of the Black Armory's forges", 'Ada-1'],
  ['The Exo from another timeline, sister of Ana Bray', 'Elsie Bray'],
];

function destinyUniverse(): SimpleUniverse {
  const b = boss('destiny');
  const pics = new Map([b.boss, ...b.radar.members, ...b.finale].map((c) => ['label' in c ? c.label : c.name, c.image ?? '']));
  const picture = (name: string) => pics.get(name) || cardImage('destiny', name);
  return {
    id: 'destiny',
    columns: ['Species', 'Side', 'Guardian', 'Gender', 'Debut'],
    characters: D.map(([name, species, side, guardian, gender, debut]) => ({ id: slug(name), name, aliases: D_ALIASES[name] ?? [], image: picture(name), traits: { Species: species, Side: side, Guardian: guardian, Gender: gender, Debut: debut } })),
    clues: D_CLUES.map(([text, name]) => ({ text, answer: slug(name) })),
    items: (b.signature?.clues ?? []).flatMap((c) => (c.image ? [{ id: slug(c.answer.name), name: c.answer.name, aliases: c.answer.aliases, image: c.image, traits: {} }] : [])),
  };
}

// ── Overwatch: every hero with voice lines on the Overwatch wiki (the Voice Line rounds), their OW2 portraits
// from the boss, and the boss's Signature clues (their ultimates). Roles only where they're sure. ──
const OW_ROLE: Record<string, string[]> = {
  Tank: ['D.Va', 'Doomfist', 'Hazard', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston', 'Wrecking Ball', 'Zarya'],
  Damage: ['Ashe', 'Bastion', 'Cassidy', 'Echo', 'Freja', 'Genji', 'Hanzo', 'Junkrat', 'Mei', 'Pharah', 'Reaper', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Venture', 'Widowmaker'],
  Support: ['Ana', 'Baptiste', 'Brigitte', 'Illari', 'Juno', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy', 'Moira', 'Wuyang', 'Zenyatta'],
};

function overwatch(): SimpleUniverse {
  const b = boss('overwatch');
  const portraits = [b.boss, ...b.radar.members, ...b.finale] as { label?: string; name?: string; image?: string; aliases?: string[] }[];
  const byName = new Map(portraits.map((c) => [c.label ?? c.name ?? '', c]));
  const characters = OW_VOICES.map((h): SimpleCharacter => {
    const p = byName.get(h.name);
    const role = groupOf(OW_ROLE, h.name);
    // The boss's drawn art only (the wiki's icons are 3D renders): a hero without it is never a picture to guess.
    // Sub-role, nationality, health and age from the Overwatch wiki (scripts/build-classic-traits.mjs); an omnic or a gorilla has no nationality.
    const w = (CLASSIC_TRAITS.overwatch as Record<string, Record<string, string>>)[h.name] ?? {};
    const r = w.Role ?? (role === 'Unknown' ? '' : role);
    const traits: Record<string, string> = r ? { Role: r } : {};
    if (w['Sub-role']) traits['Sub-role'] = w['Sub-role'];
    traits.Nationality = (w.Nationality ?? 'None').split(/\s*\/\s*/).join(' / ');
    if (w.Health) traits.Health = w.Health;
    if (w.Age) traits.Age = w.Age;
    return { id: slug(h.name), name: h.name, aliases: p?.aliases ?? [], image: p?.image || '', traits };
  });
  return {
    id: 'overwatch',
    columns: ['Role', 'Sub-role', 'Nationality', 'Health', 'Age'],
    numeric: ['Health', 'Age'],
    lists: ['Nationality'],
    characters,
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
    voices: OW_VOICES.flatMap((h) => h.lines.map((en) => ({ answer: slug(h.name), en }))),
    // scripts/build-overwatch-ults.mjs: from each hero's wiki page.
    ults: OW_ULTS.map((u) => ({ answer: slug(u.hero), ultimate: u.ultimate, cost: u.cost })),
  };
}

// ── Ufouria: The Saga 2: the four heroes, the enemies (the in-game bestiary's names) and the things of the cards. ──
const UFOURIA_HEROES: [string, string[]][] = [
  ['Hebe', ['Bop-Louie']],
  ['O-Chan', ['Ochan', 'Ō-Chan', 'Freeon-Leon']],
  ['Sukezaemon', ['Shades']],
  ['Jennifer', ['Gil']],
];
const UFOURIA_ENEMIES = ['Utsujin', 'Kotsu', 'Bumyon', 'Bemyon', 'Bomyon', 'Kerasu', 'Sanbo', 'Teketeke', 'Punipuni', 'Gako', 'Nezuchiu', 'Keronba', 'Kokeron', 'Hobachiu', 'Hoppin', 'Hanageruge', 'Gyorochan', 'Nanikano Tamago', 'Donadona', 'Micky', 'Kuchigeruge', 'Capchiu', 'Nyanham', 'Pen-Chan', 'Ricky', 'Muneko', 'Bobodori'];
/**
 * Ufouria's Classic: kind, creature and where they're met — the heroes as the game shows them, the
 * enemies as the in-game bestiary describes them (its list and locations, kosgames' guide).
 */
const UFOURIA_TRAITS: Record<string, [kind: string, creature: string, where: string]> = {
  Hebe: ['Hero', 'Penguin', "Hebe's team"],
  'O-Chan': ['Hero', 'Cat', "Hebe's team"],
  Sukezaemon: ['Hero', 'Ghost', "Hebe's team"],
  Jennifer: ['Hero', 'Fish', "Hebe's team"],
  Utsujin: ['Villain', 'Alien', 'Final battle'],
  Kotsu: ['Enemy', 'Alien', 'Final battle'],
  Bumyon: ['Enemy', 'Blob', 'Everywhere'],
  Bemyon: ['Enemy', 'Blob', 'Everywhere'],
  Bomyon: ['Enemy', 'Blob', 'Everywhere'],
  Teketeke: ['Enemy', 'Blob', 'Everywhere'],
  Punipuni: ['Enemy', 'Blob', 'Everywhere'],
  Kerasu: ['Enemy', 'Bird', 'Everywhere'],
  Kuchigeruge: ['Enemy', 'Snail', 'Everywhere'],
  Gako: ['Enemy', 'Duck', 'Shady Forest'],
  Keronba: ['Enemy', 'Frog', 'Shady Forest'],
  Kokeron: ['Enemy', 'Frog', 'Shady Forest'],
  Gyorochan: ['Enemy', 'Fish', 'Shady Forest'],
  Nezuchiu: ['Enemy', 'Mouse', 'Chilly Caves / Frozen Depths'],
  Ricky: ['Enemy', 'Wallaby', 'Chilly Caves / Frozen Depths'],
  'Pen-Chan': ['Enemy', 'Penguin', 'Frozen Depths'],
  Hobachiu: ['Enemy', 'Mouse', 'Popoitto Caves / Chilly Caves / Scalding Peaks'],
  Hoppin: ['Enemy', 'Worker', 'Scalding Peaks'],
  'Nanikano Tamago': ['Enemy', 'Egg', 'Horizon Tree'],
  Donadona: ['Enemy', 'Egg', 'Horizon Tree'],
  Micky: ['Enemy', 'Koala', 'Horizon Tree'],
  Capchiu: ['Enemy', 'Mouse', 'Inky Caves'],
  Nyanham: ['Enemy', 'Cat', 'Inky Caves'],
  Sanbo: ['Boss', 'Giant', 'Popoitto Caves / Chilly Caves / Inky Caves / Horizon Tree'],
  Muneko: ['Enemy', 'Cat', 'Untamed levels'],
  Hanageruge: ['Enemy', 'Clown', 'End of levels'],
};
const ufouriaTraits = (name: string, fallback: string): Record<string, string> => {
  const t = UFOURIA_TRAITS[name];
  return t ? { Kind: t[0], Creature: t[1], 'Met in': t[2] } : { Kind: fallback };
};
const ufouriaArt = (file: string) => `${import.meta.env?.BASE_URL ?? './'}art/ufouria/${file}`;

function ufouria(): SimpleUniverse {
  const b = boss('ufouria');
  const heroes = UFOURIA_HEROES.map(([n]) => n);
  const enemies = new Set(UFOURIA_ENEMIES);
  const cards = CARDS.filter((c) => c.set === 'ufouria' && c.rarity !== 'mythic' && c.rarity !== 'omni');
  const things = cards.filter((c) => !heroes.includes(c.name) && !enemies.has(c.name));
  return {
    id: 'ufouria',
    columns: ['Kind', 'Creature', 'Met in'],
    lists: ['Met in'],
    characters: [
      ...UFOURIA_HEROES.map(([name, aliases]) => ({ id: slug(name), name, aliases, image: cardImage('ufouria', name), traits: ufouriaTraits(name, 'Hero') })),
      ...UFOURIA_ENEMIES.map((name) => ({ id: slug(name), name, aliases: [], image: cardImage('ufouria', name) || (name === 'Utsujin' ? (b.boss.image ?? '') : ''), traits: ufouriaTraits(name, 'Enemy') })),
      ...things.map((c) => ({ id: slug(c.name), name: c.name, aliases: [], image: c.image, traits: { Kind: 'Thing or place' } })),
    ],
    clues: (b.signature?.clues ?? []).flatMap((c) => (c.text ? [{ text: c.text, answer: slug(c.answer.name) }] : [])),
    dances: [
      { answer: 'hebe', image: ufouriaArt('dance-hebe-1.png') },
      { answer: 'hebe', image: ufouriaArt('dance-hebe-2.png') },
      { answer: 'o-chan', image: ufouriaArt('dance-o-chan.png') },
      { answer: 'sukezaemon', image: ufouriaArt('dance-sukezaemon.png') },
      { answer: 'jennifer', image: ufouriaArt('dance-jennifer-1.png') },
      { answer: 'jennifer', image: ufouriaArt('dance-jennifer-2.png') },
    ],
  };
}

export const SIMPLE: Record<SimpleUniverse['id'], SimpleUniverse> = { forhonor: forHonor(), forts: forts(), avatar: avatar(), destiny: destinyUniverse(), overwatch: overwatch(), ufouria: ufouria() };

export const simpleCharacter = (u: SimpleUniverse['id'], id: string) => SIMPLE[u].characters.find((c) => c.id === id);

/** What each round type draws from: every character with a picture, every clue with a known answer, everyone for Classic. */
export function simplePools(u: SimpleUniverse['id']) {
  const x = SIMPLE[u];
  const ids = new Set(x.characters.map((c) => c.id));
  return {
    picture: x.characters.filter((c) => c.image).map((c) => c.id),
    windows: x.characters.filter((c) => c.image).map((c) => c.id),
    spotlight: x.characters.filter((c) => c.image).map((c) => c.id),
    ...(x.silhouettes?.length ? { silhouette: x.silhouettes.filter((id) => ids.has(id)) } : {}),
    ...(x.voices?.length ? { voice: x.voices.flatMap((v, i) => (ids.has(v.answer) ? [String(i)] : [])) } : {}),
    // A clue round's id is its clue's index (two clues can name the same character).
    clue: x.clues.flatMap((c, i) => (ids.has(c.answer) ? [String(i)] : [])),
    // Classic: everyone whose every trait is known (Ufouria's things and unlisted enemies stay out).
    ...(x.columns.length ? { classic: x.characters.filter((c) => x.columns.every((k) => c.traits[k] && c.traits[k] !== 'Unknown')).map((c) => c.id) } : {}),
    ...(x.items?.length ? { exotic: x.items.map((c) => c.id) } : {}),
    // Ultimate Cost: only heroes whose cost no one else has, so the number has one answer.
    ...(x.ults?.length ? { ultcost: x.ults.filter((u) => x.ults!.filter((o) => o.cost === u.cost).length === 1 && ids.has(u.answer)).map((u) => u.answer) } : {}),
    // A dance round's id is its index (a hero has several poses).
    ...(x.dances?.length ? { dance: x.dances.flatMap((d, i) => (ids.has(d.answer) ? [String(i)] : [])) } : {}),
    // An execution round's id is its index (a hero has several).
    ...(x.executions?.length ? { execution: x.executions.flatMap((e, i) => (ids.has(e.answer) ? [String(i)] : [])) } : {}),
  };
}
