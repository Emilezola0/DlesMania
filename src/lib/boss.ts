import { useCallback, useEffect, useRef, useState } from 'react';
import type { BossDifficulty } from '../store/progress';
import difficultyData from '../data/difficulties.json';
import type { BlitzPrompt, Boss, BossCard } from '../types';
import { pick, shuffle } from './rng';
import { compactText, findBestMatch, isFuzzyMatch } from '../utils/textMatcher';

export const PHASES = [
  { name: 'Knowledge Blitz', roman: 'I', how: 'Type names before the timer runs out — each valid answer is accepted as you type.' },
  { name: 'Radar Defense', roman: 'II', how: 'Swipe or press → when a card belongs. Reflect impostors with ← . Too many mistakes and the shield breaks.' },
  { name: 'Final Blow', roman: 'III', how: 'Name each flickering face before the timer burns out. Wrong answers cost time.' },
] as const;

/** Same ids as the store's saved choice. */
export type Difficulty = BossDifficulty;

/**
 * Everything a difficulty changes. Visual tricks come in levels:
 *   0 — clean cards and pictures
 *   1 — colour shifts, spinning cards, fading and clutter; the Final Blow picture turns and shifts hue
 *   2 — level 1, faster, plus reversed sorting zones, decoy zone flashes, a lockout on early
 *       swipes, inverted colours and a hidden seconds counter
 */
export interface DifficultySpec {
  id: Difficulty;
  label: string;
  blurb: string;
  /** Rounds to win in each phase; the boss's life bar has one segment per round. */
  rounds: [number, number, number];
  hearts: number;
  /** Extra answers on top of each Blitz prompt's count, and seconds allowed per answer. */
  blitzExtra: number;
  blitzSecondsPer: number;
  radarCards: number;
  radarImpostors: number;
  /** Mistakes the shield absorbs; one more breaks it. */
  radarMaxErrors: number;
  /** Per-card time: starts at `start` ms and drops by `step` per card, down to `min`. */
  radarMs: { start: number; step: number; min: number };
  /** Swipes in the first ms after a card appears count as mistakes ("too early"). */
  radarLockMs: number;
  finaleTargets: number;
  finaleSeconds: number;
  finalePenaltyMs: number;
  distortion: 0 | 1 | 2;
  /** Seconds that still earn the speed bonus. */
  parSeconds: number;
  scoreMultiplier: number;
  /** Secret last phase after the boss's life runs out; null = none (Easy, Medium). */
  roulette: RouletteSpec | null;
}

/**
 * "Russian Roulette": the player names a character from a shared pool, then the boss picks one
 * at random from what's left (the player's pick included). Same character → instant defeat.
 * Otherwise both leave the pool, and `picksToWin` safe picks win the fight.
 */
export interface RouletteSpec {
  /** Safe picks needed (lowered automatically when the pool can't allow that many). */
  picksToWin: number;
  /** Characters drawn into the pool. */
  poolSize: number;
  /** Seconds per turn; when they run out the pick is made for you. 0 = no clock. */
  turnSeconds: number;
  /** Points added (before the multiplier) when the player survives. */
  bonus: number;
}

/**
 * The numbers live in src/data/difficulties.json so balancing is a data edit, not a code change
 * (checked by `npm run data:validate`).
 */
export const DIFFICULTIES = Object.fromEntries(
  Object.entries(difficultyData).map(([id, spec]) => [id, { ...spec, id }]),
) as unknown as Record<Difficulty, DifficultySpec>;

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[];

/** Boss life: one segment per round across the three phases. */
export const totalRounds = (d: DifficultySpec) => d.rounds.reduce((a, b) => a + b, 0);

/** Radar per-card time for the i-th card. */
export const radarCardMs = (d: DifficultySpec, i: number) => Math.max(d.radarMs.min, d.radarMs.start - i * d.radarMs.step);

/**
 * One attempt's Knowledge Blitz: harder levels ask for more answers (never more than the list
 * can bear), and the number in the prompt follows ("Name 5" → "Name 7").
 */
