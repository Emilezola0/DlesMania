import type { ConnectionsPuzzle, Domain, GameType, Work } from '../types';
import rawPuzzles from './connections.json';
import anime from './works/anime.json';
import cinema from './works/cinema.json';
import games from './works/games.json';
import music from './works/music.json';


/** JSON shape is enforced by `npm run data:validate` (schema/work.schema.json). */
export const WORKS = [...games, ...anime, ...cinema, ...music] as unknown as Work[];

/**
 * In connections.json a tile is either a plain label or `{ label, src?, image? }`
 * (`src` only matters to the image script). The game always gets `{ label, image? }`.
 */
export const connectionsPuzzles: ConnectionsPuzzle[] = (rawPuzzles as unknown as (Omit<ConnectionsPuzzle, 'groups'> & {
  groups: { label: string; level: ConnectionsPuzzle['groups'][number]['level']; items: (string | { label: string; image?: string })[] }[];
})[]).map((p) => ({
  id: p.id,
  domain: p.domain,
  theme: p.theme,
  groups: p.groups.map((g) => ({
    label: g.label,
    level: g.level,
    items: g.items.map((t) => (typeof t === 'string' ? { label: t } : { label: t.label, image: t.image })),
  })),
}));

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

/** Whether a work has the content a single-target mini-game needs. */
const HAS_CONTENT: Partial<Record<GameType, (w: Work) => boolean>> = {
  // Albums have no dialogue: their "quote" round reveals track titles instead.
  quote: (w) => !!w.quote || !!w.tracks?.length,
  audio: (w) => !!w.audio,
  emoji: (w) => !!w.emoji,
  visual: (w) => !!w.cover?.image || !!w.visual,
  item: (w) => !!w.item,
  location: (w) => !!w.location,
  creator: (w) => w.credits.length > 0,
};

export function candidates(type: GameType, domain?: Domain): Work[] {
  const has = HAS_CONTENT[type];
  return WORKS.filter((w) => (!domain || w.domain === domain) && (!has || has(w)));
}
