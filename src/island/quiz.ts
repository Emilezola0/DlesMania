// The dungeon's questions (stage C, part 3): asked by its puzzle doors and by its boss each time it falls, made from the
// Dles' own works (src/data/works/*.json): a work from its emojis, a quote's work, a character's work, a work's year.
// Four choices. The answers are always a title or a year: a song is answered by its title, never an album or an artist
// (CLAUDE.md, Music).
import { WORKS } from '../data';
import { isFr } from '../lib/i18n';
import type { Work } from '../types';

export interface Question {
  /** What's asked. */
  prompt: string;
  /** Shown big (emojis, a quote, a name). */
  big: string;
  choices: string[];
  /** The right choice's index. */
  answer: number;
}

const title = (w: Work) => (isFr() && w.nameFr) || w.name;
const NOUN: Record<string, [string, string]> = { games: ['game', 'jeu'], anime: ['anime', 'anime'], cinema: ['film', 'film'], music: ['song', 'chanson'] };
const noun = (w: Work) => (isFr() ? NOUN[w.domain]?.[1] : NOUN[w.domain]?.[0]) ?? '';

function pickN<T>(xs: T[], n: number, rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** Four titles of one domain, the right one among them. */
function titles(w: Work, rand: () => number) {
  const others = pickN(
    WORKS.filter((x) => x.domain === w.domain && x.id !== w.id && title(x) !== title(w)),
    3,
    rand,
  ).map(title);
  const choices = pickN([title(w), ...others], 4, rand);
  return { choices, answer: choices.indexOf(title(w)) };
}

/** A question from the Dles: its kind and its work at random. */
export function dleQuestion(rand = Math.random): Question {
  for (let tries = 0; tries < 20; tries++) {
    const w = WORKS[Math.floor(rand() * WORKS.length)] as Work & { emoji?: string; quote?: { text?: string }; characters?: string[] };
    const kind = Math.floor(rand() * 4);
    if (kind === 0 && w.emoji)
      return { prompt: isFr() ? `Quel ${noun(w)} est-ce ?` : `Which ${noun(w)} is this?`, big: w.emoji, ...titles(w, rand) };
    if (kind === 1 && w.quote?.text && w.domain !== 'music')
      return { prompt: isFr() ? `D’où vient cette réplique ? (un ${noun(w)})` : `Where's this line from? (a ${noun(w)})`, big: `« ${w.quote.text} »`, ...titles(w, rand) };
    if (kind === 2 && w.characters?.length && w.domain !== 'music') {
      const who = w.characters[Math.floor(rand() * w.characters.length)];
      // Not a character's own name in the title (that would give it away).
      if (title(w).toLowerCase().includes(who.toLowerCase())) continue;
      return { prompt: isFr() ? `De quel ${noun(w)} vient ce personnage ?` : `Which ${noun(w)} is this character from?`, big: who, ...titles(w, rand) };
    }
    if (kind === 3 && w.year) {
      const years = new Set([w.year]);
      while (years.size < 4) years.add(w.year + Math.round((rand() - 0.5) * 16) || w.year + years.size);
      const choices = pickN([...years].map(String), 4, rand);
      return { prompt: isFr() ? `En quelle année est sorti ce ${noun(w)} ?` : `What year did this ${noun(w)} come out?`, big: title(w), choices, answer: choices.indexOf(String(w.year)) };
    }
  }
  const w = WORKS[0];
  return { prompt: isFr() ? `Quel ${noun(w)} est-ce ?` : `Which ${noun(w)} is this?`, big: (w as Work & { emoji?: string }).emoji ?? title(w), ...titles(w, rand) };
}
