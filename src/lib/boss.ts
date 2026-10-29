import { useCallback, useEffect, useRef, useState } from 'react';
import type { BossDifficulty } from '../store/progress';
import difficultyData from '../data/difficulties.json';
import type { BlitzPrompt, Boss, BossCard, SecretCategory, SecretSettings, SignatureSettings } from '../types';
import { pick, shuffle } from './rng';
import { compactText, findBestMatch, isFuzzyMatch, namesAnotherWord } from '../utils/textMatcher';
import { withFrench } from './french';

export const PHASES = [
  { name: 'Knowledge Blitz', roman: 'I', how: 'Type names before the timer runs out — press Enter after each one.' },
  { name: 'Radar Defense', roman: 'II', how: 'Swipe or press → when a card belongs. Reflect impostors with ← . Too many mistakes and the shield breaks.' },
  { name: 'Final Blow', roman: 'III', how: 'Name each flickering face before the timer burns out. Wrong answers cost time.' },
  {
    name: 'Name Chain',
    roman: 'IV',
    how: 'The guardian names something — answer with another of the same kind. Never repeat a name, yours or its, and keep the chain going to win.',
  },
] as const;

/** Phase index of the Name Chain (Medium and Hard). */
export const CHAIN_PHASE = 3;

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
  /** Rounds to win in each of the four phases (0 = the phase isn't played); one life-bar segment per round. */
  rounds: number[];
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
  /** Hard: each phase's second loop is shorter but much nastier; null = loops are alike. */
  secondLoop: SecondLoop | null;
  finaleTargets: number;
  finaleSeconds: number;
  finalePenaltyMs: number;
  distortion: 0 | 1 | 2;
  /** Seconds that still earn the speed bonus. */
  parSeconds: number;
  scoreMultiplier: number;
  /** Phase IV, the Name Chain (Medium, Hard); null when the difficulty has no fourth phase. */
  chain: SecretSettings | null;
  /** Secret phase after the boss's life runs out: the Signature challenge (Hard); null = none. */
  signature: SignatureSettings | null;
  /**
   * The pressure: every round won in a fight takes `step` off every clock, down to `min`; every
   * earlier win over this guardian at this difficulty takes `rematch` more (up to `rematchMax`).
   */
  pace: { step: number; min: number; rematch: number; rematchMax: number };
}

/** The share of the clocks left: 1 for a first round of a first fight, less as the fight and the rematches go on. */
export const paceFactor = (d: DifficultySpec, cleared: number, wins: number) =>
  Math.max(d.pace.min, 1 - d.pace.step * cleared - Math.min(d.pace.rematchMax, d.pace.rematch * wins));

/** The difficulty with every clock scaled by `f` (Blitz, Radar, Final Blow, Name Chain, Signature). */
export function paced(d: DifficultySpec, f: number): DifficultySpec {
  if (f >= 1) return d;
  const sl = d.secondLoop;
  return {
    ...d,
    blitzSecondsPer: d.blitzSecondsPer * f,
    radarMs: { start: d.radarMs.start * f, step: d.radarMs.step * f, min: d.radarMs.min * f },
    finaleSeconds: d.finaleSeconds * f,
    secondLoop: sl && { ...sl, blitz: { ...sl.blitz, secondsPer: sl.blitz.secondsPer * f }, radar: { ...sl.radar, speed: sl.radar.speed * f }, finale: { ...sl.finale, seconds: sl.finale.seconds * f } },
    chain: d.chain && { ...d.chain, turnSeconds: d.chain.turnSeconds * f },
    signature: d.signature && { ...d.signature, seconds: d.signature.seconds * f },
  };
}

/**
 * The numbers live in src/data/difficulties.json so balancing is a data edit, not a code change
 * (checked by `npm run data:validate`).
 */
export const DIFFICULTIES = Object.fromEntries(
  Object.entries(difficultyData).map(([id, spec]) => [id, { ...spec, id }]),
) as unknown as Record<Difficulty, DifficultySpec>;

/**
 * Hard's second loops: every phase's second round is shorter but harder. Visual difficulty stays
 * static and on the picture only — zoom, a strong colour shift, a turn (no blur) — so the
 * input, buttons and layout never move.
 */
export interface SecondLoop {
  blitz: BlitzEscalation;
  radar: RadarEscalation;
  finale: FinaleEscalation;
}

/** Knowledge Blitz: fewer answers, far less time per answer. */
export interface BlitzEscalation {
  countDelta: number;
  secondsPer: number;
}

/** Static picture distortion shared by the Radar and Final Blow second loops. */
export interface PictureDistortion {
  /** Zoom range on a random spot of the picture. */
  zoom: [number, number];
  /** Hue shift range in degrees (applied with a random sign). */
  hue: [number, number];
  /** Chance a picture is turned. */
  flip: number;
  /** Angles a turned picture can take (default: upside down only). */
  turns?: number[];
}

