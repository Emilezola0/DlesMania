import { useEffect, useRef, useState } from 'react';
import { Glyph } from '../components/Glyph';
import { escalated, pictureStyle, radarCardMs, type DifficultySpec, type RadarCard } from '../lib/boss';
import { shownName } from '../lib/french';
import { useImagesReady } from '../lib/images';
import { sfx } from '../lib/sfx';
import { useUi } from '../store/ui';
import type { PhaseResult } from '../types';
import { TimerBar } from './TimerBar';

interface Props {
  cards: RadarCard[];
  franchise: string;
  difficulty: DifficultySpec;
  /** Which loop of this phase (0 = first); Hard's second loop is the escalated one. */
  loop: number;
  onEvent: (good: boolean) => void;
  onDone: (result: PhaseResult) => void;
}

type Zone = 'left' | 'right';
const SWIPE = 90;

interface Fling {
  card: RadarCard;
  zone: Zone;
  correct: boolean;
  note?: string;
}

/** Which zone sorts a card as "belongs": the right one, unless this card reverses the zones. */
const belongsZone = (card: RadarCard | undefined): Zone => (card?.fx?.reversed ? 'left' : 'right');

/** Drifting glyphs scattered over a card's picture (Medium and Hard). */
function Clutter({ seeds, fast }: { seeds: number[]; fast: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {seeds.map((s) => (
        <span
          key={s}
          className="boss-drift absolute text-ink/60"
          style={
            {
              left: `${(s % 70) + 5}%`,
              top: `${((s >> 7) % 70) + 5}%`,
              '--dx': `${((s >> 3) % 60) - 30}px`,
              '--dy': `${((s >> 11) % 60) - 30}px`,
              animationDuration: `${(fast ? 0.7 : 1.4) + ((s >> 5) % 10) / 10}s`,
            } as React.CSSProperties
          }
        >
          <Glyph seed={String(s)} size={28 + (s % 4) * 10} strokeWidth={2.4} />
        </span>
      ))}
    </div>
  );
}

/**
 * Phase II: sort a stream of cards — into "belongs" if it's from the franchise, "reflect" if it's an impostor.
 * Medium/Hard disguise the cards (colour shifts, spin, fading, clutter); Hard also reverses the zones on
 * some cards, flashes decoy zones, penalises swipes made before a card has settled, and hides the seconds.
 */
