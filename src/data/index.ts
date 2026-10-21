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

/**
 * `tone` / `fill` are literal Tailwind classes (so the compiler sees them): each category has
 * one flat pastel colour, used for its glyph, rules and progress bars.
 */
export const DOMAINS: { id: Domain; label: string; noun: string; icon: string; tone: string; fill: string }[] = [
  { id: 'games', label: 'Video Games', noun: 'video game', icon: '🎮', tone: 'text-accent', fill: 'bg-accent' },
  { id: 'anime', label: 'Anime', noun: 'anime', icon: '🌸', tone: 'text-rose', fill: 'bg-rose' },
  { id: 'cinema', label: 'Cinema', noun: 'movie', icon: '🎬', tone: 'text-ochre', fill: 'bg-ochre' },
  { id: 'music', label: 'Music', noun: 'album', icon: '🎵', tone: 'text-plum', fill: 'bg-plum' },
];

export function domainInfo(id: Domain) {
  return DOMAINS.find((d) => d.id === id)!;
}

/** Whether a work has the content a single-target mini-game needs. */
const HAS_CONTENT: Partial<Record<GameType, (w: Work) => boolean>> = {
  // Albums have no dialogue: their "quote" round reveals track titles instead.
  quote: (w) => !!w.quote || !!w.tracks?.length,
  // Soundtrack falls back to a zoomed cover detail when a clip can't play.
  audio: (w) => !!w.audio && (!!w.audio.youtubeId || !!w.cover?.image),
  emoji: (w) => !!w.emoji,
  visual: (w) => !!w.cover?.image || !!w.visual,
  // Picture rounds only draw works that actually have the picture.
  item: (w) => !!w.item?.image,
  location: (w) => !!w.location?.image,
  tiles: (w) => !!w.cover?.image,
};

export function candidates(type: GameType, domain?: Domain): Work[] {
  const has = HAS_CONTENT[type];
  return WORKS.filter((w) => (!domain || w.domain === domain) && (!has || has(w)));
}
