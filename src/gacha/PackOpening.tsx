import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig, rumble, shake } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardBack, CardFace, RARITY_STYLE } from './CardView';
import { RARITIES, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from './cards';
import { PackArt } from './PackArt';
import { playVoice } from './voice';
import { ABSORB_CHANCE, ANOMALIES, ANOMALY_IDS, BLACK_HOLE_CHANCE, fakeTag, rollAnomaly, type AnomalyId } from './anomalies';
import type { Pack } from './packs';

/** Where the pack tears: this far down its height. */
const TEAR_AT = 18;
/** The share of the width a swipe has to cross to tear the pack. */
const TEAR_ENOUGH = 0.8;

type Phase = 'choose' | 'pack' | 'torn' | 'meteor' | 'reveal' | 'summary';

/** The three packs to choose from: the same pack, each tinted and tilted a little differently. */
const LINEUP = [
  { filter: 'hue-rotate(-22deg) saturate(1.1)', tilt: -7 },
  { filter: 'none', tilt: 0 },
  { filter: 'hue-rotate(22deg) saturate(1.1)', tilt: 7 },
];

/** The pack's own light before it's torn, and the flash as the cards come (the tear itself glows in the best card's colour). */
const PACK_LIGHT = '#c4b5fd';
/** A mythic's light is every colour at once. */
const RAINBOW = ['#ff4fd8', '#ffcd3c', '#3cff9e', '#3cc7ff', '#a855f7'];
const top = (r: Rarity) => r === 'legendary' || r === 'mythic' || r === 'omni';
/** The rainbow tiers: mythic and, above it, omni. */
const prismatic = (r: Rarity) => r === 'mythic' || r === 'omni';
/** Only the mythic is a rainbow: the omni burns in its own colours. */
const rainbowy = (r: Rarity) => r === 'mythic';

/** A pack's shooting stars: one per card, in its colour, the rarest last. */
interface Star {
  /** The card's rarity, and the one the star shows first (a rarity lower when it evolves on the way). */
  to: Rarity;
  from: Rarity;
  /** When it starts and how long it flies, in ms; its height and tilt on screen. */
  delay: number;
  duration: number;
  top: number;
  tilt: number;
}
/**
 * How often a pack plays a fake-out: its best card, when Epic or better, poses as one rarity lower — its
 * star shows Rare for an Epic, Epic for a Legendary… — until it evolves mid-flight.
 */
const EVOLVE_CHANCE = 0.3;
const STAR_GAP = 260;
/** The beat of suspense before the last star (the best card's), once every other star has crossed: evolving or not. The screen rumbles meanwhile. */
const LAST_STAR_PAUSE = 2000;
/**
 * An evolving star doesn't cross: it and a second star rush in from both sides, crash together in the
 * middle after CLASH_AT ms and burst in the colour of the rarity it becomes (BOOM ms of sparks).
 */
const CLASH_AT = 950;
const BOOM = 1000;
const flight = (r: Rarity) => (prismatic(r) ? 1700 : r === 'legendary' ? 1300 : 850);

/** Where the black hole opens, on screen (%). */
const HOLE = { x: 62, y: 42 };
/** A swallowed star's fall into the hole, and its way back out once every other star has passed (ms). */
const SWALLOW_MS = 1200;
const EMERGE_MS = 1300;
const EMERGE_GAP = 900;

/**
 * Now and then (BLACK_HOLE_CHANCE) a black hole opens as the stars fly, and each star passing (not an
 * evolving one) may be pulled in (ABSORB_CHANCE). Its card comes last, with an anomaly to keep or not.
 * For testing, localStorage "omnidle-force-anomaly" = "1" (or "corrupted", "fake") opens one every time and swallows a star.
 */
function cosmosFor(stars: Star[], rand: () => number = Math.random): { hole: boolean; swallowed: Map<number, AnomalyId> } {
  let force: string | null = null;
  try {
    force = localStorage.getItem('omnidle-force-anomaly');
  } catch {
    // No storage: chance alone.
  }
  // "1": a black hole and a swallowed star; or the name of an anomaly, to get that one.
  const forced = force === '1' || (ANOMALY_IDS as string[]).includes(force ?? '');
  const roll = () => ((ANOMALY_IDS as string[]).includes(force ?? '') ? (force as AnomalyId) : rollAnomaly(rand));
  const hole = forced || rand() < BLACK_HOLE_CHANCE;
  const swallowed = new Map<number, AnomalyId>();
  if (!hole) return { hole, swallowed };
  const candidates = stars.flatMap((s, k) => (s.from === s.to ? [k] : []));
  for (const k of candidates) if (rand() < ABSORB_CHANCE) swallowed.set(k, roll());
  if (forced && !swallowed.size && candidates.length) swallowed.set(candidates[Math.floor(rand() * candidates.length)], roll());
  return { hole, swallowed };
}

function starsFor(cards: Card[], rand: () => number = Math.random): Star[] {
  // Now and then the best card (Epic or better: the smallest fake-out is Rare → Epic) shows a rarity lower,
  // and evolves on the way. The cards come sorted, the best last.
  const last = cards.length - 1;
  const evolving = last >= 0 && RARITIES.indexOf(cards[last].rarity) >= 2 && rand() < EVOLVE_CHANCE ? last : -1;
  let at = 0;
  let clear = 0;
  return cards.map((c, i) => {
    // The last star waits for the sky to empty, then a moment more.
    if (i === last && i > 0) at = Math.max(at, clear) + LAST_STAR_PAUSE;
    const from = i === evolving ? RARITIES[RARITIES.indexOf(c.rarity) - 1] : c.rarity;
    const star: Star = { to: c.rarity, from, delay: at, duration: from !== c.rarity ? CLASH_AT + BOOM : flight(c.rarity), top: 16 + ((i * 37) % 48) + rand() * 6, tilt: -10 - rand() * 16 };
    // Many cards (five packs at once): the stars come closer together.
    at += (cards.length > 5 ? STAR_GAP / 2.5 : STAR_GAP) + (top(c.rarity) ? 250 : 0);
    clear = Math.max(clear, star.delay + star.duration);
    return star;
  });
}
/** A star's streak: transparent tail, its colour, a white head (a rainbow for mythics and omnis). */
const streak = (r: Rarity) => ({
  background: rainbowy(r) ? `linear-gradient(90deg, transparent, ${RAINBOW.join(', ')}, #fff)` : `linear-gradient(90deg, transparent, ${RARITY_LIGHT[r]}88 40%, #fff)`,
  boxShadow: rainbowy(r) ? '0 0 18px #ff4fd8, 0 0 40px #3cc7ff, 0 0 70px #ffcd3c' : `0 0 16px ${RARITY_LIGHT[r]}, 0 0 40px ${RARITY_LIGHT[r]}`,
});

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Sparks flying out from a turned card, in its colour (more for rarer cards; a mythic's in every colour). */
function Burst({ color, count, rainbow }: { color: string; count: number; rainbow?: boolean }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 110 + Math.random() * 160;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 4 + Math.random() * 7, delay: Math.random() * 120, color: rainbow ? RAINBOW[i % RAINBOW.length] : color };
      }),
    [count, rainbow, color],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden>
      {sparks.map((p, i) => (
        <span
          key={i}
          className="pack-spark absolute rounded-full"
          style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 12px ${p.color}`, ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animationDelay: `${p.delay}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * An evolving star: two stars in its first colour rush in from both sides, crash in the middle of the
 * screen and burst in the colour of the rarity it turns out to be.
 */
function Clash({ star, thick }: { star: Star; thick: number }) {
  const [boom, setBoom] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBoom(true), star.delay + CLASH_AT);
    return () => window.clearTimeout(t);
  }, [star.delay]);
  const timing = { animationDuration: `${CLASH_AT}ms`, animationDelay: `${star.delay}ms` };
  const color = RARITY_LIGHT[star.to];
  return (
    <div className="absolute inset-0">
      {/* From the left, and from the right (the same star turned around), meeting in the middle. */}
      {[star.tilt, 180 + star.tilt].map((angle) => (
        <div key={angle} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="pack-clash absolute right-0 top-0 rounded-full" style={{ ...timing, width: `${top(star.to) ? 40 : 30}vw`, height: thick + 2, ...streak(star.from) }} />
        </div>
      ))}
      {boom && (
        <>
          <div className="pack-clash-boom absolute left-1/2 top-1/2 size-40 rounded-full" style={{ background: rainbowy(star.to) ? `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 72%)` : `radial-gradient(circle, #fff 10%, ${color} 40%, transparent 70%)` }} />
          <div className="pack-clash-ring absolute left-1/2 top-1/2 size-40 rounded-full border-4" style={{ borderColor: color, boxShadow: `0 0 30px ${color}` }} />
          <Burst color={color} rainbow={rainbowy(star.to)} count={top(star.to) ? 70 : 44} />
        </>
      )}
    </div>
  );
}