/** Radar Defense: fewer, faster cards with distorted pictures. */
export interface RadarEscalation extends PictureDistortion {
  cards: number;
  impostors: number;
  /** Multiplier on each card's time (0.65 = 35% less). */
  speed: number;
}

/** Final Blow: fewer faces, a much shorter clock, distorted pictures. */
export interface FinaleEscalation extends PictureDistortion {
  targets: number;
  seconds: number;
}

/** A still distortion drawn for one picture. */
export interface PictureFx {
  scale: number;
  /** Zoom origin, in % of the picture. */
  x: number;
  y: number;
  hue: number;
  /** Rotation in degrees (0 = upright). */
  turn: number;
}

export function drawPictureFx(p: PictureDistortion, rand: () => number): PictureFx {
  return {
    scale: p.zoom[0] + rand() * (p.zoom[1] - p.zoom[0]),
    x: 20 + rand() * 60,
    y: 15 + rand() * 55,
    hue: (rand() < 0.5 ? -1 : 1) * (p.hue[0] + rand() * (p.hue[1] - p.hue[0])),
    turn: rand() < p.flip ? (p.turns?.length ? p.turns[Math.floor(rand() * p.turns.length)] : 180) : 0,
  };
}

/** CSS for a still distortion: only ever put on the picture element. */
export const pictureStyle = (fx: PictureFx) => ({
  transform: `scale(${fx.scale})${fx.turn ? ` rotate(${fx.turn}deg)` : ''}`,
  transformOrigin: `${fx.x}% ${fx.y}%`,
  filter: `hue-rotate(${fx.hue}deg) saturate(1.7)`,
});

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[];

/** Boss life: one segment per round across the three phases. */
export const totalRounds = (d: DifficultySpec) => d.rounds.reduce((a, b) => a + b, 0);

/** Whether this loop of a phase (0 = first) is an escalated one. */
export const escalated = (d: DifficultySpec, loop: number) => loop > 0 && !!d.secondLoop;

/** Radar per-card time for the i-th card of a loop. */
export const radarCardMs = (d: DifficultySpec, i: number, loop = 0) =>
  Math.round(Math.max(d.radarMs.min, d.radarMs.start - i * d.radarMs.step) * (escalated(d, loop) ? d.secondLoop!.radar.speed : 1));

/**
 * One attempt's Knowledge Blitz: harder levels ask for more answers (never more than the list
 * can bear), and the number in the prompt follows ("Name 5" → "Name 7").
 */
export function drawBlitz(boss: Boss, d: DifficultySpec, rand: () => number, avoid: string[] = [], loop = 0): BlitzPrompt {
  const fresh = boss.blitz.filter((p) => !avoid.includes(p.prompt));
  const base = pick(fresh.length ? fresh : boss.blitz, rand);
  const full = Math.max(base.count, Math.min(base.count + d.blitzExtra, base.answers.length - 2));
  // Second loop: a shorter list (but never below 3 answers).
  const count = escalated(d, loop) ? Math.max(3, Math.min(full, full + d.secondLoop!.blitz.countDelta)) : full;
  const prompt = count === base.count ? base.prompt : base.prompt.replace(/\b\d+\b/, String(count));
  return { ...base, prompt, count };
}

/** Seconds for a Knowledge Blitz prompt. */
export const blitzSeconds = (p: BlitzPrompt, d: DifficultySpec, loop = 0) =>
  p.count * (escalated(d, loop) ? d.secondLoop!.blitz.secondsPer : d.blitzSecondsPer);

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
  /** Escalated loop: a still distortion of the picture instead of the moving effects. */
  still?: PictureFx;
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

/** Radar cards, avoiding the members shown in earlier rounds and fights (`avoid`) while there are others. */
export function drawRadar(boss: Boss, d: DifficultySpec, rand: () => number, loop = 0, avoid: string[] = []): RadarCard[] {
  const esc = escalated(d, loop) ? d.secondLoop!.radar : null;
  const cards = esc?.cards ?? d.radarCards;
  const impostorCount = esc?.impostors ?? d.radarImpostors;
  const need = cards - impostorCount;
  const fresh = shuffle(boss.radar.members.filter((c) => !avoid.includes(c.label)), rand);
  const stale = shuffle(boss.radar.members.filter((c) => avoid.includes(c.label)), rand);
  const members = [...fresh, ...stale].slice(0, need);
  const impostors = shuffle(boss.radar.impostors, rand).slice(0, impostorCount);
  // Never open on an impostor: the first card teaches the gesture.
  const [first, ...rest] = members;
  const order = [
    { ...first, belongs: true },
    ...shuffle([...rest.map((c) => ({ ...c, belongs: true })), ...impostors.map((c) => ({ ...c, belongs: false }))], rand),
  ];
  return order.map((c, i) => {
    // Second loop: no motion, no layout tricks — the picture alone is zoomed, recoloured and maybe flipped.
    if (esc) return { ...c, fx: { hue: 0, saturate: 1, spin: 0, invert: false, reversed: false, decoy: null, clutter: [], still: drawPictureFx(esc, rand) } };
    return { ...c, fx: radarFx(d.distortion, i, rand) };
  });
}

