import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig, rumble, shake } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx, type TearSound } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardBack, CardFace, RARITY_STYLE } from './CardView';
import { COLLECTIBLE, RARITIES, RARITY_INFO, RARITY_LIGHT, SETS, type Card, type Rarity } from './cards';
import { PackArt } from './PackArt';
import { playVoice } from './voice';
import { ABSORB_CHANCE, ANOMALIES, ANOMALY_IDS, BLACK_HOLE_CHANCE, rollAnomaly, type AnomalyId } from './anomalies';
import { clampGolden, clampPity, COSMIC, GOLDEN, goldenNext, PITY_MAX, pityLuck, type CosmicEvent, type CosmicKind, type Pack } from './packs';

/** Where the pack tears: this far down its height. */
const TEAR_AT = 18;
/** The share of the width a swipe has to cross to tear the pack. */
const TEAR_ENOUGH = 0.8;
/** The tear's teeth across the pack, and how far up and down of TEAR_AT they bite (% of its height). */
const TEETH = 18;
/** The breath the pack holds once torn far enough, before it gives (ms). */
const HOLD_MS = 240;
/** A finger this fast (px per ms) rips at full volume. */
const FAST_SWIPE = 1.4;

/** The jagged line of the tear, as [x%, y%] points left to right (a little different every pack). */
function tearLine(): [number, number][] {
  return Array.from({ length: TEETH + 1 }, (_, k) => [(k / TEETH) * 100, TEAR_AT + (k % 2 ? 1.4 : -1.1) + (Math.random() - 0.5) * 1.2]);
}
const pts = (line: [number, number][]) => line.map(([x, y]) => `${x}% ${y}%`).join(', ');
/** A phone buzzes along (where it can): a few ms a pulse. */
const buzz = (pattern: number | number[]) => {
  try {
    if (!reducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    // No vibration here.
  }
};

/** A spark flying off the tear where the finger is, in the best card's colour. */
interface TearSpark {
  id: number;
  x: number;
  dx: number;
  dy: number;
  size: number;
}

type Phase = 'choose' | 'pack' | 'torn' | 'meteor' | 'reveal' | 'summary';

/** The three packs to choose from: the same pack, each tinted and tilted a little differently. */
const LINEUP = [
  { filter: 'hue-rotate(-22deg) saturate(1.1)', tilt: -7 },
  { filter: 'none', tilt: 0 },
  { filter: 'hue-rotate(22deg) saturate(1.1)', tilt: 7 },
];

/** The pack's own light before it's torn, and the flash as the cards come (the tear itself glows in the best card's colour). */
const PACK_LIGHT = '#c4b5fd';
/** A golden pack's light. */
const GOLDEN_LIGHT = '#fbbf24';
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
  /** A cosmic event its card went through (rolled at the pull: two planets embracing, a supernova, a Big Bang). */
  event?: CosmicKind;
  /** The sky holds its breath before it (the best card's star, and every cosmic event). */
  climax?: boolean;
}
/**
 * How often a pack plays a fake-out: its best card, when Epic or better, poses as one rarity lower — its
 * star shows Rare for an Epic, Epic for a Legendary… — until it evolves mid-flight.
 */
const EVOLVE_CHANCE = 0.3;
const STAR_GAP = 260;
/** The beat of suspense before the last star (the best card's), once every other star has crossed: evolving or not. The screen rumbles meanwhile. */
const LAST_STAR_PAUSE = 1500;
/**
 * An evolving star doesn't cross: it and a second star rush in from both sides, crash together in the
 * middle after CLASH_AT ms and burst in the colour of the rarity it becomes (BOOM ms of sparks).
 */
const CLASH_AT = 820;
const BOOM = 850;
/** How long each cosmic event plays (ms), and when, in it, the card's new colour bursts out. */
/**
 * A wish plays where its star is, among the others: the star crosses in WISH_MS, the golden comet catches it
 * WISH_BOOM ms in, where its head is then (WISH_HIT, in vw along its way: it goes from -30vw to 130vw, 24vw long).
 */
const WISH_MS = 2200;
const WISH_BOOM = 1000;
const WISH_HIT = -30 + (160 * WISH_BOOM) / WISH_MS + 24;
const COSMIC_MS: Record<CosmicKind, number> = { wish: WISH_MS, collision: 4200, supernova: 5000, bigbang: 5800 };
const COSMIC_BOOM: Record<CosmicKind, number> = { wish: WISH_BOOM, collision: 2900, supernova: 3300, bigbang: 3500 };
const COSMIC_NAME: Record<CosmicKind, { icon: string; name: string }> = {
  wish: { icon: '🌠', name: 'A WISH COMES TRUE' },
  collision: { icon: '🪐', name: 'TWO PLANETS EMBRACE' },
  supernova: { icon: '💥', name: 'SUPERNOVA' },
  bigbang: { icon: '🌌', name: 'BIG BANG' },
};
/** What each event did, said under the card. */
const COSMIC_DONE: Record<CosmicKind, string> = {
  wish: 'A wish came true',
  collision: 'Two planets embraced',
  supernova: 'Reborn from a supernova',
  bigbang: 'Born in the Big Bang',
};
/** The order the events play in, the greatest last. */
const COSMIC_KINDS_ORDER: CosmicKind[] = ['wish', 'collision', 'supernova', 'bigbang'];
/** When a star shows its true colour (ms from the meteor phase's start): its crash, wish or cosmic burst; null if it never changes. */
const boomOf = (s: Star) => (s.from === s.to ? null : s.event ? s.delay + COSMIC_BOOM[s.event] : s.delay + CLASH_AT);
const flight = (r: Rarity) => (prismatic(r) ? 1400 : r === 'legendary' ? 1100 : 850);

/** Legendary and up: the card spins as it charges, faster and faster — turns in the charge's time (see turn()). */
const SPIN: Partial<Record<Rarity, React.CSSProperties>> = {
  legendary: { ['--turns' as string]: 5, animationDuration: '2000ms' },
  mythic: { ['--turns' as string]: 6, animationDuration: '2100ms' },
  omni: { ['--turns' as string]: 7, animationDuration: '2300ms' },
};

/** Where the black hole opens: the middle of the screen (%). */
const HOLE = { x: 50, y: 45 };
/** With a black hole: each star's way in from the left, round the hole and out to the right (or into it), and the gap between stars (ms). */
const ORBIT_MS = 3000;
const ORBIT_GAP = 420;

/**
 * Now and then (BLACK_HOLE_CHANCE, 5%) a black hole opens in the middle of the screen: the stars come in from
 * the left as ever, but circle round it; after a while, those it doesn't keep fly on to the right, and the ones
 * it pulls in (ABSORB_CHANCE each; never the last star, the best card's) vanish into it in a spark. Then the
 * last star comes as usual (evolving or not). A swallowed star's card comes last, with an anomaly to keep or not.
 * For testing, in dev only, localStorage "omnidle-force-anomaly" = "1" (or "corrupted", "fake") opens one every time and swallows a star.
 */
function cosmosFor(cards: Card[], events: Map<number, CosmicEvent>, wishes: Map<number, CosmicEvent>, rand: () => number = Math.random): { hole: boolean; stars: Star[]; swallowed: Map<number, AnomalyId> } {
  let force: string | null = null;
  try {
    // Dev only: the live site ignores it (anomalies are kept, so it would be a cheat).
    if (import.meta.env.DEV) force = localStorage.getItem('omnidle-force-anomaly');
  } catch {
    // No storage: chance alone.
  }
  // "1": a black hole and a swallowed star; or the name of an anomaly, to get that one.
  const forced = force === '1' || (ANOMALY_IDS as string[]).includes(force ?? '');
  const roll = () => ((ANOMALY_IDS as string[]).includes(force ?? '') ? (force as AnomalyId) : rollAnomaly(rand));
  const regular = cards.length - events.size;
  const hole = regular > 1 && (forced || rand() < BLACK_HOLE_CHANCE);
  const stars = starsFor(cards, hole, events, wishes, rand);
  const swallowed = new Map<number, AnomalyId>();
  if (!hole) return { hole, stars, swallowed };
  // Never the last ordinary star (the best card's), a wish's, nor a cosmic event's.
  const candidates = stars.slice(0, regular - 1).map((_, k) => k).filter((k) => !wishes.has(k));
  for (const k of candidates) if (rand() < ABSORB_CHANCE) swallowed.set(k, roll());
  if (forced && !swallowed.size && candidates.length) swallowed.set(candidates[Math.floor(rand() * candidates.length)], roll());
  return { hole, stars, swallowed };
}

