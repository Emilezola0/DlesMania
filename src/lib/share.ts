import { domainInfo } from '../data';
import type { Domain, RoundRecord, RoundSpec } from '../types';
import { GAME_META } from '../games/meta';
import { MAX_DAILY_SCORE } from './scoring';

export function roundEmoji(r?: RoundRecord): string {
  if (!r || r.status === 'playing') return '⬛';
  if (r.status === 'lost') return '🟥';
  return r.score >= 70 ? '🟩' : '🟨';
}

/** Wordle-style summary, e.g. "Omnidle Video Games 2026-10-18 — 820/1000 🔥3" + two rows of five squares. */
export function shareText(domain: Domain, date: string, specs: RoundSpec[], rounds: Record<number, RoundRecord>, streak: number): string {
  const squares = specs.map((_, i) => roundEmoji(rounds[i]));
  const score = specs.reduce((sum, _, i) => sum + (rounds[i]?.score ?? 0), 0);
  const icons = specs.map((s) => GAME_META[s.type].icon);
  const link = `${window.location.origin}${window.location.pathname}#/daily/${domain}/${date}`;
  return [
    `Omnidle ${domainInfo(domain).label} ${date} — ${score}/${MAX_DAILY_SCORE}${streak > 1 ? ` 🔥${streak}` : ''}`,
    squares.slice(0, 5).join(''),
    squares.slice(5).join(''),
    icons.join(''),
    link,
  ].join('\n');
}