/** Final Blow targets, avoiding faces already shown earlier in this fight where possible. */
export function drawFinale(boss: Boss, d: DifficultySpec, rand: () => number, avoid: string[] = [], loop = 0): BossCard[] {
  const targets = escalated(d, loop) ? d.secondLoop!.finale.targets : d.finaleTargets;
  const fresh = boss.finale.filter((c) => !avoid.includes(c.label));
  const pool = fresh.length >= targets ? fresh : boss.finale;
  return shuffle(pool, rand).slice(0, targets);
}

/** Final Blow seconds per face for a loop. */
export const finaleSeconds = (d: DifficultySpec, loop = 0) => (escalated(d, loop) ? d.secondLoop!.finale.seconds : d.finaleSeconds);

/**
 * Each exchange uses up two entities of one category (the boss's and the player's), so a category
 * with n entities allows floor(n / 2) exchanges.
 */
export const maxExchanges = (categories: SecretCategory[]) => categories.reduce((n, c) => n + Math.floor(c.entities.length / 2), 0);

/**
 * The Name Chain (phase IV): the difficulty's settings, overridden per boss, with the target lowered
 * so it can always be reached. Null when the difficulty has none or the boss has no categories.
 */
export function drawSecret(boss: Boss, d: DifficultySpec) {
  if (!d.chain || !boss.secret?.categories.length) return null;
  const { categories, ...overrides } = boss.secret;
  const settings = { ...d.chain, ...overrides };
  const picksToWin = Math.min(settings.picksToWin, maxExchanges(categories));
  if (picksToWin < 1) return null;
  return { ...settings, picksToWin, categories };
}

export type SecretPhase = NonNullable<ReturnType<typeof drawSecret>>;

/**
 * The Signature challenge for one fight: enough of the boss's clues for `toWin` answers plus the extra
 * chances, avoiding the ones in `avoid` (seen in earlier fights) while there are others. Null when there's none.
 */
export function drawSignature(boss: Boss, d: DifficultySpec, rand: () => number = Math.random, avoid: string[] = []) {
  if (!d.signature || !boss.signature) return null;
  const needed = d.signature.toWin + Math.max(0, d.signature.chances - 1);
  if (boss.signature.clues.length < needed) return null;
  const fresh = shuffle(boss.signature.clues.filter((c) => !avoid.includes(signatureKey(c))), rand);
  const seen = shuffle(boss.signature.clues.filter((c) => avoid.includes(signatureKey(c))), rand);
  return { ...d.signature, label: boss.signature.label, prompt: boss.signature.prompt, clues: [...fresh, ...seen].slice(0, needed) };
}

/** What identifies a Signature clue in the "already seen" history. */
export const signatureKey = (c: { text?: string; audio?: { youtubeId: string }; answer: { name: string } }) => c.text ?? c.audio?.youtubeId ?? c.answer.name;

export type SignaturePhase = NonNullable<ReturnType<typeof drawSignature>>;

/** Every spelling of an answer (English, French, nicknames), compacted for exact comparison. */
const compactSpellings = (name: string, aliases: string[] = []) => withFrench([name, ...aliases]).map(compactText).filter(Boolean);

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
  const spell = (a: BlitzPrompt['answers'][number]) => withFrench([a.name, ...a.aliases]);
  const best = findBestMatch(text, prompt.answers, spell);
  // A real word of another answer isn't a typo: let the "Did you mean" ask instead.
  if (best && best.distance > 0 && namesAnotherWord(text, prompt.answers, spell, best.item)) return null;
  return best ? { name: best.item.name, already: found.has(best.item.name), exact: true, typo: true } : null;
}

/** Final Blow: whether `text` names the card (any spelling, small typos forgiven). */
export const namesCard = (card: BossCard, text: string) => isFuzzyMatch(text, withFrench([card.label, ...(card.aliases ?? [])]));

export interface BattleStats {
  /** Rounds won (boss segments broken). */
  roundsWon: number;
  hearts: number;
  correct: number;
  wrong: number;
  timeMs: number;
  /** Secret phase: its bonus when won, -1 when lost (no victory bonuses). */
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