function starsFor(cards: Card[], hole: boolean, events: Map<number, CosmicEvent>, wishes: Map<number, CosmicEvent>, rand: () => number = Math.random): Star[] {
  // Now and then the best card (Epic or better: the smallest fake-out is Rare → Epic) shows a rarity lower,
  // and evolves on the way. The cards come sorted, the best last — then the cosmic events' cards, each its own scene.
  const last = cards.length - events.size - 1;
  const evolving = last >= 0 && RARITIES.indexOf(cards[last].rarity) >= 2 && rand() < EVOLVE_CHANCE ? last : -1;
  let at = 0;
  let clear = 0;
  return cards.map((c, i) => {
    const ev = events.get(i);
    if (ev) {
      // A cosmic event: once the sky is empty, a breath, then its scene (the star first in the card's old colour).
      const delay = Math.max(at, clear) + LAST_STAR_PAUSE;
      const star: Star = { to: c.rarity, from: ev.from.rarity, delay, duration: COSMIC_MS[ev.kind], top: 40, tilt: -12 - rand() * 10, event: ev.kind, climax: true };
      at = clear = delay + star.duration;
      return star;
    }
    const wish = wishes.get(i);
    if (wish) {
      // A wish: among the other stars, a little slower, caught by a golden comet on the way.
      const star: Star = { to: c.rarity, from: wish.from.rarity, delay: at, duration: WISH_MS, top: 16 + ((i * 37) % 48) + rand() * 6, tilt: -6 - rand() * 10, event: 'wish' };
      at += (cards.length > 5 ? STAR_GAP / 2.5 : STAR_GAP) + 500;
      clear = Math.max(clear, star.delay + star.duration);
      return star;
    }
    // The last star waits for the sky to empty, then a moment more.
    if (i === last && i > 0) at = Math.max(at, clear) + LAST_STAR_PAUSE;
    // An evolving star poses as a rarity lower — or, now and then, a Legendary or better as two lower
    // (a Legendary's pack tearing open blue).
    const rank = RARITIES.indexOf(c.rarity);
    const from = i === evolving ? RARITIES[rank >= 3 && rand() < COSMIC.deepFake ? rank - 2 : rank - 1] : c.rarity;
    // With a black hole, every star but the last circles it first: a longer way.
    const orbit = hole && i !== last;
    const star: Star = { to: c.rarity, from, delay: at, duration: from !== c.rarity ? CLASH_AT + BOOM : orbit ? ORBIT_MS : flight(c.rarity), top: 16 + ((i * 37) % 48) + rand() * 6, tilt: -10 - rand() * 16, climax: i === last && i > 0 };
    // Many cards (five packs at once): the stars come closer together.
    const gap = orbit ? ORBIT_GAP : STAR_GAP;
    at += (cards.length > 5 ? gap / 2.5 : gap) + (top(c.rarity) && !orbit ? 250 : 0);
    clear = Math.max(clear, star.delay + star.duration);
    return star;
  });
}
/**
 * The planet on the edge of the sky, drawn from what the pack shows (its stars' first colours, so a cosmic
 * event still comes as a surprise): an icy moon for a pack of Commons and Rares, a violet gas giant with a
 * ring for an Epic, a bigger one with a moon for two or more, a golden giant with two moons and sparkles for a
 * Legendary, and an iridescent world with double rings for a Mythic or better.
 */
type SkyTier = 0 | 1 | 2 | 3 | 4;
function skyTier(shown: Rarity[]): SkyTier {
  const rank = (r: Rarity) => RARITIES.indexOf(r);
  if (shown.some((r) => rank(r) >= rank('mythic'))) return 4;
  if (shown.some((r) => r === 'legendary')) return 3;
  const epics = shown.filter((r) => r === 'epic').length;
  return epics >= 2 ? 2 : epics === 1 ? 1 : 0;
}
const SKY: { size: number; light: string; base: string; dark: string; glow: string; bands?: string[]; ring?: string; rings?: number; moons: number; sparkle?: boolean; craters?: boolean; prism?: boolean }[] = [
  { size: 24, light: '#e0ecff', base: '#6b86b8', dark: '#0f1830', glow: 'rgba(96, 165, 250, 0.22)', moons: 0, craters: true },
  { size: 31, light: '#f3e8ff', base: '#8b5cf6', dark: '#1a0d40', glow: 'rgba(168, 85, 247, 0.35)', bands: ['#7c3aed', '#a78bfa', '#6d28d9', '#c4b5fd'], ring: 'rgba(216, 180, 254, 0.55)', moons: 0 },
  { size: 36, light: '#fae8ff', base: '#a855f7', dark: '#1e0b45', glow: 'rgba(192, 132, 252, 0.45)', bands: ['#9333ea', '#d8b4fe', '#7e22ce', '#f0abfc'], ring: 'rgba(240, 171, 252, 0.65)', moons: 1 },
  { size: 41, light: '#fffbe6', base: '#f59e0b', dark: '#3a1a02', glow: 'rgba(251, 191, 36, 0.5)', bands: ['#d97706', '#fde68a', '#b45309', '#fbbf24'], ring: 'rgba(253, 230, 138, 0.8)', moons: 2, sparkle: true },
  { size: 46, light: '#ffffff', base: '#ff4fd8', dark: '#1b0b30', glow: 'rgba(255, 79, 216, 0.45)', bands: ['#ff4fd8', '#ffcd3c', '#3cff9e', '#3cc7ff', '#a855f7'], ring: 'rgba(255, 255, 255, 0.8)', rings: 2, moons: 2, sparkle: true, prism: true },
];
/**
 * The planet on the edge of the sky. It changes as the pack shows better than it looked: each time a star
 * turns out rarer (a fake-out evolving, a wish, a cosmic event), a spark flies to the planet and it grows into
 * the next world, with a flash. With a sky moment "capture", it catches a passing moon and keeps it in orbit.
 */
function SkyPlanet({ tier, evolved, captureAt }: { tier: SkyTier; evolved: number; captureAt: number | null }) {
  const p = SKY[tier];
  const bands = p.bands && `repeating-linear-gradient(168deg, ${p.bands.map((c, k) => `${c} ${k * 7}% ${k * 7 + 5}%`).join(', ')}, ${p.bands[0]} ${p.bands.length * 7}%)`;
  const ring = (front: boolean, k: number) =>
    p.ring && (
      <div
        key={`${front}${k}`}
        className={`sky-ring ${front ? 'sky-ring-front' : ''}`}
        style={{ borderColor: p.prism ? undefined : p.ring, boxShadow: `0 0 ${2 + tier}vmin ${p.ring}`, ['--ring-scale' as string]: 1 + k * 0.22 }}
      />
    );
  return (
    <div className={`sky-planet sky-tier-${tier} absolute`} style={{ width: `${p.size}vmin`, height: `${p.size}vmin`, ['--glow' as string]: p.glow }} aria-hidden>
      {/* Redrawn whole at each evolution, in a flash. */}
      <div key={tier} className={`absolute inset-0 ${evolved ? 'sky-evolve' : ''}`}>
        {Array.from({ length: p.rings ?? (p.ring ? 1 : 0) }, (_, k) => ring(false, k))}
        <div className="sky-body" style={{ background: `radial-gradient(circle at 32% 30%, ${p.light} 0%, ${p.base} 30%, ${p.dark} 82%)` }}>
          {bands && <div className={`sky-bands ${p.prism ? 'sky-bands-prism' : ''}`} style={{ backgroundImage: bands }} />}
          {p.craters && <div className="sky-craters" />}
          <div className="sky-shade" />
          {p.prism && <div className="sky-aurora" />}
        </div>
        {Array.from({ length: p.rings ?? (p.ring ? 1 : 0) }, (_, k) => ring(true, k))}
        {Array.from({ length: p.moons }, (_, k) => (
          <div key={k} className="sky-moon" style={{ animationDuration: `${9 + k * 5}s`, animationDelay: `${-k * 4}s`, ['--moon' as string]: tier >= 3 ? '#fff4d1' : '#d9d2ff', width: `${3.4 - k * 0.9}vmin`, height: `${3.4 - k * 0.9}vmin` }} />
        ))}
        {p.sparkle &&
          [
            [-8, 20],
            [18, -6],
            [70, -10],
            [104, 30],
            [40, -14],
            [-12, 64],
          ].map(([x, y], k) => <span key={k} className="sky-sparkle" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${k * 0.37}s` }} />)}
        {evolved > 0 && <div className="sky-evolve-flash" />}
      </div>
      {/* A moon caught on its way past: in from the far sky, then round and round (it stays through evolutions). */}
      {captureAt !== null && <div className="sky-moon sky-captured" style={{ ['--moon' as string]: '#bfe3ff', width: '2.8vmin', height: '2.8vmin', animationDelay: `${captureAt}ms, ${captureAt + 2600}ms` }} />}
    </div>
  );
}

/** The sky's own moments, now and then: none of them changes a card, they're there to watch. */
type SkyMoment = 'comet' | 'shower' | 'capture';
const SKY_MOMENTS: SkyMoment[] = ['comet', 'shower', 'capture'];
/** For testing: localStorage "omnidle-force-sky" = "comet", "shower" or "capture". */
function skyMomentFor(rand: () => number = Math.random): SkyMoment | null {
  let force: string | null = null;
  try {
    force = localStorage.getItem('omnidle-force-sky');
  } catch {
    // No storage: chance alone.
  }
  if ((SKY_MOMENTS as string[]).includes(force ?? '')) return force as SkyMoment;
  return rand() < COSMIC.skyMoment ? SKY_MOMENTS[Math.floor(rand() * SKY_MOMENTS.length)] : null;
}

/** A great comet crossing the top of the sky, slow, its tail streaming behind. */
function Comet() {
  return (
    <div className="sky-comet-way absolute left-0 top-[14%] w-full">
      <div className="sky-comet">
        <div className="sky-comet-tail" />
        <div className="sky-comet-head" />
      </div>
    </div>
  );
}

/** A meteor shower: thin streaks falling all over the sky for a few seconds. */
function Shower() {
  const streaks = useMemo(() => Array.from({ length: 22 }, () => ({ x: 10 + Math.random() * 95, y: -5 + Math.random() * 45, delay: 300 + Math.random() * 2600, len: 6 + Math.random() * 10 })), []);
  return (
    <>
      {streaks.map((s, i) => (
        <span key={i} className="sky-shower absolute h-px rounded-full" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.len}vmin`, animationDelay: `${s.delay}ms` }} />
      ))}
    </>
  );
}

/**
 * Deep space behind the shooting stars: far stars twinkling at their own pace, a faint nebula drifting,
 * and a planet on the edge of the sky. Drawn once per pack; it only animates opacity and transform.
 */
