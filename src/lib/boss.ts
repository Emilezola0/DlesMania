import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlitzPrompt, Boss, BossCard, SecretCategory } from '../types';
import { pick, shuffle } from './rng';
import { compactText, findBestMatch, isFuzzyMatch, namesAnotherWord } from '../utils/textMatcher';
import { withFrench } from './french';
import { mediaLoading } from './images';

export * from './bossRules';
import { drawPictureFx, escalated, totalRounds, type DifficultySpec, type PictureFx } from './bossRules';

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

/**
 * Final Blow targets, avoiding faces already shown earlier where possible. `faces`: what to draw from
 * (src/boss/faces.ts widens a boss's own list with its franchise's cards).
 */
export function drawFinale(boss: Boss, d: DifficultySpec, rand: () => number, avoid: string[] = [], loop = 0, faces: BossCard[] = boss.finale): BossCard[] {
  const targets = escalated(d, loop) ? d.secondLoop!.finale.targets : d.finaleTargets;
  const fresh = faces.filter((c) => !avoid.includes(c.label));
  const pool = fresh.length >= targets ? fresh : faces;
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
  const { categories, turnScale, ...overrides } = boss.secret;
  const settings = { ...d.chain, ...overrides };
  // A boss can shorten (or lengthen) the difficulty's clock for its own chain.
  if (turnScale) settings.turnSeconds = settings.turnSeconds * turnScale;
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
  return {
    ...d.signature,
    // A boss can set its own time per clue, and hints that come as it runs down.
    seconds: boss.signature.seconds ?? d.signature.seconds,
    hints: !!boss.signature.hints,
    label: boss.signature.label,
    prompt: boss.signature.prompt,
    clues: [...fresh, ...seen].slice(0, needed),
  };
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

/** The longest a question's clock waits for its pictures and videos to load (ms). */
const MEDIA_WAIT_MS = 15000;

/**
 * A countdown that runs while `running`, with time penalties. Calls `onExpire` once at zero.
 * Returns the remaining milliseconds (updated every frame) and `penalize(ms)`.
 *
 * While a picture or video on screen is still loading the clock waits (`loading` is true), up to
 * MEDIA_WAIT_MS a question, so a broken picture can't freeze it. `waitForMedia: false` for a clock that
 * can't wait (one shared with another player).
 */
export function useCountdown(totalMs: number, running: boolean, onExpire: () => void, waitForMedia = true) {
  const [left, setLeft] = useState(totalMs);
  const [loading, setLoading] = useState(false);
  const waited = useRef(0);
  const end = useRef(0);
  const remaining = useRef(totalMs);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    remaining.current = totalMs;
    waited.current = 0;
    setLeft(totalMs);
  }, [totalMs]);

  useEffect(() => {
    if (!running) return;
    end.current = performance.now() + remaining.current;
    let raf = 0;
    let last = performance.now();
    let checked = 0;
    let waiting = false;
    const loop = () => {
      const now = performance.now();
      // Looking for loading media a few times a second is plenty; while some loads, the end moves on with time.
      if (waitForMedia && now - checked > 120) {
        checked = now;
        const w = waited.current < MEDIA_WAIT_MS && mediaLoading();
        if (w !== waiting) setLoading((waiting = w));
      }
      if (waiting) {
        end.current += now - last;
        waited.current += now - last;
      }
      last = now;
      const l = Math.max(0, end.current - now);
      remaining.current = l;
      setLeft(l);
      if (l <= 0) expire.current();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setLoading(false);
    };
  }, [running, totalMs, waitForMedia]);

  const penalize = useCallback((ms: number) => {
    end.current -= ms;
    remaining.current = Math.max(0, remaining.current - ms);
  }, []);
  const reset = useCallback((ms: number) => {
    waited.current = 0;
    end.current = performance.now() + ms;
    remaining.current = ms;
    setLeft(ms);
  }, []);

  return { left, penalize, reset, loading };
}
