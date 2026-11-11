import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS } from '../gacha/cards';
import type { SecretPhase } from '../lib/boss';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { shuffle } from '../lib/rng';
import type { BossCard } from '../types';
import type { ChainResult } from './NameChain';
import { TimerBar } from './TimerBar';

interface Props {
  /** The boss's own: who was snapped (true) and who was spared (false). */
  quiz: { name: string; snapped: boolean }[];
  /** Its chain's settings: how many right answers win, and the clock for each. */
  secret: SecretPhase;
  set: string;
  bossName: string;
  cards: BossCard[];
  okLines: string[];
  onSay: (text: string, mood: 'taunt' | 'hit' | 'hurt') => void;
  onDone: (result: ChainResult) => void;
}

type Turn = 'answer' | 'shown' | 'over';

/**
 * Phase IV of the Marvel boss (the owner's call, a ticket): Thanos's snap. A hero or villain shows; say
 * whether they turned to dust in the snap or were spared. A wrong answer or the clock running out loses
 * on the spot; `picksToWin` right answers win. The answer shows after each one, to learn it.
 */
export function SnapQuiz({ quiz, secret, set, bossName, cards, okLines, onSay, onDone }: Props) {
  const { picksToWin, turnSeconds } = secret;
  const order = useMemo(() => shuffle(quiz, Math.random), [quiz]);
  const toWin = Math.min(picksToWin, order.length);
  const [i, setI] = useState(0);
  const [turn, setTurn] = useState<Turn>('answer');
  const [lastRight, setLastRight] = useState<boolean | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const who = order[i];
  const portrait = useMemo(() => {
    if (!who) return undefined;
    return cards.find((c) => c.label === who.name)?.image ?? CARDS.find((c) => c.set === set && c.name === who.name)?.image;
  }, [who, cards, set]);

  const answer = (snapped: boolean | null) => {
    if (turn !== 'answer' || !who) return;
    const right = snapped === who.snapped;
    setLastRight(right);
    setTurn('shown');
    if (right) {
      sfx.correct();
      if (okLines.length && Math.random() < 0.5) onSay(okLines[Math.floor(Math.random() * okLines.length)], 'hurt');
      const score = i + 1;
      if (score >= toWin) {
        later(900, () => (setTurn('over'), onDone({ won: true, score, reason: '' })));
      } else later(1100, () => (setI(score), setLastRight(null), setTurn('answer')));
    } else {
      sfx.wrong();
      onSay(snapped === null ? 'Too slow. Perfectly balanced, as all things should be.' : 'Wrong. Reality is often disappointing.', 'taunt');
      const reason = snapped === null ? "Time's up" : `${shownName(who.name)} was ${who.snapped ? 'snapped' : 'spared'}`;
      later(1600, () => (setTurn('over'), onDone({ won: false, score: i, reason })));
    }
  };

  // Keys: S (snapped) or ← , K (kept / spared) or →.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowLeft') answer(true);
      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowRight') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!who) return null;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-accent">Phase IV · The Snap</p>
        <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">{bossName} snapped his fingers. Did they turn to dust?</h3>
      </div>

      <div className="flex items-center justify-center gap-1.5" aria-label={`${i} of ${toWin} answers`}>
        {Array.from({ length: toWin }, (_, k) => (
          <span key={k} className={`h-2 w-6 rounded-full transition ${k < i || (k === i && lastRight) ? 'bg-hit' : k === i && lastRight === false ? 'animate-pop bg-coral' : 'bg-rule-strong'}`} />
        ))}
      </div>

      <div key={i} className="animate-pop mx-auto flex max-w-sm flex-col items-center gap-2 rounded-md border-2 border-coral/60 bg-card/70 p-4">
        <span className={`relative grid size-40 place-items-center overflow-hidden rounded-md bg-tile transition duration-700 ${turn !== 'answer' && who.snapped ? 'opacity-30 blur-[2px] grayscale' : ''}`}>
          {portrait ? <img src={portrait} alt="" className="size-full object-cover object-top" /> : <span className="font-display text-4xl text-ink-faint">?</span>}
        </span>
        <p className="font-display text-2xl font-bold">{shownName(who.name)}</p>
        <p className="min-h-6 text-sm font-semibold" aria-live="polite">
          {turn !== 'answer' && (
            <span className={lastRight ? 'text-hit' : 'text-coral'}>
              {lastRight ? '✓' : '✗'} {who.snapped ? 'Snapped — turned to dust' : 'Spared by the snap'}
            </span>
          )}
        </p>
      </div>

      {turnSeconds > 0 && <TimerBar total={turnSeconds * 1000} running={turn === 'answer'} resetKey={i} onExpire={() => answer(null)} hideSeconds />}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={turn !== 'answer'} onClick={() => answer(true)} className="rounded-md border border-coral bg-coral/15 px-4 py-3 font-display font-bold disabled:opacity-50">
          🫰 Snapped <span className="text-xs text-ink-faint">(S)</span>
        </button>
        <button type="button" disabled={turn !== 'answer'} onClick={() => answer(false)} className="rounded-md border border-hit bg-hit/15 px-4 py-3 font-display font-bold disabled:opacity-50">
          🛡️ Spared <span className="text-xs text-ink-faint">(K)</span>
        </button>
      </div>
    </div>
  );
}