function Space({ tier, evolved, feed, moment }: { tier: SkyTier; evolved: number; feed: number; moment: SkyMoment | null }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 110 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() < 0.12 ? 2.5 : Math.random() < 0.5 ? 1.5 : 1,
        color: ['#ffffff', '#ffffff', '#cfe0ff', '#ffe9c4', '#e0d0ff'][Math.floor(Math.random() * 5)],
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
      })),
    [],
  );
  return (
    <div className="pack-space pointer-events-none absolute inset-0" aria-hidden>
      <div className="pack-nebula absolute -inset-[15%]" />
      {dots.map((d, i) => (
        <span
          key={i}
          className="pack-far-star absolute rounded-full"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, background: d.color, boxShadow: d.size > 2 ? `0 0 6px ${d.color}` : undefined, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
        />
      ))}
      {moment === 'comet' && <Comet />}
      {moment === 'shower' && <Shower />}
      <SkyPlanet tier={tier} evolved={evolved} captureAt={moment === 'capture' ? 900 : null} />
      {/* The spark that flies from a star turning rarer to the planet, which grows with it. */}
      {feed > 0 && <span key={feed} className="sky-feed absolute" />}
    </div>
  );
}

/**
 * The quiet life behind the pack, its cards and the summary: dust rising, faint stars twinkling, now and then
 * a shooting star, and slow rays turning behind it all — tinted with whatever colour the moment has.
 */
function Ambient({ tint }: { tint: string }) {
  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, () => ({
        x: Math.random() * 100,
        size: 2 + Math.random() * 3,
        delay: -Math.random() * 14,
        duration: 9 + Math.random() * 8,
        sway: (Math.random() - 0.5) * 60,
        white: Math.random() < 0.4,
      })),
    [],
  );
  const stars = useMemo(() => Array.from({ length: 40 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, delay: Math.random() * 4, duration: 2 + Math.random() * 3 })), []);
  // Three shooting stars on long, out-of-step loops: one crosses every few seconds, never two at once.
  const shooting = useMemo(() => [0, 1, 2].map((k) => ({ x: 15 + Math.random() * 70, y: 5 + Math.random() * 35, delay: 1.5 + k * 3.7 + Math.random(), angle: 18 + Math.random() * 20 })), []);
  return (
    <div className="pack-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ ['--tint' as string]: tint }} aria-hidden>
      <div className="pack-ambient-rays absolute left-1/2 top-[40%] aspect-square w-[160vmax]" />
      {stars.map((s, i) => (
        <span key={`s${i}`} className="pack-far-star absolute size-px rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
      ))}
      {shooting.map((s, i) => (
        <span key={`t${i}`} className="pack-ambient-shoot absolute h-px w-32" style={{ left: `${s.x}%`, top: `${s.y}%`, rotate: `${s.angle}deg`, animationDelay: `${s.delay}s` }} />
      ))}
      {motes.map((m, i) => (
        <span
          key={`m${i}`}
          className="pack-mote absolute bottom-0 rounded-full"
          style={{ left: `${m.x}%`, width: m.size, height: m.size, background: m.white ? '#fff' : 'var(--tint)', boxShadow: '0 0 6px var(--tint)', animationDelay: `${m.delay}s`, animationDuration: `${m.duration}s`, ['--sway' as string]: `${m.sway}px` }}
        />
      ))}
    </div>
  );
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

/**
 * The black hole: a disc of darkness ringed with light, bending what's behind it. Hot dust spirals into it
 * (in the colours of the pack's stars), its disc streams across in front, a photon ring glows round its edge;
 * each star it swallows (at the times in `gulps`) makes it flare and spit two jets. It opens, then closes at `until` ms.
 */
function BlackHole({ until, gulps, tints }: { until: number; gulps: number[]; tints: string[] }) {
  const dust = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        angle: Math.random() * 360,
        r: 16 + Math.random() * 26,
        duration: 1.4 + Math.random() * 1.8,
        delay: -Math.random() * 3.2,
        size: 1.5 + Math.random() * 3,
        color: i % 3 ? (tints[i % tints.length] ?? '#fff') : '#ffd9a0',
      })),
    // Drawn once a pack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [gulp, setGulp] = useState(0);
  useEffect(() => {
    const ts = gulps.map((t) => window.setTimeout(() => setGulp((g) => g + 1), t));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [gulps]);
  return (
    <div className="pack-hole pointer-events-none absolute z-10" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, ['--hole-life' as string]: `${until + 600}ms` }} aria-hidden>
      <div className="pack-hole-glow" />
      <div className="pack-hole-lens" />
      <div className="pack-hole-disc" />
      <div className="pack-hole-band" />
      {dust.map((d, i) => (
        <div key={i} className="pack-hole-arm" style={{ rotate: `${d.angle}deg` }}>
          <span
            className="pack-hole-dust"
            style={{ width: d.size * 2.4, height: d.size, marginLeft: -d.size, marginTop: -d.size / 2, background: d.color, boxShadow: `0 0 ${d.size * 3}px ${d.color}`, ['--r' as string]: `${d.r}vmin`, animationDuration: `${d.duration}s`, animationDelay: `${d.delay}s` }}
          />
        </div>
      ))}
      <div className="pack-hole-core" />
      <div className="pack-hole-photon" />
      <div className="pack-hole-band pack-hole-band-front" />
      {gulp > 0 && (
        <div key={gulp}>
          <div className="pack-hole-flare" />
          <div className="pack-hole-jet" />
          <div className="pack-hole-jet pack-hole-jet-down" />
        </div>
      )}
    </div>
  );
}

/**
 * A star round the black hole: in from the left, a turn and a half around it, then out to the right — or,
 * pulled in, spiralling ever closer until it's gone in a spark. Its way is a path across the screen.
 */
function Orbiter({ star, k, thick, swallowed }: { star: Star; k: number; thick: number; swallowed: boolean }) {
  const path = useMemo(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = (W * HOLE.x) / 100;
    const cy = (H * HOLE.y) / 100;
    const r = Math.min(W, H) * (0.17 + (k % 5) * 0.035);
    const y0 = (H * star.top) / 100;
    const start = `M -120 ${y0} L ${cx - r} ${cy}`;
    if (!swallowed) return `${start} A ${r} ${r} 0 0 1 ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} L ${W + 160} ${cy + (y0 - cy) * 0.4}`;
    // Pulled in: half-turns ever closer, side to side, down to the middle.
    const xs = [-1, 0.75, -0.5, 0.3, -0.14, 0.05].map((f) => cx + f * r);
    const arcs = xs.slice(1).map((x, i) => `A ${Math.abs(x - xs[i]) / 2} ${Math.abs(x - xs[i]) / 2} 0 0 1 ${x} ${cy}`);
    return `${start} ${arcs.join(' ')} L ${cx} ${cy}`;
  }, [star, k, swallowed]);
  const [spark, setSpark] = useState(false);
  useEffect(() => {
    if (!swallowed) return;
    const t = window.setTimeout(() => setSpark(true), star.delay + star.duration - 80);
    return () => window.clearTimeout(t);
  }, [swallowed, star]);
  return (
    <>
      {/* Its afterglow, a beat behind on the same way, then the star itself (stretched thin as it's pulled in). */}
      {[110, 0].map((lag) => (
        <div
          key={lag}
          className={`${swallowed ? 'pack-orbit-in' : 'pack-orbit'} ${lag ? 'pack-orbit-ghost' : ''} absolute left-0 top-0 rounded-full`}
          style={{ width: (top(star.to) ? 90 : 64) * (lag ? 1.8 : 1), height: thick + 1, offsetPath: `path('${path}')`, offsetRotate: 'auto', animationDuration: `${star.duration}ms`, animationDelay: `${star.delay + lag}ms`, ...streak(star.to) }}
        />
      ))}
      {/* Swallowed: a spark where it went in. */}
      {spark && (
        <div className="absolute" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, width: 0, height: 0 }}>
          <div className="pack-spark-flash absolute size-16 rounded-full" style={{ background: `radial-gradient(circle, #fff, ${RARITY_LIGHT[star.to]} 45%, transparent 70%)` }} />
          <div className="absolute left-0 top-0">
            <Burst color={RARITY_LIGHT[star.to]} count={16} rainbow={rainbowy(star.to)} />
          </div>
        </div>
      )}
    </>
  );
}

/** A state that turns true `ms` after the scene mounts (the scenes count from the meteor phase's start). */
function useAt(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return on;
}

