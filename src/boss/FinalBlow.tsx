import { useEffect, useMemo, useRef, useState } from 'react';
import { FINALE_PENALTY_MS, FINALE_SECONDS, namesCard } from '../lib/boss';
import { sfx } from '../lib/sfx';
import { normalize } from '../lib/text';
import type { BossCard, PhaseResult } from '../types';
import { TimerBar } from './TimerBar';

interface Props {
  targets: BossCard[];
  /** Names offered as suggestions: the targets hidden among the franchise's other cards. */
  pool: string[];
  onEvent: (good: boolean) => void;
  onDone: (result: PhaseResult) => void;
}

/** A spotlight that jumps around the picture; it widens as time runs out. */
function useSpotlight(active: boolean) {
  const [spot, setSpot] = useState({ x: 50, y: 35, key: 0 });
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSpot((s) => ({ x: 20 + Math.random() * 60, y: 15 + Math.random() * 60, key: s.key + 1 })), 520);
    return () => clearInterval(id);
  }, [active]);
  return spot;
}

/** Phase III: name flickering, half-hidden faces before the timer burns out. */
export function FinalBlow({ targets, pool, onEvent, onDone }: Props) {
  const total = FINALE_SECONDS * 1000;
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [solved, setSolved] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const target = targets[index];
  const spot = useSpotlight(!over && !solved);

  useEffect(() => targets.forEach((t) => t.image && (new Image().src = t.image)), [targets]);
  useEffect(() => input.current?.focus({ preventScroll: true }), [index]);

  // The picture clears up as the clock runs: blur and spotlight follow the elapsed share.
  useEffect(() => {
    setElapsed(0);
    if (over) return;
    const t0 = performance.now();
    const id = window.setInterval(() => setElapsed(Math.min(1, (performance.now() - t0) / total)), 100);
    return () => clearInterval(id);
  }, [index, over, total]);

  const suggestions = useMemo(() => {
    const q = normalize(text);
    if (!q) return [];
    return pool.filter((n) => normalize(n).includes(q)).slice(0, 6);
  }, [pool, text]);

  const guess = (value: string) => {
    if (over || solved || !value.trim()) return;
    setText('');
    setActive(0);
    if (namesCard(target, value)) {
      sfx.hit();
      onEvent(true);
      setSolved(target.label);
      window.setTimeout(() => {
        setSolved(null);
        if (index + 1 >= targets.length) {
          setOver(true);
          onDone({ won: true, correct: targets.length, wrong });
        } else setIndex(index + 1);
      }, 900);
    } else {
      sfx.wrong();
      onEvent(false);
      setWrong((w) => w + 1);
      setPenalties((p) => p + 1);
      setShakeKey((k) => k + 1);
    }
  };

  const expire = () => {
    if (over || solved) return;
    setOver(true);
    onDone({ won: false, correct: index, wrong, missed: [target.label] });
  };

  const blur = solved || over ? 0 : Math.max(1.5, 12 - elapsed * 14);
  const radius = solved || over ? 150 : 16 + elapsed * 34;
  const mask = `radial-gradient(circle at ${spot.x}% ${spot.y}%, #000 ${radius}%, transparent ${radius + 14}%)`;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-coral">Final blow · {index + 1} / {targets.length}</p>
        <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">Who — or what — is this?</h3>
      </div>

      <TimerBar total={total} running={!over && !solved} resetKey={index} penalties={penalties} penaltyMs={FINALE_PENALTY_MS} onExpire={expire} intense />

      <div key={shakeKey} className={`relative mx-auto aspect-square w-full max-w-xs ${shakeKey ? 'animate-shake' : ''}`}>
        <div className={`boss-glow absolute -inset-2 rounded-lg ${solved ? 'opacity-0' : ''}`} aria-hidden />
        <div className="relative size-full overflow-hidden rounded-md border-2 border-coral/70 bg-[#141018]">
          {target?.image && (
            <img
              key={target.label}
              src={target.image}
              alt=""
              draggable={false}
              className={`size-full select-none object-cover object-top transition-[filter] duration-300 ${solved ? '' : 'boss-flicker'}`}
              style={{ filter: `blur(${blur}px) contrast(1.1)`, WebkitMaskImage: mask, maskImage: mask }}
            />
          )}
          {solved && (
            <span className="animate-pop absolute inset-x-0 bottom-0 bg-hit px-3 py-2 text-center font-display text-lg font-bold text-on-strong">
              ✓ {solved}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          ref={input}
          value={text}
          disabled={over || !!solved}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') guess(suggestions[active] ?? text);
          }}
          placeholder="Name it — a wrong answer burns 2 seconds"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-50"
        />
        {suggestions.length > 0 && (
          <ul className="animate-pop absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-rule-strong bg-card shadow-2xl">
            {suggestions.map((n, i) => (
              <li key={n}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => guess(n)}
                  className={`w-full px-4 py-2.5 text-left font-medium ${i === active ? 'bg-accent-soft' : 'hover:bg-tile'}`}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
