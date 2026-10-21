import { useEffect, useRef, useState } from 'react';
import { RADAR_MAX_ERRORS, type RadarCard } from '../lib/boss';
import { sfx } from '../lib/sfx';
import type { PhaseResult } from '../types';
import { TimerBar } from './TimerBar';

interface Props {
  cards: RadarCard[];
  franchise: string;
  onEvent: (good: boolean) => void;
  onDone: (result: PhaseResult) => void;
}

/** Seconds per card shrink as the wave goes on. */
const cardMs = (i: number) => Math.max(2800, 4600 - i * 200);
const SWIPE = 90;

interface Fling {
  card: RadarCard;
  right: boolean;
  correct: boolean;
}

/** Phase II: sort a stream of cards — right if it belongs to the franchise, left to reflect an impostor. */
export function RadarDefense({ cards, franchise, onEvent, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [fling, setFling] = useState<Fling | null>(null);
  const [drag, setDrag] = useState(0);
  const [over, setOver] = useState(false);
  const start = useRef<number | null>(null);
  const card = cards[index];

  // Preload the whole wave so cards never pop in late.
  useEffect(() => cards.forEach((c) => c.image && (new Image().src = c.image)), [cards]);

  const decide = (right: boolean | null) => {
    if (over || fling || !card) return;
    const ok = right !== null && right === card.belongs;
    const nextErrors = errors + (ok ? 0 : 1);
    const nextCorrect = correct + (ok ? 1 : 0);
    setErrors(nextErrors);
    setCorrect(nextCorrect);
    setFling({ card, right: right ?? !card.belongs, correct: ok });
    setDrag(0);
    if (ok) sfx.whoosh();
    else sfx.wrong();
    onEvent(ok);
    window.setTimeout(() => {
      setFling(null);
      if (nextErrors > RADAR_MAX_ERRORS) {
        setOver(true);
        onDone({ won: false, correct: nextCorrect, wrong: nextErrors });
      } else if (index + 1 >= cards.length) {
        setOver(true);
        onDone({ won: true, correct: nextCorrect, wrong: nextErrors });
      } else setIndex(index + 1);
    }, 520);
  };

  // Keyboard: ← reflect, → belongs.
  const decideRef = useRef(decide);
  decideRef.current = decide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') decideRef.current(true);
      else if (e.key === 'ArrowLeft') decideRef.current(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = fling?.card ?? card;
  const leaning = drag < -30 ? 'left' : drag > 30 ? 'right' : null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
          Card {Math.min(index + 1, cards.length)} / {cards.length}
        </p>
        <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">
          Does it belong to <span className="text-accent">{franchise}</span>?
        </h3>
      </div>

      <TimerBar total={cardMs(index)} running={!over && !fling} resetKey={index} onExpire={() => decide(null)} />

      <div className="flex items-center justify-center gap-2" aria-label={`Shield: ${RADAR_MAX_ERRORS + 1 - errors} left`}>
        <span className="font-display text-[11px] uppercase tracking-widest text-ink-faint">Shield</span>
        {Array.from({ length: RADAR_MAX_ERRORS + 1 }, (_, i) => (
          <span
            key={i}
            className={`size-4 rotate-45 border-2 transition ${i < RADAR_MAX_ERRORS + 1 - errors ? 'border-accent bg-accent/70' : 'animate-pop border-rule-strong bg-transparent'}`}
          />
        ))}
      </div>

      <div className="relative grid h-80 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:h-96">
        {/* Drop zones */}
        <div
          className={`flex h-full items-center justify-center rounded-md border-2 border-dashed font-display text-xs font-bold uppercase tracking-widest transition ${
            leaning === 'left' || (fling && !fling.right) ? 'border-coral bg-coral/10 text-coral' : 'border-rule text-ink-faint'
          }`}
        >
          <span className="[writing-mode:vertical-rl] rotate-180">◀ Reflect impostor</span>
        </div>

        <div className="relative h-full w-48 sm:w-60">
          {shown && (
            <div
              key={`${index}-${shown.label}`}
              role="img"
              aria-label="Card to sort"
              onPointerDown={(e) => {
                if (fling || over) return;
                start.current = e.clientX;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
              onPointerUp={() => {
                if (start.current === null) return;
                start.current = null;
                if (Math.abs(drag) > SWIPE) decide(drag > 0);
                else setDrag(0);
              }}
              onPointerCancel={() => {
                start.current = null;
                setDrag(0);
              }}
              className={`page absolute inset-0 flex cursor-grab touch-none select-none flex-col overflow-hidden rounded-md p-2 active:cursor-grabbing ${
                fling ? '' : drag ? '' : 'boss-card-in'
              }`}
              style={{
                transform: fling
                  ? `translateX(${fling.right ? 160 : -160}%) rotate(${fling.right ? 24 : -24}deg)`
                  : `translateX(${drag}px) rotate(${drag / 18}deg)`,
                opacity: fling ? 0 : 1,
                transition: fling ? 'transform 0.5s ease-in, opacity 0.5s ease-in' : drag ? 'none' : 'transform 0.2s',
              }}
            >
              <div className="relative flex-1 overflow-hidden rounded-sm bg-tile">
                {shown.image ? (
                  <img src={shown.image} alt="" draggable={false} className="pointer-events-none size-full object-cover object-top" />
                ) : (
                  <span className="grid size-full place-items-center font-display text-xl">{shown.label}</span>
                )}
                {fling && (
                  <span
                    className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center font-display text-sm font-bold ${
                      fling.correct ? 'bg-hit text-on-strong' : 'bg-coral text-on-strong'
                    }`}
                  >
                    {fling.correct ? '✓' : '✗'} {fling.card.label}
                    {!fling.card.belongs && ' · impostor'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className={`flex h-full items-center justify-center rounded-md border-2 border-dashed font-display text-xs font-bold uppercase tracking-widest transition ${
            leaning === 'right' || (fling && fling.right) ? 'border-hit bg-hit/10 text-hit' : 'border-rule text-ink-faint'
          }`}
        >
          <span className="[writing-mode:vertical-rl]">Belongs ▶</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={over || !!fling} onClick={() => decide(false)} className="btn-paper rounded-md py-3 font-display font-bold tracking-wider">
          ◀ Reflect
        </button>
        <button type="button" disabled={over || !!fling} onClick={() => decide(true)} className="btn-ink rounded-md py-3 font-display font-bold tracking-wider">
          Belongs ▶
        </button>
      </div>
      <p className="text-center text-xs text-ink-faint">Swipe the card, use the buttons, or press ← / →.</p>
    </div>
  );
}