/** Specks rushing in from all around to the middle of the screen (the Big Bang's gathering; a supernova's feeding). */
function Converge({ colors, count, delay, spread }: { colors: string[]; count: number; delay: number; spread: number }) {
  const specks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = spread * (0.6 + Math.random() * 0.6);
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 2 + Math.random() * 4, delay: delay + Math.random() * 1600, color: colors[i % colors.length] };
      }),
    // Drawn once a scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <>
      {specks.map((p, i) => (
        <span key={i} className="pack-converge absolute rounded-full" style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 10px ${p.color}`, ['--dx' as string]: `${p.dx}vmin`, ['--dy' as string]: `${p.dy}vmin`, animationDelay: `${p.delay}ms` }} />
      ))}
    </>
  );
}

/** The name of a cosmic event across the top as it starts, and what it made of the card once it bursts. */
function CosmicTitle({ star, boom }: { star: Star; boom: boolean }) {
  const ev = COSMIC_NAME[star.event!];
  const on = useAt(star.delay);
  if (!on) return null;
  const name = (r: Rarity) => RARITY_INFO[r].name.toUpperCase();
  return (
    <div className="absolute inset-x-0 top-[9%] z-30 px-4 text-center">
      <p className="pack-cosmic-title font-display text-2xl font-black tracking-[0.3em] text-white sm:text-4xl">
        {ev.icon} {ev.name}
      </p>
      {boom && (
        <p className="pack-cosmic-result mt-2 font-display text-lg font-black tracking-[0.25em] sm:text-2xl">
          <span style={{ color: RARITY_LIGHT[star.from] }}>{name(star.from)}</span>
          <span className="text-white"> → </span>
          <span className={star.to === 'omni' ? 'card-omni-name' : star.to === 'mythic' ? 'card-mythic-name' : ''} style={prismatic(star.to) ? undefined : { color: RARITY_LIGHT[star.to] }}>
            {name(star.to)}
          </span>
        </p>
      )}
    </div>
  );
}

/** A planet, lit from the top left, in a colour (a ring round it if `ringed`). */
function Planet({ color, size, ringed }: { color: string; size: string; ringed?: boolean }) {
  return (
    <div className="absolute rounded-full" style={{ width: size, height: size, translate: '-50% -50%', background: `radial-gradient(circle at 32% 28%, #fff 0%, ${color} 22%, ${color}cc 45%, #120a24 88%)`, boxShadow: `0 0 40px ${color}aa, inset -8px -10px 24px #0008` }}>
      {ringed && <div className="pack-cosmic-ring absolute left-1/2 top-1/2 rounded-[50%] border-[3px]" style={{ borderColor: `${color}cc`, boxShadow: `0 0 16px ${color}` }} />}
    </div>
  );
}

/**
 * Two planets embrace: the card's star and another, as two planets in its old colour, are drawn together in a
 * tightening spiral, faster and faster, a halo growing between them — then meet, and one planet is born in the
 * rarity the card became, ringed and blazing.
 */
function Embrace({ star }: { star: Star }) {
  const boom = useAt(star.delay + COSMIC_BOOM.collision);
  const old = RARITY_LIGHT[star.from];
  const now = RARITY_LIGHT[star.to];
  const dance = { animationDuration: `${COSMIC_BOOM.collision}ms`, animationDelay: `${star.delay}ms` };
  return (
    <div className="absolute inset-0">
      <CosmicTitle star={star} boom={boom} />
      <div className="absolute left-1/2 top-[50%] h-0 w-0">
        {!boom && (
          <>
            <div className="pack-embrace-halo absolute left-0 top-0 rounded-full" style={{ ...dance, background: `radial-gradient(circle, #fff8, ${old}66 30%, transparent 70%)` }} />
            <div className="pack-embrace absolute left-0 top-0 h-0 w-0" style={dance}>
              {[1, -1].map((side) => (
                <div key={side} className="pack-embrace-arm absolute left-0 top-0 h-0 w-0" style={{ ...dance, ['--side' as string]: side }}>
                  <Planet color={old} size={side > 0 ? '12vmin' : '9vmin'} ringed={side > 0} />
                </div>
              ))}
            </div>
          </>
        )}
        {boom && (
          <>
            <div className="pack-clash-boom absolute left-0 top-0 size-60 rounded-full" style={{ background: `radial-gradient(circle, #fff 10%, ${now} 40%, transparent 70%)` }} />
            {[0, 160, 320].map((d) => (
              <div key={d} className="pack-shock absolute left-0 top-0 size-40 rounded-full border-4" style={{ borderColor: now, boxShadow: `0 0 30px ${now}`, animationDelay: `${d}ms` }} />
            ))}
            <div className="pack-planet-born absolute left-0 top-0 h-0 w-0" style={{ animationDuration: `${COSMIC_MS.collision - COSMIC_BOOM.collision}ms` }}>
              <Planet color={now} size="17vmin" ringed />
            </div>
            <Burst color={now} count={top(star.to) ? 80 : 56} />
          </>
        )}
      </div>
    </div>
  );
}

/** The card's star flying in from the left to the middle of the screen (fed to a supernova, or to the Big Bang). */
function Feed({ star, r }: { star: Star; r: Rarity }) {
  return (
    <div className="absolute left-0 top-[50%] w-1/2" style={{ transform: `rotate(${star.tilt * 0.4}deg)`, transformOrigin: '100% 50%' }}>
      <div className="pack-nova-feed relative ml-auto h-[7px] w-[35vw] rounded-full" style={{ animationDelay: `${star.delay}ms`, ...streak(r) }} />
    </div>
  );
}

/**
 * A supernova: a giant star burns in the middle; the card's star flies into it and is swallowed; the giant
 * swells, red and trembling, collapses to a point — and explodes in every colour, rings of light racing out,
 * a rainbow nebula left behind.
 */
function Supernova({ star }: { star: Star }) {
  const boom = useAt(star.delay + COSMIC_BOOM.supernova);
  const old = RARITY_LIGHT[star.from];
  const life = { animationDuration: `${COSMIC_BOOM.supernova}ms`, animationDelay: `${star.delay}ms` };
  return (
    <div className="absolute inset-0">
      <CosmicTitle star={star} boom={boom} />
      {!boom && <Feed star={star} r={star.from} />}
      <div className="absolute left-1/2 top-[50%] h-0 w-0">
        {!boom && (
          <>
            <div className="pack-nova-star absolute left-0 top-0 rounded-full" style={{ ...life, ['--fed' as string]: old }}>
              <div className="pack-nova-corona absolute -inset-[60%] rounded-full" />
            </div>
            <Converge colors={['#ffd27a', old, '#ff7a3c']} count={30} delay={star.delay + 1000} spread={40} />
          </>
        )}
        {boom && (
          <>
            <div className="pack-nova-nebula absolute left-0 top-0 rounded-full" />
            <div className="pack-clash-boom absolute left-0 top-0 size-72 rounded-full" style={{ background: `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 72%)` }} />
            {RAINBOW.slice(0, 4).map((c, k) => (
              <div key={c} className="pack-shock pack-shock-wide absolute left-0 top-0 size-40 rounded-full border-[6px]" style={{ borderColor: c, boxShadow: `0 0 40px ${c}`, animationDelay: `${k * 140}ms` }} />
            ))}
            <Burst color="#fff" rainbow count={100} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The Big Bang: the sky goes dark; the Legendary's star flies to the middle and shrinks to a single point while
 * every last speck of light is drawn into it; a breath of perfect stillness — then everything is born at once:
 * a white flash, a red and gold wave filling the screen, new stars flung out across a new sky.
 */
function BigBang({ star }: { star: Star }) {
  const boom = useAt(star.delay + COSMIC_BOOM.bigbang);
  const gold = RARITY_LIGHT.legendary;
  const newborn = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 70;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 1.5 + Math.random() * 3, delay: Math.random() * 300, color: ['#fff', '#ffcd3c', '#ff3b4e', '#ffe9c4'][i % 4] };
      }),
    [],
  );
  return (
    <div className="absolute inset-0">
      <div className="pack-bb-veil absolute inset-0 bg-black" style={{ animationDelay: `${star.delay}ms`, animationDuration: `${COSMIC_MS.bigbang}ms` }} />
      <CosmicTitle star={star} boom={boom} />
      {!boom && <Feed star={star} r={star.from} />}
      <div className="absolute left-1/2 top-[50%] h-0 w-0">
        {!boom && (
          <>
            <div className="pack-bb-seed absolute left-0 top-0 rounded-full" style={{ animationDelay: `${star.delay}ms`, animationDuration: `${COSMIC_BOOM.bigbang}ms`, ['--glow' as string]: gold }} />
            <Converge colors={['#fff', gold, '#ffe9c4', '#cfe0ff']} count={60} delay={star.delay + 900} spread={70} />
          </>
        )}
        {boom && (
          <>
            <div className="pack-bb-wave absolute left-0 top-0 rounded-full" />
            {['#fff', '#ffcd3c', '#ff3b4e'].map((c, k) => (
              <div key={c} className="pack-shock pack-shock-huge absolute left-0 top-0 size-40 rounded-full border-[8px]" style={{ borderColor: c, boxShadow: `0 0 50px ${c}`, animationDelay: `${k * 180}ms` }} />
            ))}
            {newborn.map((p, i) => (
              <span key={i} className="pack-bb-newborn absolute left-0 top-0 rounded-full" style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 8px ${p.color}`, ['--dx' as string]: `${p.dx}vmax`, ['--dy' as string]: `${p.dy}vmax`, animationDelay: `${p.delay}ms` }} />
            ))}
            <Burst color="#ffcd3c" count={120} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A wish: one of the smaller stars crosses as ever, then a golden comet dives from the top right and catches
 * it; a gold burst, and the star flies on in the colour of the rarity it became.
 */
function Wish({ star, thick }: { star: Star; thick: number }) {
  const boom = useAt(star.delay + WISH_BOOM);
  const timing = { animationDuration: `${star.duration}ms`, animationDelay: `${star.delay}ms` };
  const name = (r: Rarity) => RARITY_INFO[r].name.toUpperCase();
  return (
    <div className="absolute left-0 w-full" style={{ top: `${star.top}%`, transform: `rotate(${star.tilt}deg)` }}>
      <div className="pack-wish-star absolute left-0 top-0 rounded-full" style={{ ...timing, width: '24vw', height: thick + 1, ...streak(boom ? star.to : star.from) }} />
      {/* The comet, diving in to meet the star's head. */}
      <div className="absolute top-0" style={{ left: `${WISH_HIT}vw` }}>
        {!boom && <div className="pack-wish-comet" style={{ animationDuration: `${WISH_BOOM}ms`, animationDelay: `${star.delay}ms` }} />}
        {boom && (
          <>
            <div className="pack-clash-boom absolute left-0 top-0 size-28 rounded-full" style={{ background: `radial-gradient(circle, #fff 10%, #ffd86b 35%, ${RARITY_LIGHT[star.to]} 55%, transparent 72%)` }} />
            <Burst color="#ffd86b" count={34} />
            <p className="pack-wish-label absolute left-0 top-0 whitespace-nowrap font-display text-sm font-black tracking-[0.25em] sm:text-base" style={{ rotate: `${-star.tilt}deg` }}>
              🌠 WISH · <span style={{ color: RARITY_LIGHT[star.from] }}>{name(star.from)}</span> → <span style={{ color: RARITY_LIGHT[star.to] }}>{name(star.to)}</span>
            </p>
          </>
        )}
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

/**
 * What a pack (or five) leaves behind: how many cards were new and how many spares, each set's bar
 * filling with the cards just found, and the luck meter — up for the next pack, or back to ×1 after a Legendary.
 */
function PackStats({ deck, fresh, golden }: { deck: Card[]; fresh: Set<string>; golden: boolean }) {
  const counts = useProgress((s) => s.cards);
  const goldenCount = useProgress((s) => clampGolden(s.golden));
  const goldenLeft = GOLDEN.packs - 1 - goldenCount + 1;
  const pity = useProgress((s) => clampPity(s.pity));
  const luck = pityLuck(pity);
  const newOnes = deck.filter((c) => fresh.has(c.id)).length;
  const spares = deck.length - newOnes;
  const gotTop = deck.some((c) => top(c.rarity));
  // Each set of the pack: what's owned now, what this pack added.
  const sets = useMemo(() => {
    const ids = [...new Set(deck.map((c) => c.set))];
    return ids
      .map((id) => {
        const all = COLLECTIBLE.filter((c) => c.set === id);
        const owned = all.filter((c) => counts[c.id]).length;
        const added = new Set(deck.filter((c) => c.set === id && fresh.has(c.id)).map((c) => c.id)).size;
        return { id, name: SETS.find((x) => x.id === id)?.franchise ?? id, owned, added, size: all.length };
      })
      .sort((a, b) => b.added - a.added || b.owned / b.size - a.owned / a.size)
      .slice(0, 5);
    // Counted once, as the pack is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  return (
    <div className="pack-stats mx-auto w-full max-w-2xl space-y-3 rounded-lg border border-white/15 bg-white/5 p-3 text-white">
      <div className="flex flex-wrap items-center justify-center gap-2 font-display text-sm font-bold tracking-widest">
        {newOnes > 0 && <span className="pack-chip rounded-full bg-coral/90 px-3 py-0.5 text-[#1b1530]">{newOnes} NEW</span>}
        {spares > 0 && (
          <span className="pack-chip rounded-full border border-white/40 px-3 py-0.5 text-white/85" style={{ animationDelay: '0.12s' }} title="Spare copies grade a card up (Album) or trade for others (Renew)">
            +{spares} SPARE{spares === 1 ? '' : 'S'}
          </span>
        )}
      </div>
      {/* Each set's bar: what was owned, then what this pack added, filling in. */}
      <div className="space-y-1.5">
        {sets.map((s, k) => {
          const before = ((s.owned - s.added) / s.size) * 100;
          const now = (s.owned / s.size) * 100;
          return (
            <div key={s.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate text-white/80" title={s.name}>{s.name}</span>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white/45" style={{ width: `${before}%` }} />
                {s.added > 0 && <div className="pack-bar-fill absolute inset-y-0 rounded-full bg-[#fbbf24]" style={{ left: `${before}%`, width: `${Math.max(0.8, now - before)}%`, animationDelay: `${0.3 + k * 0.12}s` }} />}
              </div>
              <span className="tabular-nums text-white/70">
                {s.owned}/{s.size}
                {s.added > 0 && <span className="ml-1 font-bold text-[#fbbf24]">+{s.added}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {/* The luck meter: it fills with every pack without a Legendary or better. */}
      <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
        <span className="text-white/80">✨ Luck</span>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`pack-luck absolute inset-y-0 left-0 rounded-full ${luck >= PITY_MAX ? 'pack-luck-full' : ''}`} style={{ width: `${((luck - 1) / (PITY_MAX - 1)) * 100}%` }} />
        </div>
        <span className="tabular-nums font-bold text-[#fde68a]">×{luck.toFixed(2)}</span>
      </div>
      {/* The golden meter: the packs since the last golden one. */}
      <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
        <span className="text-white/80">🌟 Golden</span>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          <div className="golden-fill absolute inset-y-0 left-0 rounded-full" style={{ width: `${(goldenCount / (GOLDEN.packs - 1)) * 100}%` }} />
        </div>
        <span className="tabular-nums font-bold text-[#fde68a]">
          {goldenCount}/{GOLDEN.packs - 1}
        </span>
      </div>
      <p className="text-center text-[11px] text-white/55">
        {golden ? 'A golden pack! The count to the next one starts again. ' : goldenNext(goldenCount) ? 'Your next pack is golden! ' : `A golden pack in ${goldenLeft} pack${goldenLeft === 1 ? '' : 's'}. `}
        {gotTop ? 'A Legendary or better: your luck starts again from ×1.' : luck >= PITY_MAX ? 'Luck at its highest: the next pack has the best odds it can get.' : 'No Legendary this time: the next pack has better odds of one.'}
      </p>
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
export function PackOpening({ pack, times = 1, cards, events = [], fresh, onClose, onAgain, canAgain, golden = false }: { pack: Pack; times?: number; cards: Card[]; events?: CosmicEvent[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean; golden?: boolean }) {
  // A golden pack's own light, gold where an ordinary pack's is lilac.
  const packLight = golden ? GOLDEN_LIGHT : PACK_LIGHT;
  const counts = useProgress((s) => s.cards);
  const best = cards.reduce<Rarity>((b, c) => (RARITIES.indexOf(c.rarity) > RARITIES.indexOf(b) ? c.rarity : b), 'common');
  const light = RARITY_LIGHT[best];
  // The shooting stars, drawn once per pack (the cards come sorted, the rarest last).
  // …with a black hole now and then, and the stars it swallows (their cards come last, with an anomaly to keep or not).
  // The cards a cosmic event made (rolled at the pull: they're already the player's) come after the others,
  // the greatest event last: each its own scene once the ordinary stars have crossed.
  const { ordered, evAt } = useMemo(() => {
    const used = new Set<number>();
    const found: [number, CosmicEvent][] = [];
    for (const e of events) {
      if (e.kind === 'wish') continue;
      const k = cards.findIndex((c, j) => c === e.to && !used.has(j));
      if (k >= 0) (used.add(k), found.push([k, e]));
    }
    found.sort((a, b) => COSMIC_KINDS_ORDER.indexOf(a[1].kind) - COSMIC_KINDS_ORDER.indexOf(b[1].kind) || RARITIES.indexOf(a[1].to.rarity) - RARITIES.indexOf(b[1].to.rarity));
    const rest = cards.filter((_, j) => !used.has(j));
    return { ordered: [...rest, ...found.map(([k]) => cards[k])], evAt: new Map(found.map(([, e], j) => [rest.length + j, e])) };
  }, [cards, events]);
  /** The wishes, where their cards are among the ordinary ones. */
  const wishAt = useMemo(() => {
    const m = new Map<number, CosmicEvent>();
    for (const e of events) {
      if (e.kind !== 'wish') continue;
      const k = ordered.findIndex((c, j) => c === e.to && !m.has(j) && !evAt.has(j));
      if (k >= 0) m.set(k, e);
    }
    return m;
  }, [events, ordered, evAt]);
  const regular = ordered.length - evAt.size;
  const cosmos = useMemo(() => cosmosFor(ordered, evAt, wishAt), [ordered, evAt, wishAt]);
  const stars = cosmos.stars;
  // The deck: the ordinary cards, those back from the black hole, then the cosmic events'.
  const order = useMemo(() => {
    const ks = ordered.map((_, k) => k).filter((k) => !evAt.has(k));
    return [...ks.filter((k) => !cosmos.swallowed.has(k)), ...ks.filter((k) => cosmos.swallowed.has(k)), ...evAt.keys()];
  }, [ordered, evAt, cosmos]);
  const deck = useMemo(() => order.map((k) => ordered[k]), [order, ordered]);
  /** The anomaly each card of the deck came back with (by its place in the deck), and what the player said. */
  const pending = useMemo(() => {
    const m = new Map<number, AnomalyId>();
    order.forEach((k, p) => cosmos.swallowed.has(k) && m.set(p, cosmos.swallowed.get(k)!));
    return m;
  }, [cosmos, order]);
  /** The cosmic event each card of the deck went through (by its place in the deck). */
  const cosmicAt = useMemo(() => {
    const m = new Map<number, CosmicEvent>();
    order.forEach((k, p) => {
      const e = evAt.get(k) ?? wishAt.get(k);
      if (e) m.set(p, e);
    });
    return m;
  }, [evAt, wishAt, order]);
  // The planet in the corner: how good the pack looks at first, then better each time a star turns out
  // rarer than it showed (it evolves a moment after the burst).
  const skySteps = useMemo(() => {
    const shown = stars.map((s) => s.from);
    const steps: { at: number; tier: SkyTier }[] = [];
    let now = skyTier(shown);
    const first = now;
    stars
      .map((s, k) => ({ k, at: boomOf(s) }))
      .filter((x): x is { k: number; at: number } => x.at !== null)
      .sort((a, b) => a.at - b.at)
      .forEach(({ k, at }) => {
        shown[k] = stars[k].to;
        const t = skyTier(shown);
        if (t > now) steps.push({ at: at + 450, tier: (now = t) });
      });
    return { first, steps };
  }, [stars]);
  const [skyNow, setSkyNow] = useState<{ tier: SkyTier; n: number }>({ tier: skySteps.first, n: 0 });
  const [feed, setFeed] = useState(0);
  const moment = useMemo(() => skyMomentFor(), []);
  const [kept, setKept] = useState<Record<number, boolean>>({});
  const setAnomaly = useProgress((s) => s.setAnomaly);
  const decide = (k: number, keep: boolean) => {
    const a = pending.get(k);
    if (!a || k in kept) return;
    setKept((x) => ({ ...x, [k]: keep }));
    if (keep) (setAnomaly(deck[k].id, a), sfx.streak());
    else sfx.click();
  };
  // When the black hole closes: once every star round it has flown on or gone in (the last star comes after).
  const holeEnd = Math.max(0, ...stars.slice(0, regular - 1).map((s) => s.delay + s.duration));
  /** When the black hole swallows each star it takes (it flares). */
  const gulps = useMemo(() => [...cosmos.swallowed.keys()].map((k) => stars[k].delay + stars[k].duration - 80), [cosmos, stars]);
  const tints = useMemo(() => [...new Set(stars.map((s) => RARITY_LIGHT[s.to]))], [stars]);
  // The tear glows in the colour of the best card inside — or, when its star is going to evolve, of the
  // rarity it pretends to be until then (an Epic about to become Legendary tears open purple).
  // A cosmic event's card shows its old colour too: a pack that tears open blue may still hold a Legendary.
  const shownBest = stars.reduce<Rarity>((b, s) => (RARITIES.indexOf(s.from) > RARITIES.indexOf(b) ? s.from : b), 'common');
  const glow = RARITY_LIGHT[shownBest];
  // Mythic and Omni can't pass for an Epic: a rainbow (Mythic) or a red and gold (Omni) aura, glows on glows.
  const special = shownBest === 'mythic' || shownBest === 'omni' ? shownBest : null;
  const auraFilter = (n: number) =>
    special === 'mythic'
      ? `drop-shadow(0 0 ${n}px #ff4fd8) drop-shadow(0 0 ${n * 1.6}px #3cc7ff) drop-shadow(0 0 ${n * 2.2}px #ffcd3c)`
      : special === 'omni'
        ? `drop-shadow(0 0 ${n}px #ff3b4e) drop-shadow(0 0 ${n * 1.6}px #ffcd3c) drop-shadow(0 0 ${n * 2.2}px #ff3b4e)`
        : `drop-shadow(0 0 ${n}px ${glow})`;
  const beam =
    special === 'mythic'
      ? 'linear-gradient(to top, #fff, #ff4fd8 12%, #ffcd3c 28%, #3cff9e 44%, #3cc7ff 60%, #a855f799 74%, transparent 92%)'
      : special === 'omni'
        ? 'linear-gradient(to top, #fff, #ff3b4e 14%, #ffcd3c 34%, #ff3b4e99 58%, transparent 90%)'
        : `linear-gradient(to top, ${glow}, ${glow}55 30%, transparent 85%)`;
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState<number | null>(null);
  const [tear, setTear] = useState(0);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [charging, setCharging] = useState(false);
  const [flash, setFlash] = useState<{ color: string; key: number; rainbow?: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // What shakes: the stage inside the overlay (the pack, the stars, the card), never the overlay itself, so the
  // backdrop stays put and no edge of the page shows at the screen's borders.
  const stage = useRef<HTMLDivElement>(null);
  // A hit: the stage swells a little, then settles in jolts that die away.
  const jolt = (px: number, ms: number) => shake(stage.current, px * 0.6, ms, { punch: Math.min(0.035, px / 900) });
  const packRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const card = deck[i];
  // ── Tearing ─────────────────────────────────────────────────────────
  // The tear's live sound (the best card's tone, or the one it poses as), its jagged line, its sparks.
  const toneLevel = RARITIES.indexOf(shownBest);
  const tearSnd = useRef<TearSound | null>(null);
  const line = useMemo(tearLine, []);
  const [sparks, setSparks] = useState<TearSpark[]>([]);
  const lastSpark = useRef(0);
  const lastBuzz = useRef(0);
  const [lean, setLean] = useState(0);
  const [wobble, setWobble] = useState(0);
  const [holding, setHolding] = useState(false);
  const still = useRef<number>();
  const move = useRef<{ x: number; t: number } | null>(null);
  useEffect(() => () => tearSnd.current?.stop(), []);
  const sound = () => (tearSnd.current ??= sfx.tearStart(toneLevel));
  /** The tear reached `p`: sparks fly from there, and the phone ticks every tenth. */
  const tearTo = (p: number) => {
    if (reducedMotion()) return;
    if (p - lastSpark.current >= 0.025) {
      lastSpark.current = p;
      const born = Array.from({ length: toneLevel >= 3 ? 3 : 2 }, () => ({ id: Math.random(), x: p * 100, dx: (Math.random() - 0.3) * 60, dy: -20 - Math.random() * 70, size: 2 + Math.random() * (toneLevel >= 3 ? 5 : 3) }));
      setSparks((s) => [...s.slice(-40), ...born]);
    }
    if (p - lastBuzz.current >= 0.1) ((lastBuzz.current = p), buzz(6));
  };
  // Set at the first tear: a second tap (or a key) while the pack tears by itself must not tear it twice.
  const tearing = useRef(false);
  const autoTearing = useRef(false);
  const torn = () => {
    if (phase !== 'pack' || tearing.current) return;
    tearing.current = true;
    setTear(1);
    window.clearTimeout(still.current);
    // The last moment holds its breath — the rip goes quiet, the tone swells — then it snaps open.
    if (reducedMotion()) return open();
    sound()?.hold();
    setHolding(true);
    later(open, HOLD_MS);
  };
  const open = () => {
    const snd = sound();
    if (snd) snd.snap();
    else sfx.tear();
    tearSnd.current = null;
    setHolding(false);
    setLean(0);
    buzz([30, 40, 70]);
    if (!reducedMotion()) {
      jolt(10, 340);
      setFlash({ color: glow, key: Date.now(), rainbow: special === 'mythic' });
    }
    setPhase('torn');
    later(() => {
      if (reducedMotion()) return toReveal();
      setPhase('meteor');
      // A star a card: each its own whoosh, the rarest the long one; an evolving star chimes as it changes.
      // The black hole: it opens with a hum as the first star flies.
      if (cosmos.hole) later(() => (sfx.blackHole(), rumble(stage.current, 1800, 0.3, 3)), 0);
      // A star it pulls in: a rush of air, and a jolt as it goes.
      for (const k of cosmos.swallowed.keys()) later(() => (sfx.swallow(), jolt(7, 400)), stars[k].delay + stars[k].duration - 300);
      stars.forEach((s, k) => {
        if (s.event) return cosmicCues(s);
        later(() => (k === regular - 1 ? sfx.meteor(top(s.to)) : sfx.whoosh()), s.delay);
        // An evolving star: the crash, a hard shake and the burst in its new colour.
        if (s.from !== s.to)
          later(() => {
            sfx.clash();
            sfx.shimmer(5);
            jolt(14, 520);
            setFlash({ color: RARITY_LIGHT[s.to], key: Date.now(), rainbow: rainbowy(s.to) });
          }, s.delay + CLASH_AT);
      });
      // The planet evolving: a chime as it grows.
      skySteps.steps.forEach(({ at, tier }, j) => {
        later(() => setFeed(j + 1), at - 450);
        later(() => (setSkyNow({ tier, n: j + 1 }), sfx.shimmer(4 + tier * 2)), at);
      });
      // A sky moment: its own sound.
      if (moment === 'comet') later(() => sfx.shimmer(10), 500);
      if (moment === 'shower') for (let t = 400; t < 3000; t += 450) later(() => sfx.shimmer(2), t);
      if (moment === 'capture') later(() => sfx.shimmer(6), 3300);
      // The wait before the last star (and each cosmic event): the screen trembles, harder and harder, to a quiet rising drone.
      for (const s of stars) if (s.climax) later(() => (rumble(stage.current, LAST_STAR_PAUSE, 0.5, 7), sfx.suspense(LAST_STAR_PAUSE / 1000)), s.delay - LAST_STAR_PAUSE);
      const end = Math.max(...stars.map((s) => s.delay + s.duration));
      later(() => setFlash({ color: packLight, key: Date.now() }), end - 100);
      later(toReveal, end + 300);
    }, 950);
  };
  /** A cosmic event's sounds, jolts and flashes, timed to its scene. */
  const cosmicCues = (s: Star) => {
    const boom = s.delay + COSMIC_BOOM[s.event!];
    const color = RARITY_LIGHT[s.to];
    if (s.event === 'wish') {
      later(() => sfx.whoosh(), s.delay);
      later(() => sfx.shimmer(8), boom - 500);
      later(() => (sfx.streak(), jolt(6, 300), buzz(25), setFlash({ color: '#ffd86b', key: Date.now() })), boom);
      return;
    }
    later(() => sfx.shimmer(6), s.delay);
    if (s.event === 'collision') {
      later(() => (sfx.planets(COSMIC_BOOM.collision / 1000), rumble(stage.current, COSMIC_BOOM.collision, 0.2, 6)), s.delay);
      later(() => (sfx.embrace(), jolt(16, 600), buzz([40, 30, 90]), setFlash({ color, key: Date.now() })), boom);
    } else if (s.event === 'supernova') {
      later(() => sfx.whoosh(), s.delay);
      later(() => (sfx.swallow(), jolt(8, 300)), s.delay + 900);
      later(() => (sfx.swell((COSMIC_BOOM.supernova - 1000) / 1000), rumble(stage.current, COSMIC_BOOM.supernova - 1000, 0.3, 11)), s.delay + 1000);
      later(() => (sfx.supernova(), jolt(24, 900), buzz([60, 40, 120]), setFlash({ color: '#fff', key: Date.now(), rainbow: true })), boom);
      later(() => celebrate(), boom + 300);
    } else {
      later(() => sfx.meteor(true), s.delay);
      later(() => (sfx.collapse((COSMIC_BOOM.bigbang - 900) / 1000), rumble(stage.current, COSMIC_BOOM.bigbang - 1400, 0.2, 9)), s.delay + 900);
      later(() => (sfx.bigBang(), jolt(30, 1300), buzz([90, 50, 200]), setFlash({ color: '#ffcd3c', key: Date.now() })), boom);
      later(() => celebrateBig(), boom + 250);
    }
  };
  /** A tap instead of a swipe: the pack tears by itself, quickly. */
  const autoTear = () => {
    if (tearing.current || autoTearing.current) return;
    autoTearing.current = true;
    let p = 0;
    sfx.crinkle();
    const id = window.setInterval(() => {
      p += 0.07;
      const at = Math.min(1, p);
      setTear(at);
      sound()?.update(at, 0.85);
      tearTo(at);
      if (p >= 1) (window.clearInterval(id), torn());
    }, 30);
    timers.current.push(id);
  };
  const progressAt = (clientX: number) => {
    const r = packRef.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  /** The foil's shine follows the pointer, held or not. */
  const shineAt = (e: React.PointerEvent) => {
    const r = packRef.current?.getBoundingClientRect();
    if (!r || !packRef.current) return;
    packRef.current.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`);
    packRef.current.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'pack' || tearing.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
    move.current = { x: e.clientX, t: performance.now() };
    // Picked up: the foil crinkles, and the tear's sound gets ready.
    sfx.crinkle();
    sound();
  };
  const onMove = (e: React.PointerEvent) => {
    shineAt(e);
    const d = drag.current;
    if (!d || phase !== 'pack' || tearing.current) return;
    if (Math.abs(e.clientX - d.x) > 8) d.moved = true;
    if (!d.moved) return;
    // The tear follows the finger, from whichever side it started.
    const p = Math.abs(progressAt(e.clientX) - progressAt(d.x));
    const now = performance.now();
    const last = move.current ?? { x: e.clientX, t: now };
    const v = (e.clientX - last.x) / Math.max(1, now - last.t);
    move.current = { x: e.clientX, t: now };
    // The rip as loud as the finger is fast, the tone as high as the tear is far; the pack leans with the pull.
    const reach = Math.max(tear, p);
    sound()?.update(reach / TEAR_ENOUGH, Math.abs(v) / FAST_SWIPE);
    setLean(Math.max(-6, Math.min(6, v * 5)));
    tearTo(p);
    setTear((t) => Math.max(t, p));
    // A finger that stops: the rip goes quiet, the pack settles.
    window.clearTimeout(still.current);
    still.current = window.setTimeout(() => (tearSnd.current?.update(reach / TEAR_ENOUGH, 0), setLean(0)), 70);
    if (p >= TEAR_ENOUGH) ((drag.current = null), torn());
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (phase !== 'pack' || tearing.current) return;
    if (!d?.moved) return autoTear();
    // Let go halfway: the rip stops, and the pack wobbles back.
    tearSnd.current?.update(tear / TEAR_ENOUGH, 0);
    setLean(0);
    setWobble((w) => w + 1);
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
  /** The turn in progress (a Legendary or better charging): a skip lands it at once. */
  const landing = useRef<(() => void) | null>(null);
  const turn = (c: Card = card) => {
    const go = () => {
      landing.current = null;
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
        jolt(22, 1000);
      } else if (c.rarity === 'mythic') {
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 900);
        if (c.voice) later(() => playVoice(c), 1300);
        jolt(18, 800);
      } else if (c.rarity === 'legendary') (sfx.victory(), celebrateBig(), jolt(14, 600));
      else if (c.rarity === 'epic') (sfx.streak(), celebrate(), jolt(6, 300));
      else if (c.rarity === 'rare') sfx.correct();
      else sfx.pop();
    };
    // A mythic takes a long breath, every colour running through it; a legendary a shorter one.
    // Legendary and up: time slows — the room goes dark around the card, to a low drone.
    landing.current = go;
    if (top(c.rarity) && !reducedMotion()) sfx.suspense(c.rarity === 'omni' ? 2.3 : c.rarity === 'mythic' ? 2.1 : 2);
    if (c.rarity === 'omni' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(20);
      later(go, 2300);
    } else if (c.rarity === 'mythic' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(16);
      later(go, 2100);
    } else if (c.rarity === 'legendary' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(10);
      later(go, 2000);
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
  /**
   * Skip never skips past a top card: it goes straight to the next Legendary or better still face down and
   * turns it (a quick skipper still sees it come). Pressed again while it charges, it lands at once; on a
   * card already turned, it goes on to the next top card, and to the summary once there's none left.
   */
  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    tearSnd.current?.stop();
    tearSnd.current = null;
    setHolding(false);
    // A top card charging: its turn now, without the wait.
    if (phase === 'reveal' && charging && landing.current) return landing.current();
    const from = phase === 'reveal' ? (flipped ? i + 1 : i) : 0;
    const next = deck.findIndex((c, k) => k >= from && top(c.rarity));
    setCharging(false);
    if (next < 0) {
      setPhase('summary');
      // A pack with a top card already seen doesn't celebrate twice.
      if (phase !== 'reveal' && deck.some((c) => top(c.rarity))) celebrateBig();
      return;
    }
    setPhase('reveal');
    setI(next);
    setFlipped(false);
    sfx.whoosh();
    turn(deck[next]);
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
  // A Legendary or better charging: it spins front over back.
  const spinning = charging && !!card && top(card.rarity);
  const big = card && (card.rarity === 'epic' || top(card.rarity));
  return (
    // The summary of five packs is taller than the screen: it scrolls inside the overlay (the page behind stays still).
    <div ref={box} className="fixed inset-0 z-50 overflow-hidden bg-[#07060c]/90 backdrop-blur-sm" style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${phase === 'pack' ? '#1e1b4b66' : `${phase === 'summary' ? light : phase === 'reveal' && flipped && card ? RARITY_LIGHT[card.rarity] : phase === 'torn' || phase === 'meteor' ? glow : packLight}${special && (phase === 'torn' || phase === 'meteor') ? '55' : '22'}`}, transparent 60%)` }}>
      {phase !== 'summary' && (
        <button type="button" onClick={skip} className="absolute right-4 top-4 z-30 rounded-full border border-white/30 px-3 py-1 text-xs font-bold tracking-widest text-white/80 hover:bg-white/10">
          {/* What a skip does now: land the card charging, go to the next top card, or to the end. */}
          {phase === 'reveal' && charging && card && top(card.rarity) ? 'SKIP ✦' : deck.some((c, k) => k >= (phase === 'reveal' ? (flipped ? i + 1 : i) : 0) && top(c.rarity)) ? 'SKIP TO ★' : 'SKIP ⏭'}
        </button>
      )}
      {/* Slow motion: the room darkens around a Legendary or better as it charges. */}
      {phase !== 'meteor' && <Ambient tint={phase === 'summary' ? light : phase === 'reveal' && flipped && card ? RARITY_LIGHT[card.rarity] : phase === 'torn' ? glow : packLight} />}
      {phase === 'reveal' && charging && card && top(card.rarity) && <div className="pack-slowmo pointer-events-none fixed inset-0" aria-hidden />}
      {/* A Mythic or Omni makes its entrance: its franchise's name sweeps across, in its colours. */}
      {phase === 'reveal' && charging && card && prismatic(card.rarity) && (
        <div className="pointer-events-none fixed inset-x-0 top-[12%] z-30 overflow-hidden" aria-hidden>
          <p className={`pack-banner whitespace-nowrap text-center font-display text-3xl font-black tracking-[0.3em] sm:text-5xl ${card.rarity === 'omni' ? 'card-omni-name' : 'card-mythic-name'}`}>{card.franchise.toUpperCase()}</p>
        </div>
      )}
      {/* A golden pack: gold rays turning slowly behind everything, from the pick to the summary. */}
      {/* (Clipped in a box of its own: bigger than the screen to turn without corners, it must not make the overlay scroll.) */}
      {golden && (
        <div className="pointer-events-none fixed inset-0 overflow-clip" aria-hidden>
          <div className="golden-backdrop absolute -inset-1/2" />
        </div>
      )}
      {flash && <div key={flash.key} className="pack-flash pointer-events-none fixed inset-0 z-40" style={{ background: flash.rainbow ? `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 85%)` : `radial-gradient(circle, #fff, ${flash.color} 45%, transparent 80%)` }} />}

      {/* The stage: everything that shakes. Not clipped itself (the overlay clips), so the star field's bleed covers the borders mid-shake. */}
      <div ref={stage} className={`absolute inset-0 p-4 ${phase === 'summary' ? 'flex justify-center overflow-y-auto' : 'grid place-items-center'}`}>
      {/* 0. Three packs: pick one. */}
      {phase === 'choose' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          {golden && <p className="golden-banner golden-text text-center font-display text-3xl font-black tracking-[0.3em] sm:text-5xl">★ GOLDEN PACK ★</p>}
          <p className="font-display text-sm font-bold tracking-[0.35em] text-white/80">{golden ? `${GOLDEN.slots} LEGENDARY OR BETTER INSIDE · CHOOSE YOUR PACK` : 'CHOOSE YOUR PACK'}</p>
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
                    <PackArt pack={pack} golden={golden} />
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
            onPointerCancel={() => ((drag.current = null), tearSnd.current?.update(tear, 0))}
            className={`relative w-56 cursor-grab touch-none select-none sm:w-64 ${phase === 'pack' && !holding ? 'pack-float' : ''}`}
            style={phase === 'pack' && tear > 0 ? { filter: auraFilter(8 + tear * 30) } : phase === 'torn' && special ? { filter: auraFilter(26) } : undefined}
            role="button"
            aria-label="Swipe across the pack, or tap it, to tear it open"
          >
            <div key={`w${wobble}`} className={`relative ${holding ? 'pack-hold' : wobble ? 'pack-wobble' : ''}`} style={{ transform: holding ? undefined : `rotate(${lean}deg) skewX(${lean * -0.6}deg)`, transition: 'transform 0.12s ease-out' }}>
            {/* Mythic and Omni: a halo turning behind the pack as it tears. */}
            {special && (phase === 'torn' || (phase === 'pack' && tear > 0)) && (
              <div className={`pack-halo pack-halo-${special} pointer-events-none absolute left-1/2 top-1/2 -z-10`} style={{ opacity: phase === 'torn' ? 1 : 0.3 + tear * 0.7 }} aria-hidden />
            )}
            {/* The light inside, pouring out of the tear. */}
            {phase === 'torn' && (
              <div
                className="pack-beam pointer-events-none absolute left-1/2 w-[260%]"
                style={{ bottom: `${100 - TEAR_AT}%`, height: '70vh', background: beam }}
                aria-hidden
              />
            )}
            {/* The pack below the cut, and the strip above it: they part along the same jagged line. */}
            <div style={{ clipPath: `polygon(${pts(line)}, 100% 100%, 0 100%)` }} className={phase === 'torn' ? 'pack-glow' : ''}>
              <PackArt pack={pack} shine golden={golden} />
            </div>
            <div className={`absolute inset-0 ${phase === 'torn' ? 'pack-flap-fly' : ''}`} style={{ clipPath: `polygon(0 0, 100% 0, ${pts([...line].reverse())})`, transform: phase === 'pack' ? `rotate(${-tear * 7}deg) translateY(${-tear * 7}px)` : undefined, transformOrigin: '100% 100%' }}>
              <PackArt pack={pack} shine golden={golden} />
            </div>
            {/* The light inside, shining through the cut as it opens. */}
            {phase === 'pack' && tear > 0 && (
              <div
                className="pointer-events-none absolute left-0 -translate-y-1/2 rounded-full mix-blend-screen"
                style={{ top: `${TEAR_AT}%`, width: `${tear * 100}%`, height: 6 + tear * 34, opacity: 0.45 + tear * 0.55, background: `linear-gradient(to bottom, transparent, ${glow}aa 35%, #fff 50%, ${glow}aa 65%, transparent)`, filter: `blur(${3 + tear * 4}px)` }}
                aria-hidden
              />
            )}
            {/* The cut itself, jagged and white-hot, as far as the finger has gone. */}
            {phase === 'pack' && tear > 0 && (
              <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ filter: `drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px ${glow})` }}>
                <polyline points={line.filter(([x]) => x <= tear * 100 + 0.01).concat(tear < 1 ? [[tear * 100, TEAR_AT]] : []).map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            )}
            {/* Sparks off the tear, where the finger is. */}
            {sparks.map((s) => (
              <span
                key={s.id}
                className="pack-tear-spark pointer-events-none absolute rounded-full"
                onAnimationEnd={() => setSparks((all) => all.filter((x) => x.id !== s.id))}
                style={{ left: `${s.x}%`, top: `${TEAR_AT}%`, width: s.size, height: s.size, background: special === 'mythic' ? RAINBOW[Math.floor(s.x) % RAINBOW.length] : '#fff', boxShadow: `0 0 8px ${glow}, 0 0 3px #fff`, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }}
                aria-hidden
              />
            ))}
            {phase === 'pack' && tear === 0 && (
              <div className="pack-hint pointer-events-none absolute left-[8%] font-display text-2xl text-white drop-shadow" style={{ top: `calc(${TEAR_AT}% - 1.2rem)` }}>
                ✂
              </div>
            )}
            </div>
          </div>
          {phase === 'pack' && <p className="animate-pulse text-center font-display text-sm font-bold tracking-widest text-white/90">SWIPE ACROSS THE TOP TO TEAR · OR TAP</p>}
        </div>
      )}

      {/* 2. The shooting stars: one per card, in its colour, the rarest last — now and then one crashes into another and evolves. */}
      {phase === 'meteor' && (
        <div className="pointer-events-none absolute -inset-16 overflow-hidden" aria-hidden>
          <Space tier={skyNow.tier} evolved={skyNow.n} feed={feed} moment={moment} />
          {cosmos.hole && <BlackHole until={holeEnd} gulps={gulps} tints={tints} />}
          {stars.map((s, k) => {
            const thick = top(s.to) ? 7 : RARITIES.indexOf(s.to) >= 2 ? 5 : 3;
            // A black hole: every star but the last circles it (and some go in).
            // A cosmic event: its own scene.
            if (s.event === 'wish') return <Wish key={k} star={s} thick={thick} />;
            if (s.event === 'collision') return <Embrace key={k} star={s} />;
            if (s.event === 'supernova') return <Supernova key={k} star={s} />;
            if (s.event === 'bigbang') return <BigBang key={k} star={s} />;
            if (cosmos.hole && k < regular - 1) return <Orbiter key={k} star={s} k={k} thick={thick} swallowed={cosmos.swallowed.has(k)} />;
            // An evolving star crashes into another and bursts in its true colour.
            if (s.from !== s.to) return <Clash key={k} star={s} thick={thick} />;
            return (
              <div key={k} className="absolute left-0 w-full" style={{ top: `${s.top}%`, transform: `rotate(${s.tilt}deg)` }}>
                <div className="pack-meteor relative rounded-full" style={{ animationDuration: `${s.duration}ms`, animationDelay: `${s.delay}ms`, width: `${top(s.to) ? 45 : 30}vw`, height: thick, transform: 'translateX(-60vw)' }}>
                  <div className="absolute inset-0 rounded-full" style={streak(s.to)} />
                  <div className="pack-meteor-head absolute right-0 top-1/2 rounded-full" style={{ width: thick * 5, height: thick * 5, ['--glow' as string]: RARITY_LIGHT[s.to] }} />
                  <div className={`pack-meteor-dust absolute inset-y-0 left-[15%] right-[10%] ${rainbowy(s.to) ? 'pack-twinkle-rainbow' : ''}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. One card at a time from the deck. */}
      {phase === 'reveal' && card && style && (
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5">
          <p className="font-display text-xs font-bold tracking-[0.35em] text-white/60">
            {pending.has(i) ? 'BACK FROM THE BLACK HOLE · ' : cosmicAt.has(i) ? `${COSMIC_NAME[cosmicAt.get(i)!.kind].icon} ${COSMIC_NAME[cosmicAt.get(i)!.kind].name} · ` : ''}CARD {i + 1} OF {deck.length}
          </p>
          <button type="button" onClick={act} className="relative isolate w-52 outline-none sm:w-60" aria-label={flipped ? `${card.name} — next` : 'Turn the card'}>
            {/* The rest of the deck, underneath. */}
            {Array.from({ length: Math.min(3, deck.length - i - 1) }, (_, k) => (
              <div key={k} className="absolute inset-0 opacity-70" style={{ transform: `translate(${(k + 1) * 6}px, ${(k + 1) * 6}px)`, zIndex: -1 - k }}>
                <CardBack />
              </div>
            ))}
            {big && <Rays color={RARITY_LIGHT[card.rarity]} strong={top(card.rarity) && (charging || flipped)} rainbow={rainbowy(card.rarity)} />}
            <div
              key={i}
              className={`pack-card-in [perspective:1100px] ${!flipped && !charging && card.rarity !== 'common' && !reducedMotion() ? 'pack-leak' : ''}`}
              style={{ ['--leak' as string]: RARITY_LIGHT[card.rarity], ['--leak-size' as string]: `${6 + RARITIES.indexOf(card.rarity) * 7}px`, ['--leak-shake' as string]: `${RARITIES.indexOf(card.rarity) * 0.6}px` }}
            >
              <div className={`relative transition-transform ${flipped ? 'duration-700 [transform:rotateY(180deg)]' : 'duration-300'} [transform-style:preserve-3d] ${charging ? (card.rarity === 'mythic' ? 'pack-charge-spin pack-charge-prism' : card.rarity === 'omni' || card.rarity === 'legendary' ? 'pack-charge-spin' : 'pack-charge') : ''}`} style={charging && top(card.rarity) ? SPIN[card.rarity] : undefined}>
                {/* Spinning front over back (Legendary and up): the back shows on both sides, the face stays hidden until the turn. */}
                <div className={spinning ? '' : '[backface-visibility:hidden]'}>
                  <CardBack rarity={card.rarity === 'common' ? undefined : card.rarity} />
                </div>
                <div className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] ${spinning ? 'opacity-0' : ''}`}>
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
                    ? '✦ MYTHIC ✦'
                    : card.rarity === 'omni' ? '✪ OMNI ✪' : card.rarity === 'mythic' ? '✦ MYTHIC ✦' : card.rarity === 'legendary' ? '★ LEGENDARY ★' : RARITY_INFO[card.rarity].name.toUpperCase()}
                </p>
                {cosmicAt.has(i) && <p className="text-xs font-bold tracking-widest text-white/70">{COSMIC_DONE[cosmicAt.get(i)!.kind]} — it was {RARITY_INFO[cosmicAt.get(i)!.from.rarity].name}</p>}
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
          <PackStats deck={deck} fresh={fresh} golden={golden} />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {deck.map((c, k) => (
              <div key={k} className="animate-card-deal" style={{ animationDelay: `${Math.min(k, 12) * 90 + Math.max(0, k - 12) * 30}ms`, ['--deal-rot' as string]: `${((k % 5) - 2) * 6}deg` }}>
                <CardFace card={c} count={counts[c.id]} isNew={fresh.has(c.id)} hoverHero anomaly={pending.has(k) && kept[k] !== false ? pending.get(k) : undefined} />
                {pending.has(k) && !(k in kept) && <AnomalyChoice compact anomaly={pending.get(k)!} onDecide={(keep) => decide(k, keep)} />}
                <p className="mt-2 text-center font-display text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_STYLE[c.rarity].text }}>
                  {pending.get(k) === 'fake' && kept[k] !== false ? 'Mythic' : RARITY_INFO[c.rarity].name}
                </p>
                {cosmicAt.has(k) && <p className="text-center text-[10px] font-bold tracking-widest text-white/70" title={COSMIC_DONE[cosmicAt.get(k)!.kind]}>{COSMIC_NAME[cosmicAt.get(k)!.kind].icon} was {RARITY_INFO[cosmicAt.get(k)!.from.rarity].name}</p>}
                {!fresh.has(c.id) && <p className="pack-chip mt-0.5 text-center font-display text-[10px] font-bold tracking-widest text-white/60" style={{ animationDelay: `${0.4 + Math.min(k, 12) * 0.09}s` }}>+1 SPARE</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {canAgain && (
              <button type="button" onClick={onAgain} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                {times > 1 ? `Open ×${times} again` : 'Open another'} · <Coins n={pack.cost * times} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-paper rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Done
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
