import type { GameType, Work } from '../types';

/** Progressive hints revealed after each wrong guess, ordered from vague to giveaway. */
export function hintsFor(type: GameType, w: Work, opts: { hasClip?: boolean } = {}): string[] {
  const hints: string[] = [];
  if (type === 'audio' && opts.hasClip && w.audio) hints.push(w.audio.clue);
  if (type === 'quote' && w.quote?.speaker) hints.push(`Said by: ${w.quote.speaker}`);
  if (type === 'item' && w.item) hints.push(`The item: ${w.item.name}`);
  if (type === 'location' && w.location) hints.push(`The place: ${w.location.name}`);
  if (type === 'creator') hints.push(...w.credits.slice(1));

  if (w.themes?.length) hints.push(`Themes: ${w.themes.join(', ')}`);
  hints.push(`Released in ${w.year}`);
  hints.push(`Genre: ${w.genres.join(', ')}`);
  if (type !== 'creator') hints.push(w.credits[0]);
  if (w.characters?.length) hints.push(`Features: ${w.characters[0]}`);
  hints.push(`Starts with “${w.name.replace(/^The /, '').charAt(0)}”`);
  return hints;
}
