import { SILHOUETTES } from '../data/silhouettes';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { WOW } from '../specialist/wow';

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
  { id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', palette: ['#0b3a66', '#f2b366', '#1d5c7a', '#c9a46a'], characters: pick(ONE_PIECE.characters, 120) },
  { id: 'lol', label: 'League of Legends', icon: '⚔️', palette: ['#0b1626', '#3b6b8f', '#1c3346', '#3d4d3a'], characters: pick(LOL.champions) },
  { id: 'marvel', label: 'Marvel (MCU)', icon: '🦸', palette: ['#1a0b2e', '#c2413a', '#3a1f3f', '#4a4552'], characters: pick(MARVEL.characters, 100) },
  { id: 'genshin', label: 'Genshin Impact', icon: '✨', palette: ['#1f3b73', '#9ad0f5', '#5d8a6b', '#a7c48a'], characters: pick(GENSHIN.characters) },
  { id: 'wow', label: 'World of Warcraft', icon: '🐉', palette: ['#120f24', '#6a4c93', '#2b2a45', '#4b3f36'], characters: pick(WOW.characters) },
  { id: 'pokemon', label: 'Pokémon', icon: '⚡', palette: ['#2f80c8', '#ffe08a', '#4f9d57', '#8fcf6b'], characters: pick(series('pokemon')) },
  { id: 'minecraft', label: 'Minecraft', icon: '⛏️', palette: ['#5aa5e6', '#cfe9ff', '#3f7d3a', '#7a5a3a'], characters: pick(series('minecraft')) },
];

export const railLine = (id: string | undefined) => RAIL_LINES.find((l) => l.id === id);