/** The black hole: a disc of darkness ringed with light, bending what's behind it; it opens, then closes at `until` ms. */
function BlackHole({ until }: { until: number }) {
  return (
    <div className="pack-hole pointer-events-none absolute z-10" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, ['--hole-life' as string]: `${until + 600}ms` }} aria-hidden>
      <div className="pack-hole-lens" />
      <div className="pack-hole-disc" />
      <div className="pack-hole-core" />
    </div>
  );
}

/**
 * A star the black hole swallows: it flies at the hole, bends, shrinks and is gone; once every other star
 * has passed, it shoots back out of the hole the other way.
 */
function Swallowed({ star, thick, backAt }: { star: Star; thick: number; backAt: number }) {
  const width = `${top(star.to) ? 40 : 28}vw`;
  return (
    <div className="absolute inset-0">
      <div className="absolute h-0 w-0" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, transform: `rotate(${star.tilt}deg)` }}>
        <div className="pack-swallow absolute right-0 top-0 origin-right rounded-full" style={{ width, height: thick, animationDuration: `${SWALLOW_MS}ms`, animationDelay: `${star.delay}ms`, ...streak(star.to) }} />
      </div>
      <div className="absolute h-0 w-0" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, transform: `rotate(${-star.tilt - 8}deg)` }}>
        <div className="pack-emerge absolute left-0 top-0 rounded-full" style={{ width, height: thick + 2, animationDuration: `${EMERGE_MS}ms`, animationDelay: `${backAt}ms`, ...streak(star.to) }} />
      </div>
    </div>
  );
}

