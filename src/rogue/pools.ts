// What a run draws its rooms from, narrowed to the kinds of work the player picked
// (an Expedition of video games only, anime and movies, or everything).
import { HL_DECKS, type HlDeck } from '../arcade/higherLower';
import { NAME_LISTS } from '../arcade/lists';
import { SORT_DECKS, type SortDeck } from '../arcade/quickSort';
import { WHO_UNIVERSES } from '../arcade/whoAmI';
import { connectionThemes } from '../data';
import { BOSSES } from '../data/bosses';
import type { Domain } from '../types';
import type { ChallengeKind } from './run';

/** The kinds of work an Expedition can be made of. */
export const MEDIA: { id: Domain; label: string; icon: string }[] = [
  { id: 'games', label: 'Video games', icon: '🎮' },
  { id: 'anime', label: 'Anime', icon: '🌸' },
  { id: 'cinema', label: 'Movies', icon: '🎬' },
];

export const ALL_MEDIA: Domain[] = MEDIA.map((m) => m.id);

/** A deck of every kind of work keeps only the picked kinds' cards; it needs this many left to be played. */
const MIN_MIXED = 15;

export const universesFor = (media: Domain[]) => WHO_UNIVERSES.filter((u) => media.includes(u.domain));

export function hlDecksFor(media: Domain[]): HlDeck[] {
  return HL_DECKS.flatMap((d) => {
    if (d.domain !== 'mixed') return media.includes(d.domain) ? [d] : [];
    const items = d.items.filter((x) => x.domain && media.includes(x.domain));
    return items.length >= MIN_MIXED ? [{ ...d, items }] : [];
  });
}

export function sortDecksFor(media: Domain[]): SortDeck[] {
  return SORT_DECKS.flatMap((d) => {
    if (d.domain !== 'mixed') return media.includes(d.domain) ? [d] : [];
    const cards = d.cards.filter((x) => x.domain && media.includes(x.domain));
    // Both sides must show up, or the deck is a giveaway.
    return cards.length >= MIN_MIXED && cards.some((c) => c.side === 'left') && cards.some((c) => c.side === 'right') ? [{ ...d, cards }] : [];
  });
}

export const listsFor = (media: Domain[]) => NAME_LISTS.filter((l) => l.answers.length >= 10 && media.includes(l.domain));

export const bossesFor = (media: Domain[]) => BOSSES.filter((b) => media.includes(b.domain));

/** The challenges a run of these kinds of work can hold. */
export function challengesFor(media: Domain[]): ChallengeKind[] {
  const has: Record<ChallengeKind, boolean> = {
    portrait: universesFor(media).length > 0,
    whoami: universesFor(media).length > 0,
    higherlower: hlDecksFor(media).length > 0,
    sort: sortDecksFor(media).length > 0,
    odd: connectionThemes.some((t) => media.includes(t.domain)),
    name5: listsFor(media).length > 0,
  };
  return (Object.keys(has) as ChallengeKind[]).filter((k) => has[k]);
}
