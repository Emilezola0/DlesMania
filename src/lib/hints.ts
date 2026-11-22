import type { GameType, Work } from '../types';
import { mulberry32, shuffle } from './rng';

/** Words too common to give a title away when a hint shares them. */
const COMMON = new Set(['the', 'and', 'from', 'with', 'for', 'part', 'game', 'games', 'world', 'story', 'movie', 'film', 'song', 'theme']);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** The words of a work's titles (its name, French name, aliases) that would give it away: 4 letters or more, not common. */
function titleWords(w: Work): Set<string> {
  const names = [w.name, w.nameFr, ...(w.aliases ?? [])].filter((n): n is string => !!n);
  return new Set(names.flatMap((n) => norm(n).split(/[^a-z0-9]+/)).filter((x) => x.length >= 4 && !COMMON.has(x)));
}

/**
 * Progressive hints revealed after each wrong guess, from vague to giveaway. With a `seed` (the round's), the hints of
 * one strength come in an order of their own each round, so a work that comes back doesn't give the same hints in the
 * same order; a hint never comes before a stronger one. The strengths, in order:
 * - the round's own text clue (what's heard, the item, the place), first;
 * - vague: themes, year, genre;
 * - medium: who says the quote, the item's and the place's names, the first credit;
 * - strong, in a fixed order: the voice's character, the main character, a song's game or anime, and any hint that
 *   shares a word with the title (a place called "Tsushima Island" in Ghost of Tsushima);
 * - the first letter, always last.
 * `textClueShown`: the round is already showing its text clue (no image/clip), so don't repeat it.
 */
export function hintsFor(type: GameType, w: Work, opts: { textClueShown?: boolean; seed?: number } = {}): string[] {
  const lead: string[] = [];
  const vague: string[] = [];
  const medium: string[] = [];
  const strong: string[] = [];
  if (!opts.textClueShown) {
    if ((type === 'audio' || type === 'intro' || type === 'needle') && w.audio) lead.push(w.audio.clue);
    if (type === 'item' && w.item) lead.push(w.item.description);
    if (type === 'location' && w.location) lead.push(w.location.description);
  }
  if (type === 'quote' && w.quote?.speaker) medium.push(`Said by: ${w.quote.speaker}`);
  if (type === 'item' && w.item) medium.push(`The item: ${w.item.name}`);
  if (type === 'location' && w.location) medium.push(`The place: ${w.location.name}`);
  if (type === 'voice' && w.voice) strong.push(`The voice of: ${w.voice.speaker}`);

  if (w.themes?.length) vague.push(`Themes: ${w.themes.join(', ')}`);
  vague.push(`Released in ${w.year}`);
  vague.push(`Genre: ${w.genres.join(', ')}`);
  // A song's first credit is where it's from (its game or anime): as strong as a main character.
  if (w.credits[0]) (w.domain === 'music' ? strong : medium).push(w.credits[0]);
  if (w.characters?.length) strong.push(`Features: ${w.characters[0]}`);

  // A hint that shares a word with the title goes with the strong ones, whatever its kind.
  const words = titleWords(w);
  const givesAway = (h: string) => norm(h).split(/[^a-z0-9]+/).some((x) => words.has(x));
  const tell = [...lead, ...vague, ...medium].filter(givesAway);
  const keep = (list: string[]) => list.filter((h) => !tell.includes(h));
  const mix = (list: string[], salt: number) => (opts.seed === undefined ? list : shuffle(list, mulberry32((opts.seed ^ salt) >>> 0)));

  return [
    ...keep(lead),
    ...mix(keep(vague), 0x9e3779b9),
    ...mix(keep(medium), 0x85ebca6b),
    ...strong,
    ...tell,
    `Starts with “${w.name.replace(/^The /, '').charAt(0)}”`,
  ];
}