/** The choice for a card back from the black hole: keep its anomaly, or let it be. */
function AnomalyChoice({ anomaly, kept, onDecide, compact }: { anomaly: AnomalyId; kept?: boolean; onDecide: (keep: boolean) => void; compact?: boolean }) {
  const a = ANOMALIES[anomaly];
  if (kept !== undefined)
    return <p className="animate-pop text-center text-xs font-bold tracking-widest text-white/70">{kept ? `${a.icon} ${a.name.toUpperCase()} — KEPT` : 'LEFT AS IT WAS'}</p>;
  return (
    <div className={`animate-pop mx-auto space-y-2 rounded-md border border-[#a78bfa]/60 bg-[#1b1530]/90 text-center text-white ${compact ? 'mt-2 p-2' : 'max-w-sm p-3'}`}>
      <p className={`font-display font-bold tracking-widest ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {a.icon} {a.name.toUpperCase()}
      </p>
      {!compact && <p className="text-xs text-white/75">This card came back from the black hole changed. {a.blurb} Keep it that way?</p>}
      <div className="flex justify-center gap-2">
        <button type="button" onClick={(e) => (e.stopPropagation(), onDecide(true))} className={`rounded-md bg-[#a78bfa] font-display font-bold text-[#1b1530] ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'}`}>
          Keep it
        </button>
        <button type="button" onClick={(e) => (e.stopPropagation(), onDecide(false))} className={`rounded-md border border-white/40 font-display font-bold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'}`}>
          Leave it
        </button>
      </div>
    </div>
  );
}

/** Light rays turning behind a card (epic and up; a mythic's in rainbow). */
function Rays({ color, strong, rainbow }: { color: string; strong: boolean; rainbow?: boolean }) {
  return (
    <div
      className="pack-rays pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[220%] rounded-full"
      style={{
        background: rainbow
          ? `repeating-conic-gradient(from 0deg, #ff4fd877 0deg 6deg, transparent 6deg 12deg, #ffcd3c77 12deg 18deg, transparent 18deg 24deg, #3cc7ff77 24deg 30deg, transparent 30deg 36deg)`
          : `repeating-conic-gradient(from 0deg, ${color}${strong ? '66' : '33'} 0deg 8deg, transparent 8deg 24deg)`,
        maskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
        WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
      }}
      aria-hidden
    />
  );
}

/**
 * Opening a pack, in four beats: swipe across the pack to tear it (light pours out, in the colour of
 * the best card inside — or of the rarity it poses as, when its star is about to evolve), a shooting star crosses the screen per card, the cards come one at a time from
 * the deck — rarer ones charge up before they turn, then burst — and the five are laid out together.
 */
export function PackOpening({ pack, cards, fresh, onClose, onAgain, canAgain }: { pack: Pack; cards: Card[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean }) {
  const counts = useProgress((s) => s.cards);
  const best = cards.reduce<Rarity>((b, c) => (RARITIES.indexOf(c.rarity) > RARITIES.indexOf(b) ? c.rarity : b), 'common');
  const light = RARITY_LIGHT[best];
  // The shooting stars, drawn once per pack (the cards come sorted, the rarest last).
  const stars = useMemo(() => starsFor(cards), [cards]);
  // A black hole, now and then, and the stars it swallows: their cards come last, with an anomaly to keep or not.
  const cosmos = useMemo(() => cosmosFor(stars), [stars]);
  const deck = useMemo(() => [...cards.filter((_, k) => !cosmos.swallowed.has(k)), ...cards.filter((_, k) => cosmos.swallowed.has(k))], [cards, cosmos]);
  /** The anomaly each card of the deck came back with (by its place in the deck), and what the player said. */
  const pending = useMemo(() => {
    const m = new Map<number, AnomalyId>();
    const back = [...cosmos.swallowed.entries()];
    back.forEach(([, a], j) => m.set(deck.length - back.length + j, a));
    return m;
  }, [cosmos, deck]);
  const [kept, setKept] = useState<Record<number, boolean>>({});
  const setAnomaly = useProgress((s) => s.setAnomaly);
  const decide = (k: number, keep: boolean) => {
    const a = pending.get(k);
    if (!a || k in kept) return;
    setKept((x) => ({ ...x, [k]: keep }));
    if (keep) (setAnomaly(deck[k].id, a), sfx.streak());
    else sfx.click();
  };
  // When the swallowed stars come back: after every other star (and the last one's pause), one after another.
  const normalEnd = Math.max(0, ...stars.map((s, k) => (cosmos.swallowed.has(k) ? 0 : s.delay + s.duration)));
  const emergeAt = (j: number) => normalEnd + 700 + j * EMERGE_GAP;
  // The tear glows in the colour of the best card inside — or, when its star is going to evolve, of the
  // rarity it pretends to be until then (an Epic about to become Legendary tears open purple).
  const tease = stars.find((s) => s.from !== s.to);
  const shownBest = tease && cards.filter((c) => c.rarity === best).length === 1 ? tease.from : best;
  const glow = RARITY_LIGHT[shownBest];
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState<number | null>(null);
  const [tear, setTear] = useState(0);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [charging, setCharging] = useState(false);
  const [flash, setFlash] = useState<{ color: string; key: number; rainbow?: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const card = deck[i];
  // ── Tearing ─────────────────────────────────────────────────────────
  const torn = () => {
    if (phase !== 'pack') return;
    sfx.tear();
    setTear(1);
    setPhase('torn');
    later(() => {
      if (reducedMotion()) return toReveal();
      setPhase('meteor');
      // A star a card: each its own whoosh, the rarest the long one; an evolving star chimes as it changes.
      // The black hole: it opens with a hum as the first star flies.
      if (cosmos.hole) later(() => (sfx.blackHole(), rumble(box.current, 1800, 0.3, 3)), 0);
      const back = [...cosmos.swallowed.keys()];
      back.forEach((k, j) => {
        later(() => (sfx.swallow(), shake(box.current, 6, 400)), stars[k].delay + SWALLOW_MS - 200);
        later(() => (sfx.meteor(true), shake(box.current, 10, 500)), emergeAt(j));
      });
      stars.forEach((s, k) => {
        if (cosmos.swallowed.has(k)) return;
        later(() => (k === stars.length - 1 ? sfx.meteor(top(best)) : sfx.whoosh()), s.delay);
        // An evolving star: the crash, a hard shake and the burst in its new colour.
        if (s.from !== s.to)
          later(() => {
            sfx.clash();
            sfx.shimmer(5);
            shake(box.current, 14, 520);
            setFlash({ color: RARITY_LIGHT[s.to], key: Date.now(), rainbow: rainbowy(s.to) });
          }, s.delay + CLASH_AT);
      });
      // The wait before the last star: the screen trembles, harder and harder, to a quiet rising drone.
      if (stars.length > 1) {
        const wait = stars[stars.length - 1].delay - LAST_STAR_PAUSE;
        later(() => (rumble(box.current, LAST_STAR_PAUSE, 0.5, 7), sfx.suspense(LAST_STAR_PAUSE / 1000)), wait);
      }
      const end = Math.max(normalEnd, ...back.map((_, j) => emergeAt(j) + EMERGE_MS));
      later(() => setFlash({ color: PACK_LIGHT, key: Date.now() }), end - 100);
      later(toReveal, end + 300);
    }, 950);
  };
  /** A tap instead of a swipe: the pack tears by itself, quickly. */
  const autoTear = () => {
    let p = 0;
    const id = window.setInterval(() => {
      p += 0.12;
      setTear(Math.min(1, p));
      if (p >= 1) (window.clearInterval(id), torn());
    }, 30);
    timers.current.push(id);
  };
  const progressAt = (clientX: number) => {
    const r = packRef.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'pack') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || phase !== 'pack') return;
    if (Math.abs(e.clientX - d.x) > 8) d.moved = true;
    if (!d.moved) return;
    // The tear follows the finger, from whichever side it started.
    const p = Math.abs(progressAt(e.clientX) - progressAt(d.x));
    if (p > tear + 0.08) sfx.tick();
    setTear((t) => Math.max(t, p));
    if (p >= TEAR_ENOUGH) ((drag.current = null), torn());
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (phase !== 'pack') return;
    if (!d?.moved) autoTear();
  };

  // ── Revealing ───────────────────────────────────────────────────────
  const toReveal = () => {
    setPhase('reveal');
    setI(0);
    setFlipped(false);
    cue(deck[0]);
  };
  /** A card arriving on top of the deck: rarer ones hum. */
  const cue = (c: Card | undefined) => {
    if (!c) return;
    if (c.rarity === 'omni') sfx.shimmer(16);
    else if (c.rarity === 'mythic') sfx.shimmer(12);
    else if (c.rarity === 'legendary') sfx.shimmer(8);
    else if (c.rarity === 'epic') sfx.shimmer(5);
    else if (c.rarity === 'rare') sfx.shimmer(3);
  };
  const turn = () => {
    const c = card;
    const go = () => {
      setCharging(false);
      setFlipped(true);
      if (reducedMotion()) return;
      setFlash({ color: RARITY_LIGHT[c.rarity], key: Date.now(), rainbow: rainbowy(c.rarity) });
      if (c.rarity === 'omni') {
        // The rarest pull of all: three showers, the strongest shake.
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 800);
        later(() => (celebrateBig(), sfx.victory()), 1700);
        // Then the legend speaks, once the fanfare has passed.
        if (c.voice) later(() => playVoice(c), 2400);
        shake(box.current, 22, 1000);
      } else if (c.rarity === 'mythic') {
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 900);
        if (c.voice) later(() => playVoice(c), 1300);
        shake(box.current, 18, 800);
      } else if (c.rarity === 'legendary') (sfx.victory(), celebrateBig(), shake(box.current, 14, 600));
      else if (c.rarity === 'epic') (sfx.streak(), celebrate(), shake(box.current, 6, 300));
      else if (c.rarity === 'rare') sfx.correct();
      else sfx.pop();
    };
    // A mythic takes a long breath, every colour running through it; a legendary a shorter one.
    if (c.rarity === 'omni' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(20);
      later(go, 2200);
    } else if (c.rarity === 'mythic' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(16);
      later(go, 1500);
    } else if (c.rarity === 'legendary' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(10);
      later(go, 900);
    } else if (c.rarity === 'epic' && !reducedMotion()) {
      setCharging(true);
      later(go, 380);
    } else go();
  };
  /** One of the three: the others drop away, the chosen one comes forward to be torn. */
  const choose = (k: number) => {
    if (phase !== 'choose' || chosen !== null) return;
    setChosen(k);
    sfx.select();
    sfx.shimmer(3);
    later(() => setPhase('pack'), 650);
  };

  const act = () => {
    if (phase === 'choose') return choose(1);
    if (phase === 'pack') return autoTear();
    if (phase !== 'reveal' || charging) return;
    if (!flipped) return turn();
    // A card back from the black hole waits for the player's choice.
    if (pending.has(i) && !(i in kept)) return;
    if (i + 1 >= deck.length) return setPhase('summary');
    sfx.whoosh();
    setI(i + 1);
    setFlipped(false);
    cue(deck[i + 1]);
  };
  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setCharging(false);
    setPhase('summary');
    if (deck.some((c) => top(c.rarity))) celebrateBig();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return phase === 'summary' ? onClose() : skip();
      if (phase === 'choose' && /^[1-3]$/.test(e.key)) return choose(Number(e.key) - 1);
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (phase === 'summary') onClose();
      else act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Keep the page behind still while the pack is open: only the overlay scrolls.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const style = card ? RARITY_STYLE[card.rarity] : null;
  const big = card && (card.rarity === 'epic' || top(card.rarity));
  return (
    // The summary of five packs is taller than the screen: it scrolls inside the overlay (the page behind stays still).
    <div ref={box} className={`fixed inset-0 z-50 bg-[#07060c]/90 p-4 backdrop-blur-sm ${phase === 'summary' ? 'flex justify-center overflow-y-auto' : 'grid place-items-center overflow-hidden'}`} style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${phase === 'pack' ? '#1e1b4b66' : `${phase === 'summary' ? light : phase === 'reveal' && flipped && card ? RARITY_LIGHT[card.rarity] : phase === 'torn' || phase === 'meteor' ? glow : PACK_LIGHT}22`}, transparent 60%)` }}>
      {phase !== 'summary' && (
        <button type="button" onClick={skip} className="absolute right-4 top-4 z-30 rounded-full border border-white/30 px-3 py-1 text-xs font-bold tracking-widest text-white/80 hover:bg-white/10">
          SKIP ⏭
        </button>
      )}
      {flash && <div key={flash.key} className="pack-flash pointer-events-none fixed inset-0 z-40" style={{ background: flash.rainbow ? `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 85%)` : `radial-gradient(circle, #fff, ${flash.color} 45%, transparent 80%)` }} />}

      {/* 0. Three packs: pick one. */}
      {phase === 'choose' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          <p className="font-display text-sm font-bold tracking-[0.35em] text-white/80">CHOOSE YOUR PACK</p>
          <div className="flex items-end justify-center gap-3 sm:gap-8">
            {LINEUP.map((l, k) => (
              <button
                key={k}
                type="button"
                onClick={() => choose(k)}
                aria-label={`Pack ${k + 1}`}
                className={`w-24 transition-all duration-500 sm:w-40 ${chosen === null ? 'hover:-translate-y-3 hover:scale-105' : chosen === k ? 'pack-pick' : 'pack-pass'}`}
                style={{ filter: l.filter, ['--tilt' as string]: `${l.tilt}deg`, animationDelay: chosen === null ? `${k * 0.4}s` : undefined }}
              >
                <div className={chosen === null ? 'pack-float' : ''} style={{ animationDelay: `${k * -1}s` }}>
                  <div style={{ transform: `rotate(${l.tilt}deg)` }}>
                    <PackArt pack={pack} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center font-display text-xs font-bold tracking-widest text-white/50">TAP ONE · OR PRESS 1, 2, 3</p>
        </div>
      )}

      {/* 1. The pack: swipe across its top to tear it. */}
      {(phase === 'pack' || phase === 'torn') && (
        <div className="flex flex-col items-center gap-6">
          <div
            ref={packRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (drag.current = null)}
            className={`relative w-56 cursor-grab touch-none select-none sm:w-64 ${phase === 'pack' ? 'pack-float' : ''}`}
            style={phase === 'pack' && tear > 0 ? { filter: `drop-shadow(0 0 ${8 + tear * 30}px ${glow})` } : undefined}
            role="button"
            aria-label="Swipe across the pack, or tap it, to tear it open"
          >
            {/* The light inside, pouring out of the tear. */}
            {phase === 'torn' && (
              <div
                className="pack-beam pointer-events-none absolute left-1/2 w-[150%]"
                style={{ bottom: `${100 - TEAR_AT}%`, height: '70vh', background: `linear-gradient(to top, ${glow}, ${glow}55 30%, transparent 85%)`, clipPath: 'polygon(30% 100%, 70% 100%, 100% 0, 0 0)' }}
                aria-hidden
              />
            )}
            <div style={{ clipPath: `inset(${TEAR_AT}% 0 0 0)` }} className={phase === 'torn' ? 'pack-glow' : ''}>
              <PackArt pack={pack} />
            </div>
            <div className={`absolute inset-0 ${phase === 'torn' ? 'pack-flap' : ''}`} style={{ clipPath: `inset(0 0 ${100 - TEAR_AT}% 0)`, transform: phase === 'pack' ? `rotate(${-tear * 6}deg) translateY(${-tear * 6}px)` : undefined, transformOrigin: '100% 100%' }}>
              <PackArt pack={pack} />
            </div>
            {/* The tear, glowing along the cut. */}
            {phase === 'pack' && (
              <div className="pointer-events-none absolute left-0 h-[3px] rounded-full" style={{ top: `${TEAR_AT}%`, width: `${tear * 100}%`, background: '#fff', boxShadow: `0 0 10px #fff, 0 0 22px ${glow}` }} />
            )}
            {phase === 'pack' && tear === 0 && (
              <div className="pack-hint pointer-events-none absolute left-[8%] font-display text-2xl text-white drop-shadow" style={{ top: `calc(${TEAR_AT}% - 1.2rem)` }}>
                ✂
              </div>
            )}
          </div>
          {phase === 'pack' && <p className="animate-pulse text-center font-display text-sm font-bold tracking-widest text-white/90">SWIPE ACROSS THE TOP TO TEAR · OR TAP</p>}
        </div>
      )}

      {/* 2. The shooting stars: one per card, in its colour, the rarest last — now and then one crashes into another and evolves. */}
      {phase === 'meteor' && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          {cosmos.hole && <BlackHole until={Math.max(normalEnd, ...[...cosmos.swallowed.keys()].map((_, j) => emergeAt(j) + 400))} />}
          {[...cosmos.swallowed.keys()].map((k, j) => (
            <Swallowed key={`sw${k}`} star={stars[k]} thick={top(stars[k].to) ? 7 : RARITIES.indexOf(stars[k].to) >= 2 ? 5 : 3} backAt={emergeAt(j)} />
          ))}
          {stars.map((s, k) => {
            if (cosmos.swallowed.has(k)) return null;
            const thick = top(s.to) ? 7 : RARITIES.indexOf(s.to) >= 2 ? 5 : 3;
            // An evolving star crashes into another and bursts in its true colour.
            if (s.from !== s.to) return <Clash key={k} star={s} thick={thick} />;
            return (
              <div key={k} className="absolute left-0 w-full" style={{ top: `${s.top}%`, transform: `rotate(${s.tilt}deg)` }}>
                <div className="pack-meteor relative rounded-full" style={{ animationDuration: `${s.duration}ms`, animationDelay: `${s.delay}ms`, width: `${top(s.to) ? 45 : 30}vw`, height: thick, transform: 'translateX(-60vw)' }}>
                  <div className="absolute inset-0 rounded-full" style={streak(s.to)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. One card at a time from the deck. */}
      {phase === 'reveal' && card && style && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-5">
          <p className="font-display text-xs font-bold tracking-[0.35em] text-white/60">
            {pending.has(i) ? 'BACK FROM THE BLACK HOLE · ' : ''}CARD {i + 1} OF {deck.length}
          </p>
          <button type="button" onClick={act} className="relative isolate w-52 outline-none sm:w-60" aria-label={flipped ? `${card.name} — next` : 'Turn the card'}>
            {/* The rest of the deck, underneath. */}
            {Array.from({ length: Math.min(3, deck.length - i - 1) }, (_, k) => (
              <div key={k} className="absolute inset-0 opacity-70" style={{ transform: `translate(${(k + 1) * 6}px, ${(k + 1) * 6}px)`, zIndex: -1 - k }}>
                <CardBack />
              </div>
            ))}
            {big && <Rays color={RARITY_LIGHT[card.rarity]} strong={top(card.rarity) && (charging || flipped)} rainbow={rainbowy(card.rarity)} />}
            <div key={i} className="pack-card-in [perspective:1100px]">
              <div className={`relative transition-transform ${flipped ? 'duration-700 [transform:rotateY(180deg)]' : 'duration-300'} [transform-style:preserve-3d] ${charging ? (card.rarity === 'mythic' ? 'pack-charge-strong pack-charge-prism' : card.rarity === 'omni' || card.rarity === 'legendary' ? 'pack-charge-strong' : 'pack-charge') : ''}`}>
                <div className="[backface-visibility:hidden]">
                  <CardBack rarity={card.rarity === 'common' ? undefined : card.rarity} />
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <CardFace card={card} count={counts[card.id]} isNew={fresh.has(card.id)} animate anomaly={pending.has(i) && kept[i] !== false ? pending.get(i) : undefined} />
                </div>
              </div>
            </div>
            {flipped && !reducedMotion() && <Burst key={`b${i}`} color={RARITY_LIGHT[card.rarity]} rainbow={rainbowy(card.rarity)} count={card.rarity === 'omni' ? 100 : card.rarity === 'mythic' ? 70 : card.rarity === 'legendary' ? 46 : card.rarity === 'epic' ? 32 : card.rarity === 'rare' ? 18 : 10} />}
            {flipped && fresh.has(card.id) && <span className="pack-stamp absolute -right-6 top-6 z-30 rounded-md border-4 border-coral px-2 py-0.5 font-display text-xl font-black tracking-widest text-coral">NEW!</span>}
          </button>
          <div className="min-h-14 text-center">
            {flipped ? (
              <div className="animate-pop">
                <p className={`font-display text-sm font-bold tracking-[0.35em] ${card.rarity === 'omni' ? 'card-omni-name text-lg' : card.rarity === 'mythic' ? 'card-mythic-name text-base' : ''}`} style={prismatic(card.rarity) ? undefined : { color: RARITY_LIGHT[card.rarity] }}>
                  {pending.get(i) === 'fake' && kept[i] !== false
                    ? `◈ ${fakeTag(card.id).toUpperCase()} ◈`
                    : card.rarity === 'omni' ? '✪ OMNI ✪' : card.rarity === 'mythic' ? '✦ MYTHIC ✦' : card.rarity === 'legendary' ? '★ LEGENDARY ★' : RARITY_INFO[card.rarity].name.toUpperCase()}
                </p>
                {card.title && <p className="text-sm italic text-white/80">{card.title}</p>}
                <p className="font-serif text-2xl font-bold text-white">{shownName(card.name, card.set)}</p>
              </div>
            ) : (
              <p className="font-display text-sm font-bold tracking-widest text-white/70">{charging ? '…' : 'TAP TO TURN'}</p>
            )}
          </div>
          {/* Back from the black hole: keep its anomaly, or let the card be. */}
          {flipped && pending.has(i) && <AnomalyChoice anomaly={pending.get(i)!} kept={kept[i]} onDecide={(keep) => decide(i, keep)} />}
          {/* The tray: the cards already turned. */}
          <div className="flex h-20 items-end justify-center gap-2">
            {deck.slice(0, flipped ? i + 1 : i).map((c, k) => (
              <div key={k} className="pack-tray-in w-12 sm:w-14" style={{ filter: `drop-shadow(0 0 6px ${RARITY_LIGHT[c.rarity]}88)` }}>
                <CardFace card={c} tilt={false} anomaly={pending.has(k) && kept[k] !== false ? pending.get(k) : undefined} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. All five together. */}
      {phase === 'summary' && (
        <div className="my-auto w-full max-w-4xl space-y-6 py-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {deck.map((c, k) => (
              <div key={k} className="animate-card-deal" style={{ animationDelay: `${Math.min(k, 12) * 90 + Math.max(0, k - 12) * 30}ms`, ['--deal-rot' as string]: `${((k % 5) - 2) * 6}deg` }}>
                <CardFace card={c} count={counts[c.id]} isNew={fresh.has(c.id)} hoverHero anomaly={pending.has(k) && kept[k] !== false ? pending.get(k) : undefined} />
                {pending.has(k) && !(k in kept) && <AnomalyChoice compact anomaly={pending.get(k)!} onDecide={(keep) => decide(k, keep)} />}
                <p className="mt-2 text-center font-display text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_STYLE[c.rarity].text }}>
                  {pending.get(k) === 'fake' && kept[k] !== false ? fakeTag(c.id) : RARITY_INFO[c.rarity].name}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {canAgain && (
              <button type="button" onClick={onAgain} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Open another · <Coins n={pack.cost} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-paper rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