export function drawBlitz(boss: Boss, d: DifficultySpec, rand: () => number, avoid: string[] = []): BlitzPrompt {
  const fresh = boss.blitz.filter((p) => !avoid.includes(p.prompt));
  const base = pick(fresh.length ? fresh : boss.blitz, rand);
  const count = Math.max(base.count, Math.min(base.count + d.blitzExtra, base.answers.length - 2));
  const prompt = count === base.count ? base.prompt : base.prompt.replace(/\b\d+\b/, String(count));
  return { ...base, prompt, count };
}

/** Seconds for a Knowledge Blitz prompt. */
export const blitzSeconds = (p: BlitzPrompt, d: DifficultySpec) => p.count * d.blitzSecondsPer;

/** How a Radar card is disguised (Medium and Hard). */
export interface RadarFx {
  /** Hue shift in degrees and saturation multiplier. */
  hue: number;
  saturate: number;
  /** Total rotation over the card's lifetime, in degrees. */
  spin: number;
  invert: boolean;
  /** The zones swap sides for this card: belongs is on the left. */
  reversed: boolean;
  /** A zone that flashes as a decoy partway through the card. */
  decoy: 'left' | 'right' | null;
  /** Seeds for the clutter glyphs drifting over the picture. */
  clutter: number[];
}

export interface RadarCard extends BossCard {
  belongs: boolean;
  fx: RadarFx | null;
}

function radarFx(level: 0 | 1 | 2, index: number, rand: () => number): RadarFx | null {
  if (level === 0) return null;
  const sign = rand() < 0.5 ? -1 : 1;
  return {
    hue: Math.round((rand() * 2 - 1) * (level === 2 ? 180 : 120)),
    saturate: 1 + rand() * (level === 2 ? 1.6 : 0.8),
    spin: sign * Math.round((level === 2 ? 140 : 60) + rand() * (level === 2 ? 220 : 120)),
    invert: level === 2 && rand() < 0.3,
    // Never on the first cards, so the player has learnt the normal layout first.
    reversed: level === 2 && index >= 3 && rand() < 0.3,
    decoy: level === 2 && rand() < 0.5 ? (rand() < 0.5 ? 'left' : 'right') : null,
    clutter: Array.from({ length: level === 2 ? 6 : 3 }, () => Math.floor(rand() * 1e6)),
  };
}

export function drawRadar(boss: Boss, d: DifficultySpec, rand: () => number): RadarCard[] {
  const members = shuffle(boss.radar.members, rand).slice(0, d.radarCards - d.radarImpostors);
  const impostors = shuffle(boss.radar.impostors, rand).slice(0, d.radarImpostors);
  // Never open on an impostor: the first card teaches the gesture.
  const [first, ...rest] = members;
  const order = [
    { ...first, belongs: true },
    ...shuffle([...rest.map((c) => ({ ...c, belongs: true })), ...impostors.map((c) => ({ ...c, belongs: false }))], rand),
  ];
  return order.map((c, i) => ({ ...c, fx: radarFx(d.distortion, i, rand) }));
}

/** Final Blow targets, avoiding faces already shown earlier in this fight where possible. */
export function drawFinale(boss: Boss, d: DifficultySpec, rand: () => number, avoid: string[] = []): BossCard[] {
  const fresh = boss.finale.filter((c) => !avoid.includes(c.label));
  const pool = fresh.length >= d.finaleTargets ? fresh : boss.finale;
  return shuffle(pool, rand).slice(0, d.finaleTargets);
}

/**
 * Each safe turn removes two characters (the player's and the boss's), and the last turn needs
 * at least two left so the boss's pick can miss — so `n` characters allow at most floor(n / 2) picks.
 */
export const maxSafePicks = (poolSize: number) => Math.floor(poolSize / 2);