export function RadarDefense({ cards, franchise, difficulty: d, loop, onEvent, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [fling, setFling] = useState<Fling | null>(null);
  const [drag, setDrag] = useState(0);
  const [over, setOver] = useState(false);
  const [decoy, setDecoy] = useState<Zone | null>(null);
  const [warnReversed, setWarnReversed] = useState(false);
  const start = useRef<number | null>(null);
  const appearedAt = useRef(performance.now());
  const card = cards[index];
  // The clock waits for the picture.
  const ready = useImagesReady([card?.image]);
  const ms = radarCardMs(d, index, loop);
  const esc = escalated(d, loop);
  const maxErrors = d.radarMaxErrors;

  // Preload the whole wave so cards never pop in late.
  useEffect(() => cards.forEach((c) => c.image && (new Image().src = c.image)), [cards]);

  // Each new card: note when it appeared, flash the "reversed" warning, and schedule its decoy.
  useEffect(() => {
    appearedAt.current = performance.now();
    const timers: number[] = [];
    if (card?.fx?.reversed) {
      setWarnReversed(true);
      timers.push(window.setTimeout(() => setWarnReversed(false), 700));
    }
    if (card?.fx?.decoy) {
      const zone = card.fx.decoy;
      timers.push(window.setTimeout(() => setDecoy(zone), ms * (0.3 + Math.random() * 0.3)));
      timers.push(window.setTimeout(() => setDecoy(null), ms * 0.75));
    }
    return () => {
      timers.forEach(clearTimeout);
      setDecoy(null);
      setWarnReversed(false);
    };
  }, [index, card, ms]);

  const decide = (zone: Zone | null) => {
    if (over || fling || !card) return;
    const early = zone !== null && d.radarLockMs > 0 && performance.now() - appearedAt.current < d.radarLockMs;
    const ok = !early && zone !== null && (zone === belongsZone(card)) === card.belongs;
    const nextErrors = errors + (ok ? 0 : 1);
    const nextCorrect = correct + (ok ? 1 : 0);
    setErrors(nextErrors);
    setCorrect(nextCorrect);
    // On a timeout the card leaves the way it should have gone.
    const shownZone: Zone = zone ?? (card.belongs ? belongsZone(card) : belongsZone(card) === 'right' ? 'left' : 'right');
    setFling({ card, zone: shownZone, correct: ok, note: early ? 'Too early!' : zone === null ? 'Too slow!' : undefined });
    setDrag(0);
    if (ok) sfx.whoosh();
    else sfx.wrong();
    onEvent(ok);
    window.setTimeout(() => {
      setFling(null);
      if (nextErrors > maxErrors) {
        setOver(true);
        onDone({ won: false, correct: nextCorrect, wrong: nextErrors });
      } else if (index + 1 >= cards.length) {
        setOver(true);
        onDone({ won: true, correct: nextCorrect, wrong: nextErrors });
      } else setIndex(index + 1);
    }, 520);
  };

  // Keyboard: ← / → pick the left / right zone, whatever it means for this card.
  const decideRef = useRef(decide);
  decideRef.current = decide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().rules) return;
      if (e.key === 'ArrowRight') decideRef.current('right');
      else if (e.key === 'ArrowLeft') decideRef.current('left');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = fling?.card ?? card;
  const fx = shown?.fx ?? null;
  const leaning: Zone | null = drag < -30 ? 'left' : drag > 30 ? 'right' : null;
  const bz = belongsZone(shown);

  const zone = (side: Zone) => {
    const belongs = side === bz;
    // A real lean or fling lights the zone in its own colour; a decoy lights it as "belongs".
    const lit = leaning === side || fling?.zone === side;
    const fake = !lit && decoy === side;
    const tone = lit ? (belongs ? 'border-hit bg-hit/10 text-hit' : 'border-coral bg-coral/10 text-coral') : fake ? 'boss-decoy border-hit bg-hit/15 text-hit' : 'border-rule text-ink-faint';
    const label = belongs ? (side === 'right' ? 'Belongs ▶' : '◀ Belongs') : side === 'left' ? '◀ Reflect impostor' : 'Reflect impostor ▶';
    return (
      <div className={`flex h-full items-center justify-center rounded-md border-2 border-dashed font-display text-xs font-bold uppercase tracking-widest transition ${tone}`}>
        <span className={`[writing-mode:vertical-rl] ${side === 'left' ? 'rotate-180' : ''}`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4 overflow-x-clip">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
          Card {Math.min(index + 1, cards.length)} / {cards.length}
          {esc && <span className="ml-2 font-bold text-coral">· Escalation</span>}
        </p>
        <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">
          Does it belong to <span className="text-accent">{franchise}</span>?
        </h3>
      </div>

      <TimerBar total={ms} running={!over && !fling && ready} resetKey={index} onExpire={() => decide(null)} hideSeconds={d.distortion === 2} />

      <div className="flex items-center justify-center gap-2" aria-label={`Shield: ${maxErrors + 1 - errors} left`}>
        <span className="font-display text-[11px] uppercase tracking-widest text-ink-faint">Shield</span>
        {Array.from({ length: maxErrors + 1 }, (_, i) => (
          <span
            key={i}
            className={`size-4 rotate-45 border-2 transition ${i < maxErrors + 1 - errors ? 'border-accent bg-accent/70' : 'animate-pop border-rule-strong bg-transparent'}`}
          />
        ))}
      </div>

      <div className="relative grid h-80 grid-cols-[1fr_auto_1fr] grid-rows-[minmax(0,1fr)] gap-2 sm:h-96">
        {zone('left')}

        <div className="relative h-full w-48 sm:w-60">
          {warnReversed && (
            <span className="boss-reversed absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ochre px-3 py-1 font-display text-xs font-bold tracking-widest text-on-pastel shadow">
              ⇄ ZONES REVERSED
            </span>
          )}
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
                if (Math.abs(drag) > SWIPE) decide(drag > 0 ? 'right' : 'left');
                else setDrag(0);
              }}
              onPointerCancel={() => {
                start.current = null;
                setDrag(0);
              }}
              className={`page flex cursor-grab touch-none select-none flex-col overflow-hidden rounded-md p-2 active:cursor-grabbing ${
                fling || drag ? '' : 'boss-card-in'
              }`}
              style={{
                // Inline because `.page` sets position: relative, which would win over the `absolute` utility.
                position: 'absolute',
                inset: 0,
                transform: fling
                  ? `translateX(${fling.zone === 'right' ? 160 : -160}%) rotate(${fling.zone === 'right' ? 24 : -24}deg)`
                  : `translateX(${drag}px) rotate(${drag / 18}deg)`,
                opacity: fling ? 0 : 1,
                transition: fling ? 'transform 0.5s ease-in, opacity 0.5s ease-in' : drag ? 'none' : 'transform 0.2s',
              }}
            >
              <div className={`relative flex-1 overflow-hidden rounded-sm bg-tile ${fx && !fx.still && d.distortion === 2 && !fling ? 'boss-scramble' : ''}`}>
                {/* The picture spins and shifts colour over the card's lifetime. */}
                <div
                  className={`absolute inset-0 ${fx && !fx.still && !fling ? 'boss-spin' : ''}`}
                  style={fx ? ({ '--spin': `${fx.spin}deg`, animationDuration: `${ms}ms` } as React.CSSProperties) : undefined}
                >
                  {shown.image ? (
                    <img
                      src={shown.image}
                      alt=""
                      draggable={false}
                      className={`pointer-events-none size-full object-cover object-top ${fx?.still ? '' : 'scale-110'} ${fx && !fx.still && !fling ? (d.distortion === 2 ? 'boss-fade-fast' : 'boss-fade') : ''}`}
                      style={
                        fx?.still && !fling
                          ? pictureStyle(fx.still)
                          : fx && !fling
                            ? { filter: `hue-rotate(${fx.hue}deg) saturate(${fx.saturate})${fx.invert ? ' invert(1)' : ''}` }
                            : undefined
                      }
                    />
                  ) : (
                    <span className="grid size-full place-items-center font-display text-xl">{shownName(shown.label)}</span>
                  )}
                </div>
                {fx && !fx.still && !fling && <Clutter seeds={fx.clutter} fast={d.distortion === 2} />}
                {fling && (
                  <span
                    className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center font-display text-sm font-bold ${
                      fling.correct ? 'bg-hit text-on-strong' : 'bg-coral text-on-strong'
                    }`}
                  >
                    {fling.note ? `${fling.note} ` : ''}
                    {fling.correct ? '✓' : '✗'} {shownName(fling.card.label)}
                    {!fling.card.belongs && ' · impostor'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {zone('right')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['left', 'right'] as const).map((side) => {
          const belongs = side === bz;
          const label = belongs ? (side === 'left' ? '◀ Belongs' : 'Belongs ▶') : side === 'left' ? '◀ Reflect' : 'Reflect ▶';
          return (
            <button
              key={side}
              type="button"
              disabled={over || !!fling}
              onClick={() => decide(side)}
              className={`${belongs ? 'btn-ink' : 'btn-paper'} rounded-md py-3 font-display font-bold tracking-wider`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-ink-faint">
        Swipe the card, use the buttons, or press ← / →.
        {d.distortion === 2 && !esc && ' Watch for reversed zones — and wait for each card to settle.'}
        {esc && ' Escalation: fewer, faster cards — pictures zoomed in, recoloured and sometimes upside down.'}
      </p>
    </div>
  );
}
