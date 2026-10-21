import type { GameType, Work } from '../types';

/**
 * Progressive hints revealed after each wrong guess, ordered from vague to giveaway.
 * `textClueShown`: the round is already showing its text clue (no image/clip), so don't repeat it.
 */
export function hintsFor(type: GameType, w: Work, opts: { textClueShown?: boolean } = {}): string[] {
  const hints: string[] = [];
  if (!opts.textClueShown) {
    if (type === 'audio' && w.audio) hints.push(w.audio.clue);
    if (type === 'item' && w.item) hints.push(w.item.description);
    if (type === 'location' && w.location) hints.push(w.location.description);
  }
  if (type === 'quote' && w.quote?.speaker) hints.push(`Said by: ${w.quote.speaker}`);
  if (type === 'item' && w.item) hints.push(`The item: ${w.item.name}`);
  if (type === 'location' && w.location) hints.push(`The place: ${w.location.name}`);

  if (w.themes?.length) hints.push(`Themes: ${w.themes.join(', ')}`);
  hints.push(`Released in ${w.year}`);
  hints.push(`Genre: ${w.genres.join(', ')}`);
  if (w.credits[0]) hints.push(w.credits[0]);
  if (w.characters?.length) hints.push(`Features: ${w.characters[0]}`);
  hints.push(`Starts with “${w.name.replace(/^The /, '').charAt(0)}”`);
  return hints;
}
