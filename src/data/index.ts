import type { Domain, GameType, Work } from '../types';
import { anime } from './anime';
import { cinema } from './cinema';
import { games } from './games';
import { music } from './music';

export { connectionsPuzzles } from './connections';

export const WORKS: Work[] = [...games, ...anime, ...cinema, ...music];

const BY_ID = new Map(WORKS.map((w) => [w.id, w]));

export function getWork(id: string): Work {
  const w = BY_ID.get(id);
  if (!w) throw new Error(`Unknown work: ${id}`);
  return w;
}

export const DOMAINS: { id: Domain; label: string; noun: string; icon: string; accent: string }[] = [
  { id: 'games', label: 'Video Games', noun: 'video game', icon: '🎮', accent: 'from-emerald-500 to-teal-500' },
  { id: 'anime', label: 'Anime', noun: 'anime', icon: '🌸', accent: 'from-pink-500 to-rose-500' },
  { id: 'cinema', label: 'Cinema', noun: 'movie', icon: '🎬', accent: 'from-amber-500 to-orange-500' },
  { id: 'music', label: 'Music', noun: 'album', icon: '🎵', accent: 'from-violet-500 to-indigo-500' },
];

export function domainInfo(id: Domain) {
  return DOMAINS.find((d) => d.id === id)!;
}

/** Which Work field a single-target mini-game needs in order to be playable. */
const REQUIRED_FIELD: Partial<Record<GameType, keyof Work>> = {
  quote: 'quote',
  audio: 'audio',
  emoji: 'emoji',
  visual: 'visual',
  item: 'item',
  location: 'location',
  creator: 'credits',
  classic: 'year',
};

export function candidates(type: GameType, domain?: Domain): Work[] {
  const field = REQUIRED_FIELD[type];
  return WORKS.filter((w) => (!domain || w.domain === domain) && (!field || w[field] !== undefined));
}
