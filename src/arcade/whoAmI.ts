import { ONE_PIECE, formatBounty } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL, filmById } from '../specialist/marvel';
import { WOW, telltaleTitles } from '../specialist/wow';
import type { Domain } from '../types';

/** Someone to find, with clues from the vaguest to the most telling. */
export interface WhoTarget {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  clues: string[];
}

export interface WhoUniverse {
  id: string;
  label: string;
  icon: string;
  domain: Domain;
  /** Everyone the player can name. */
  pool: WhoTarget[];
  /** Who can be the answer: the best-known part of the pool. */
  targets: WhoTarget[];
}

/** The last clue always: how the name starts and how long it is. */
const nameClue = (name: string) => `Their name starts with “${name[0]}” and has ${name.replace(/[^\p{L}\p{N}]/gu, '').length} letters`;
const list = (xs: string[]) => xs.filter(Boolean).join(', ') || 'none';

const onePiece: WhoTarget[] = ONE_PIECE.characters.slice(0, 160).map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  clues: [
    `${c.gender}, from ${c.origin}`,
    `First seen in the ${c.arc} arc`,
    c.haki.length ? `Uses ${list(c.haki)} Haki` : 'No known Haki',
    c.fruitType.length ? `Ate a ${list(c.fruitType)} Devil Fruit` : 'No Devil Fruit',
    `Affiliation: ${c.affiliation}`,
    c.bounty ? `Bounty: ${formatBounty(c.bounty)} berries` : 'No known bounty',
    c.fruit.length ? `Devil Fruit: ${list(c.fruit)}` : c.height ? `Height: ${c.height} cm` : `Debut: chapter ${c.chapter}`,
    nameClue(c.name),
  ],
}));

const league: WhoTarget[] = LOL.champions.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  clues: [
    `${c.gender} · ${list(c.species)}`,
    `From ${list(c.regions)}`,
    `${c.range} · uses ${c.resource}`,
    `Plays ${list(c.positions)}`,
    c.year ? `Released in ${c.year}` : 'One of the newest champions',
    `Class: ${list(c.classes)}`,
    `Known as “${c.title}”`,
    nameClue(c.name),
  ],
}));

const marvel: WhoTarget[] = MARVEL.characters.slice(0, 120).map((c) => {
  const debut = filmById.get(c.debut);
  return {
    id: c.id,
    name: c.name,
    aliases: c.aliases,
    image: c.image,
    clues: [
      `${c.gender} · ${c.species}`,
      `Status: ${c.status}`,
      `Team: ${c.team}`,
      `In ${c.films} MCU film${c.films === 1 ? '' : 's'}`,
      debut ? `First appears in ${debut.name} (${debut.year})` : `Phase ${c.phase}`,
      c.actor ? `Played by ${c.actor}` : `Phase ${c.phase}`,
      nameClue(c.name),
    ],
  };
});

const genshin: WhoTarget[] = GENSHIN.characters.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  clues: [
    `${c.gender} · ${c.body} body`,
    `From ${c.region}`,
    `${c.rarity}★ · released in version ${c.version}`,
    `Wields a ${c.weapon}`,
    `Element: ${c.element}`,
    `Affiliation: ${c.affiliation}`,
    c.constellation ? `Constellation: ${c.constellation}` : c.title ? `Title: ${c.title}` : `Version ${c.version}`,
    nameClue(c.name),
  ],
}));

const wow: WhoTarget[] = WOW.characters.map((c) => {
  const titles = telltaleTitles(c);
  return {
    id: c.id,
    name: c.name,
    aliases: c.aliases,
    image: c.image,
    clues: [
      `${c.gender} · ${c.race}`,
      `Faction: ${c.faction}`,
      c.class !== 'None' ? `Class: ${c.class}` : 'No player class',
      `Status: ${c.status}`,
      titles[0] ? `Known as “${titles[0]}”` : `Race: ${c.race}`,
      titles[1] ? `Also “${titles[1]}”` : `Faction: ${c.faction}`,
      nameClue(c.name),
    ],
  };
});

export const WHO_UNIVERSES: WhoUniverse[] = [
  { id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', domain: 'anime', pool: onePiece, targets: onePiece.slice(0, 80) },
  { id: 'lol', label: 'League of Legends', icon: '⚔️', domain: 'games', pool: league, targets: league },
  { id: 'marvel', label: 'Marvel (MCU)', icon: '🦸', domain: 'cinema', pool: marvel, targets: marvel.slice(0, 60) },
  { id: 'genshin', label: 'Genshin Impact', icon: '✨', domain: 'games', pool: genshin, targets: genshin },
  { id: 'wow', label: 'World of Warcraft', icon: '🐉', domain: 'games', pool: wow, targets: wow.slice(0, 80) },
];

/** Characters per run, and wrong names allowed per character. */
export const WHO_ROUNDS = 5;
export const WHO_MAX_WRONG = 5;

/** Named on the first clue: 100; every extra clue costs 12, every wrong name 8 (never below 10). */
export const whoPoints = (cluesShown: number, wrong: number) => Math.max(10, 100 - (cluesShown - 1) * 12 - wrong * 8);
