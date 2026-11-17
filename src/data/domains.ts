// The four daily categories. Apart from src/data/index.ts (the works lists), so the pages that only name the categories
// (the home page, the menus) don't load every work with them.
import type { Domain } from '../types';
import { withFrench } from '../lib/langNow';

/**
 * `tone` / `fill` are literal Tailwind classes (so the compiler sees them): each category has
 * one flat pastel colour, used for its glyph, rules and progress bars.
 */
export const DOMAINS: { id: Domain; label: string; noun: string; icon: string; tone: string; fill: string }[] = [
  withFrench({ id: 'games' as Domain, label: 'Video Games', noun: 'video game', icon: '🎮', tone: 'text-accent', fill: 'bg-accent' }, { label: 'Jeux vidéo', noun: 'jeu vidéo' }),
  withFrench({ id: 'anime' as Domain, label: 'Anime', noun: 'anime', icon: '🌸', tone: 'text-rose', fill: 'bg-rose' }, { label: 'Anime', noun: 'anime' }),
  withFrench({ id: 'cinema' as Domain, label: 'Cinema', noun: 'movie', icon: '🎬', tone: 'text-ochre', fill: 'bg-ochre' }, { label: 'Cinéma', noun: 'film' }),
  withFrench({ id: 'music' as Domain, label: 'Music', noun: 'song', icon: '🎵', tone: 'text-plum', fill: 'bg-plum' }, { label: 'Musique', noun: 'chanson' }),
];

export function domainInfo(id: Domain) {
  return DOMAINS.find((d) => d.id === id)!;
}