/** Characters a boss can bring to the roulette table: its cards, minus objects it lists in `roulette.exclude`. */
export function roulettePool(boss: Boss): BossCard[] {
  const exclude = new Set((boss.roulette?.exclude ?? []).map((l) => l.toLowerCase()));
  const seen = new Set<string>();
  return [...boss.radar.members, ...boss.finale].filter((c) => {
    const key = c.label.toLowerCase();
    if (exclude.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The roulette for one fight: difficulty settings, overridden per boss in bosses.json, then
 * clamped so the target is reachable. Null when the difficulty has none or the pool is too small.
 */
export function drawRoulette(boss: Boss, d: DifficultySpec, rand: () => number) {
  if (!d.roulette) return null;
  const spec = { ...d.roulette, ...boss.roulette };
  const pool = shuffle(roulettePool(boss), rand).slice(0, spec.poolSize);
  const picksToWin = Math.min(spec.picksToWin, maxSafePicks(pool.length));
  if (picksToWin < 1) return null;
  return { pool, picksToWin, turnSeconds: spec.turnSeconds, bonus: spec.bonus };
}

export type Roulette = NonNullable<ReturnType<typeof drawRoulette>>;

/** Every spelling of an answer (English, French, nicknames), compacted for exact comparison. */
const compactSpellings = (name: string, aliases: string[] = []) => [name, ...aliases].map(compactText).filter(Boolean);

/**
 * Knowledge Blitz matching: the answer `text` names, if any.
 * While typing (`typos` false) only exact spellings count — accents, case and punctuation aside —
 * so "kayl" never becomes Kayn on its way to Kayle. On Enter or after a pause, small typos are
 * forgiven too (`typo` is then true on the result).
 * `exact` is false when a longer answer still starts with the text ("ron" vs "ron weasley" is fine,
 * but "android 1" could still become "android 16"), so the input waits before accepting it.
 */
export function matchAnswer(prompt: BlitzPrompt, text: string, found: Set<string>, typos = false) {
  const q = compactText(text);
  if (!q) return null;
  const hit = prompt.answers.find((a) => compactSpellings(a.name, a.aliases).includes(q));
  if (hit) {
    const ambiguous = prompt.answers.some(
      (a) => a !== hit && !found.has(a.name) && compactSpellings(a.name, a.aliases).some((s) => s.length > q.length && s.startsWith(q)),
    );
    return { name: hit.name, already: found.has(hit.name), exact: !ambiguous, typo: false };
  }
  if (!typos) return null;
  const best = findBestMatch(text, prompt.answers, (a) => [a.name, ...a.aliases]);
  return best ? { name: best.item.name, already: found.has(best.item.name), exact: true, typo: true } : null;
}

/** Final Blow: whether `text` names the card (any spelling, small typos forgiven). */
export const namesCard = (card: BossCard, text: string) => isFuzzyMatch(text, [card.label, ...(card.aliases ?? [])]);

export interface BattleStats {
  /** Rounds won (boss segments broken). */
  roundsWon: number;
  hearts: number;
  correct: number;
  wrong: number;
  timeMs: number;
  /** Secret phase: its bonus when survived, -1 when shot (no victory bonuses). */
  bonus?: number;
}

/**
 * Points: 1000 per round won, 400 per heart kept, accuracy and speed bonuses (victories only),
 * times the difficulty's multiplier.
 */
export function battleScore({ roundsWon, hearts, correct, wrong, timeMs, bonus = 0 }: BattleStats, d: DifficultySpec) {
  const won = roundsWon === totalRounds(d) && bonus >= 0;
  const accuracy = correct + wrong ? correct / (correct + wrong) : 0;
  const speed = won ? Math.max(0, d.parSeconds - timeMs / 1000) * 4 : 0;
  return Math.round((roundsWon * 1000 + (won ? hearts * 400 : 0) + accuracy * 500 + speed + Math.max(0, bonus)) * d.scoreMultiplier);
}

export function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A countdown that runs while `running`, with time penalties. Calls `onExpire` once at zero.
 * Returns the remaining milliseconds (updated every frame) and `penalize(ms)`.
 */
export function useCountdown(totalMs: number, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(totalMs);
  const end = useRef(0);
  const remaining = useRef(totalMs);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    remaining.current = totalMs;
    setLeft(totalMs);
  }, [totalMs]);

  useEffect(() => {
    if (!running) return;
    end.current = performance.now() + remaining.current;
    let raf = 0;
    const loop = () => {
      const l = Math.max(0, end.current - performance.now());
      remaining.current = l;
      setLeft(l);
      if (l <= 0) expire.current();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, totalMs]);

  const penalize = useCallback((ms: number) => {
    end.current -= ms;
    remaining.current = Math.max(0, remaining.current - ms);
  }, []);
  const reset = useCallback((ms: number) => {
    end.current = performance.now() + ms;
    remaining.current = ms;
    setLeft(ms);
  }, []);

  return { left, penalize, reset };
}
