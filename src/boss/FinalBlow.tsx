import { useEffect, useMemo, useRef, useState } from 'react';
import { drawPictureFx, escalated, finaleSeconds, namesCard, pictureStyle, type DifficultySpec } from '../lib/boss';
import { sfx } from '../lib/sfx';
import { isFuzzyMatch, rankBySearch } from '../utils/textMatcher';
import type { BossCard, PhaseResult } from '../types';
import { TimerBar } from './TimerBar';

interface Props {
  targets: BossCard[];
  /** Suggestions: the targets hidden among the franchise's other cards (any spelling finds them). */
  pool: BossCard[];
  difficulty: DifficultySpec;
  /** Which loop of the phase (0 = first); Hard's second loop is escalated. */
  loop: number;
  onEvent: (good: boolean) => void;
  onDone: (result: PhaseResult) => void;
}

/** How the picture is hidden at each distortion level: spotlight jump interval, radius and blur. */
const LOOK = [
  { every: 520, radius: [16, 34], blur: [12, 1.5], turn: '' },
  { every: 400, radius: [12, 30], blur: [14, 2.5], turn: 'boss-turn' },
  { every: 280, radius: [9, 26], blur: [16, 3.5], turn: 'boss-turn-fast' },
] as const;

/** A spotlight that jumps around the picture; it widens as time runs out. */
function useSpotlight(active: boolean, every: number) {
  const [spot, setSpot] = useState({ x: 50, y: 35, key: 0 });
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSpot((s) => ({ x: 20 + Math.random() * 60, y: 15 + Math.random() * 60, key: s.key + 1 })), every);
    return () => clearInterval(id);
  }, [active, every]);
  return spot;
}

/** Phase III: name flickering, half-hidden faces before the timer burns out. */
export function FinalBlow({ targets, pool, difficulty: d, loop, onEvent, onDone }: Props) {
  const esc = escalated(d, loop) ? d.secondLoop!.finale : null;
  const total = finaleSeconds(d, loop) * 1000;
  const look = LOOK[d.distortion];
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
  const spot = useSpotlight(!over && !solved, look.every);
  // Second loop: each face gets a still distortion (zoom, colour shift, maybe turned) instead of
  // the moving spotlight, turning and flicker.
  const still = useMemo(() => (esc ? targets.map(() => drawPictureFx(esc, Math.random)) : null), [esc, targets]);

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

  const suggestions = useMemo(
    () => (text.trim() ? rankBySearch(text, pool, (c) => [c.label, ...(c.aliases ?? [])], 6).map((c) => c.label) : []),
    [pool, text],
  );

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

  const clear = solved || over;
  // Still (second-loop) pictures are never blurred: zoom, colour and rotation are hard enough.
  const blur = clear || still ? 0 : Math.max(look.blur[1], look.blur[0] - elapsed * (look.blur[0] + 2));
  const radius = clear ? 150 : look.radius[0] + elapsed * look.radius[1];
  const mask = `radial-gradient(circle at ${spot.x}% ${spot.y}%, #000 ${radius}%, transparent ${radius + 14}%)`;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-coral">
          Final blow · {index + 1} / {targets.length}
          {esc && <span className="ml-2 font-bold">· Escalation</span>}
        </p>
        <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">Who — or what — is this?</h3>
      </div>

      <TimerBar total={total} running={!over && !solved} resetKey={index} penalties={penalties} penaltyMs={d.finalePenaltyMs} onExpire={expire} intense hideSeconds={d.distortion === 2} />

      <div key={shakeKey} className={`relative mx-auto aspect-square w-full max-w-xs ${shakeKey ? 'animate-shake' : ''}`}>
        <div className={`boss-glow absolute -inset-2 rounded-lg ${solved ? 'opacity-0' : ''}`} aria-hidden />
        <div className="relative size-full overflow-hidden rounded-md border-2 border-coral/70 bg-[#141018]">
          {/* Medium/Hard: the picture also turns and shifts colour (Hard flips and inverts it too). */}
          <div className={`absolute inset-0 ${clear || still ? '' : `${look.turn} ${d.distortion === 2 ? 'boss-hue-fast' : d.distortion === 1 ? 'boss-hue' : ''}`}`}>
          {target?.image && (
            <img
              key={target.label}
              src={target.image}
              alt=""
              draggable={false}
              className={`size-full select-none object-cover object-top transition-[filter] duration-300 ${solved || still ? '' : 'boss-flicker'}`}
              style={
                still && !clear
                  ? pictureStyle(still[index])
                  : { filter: `blur(${blur}px) contrast(1.1)`, WebkitMaskImage: mask, maskImage: mask }
              }
            />
          )}
          </div>
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
            } else if (e.key === 'Enter') {
              // What was typed wins when it already names the target (typos forgiven); otherwise the highlighted suggestion.
              const typedHits = isFuzzyMatch(text, [target.label, ...(target.aliases ?? [])]);
              guess(typedHits ? text : (suggestions[active] ?? text));
            }
          }}
          placeholder={`Name it — a wrong answer burns ${d.finalePenaltyMs / 1000} seconds`}
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
