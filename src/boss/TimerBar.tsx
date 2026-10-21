import { useEffect, useRef, useState } from 'react';
import { useCountdown } from '../lib/boss';
import { sfx } from '../lib/sfx';

interface Props {
  total: number;
  running: boolean;
  onExpire: () => void;
  /** Bumped by the parent to subtract `penaltyMs` (Final Blow wrong answers). */
  penalties?: number;
  penaltyMs?: number;
  /** Restart the countdown whenever this changes. */
  resetKey?: string | number;
  /** Thick, burning bar for the final phase. */
  intense?: boolean;
  /** Hard mode: no seconds counter, only the bar (the tick still warns at the end). */
  hideSeconds?: boolean;
  /** Bait (Hard's second loops): chance, every ~2 s, that the bar flashes almost empty for a moment. The real clock is unaffected. */
  fakeDrops?: number;
}

/** A draining bar with the seconds left; it turns red and ticks in the last stretch. */
export function TimerBar({ total, running, onExpire, penalties = 0, penaltyMs = 0, resetKey, intense, hideSeconds, fakeDrops = 0 }: Props) {
  const { left, penalize, reset } = useCountdown(total, running, onExpire);
  const seenPenalties = useRef(penalties);
  const lastTick = useRef(0);

  useEffect(() => {
    if (penalties > seenPenalties.current) penalize((penalties - seenPenalties.current) * penaltyMs);
    seenPenalties.current = penalties;
  }, [penalties, penaltyMs, penalize]);

  useEffect(() => {
    if (resetKey !== undefined) reset(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const [fake, setFake] = useState(false);
  useEffect(() => {
    if (!running || !fakeDrops) return;
    let off = 0;
    const id = window.setInterval(() => {
      if (Math.random() >= fakeDrops) return;
      setFake(true);
      sfx.tick();
      off = window.setTimeout(() => setFake(false), 380);
    }, 2100);
    return () => {
      clearInterval(id);
      clearTimeout(off);
      setFake(false);
    };
  }, [running, fakeDrops]);

  const secs = Math.ceil(left / 1000);
  const low = fake || left < Math.min(5000, total * 0.3);
  useEffect(() => {
    if (running && low && secs !== lastTick.current && secs > 0) sfx.tick();
    lastTick.current = secs;
  }, [secs, low, running]);

  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex-1 overflow-hidden rounded-full border border-rule-strong bg-tile ${intense ? 'h-4' : 'h-2.5'}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${low ? 'bg-coral' : intense ? 'bg-ochre' : 'bg-accent'} ${intense ? 'boss-ember' : ''}`}
          style={{ width: `${fake ? 6 : (left / total) * 100}%` }}
        />
      </div>
      <span className={`w-10 text-right font-display text-lg font-bold tabular-nums ${low ? 'animate-pulse text-coral' : 'text-ink-soft'}`}>
        {hideSeconds ? '??' : `${secs}s`}
      </span>
    </div>
  );
}
