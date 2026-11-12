// The Boss Battle in the player's language (the EN/FR setting): its interface, written in both, and a boss's own texts
// (prompts, categories, Signature clues, Connections words) in French from src/data/bosses-fr.json.
import { createContext, useContext } from 'react';
import { useProgress } from '../store/progress';
import type { Boss } from '../types';

/** Whether the game is in French (read when called: for text built in handlers too). */
export const isFr = () => useProgress.getState().nameLang === 'fr';

/** The interface's words: English, or French when the game is in French. */
export function useT(): (en: string, fr: string) => string {
  const fr = useProgress((s) => s.nameLang) === 'fr';
  return (en, frText) => (fr ? frText : en);
}
/** The same, read when called (handlers, lib code). */
export const tr = (en: string, fr: string) => (isFr() ? fr : en);

/** "1 heart" / "2 hearts", "1 cœur" / "2 cœurs". */
export const plural = (n: number, en: string, fr: string) => `${n} ${tr(en, fr)}${n === 1 ? '' : 's'}`;

const numberless = (s: string) => s.replace(/\d+/g, '#');

/**
 * A text of a boss's fight in the player's language. A text whose number changed (a Blitz prompt asking for 7
 * instead of 5) finds its French all the same, with its own number.
 */
export function bossTextIn(boss: Boss | undefined, s: string | undefined, lang: string): string {
  if (!s || lang !== 'fr' || !boss?.fr?.texts) return s ?? '';
  const t = boss.fr.texts;
  if (t[s]) return t[s];
  const n = s.match(/\d+/)?.[0];
  if (!n) return s;
  const key = numberless(s);
  for (const [en, fr] of Object.entries(t)) if (numberless(en) === key) return fr.replace(/\d+/, n);
  return s;
}

/** The boss being fought, for its texts deep in the phases. */
export const BossContext = createContext<Boss | undefined>(undefined);

/** Its texts in the player's language. */
export function useBossText(): (s: string | undefined) => string {
  const boss = useContext(BossContext);
  const lang = useProgress((s) => s.nameLang);
  return (s) => bossTextIn(boss, s, lang);
}
