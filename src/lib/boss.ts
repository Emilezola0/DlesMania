import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlitzPrompt, Boss, BossCard } from '../types';
import { pick, shuffle } from './rng';
import { normalize } from './text';

export const PHASES = [
  { name: 'Knowledge Blitz', roman: 'I', how: 'Type names before the timer runs out — each valid answer is accepted as you type.' },
  { name: 'Radar Defense', roman: 'II', how: 'Swipe or press → when a card belongs. Reflect impostors with ← . Three mistakes and the shield breaks.' },
  { name: 'Final Blow', roman: 'III', how: 'Name each flickering face before the timer burns out. Wrong answers cost time.' },
] as const;

export const PLAYER_HEARTS = 3;
/** Radar Defense: cards per wave, and how many mistakes break the shield. */
export const RADAR_CARDS = 10;
export const RADAR_IMPOSTORS = 4;
export const RADAR_MAX_ERRORS = 2;
/** Final Blow: targets per attempt, seconds each, and the wrong-answer penalty. */
export const FINALE_TARGETS = 3;
export const FINALE_SECONDS = 12;
export const FINALE_PENALTY_MS = 2000;

/** Seconds for a Knowledge Blitz prompt: 12 per required answer. */
export const blitzSeconds = (p: BlitzPrompt) => p.count * 12;

/** One attempt's content. Retrying a phase draws fresh content where the boss has enough. */
export function drawBlitz(boss: Boss, rand: () => number, avoid?: string) {
  const fresh = boss.blitz.filter((p) => p.prompt !== avoid);
  return pick(fresh.length ? fresh : boss.blitz, rand);
}

export interface RadarCard extends BossCard {
  belongs: boolean;
}

export function drawRadar(boss: Boss, rand: () => number): RadarCard[] {
  const members = shuffle(boss.radar.members, rand).slice(0, RADAR_CARDS - RADAR_IMPOSTORS);
  const impostors = shuffle(boss.radar.impostors, rand).slice(0, RADAR_IMPOSTORS);
  // Never open on an impostor: the first card teaches the gesture.
  const [first, ...rest] = members;
  return [{ ...first, belongs: true }, ...shuffle([...rest.map((c) => ({ ...c, belongs: true })), ...impostors.map((c) => ({ ...c, belongs: false }))], rand)];
}

export function drawFinale(boss: Boss, rand: () => number): BossCard[] {
  return shuffle(boss.finale, rand).slice(0, FINALE_TARGETS);
}

/** Every spelling of a name, normalised. */
export const spellings = (name: string, aliases: string[] = []) => [name, ...aliases].map(normalize).filter(Boolean);

/**
 * Knowledge Blitz matching: the answer `text` names, if any.
 * `exact` is false when a longer answer still starts with the text ("son" vs "son goku"),
 * so the input waits for Enter or a pause before accepting it.
 */
export function matchAnswer(prompt: BlitzPrompt, text: string, found: Set<string>) {
  const q = normalize(text);
  if (!q) return null;
  const hit = prompt.answers.find((a) => spellings(a.name, a.aliases).includes(q));
  if (!hit) return null;
  const ambiguous = prompt.answers.some(
    (a) => a !== hit && !found.has(a.name) && spellings(a.name, a.aliases).some((s) => s.startsWith(`${q} `)),
  );
  return { name: hit.name, already: found.has(hit.name), exact: !ambiguous };
}

export const namesCard = (card: BossCard, text: string) => spellings(card.label, card.aliases).includes(normalize(text));

export interface BattleStats {
  phasesCleared: number;
  hearts: number;
  correct: number;
  wrong: number;
  timeMs: number;
}

/** Points: 1000 per phase, 400 per heart kept, accuracy and speed bonuses (victories only). */
export function battleScore({ phasesCleared, hearts, correct, wrong, timeMs }: BattleStats) {
  const won = phasesCleared === PHASES.length;
  const accuracy = correct + wrong ? correct / (correct + wrong) : 0;
  const speed = won ? Math.max(0, 300 - timeMs / 1000) * 4 : 0;
  return Math.round(phasesCleared * 1000 + (won ? hearts * 400 : 0) + accuracy * 500 + speed);
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
