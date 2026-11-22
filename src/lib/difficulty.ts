import fame from '../data/fame.json';
import { candidates } from '../data';
import type { Domain, GameType, RoundSpec } from '../types';

/**
 * From this day on, a daily's ten rounds go from easy to hard, and the tenth is the day's Boss round: the hardest,
 * worth double coins and a sure rare seed when won (the owner's call). Days before it keep their order.
 */
export const DIFFICULTY_FROM = '2026-11-24';
/** The Boss round's place in the day. */
export const BOSS_ROUND = 9;

/**
 * How hard each mini-game is in itself, 0 (easy) to 1, whatever the work: a guided game (Classic's attributes) is
 * easier than a few seconds of sound. A judgement, to adjust once players' results say otherwise.
 */
const TYPE_DIFFICULTY: Record<GameType, number> = {
  classic: 0.2,
  emoji: 0.35,
  visual: 0.35,
  timeline: 0.4,
  item: 0.45,
  quote: 0.5,
  audio: 0.5,
  tiles: 0.55,
  needle: 0.55,
  location: 0.6,
  connections: 0.65,
  voice: 0.7,
  intro: 0.7,
  blindtest: 0.75,
};

/** How much the work's fame weighs against the mini-game's own difficulty. */
const FAME_WEIGHT = 0.5;

const VIEWS = fame as Record<string, number>;
/**
 * Each work's obscurity in its category, 0 (the best known) to 1 (the least): its rank by Wikipedia page views
 * (scripts/build-fame.mjs). A work not measured (new, or its article refused) isn't ranked: it counts as middling.
 */
const obscurity = new Map<string, number>();
for (const d of ['games', 'anime', 'cinema', 'music'] as Domain[]) {
  const works = candidates('classic', d).filter((w) => w.id in VIEWS).sort((a, b) => VIEWS[b.id] - VIEWS[a.id]);
  works.forEach((w, i) => obscurity.set(w.id, works.length > 1 ? i / (works.length - 1) : 0.5));
}

/** How hard a round is, 0 to 1: its mini-game, and how well known its works are (a grid's: middling). */
export function roundDifficulty(spec: RoundSpec): number {
  const ids = [spec.targetId, ...(spec.workIds ?? [])].filter((x): x is string => !!x);
  const known = ids.length ? ids.reduce((s, id) => s + (obscurity.get(id) ?? 0.5), 0) / ids.length : 0.5;
  return (1 - FAME_WEIGHT) * TYPE_DIFFICULTY[spec.type] + FAME_WEIGHT * known;
}

/** A day's rounds from the easiest to the hardest (a tie keeps the drawn order). */
export const byDifficulty = (specs: RoundSpec[]) =>
  specs
    .map((s, i) => [s, roundDifficulty(s), i] as const)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([s]) => s);

/** Whether a daily's round is its Boss round. */
export const isBossRound = (date: string, index: number) => date >= DIFFICULTY_FROM && index === BOSS_ROUND;

/** A round's place on the day's curve, by its place in the day. */
export function stageOf(date: string, index: number): 'easy' | 'medium' | 'hard' | 'boss' | null {
  if (date < DIFFICULTY_FROM) return null;
  if (index === BOSS_ROUND) return 'boss';
  return index < 3 ? 'easy' : index < 7 ? 'medium' : 'hard';
}
