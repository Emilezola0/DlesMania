import { SILHOUETTES } from '../data/silhouettes';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { WOW } from '../specialist/wow';
import { JLPT_LEVELS, JLPT_THEMES } from '../arcade/jlpt';
import { kanjiPicture } from '../lib/kanji';
import { romajiSpellings, toHiragana } from '../lib/romaji';

/** Someone to name on a track sign. */
export interface RailCharacter {
  id: string;
  name: string;
  aliases: string[];
  image: string;
}

/** A line: one game's characters, and the colours its scenery is painted in. */
export interface RailLine {
  id: string;
  label: string;
  icon: string;
  /** Sky top, sky bottom, far hills, near ground. */
  palette: [string, string, string, string];
  /** Where the stations are, in order (the list loops on a long run). */
  stations: string[];
  characters: RailCharacter[];
}

const pick = (xs: { id: string; name: string; aliases?: string[]; image?: string }[], n = Infinity): RailCharacter[] =>
  xs
    .filter((x) => x.image)
    .slice(0, n)
    .map((x) => ({ id: x.id, name: x.name, aliases: x.aliases ?? [], image: x.image! }));

const series = (id: string) =>
  (SILHOUETTES.find((s) => s.id === id)?.entries ?? []).map((e) => ({ id: `${id}-${e.name}`, name: e.name, aliases: e.aliases ?? [], image: e.image }));

// The Specialist rosters are ranked best-known first: the top of each keeps the signs recognisable.
export const RAIL_LINES: RailLine[] = [
  {
    id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', palette: ['#0b3a66', '#f2b366', '#1d5c7a', '#c9a46a'], characters: pick(ONE_PIECE.characters, 120),
    stations: ['Foosha Village', 'Loguetown', 'Alabasta', 'Water 7', 'Sabaody', 'Fish-Man Island', 'Dressrosa', 'Whole Cake Island', 'Wano', 'Egghead'],
  },
  {
    id: 'lol', label: 'League of Legends', icon: '⚔️', palette: ['#0b1626', '#3b6b8f', '#1c3346', '#3d4d3a'], characters: pick(LOL.champions),
    stations: ['Demacia', 'Noxus', 'Piltover', 'Zaun', 'Ionia', 'Shurima', 'Freljord', 'Bilgewater', 'Targon', 'the Shadow Isles'],
  },
  {
    id: 'marvel', label: 'Marvel (MCU)', icon: '🦸', palette: ['#1a0b2e', '#c2413a', '#3a1f3f', '#4a4552'], characters: pick(MARVEL.characters, 100),
    stations: ['Stark Tower', 'New York', 'Wakanda', 'Asgard', 'the Sanctum', 'Xandar', 'Knowhere', 'Sakaar', 'Titan', 'the Quantum Realm'],
  },
  {
    id: 'genshin', label: 'Genshin Impact', icon: '✨', palette: ['#1f3b73', '#9ad0f5', '#5d8a6b', '#a7c48a'], characters: pick(GENSHIN.characters),
    stations: ['Mondstadt', 'Liyue Harbor', 'Inazuma City', 'Sumeru City', 'Fontaine', 'Natlan', 'Dragonspine', 'the Chasm', 'Snezhnaya', 'Celestia'],
  },
  {
    id: 'wow', label: 'World of Warcraft', icon: '🐉', palette: ['#120f24', '#6a4c93', '#2b2a45', '#4b3f36'], characters: pick(WOW.characters),
    stations: ['Goldshire', 'Stormwind', 'Ironforge', 'Orgrimmar', 'Thunder Bluff', 'Dalaran', 'Shattrath', 'Icecrown', 'Valdrakken', 'Dornogal'],
  },
  {
    id: 'pokemon', label: 'Pokémon', icon: '⚡', palette: ['#2f80c8', '#ffe08a', '#4f9d57', '#8fcf6b'], characters: pick(series('pokemon')),
    stations: ['Pallet Town', 'Viridian City', 'Pewter City', 'Cerulean City', 'Vermilion City', 'Lavender Town', 'Celadon City', 'Saffron City', 'Cinnabar Island', 'Indigo Plateau'],
  },
  {
    id: 'minecraft', label: 'Minecraft', icon: '⛏️', palette: ['#5aa5e6', '#cfe9ff', '#3f7d3a', '#7a5a3a'], characters: pick(series('minecraft')),
    stations: ['Spawn', 'the Village', 'the Desert Temple', 'the Mineshaft', 'the Stronghold', 'the Nether Portal', 'the Bastion', 'the Ocean Monument', 'the Ancient City', 'The End'],
  },
  // JLPT: N5 and N4 words written in kanji on the signs — switch tracks by typing their reading (romaji or kana).
  // The stations are the list's own places. Every crash shows the readings of the signs it passed.
  {
    id: 'jlpt', label: 'JLPT', icon: '🈴', palette: ['#7f1d1d', '#fbcfe8', '#3f6212', '#a8a29e'],
    characters: JLPT_LEVELS.filter((l) => l.level === 'N5' || l.level === 'N4')
      .flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries)
      .filter((e) => /[\u3400-\u9fff]/.test(e.text) && !/[/／\s]/.test(e.text) && [...e.text].length <= 4)
      .flatMap((e) => {
        const kana = e.reading.split(/[/／・、\s]+/).map(toHiragana).filter(Boolean);
        return kana.length ? [{ id: `jlpt-${e.id}`, name: `${kana[0]} (${romajiSpellings(kana[0])[0]})`, aliases: [...new Set([...kana, ...kana.flatMap(romajiSpellings)])], image: kanjiPicture(`kanji:${e.text}`) }] : [];
      }),
    stations: JLPT_THEMES.find((t) => t.id === 'theme-places')!.entries.filter((e) => e.level === 'N5').slice(0, 10).map((e) => `${e.text} (${e.reading})`),
  },
];

export const railLine = (id: string | undefined) => RAIL_LINES.find((l) => l.id === id);
