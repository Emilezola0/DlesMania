import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig, rumble, shake } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx, type TearSound } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardBack, CardFace, RARITY_STYLE } from './CardView';
import { COLLECTIBLE, RARITIES, RARITY_INFO, RARITY_LIGHT, SETS, type Card, type Rarity } from './cards';
import { PackArt } from './PackArt';
import { flapClass, OpeningAround, OpeningInside, openingOf, wholeClass } from './WrapOpening';
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

/**
 * The golden rule of a pack opening: its cards are drawn before it starts (the drop rates live in packs.ts and
 * nothing here touches them); every light, colour, planet and burst is a skin on that result, there to look
 * incredible and build hype — and it shows that result truly. Each star crosses in its card's colour, the rarer
 * the thicker, longer and slower; the tear glows in the best colour the stars show, the planet in the corner
 * grows with them. The effects only ever climb towards the truth, never past it: now and then (EVOLVE_CHANCE)
 * the best card, Epic or better, first shows a rarity lower — two lower, now and then (COSMIC.deepFake), for a
 * Legendary or better — and evolves mid-flight, crashing into a second star and bursting into its true colour.
 */
const EVOLVE_CHANCE = 0.3;
/**
 * A card's turn builds up in steps, each more intense — 1: it trembles and glows violet; 2: time slows, the
 * room goes dark, it spins in gold to a drone and a heartbeat; 3: every colour runs through it and its
 * franchise's name sweeps across; 4: red and gold, the screen shaking. It climbs exactly as far as its rarity
 * (Epic 1, Legendary 2, Mythic 3, Omni 4), a pulse at the end of each step deciding whether it climbs on.
 * Now and then (NEAR_MISS, rarely: it must stay a surprise) the next step flickers into life at that pulse — and
 * cracks: a near-miss.
 */
type Step = 0 | 1 | 2 | 3 | 4;
const stepOf = (r: Rarity): Step => (r === 'omni' ? 4 : r === 'mythic' ? 3 : r === 'legendary' ? 2 : r === 'epic' ? 1 : 0);
const NEAR_MISS: Record<Step, number> = { 0: 0.04, 1: 0.08, 2: 0.07, 3: 0.06, 4: 0 };
/**
 * The late bloom: now and then (BLOOM_CHANCE) a Legendary or a Mythic builds up and turns over as one rarity
 * lower — an Epic, a Legendary — and the player takes it for that. Then, BLOOM_WAIT ms on, a wink from the sky:
 * a comet or a meteor shower in its true colour, falling onto the card (BLOOM_HIT ms), and it blooms into what it
 * really is. Like every effect, it only ever climbs to the truth: a wink always pays off.
 * For testing, in dev only: localStorage "omnidle-force-bloom" = "1" (every Legendary and Mythic).
 */
const BLOOM_CHANCE: Partial<Record<Rarity, number>> = { legendary: 0.15, mythic: 0.1 };
const BLOOM_WAIT = 1100;
const BLOOM_HIT = 1500;
/** The rarity just below. */
const lower = (r: Rarity): Rarity => RARITIES[Math.max(0, RARITIES.indexOf(r) - 1)];
type WinkKind = 'comet' | 'shower';
function bloomForced() {
  try {
    return import.meta.env.DEV && localStorage.getItem('omnidle-force-bloom') === '1';
  } catch {
    return false;
  }
}
/** Each step's colour, when it starts (ms from the tap), and the pulse where a card that stops there turns. */
const STEP_LIGHT: Rarity[] = ['common', 'epic', 'legendary', 'mythic', 'omni'];
const STEP_AT: Record<Step, number> = { 0: 0, 1: 0, 2: 700, 3: 1900, 4: 3000 };
const TURN_AT: Record<Step, number> = { 0: 300, 1: 700, 2: 1900, 3: 3000, 4: 4400 };
/** A near-miss: how long the next step flickers before it cracks, and the breath after the crack. */
const FLICKER_MS = 550;
const CRACK_MS = 320;
/** A press on a card longer than this is a hold: it turns over the moment it's let go. */
const CARD_HOLD_MS = 220;
/** The swipe that tears the pack sets the wait before the last star: up to this much longer, the faster it was. */
const TEAR_PAUSE_MAX = 1500;
/**
 * The cosmic events escalate too: every one opens as two planets embracing; a supernova grows out of their
 * meeting, and a Big Bang out of the supernova's collapse. Each scene is cut where it would burst when the
 * event goes further, so the player only learns how far it goes at the pulse where it stops.
 */
const CHAIN: Record<Exclude<CosmicKind, 'wish'>, Exclude<CosmicKind, 'wish'>[]> = {
  collision: ['collision'],
  supernova: ['collision', 'supernova'],
  bigbang: ['collision', 'supernova', 'bigbang'],
};
/** The scenes of an event star, when each starts, and whether it's the last (the one that bursts). */
function stagesOf(s: Star): { kind: CosmicKind; at: number; final: boolean }[] {
  if (s.event === 'wish' || !s.event) return s.event ? [{ kind: s.event, at: s.delay, final: true }] : [];
  let at = s.delay;
  return CHAIN[s.event].map((kind, j, all) => {
    const stage = { kind, at, final: j === all.length - 1 };
    at += COSMIC_BOOM[kind];
    return stage;
  });
}
/** When an event star finally bursts, and how long its whole chain plays. */
const finalBoom = (s: Star) => {
  const st = stagesOf(s);
  const last = st[st.length - 1];
  return last.at + COSMIC_BOOM[last.kind];
};
const chainMs = (kind: CosmicKind) =>
  kind === 'wish' ? COSMIC_MS.wish : CHAIN[kind].slice(0, -1).reduce((t, k) => t + COSMIC_BOOM[k], 0) + COSMIC_MS[kind];

/** A pack's shooting stars: one per card, in its colour, the rarest last. */
interface Star {
  /** Its card's rarity, and the one the star shows first (a rarity lower when it evolves on the way, or before a cosmic event). */
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
  /** It evolves mid-flight: crashes into a second star and bursts into its card's true colour. */
  clash?: boolean;
  /** A black hole is open and this star circles it (and maybe goes in). */
  orbit?: boolean;
}
/**
 * A big opening (over five packs): lighter, or 250 cards' stars and faces lag. With a black hole, only the first
 * ORBIT_FEW stars and the ones it swallows circle it (the rest fly by); the summary's cards keep still
 * (no shines, no glitches: index.css .pack-summary-big) and only the ones on screen are drawn.
 */
const BIG_OPENING = 25;
const ORBIT_FEW = 8;
const STAR_GAP = 260;
/** Many packs at once: the closest two stars come (ms), and over how many cards before the first top card they slow back down. */
const STAR_GAP_MIN = 25;
const SLOW_DOWN = 5;
/** The summary deals its cards quickly: all of them within SUMMARY_DEAL ms (a single pack a little slower, card by card). */
/** The tray under a card being turned: the last ones turned, no more. */
const TRAY_MAX = 10;
/** A shooting star is drawn this long before it sets off, and kept this long after it has crossed. */
const STAR_EARLY = 400;
const SUMMARY_DEAL = 700;
/** The summary scrolls down by itself (px a second): faster the more packs, up to SUMMARY_SCROLL_MAX. */
const SUMMARY_SCROLL_BASE = 200;
const SUMMARY_SCROLL_PER_PACK = 80;
const SUMMARY_SCROLL_MAX = 3600;
const dealAt = (k: number, n: number) => Math.round(n <= 5 ? k * 70 : (k * SUMMARY_DEAL) / Math.max(1, n - 1));
/** The beat of suspense before the last star (the best card's), once every other star has crossed. The screen rumbles meanwhile. */
const LAST_STAR_PAUSE = 1500;
/**
 * A clashing star doesn't cross: it and a second star rush in from both sides, crash together in the
 * middle after CLASH_AT ms and burst (BOOM ms of sparks).
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
/** A star's crossing: the rarer, the slower (a Mythic or Omni takes its time). */
const flight = (r: Rarity) => (prismatic(r) ? 1400 : r === 'legendary' ? 1100 : r === 'epic' ? 950 : 850);

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
  const swallowed = new Map<number, AnomalyId>();
  if (hole) {
    // Never the last ordinary star (the best card's), a wish's, nor a cosmic event's.
    const candidates = cards.slice(0, regular - 1).map((_, k) => k).filter((k) => !wishes.has(k));
    for (const k of candidates) if (rand() < ABSORB_CHANCE) swallowed.set(k, roll());
    if (forced && !swallowed.size && candidates.length) swallowed.set(candidates[Math.floor(rand() * candidates.length)], roll());
  }
  const stars = starsFor(cards, hole ? swallowed : null, events, wishes, rand);
  return { hole, stars, swallowed };
}

function starsFor(cards: Card[], hole: Map<number, AnomalyId> | null, events: Map<number, CosmicEvent>, wishes: Map<number, CosmicEvent>, rand: () => number = Math.random): Star[] {
  // The cards come sorted, the best last — then the cosmic events' cards, each its own scene. Now and then the
  // best card (Epic or better) shows a rarity lower, and evolves on the way.
  const last = cards.length - events.size - 1;
  const evolving = last >= 0 && RARITIES.indexOf(cards[last].rarity) >= 2 && rand() < EVOLVE_CHANCE ? last : -1;
  // Many packs at once: the more cards, the closer the stars come — then, over the last few before the first
  // Legendary or better, back to their own pace, so the top cards' stars take their time.
  const firstTop = cards.findIndex((c, k) => !events.has(k) && top(c.rarity));
  const gapAt = (k: number, gap: number) => {
    if (cards.length <= 5) return gap;
    const fast = Math.max(STAR_GAP_MIN, (gap / 2.5) * Math.min(1, 25 / cards.length));
    if (top(cards[k].rarity) || firstTop < 0) return top(cards[k].rarity) ? gap : fast;
    const toTop = firstTop - k;
    return toTop > 0 && toTop <= SLOW_DOWN ? fast + ((gap - fast) * (SLOW_DOWN + 1 - toTop)) / (SLOW_DOWN + 1) : fast;
  };
  let at = 0;
  let clear = 0;
  // A big drop (a Legendary or better's star, a wish, a star evolving) waits for the one before it to be over:
  // packed close together (many packs at once), they played on top of each other. Ordinary stars still crowd in.
  let bigClear = 0;
  return cards.map((c, i) => {
    const ev = events.get(i);
    if (ev) {
      // A cosmic event: once the sky is empty, a breath, then its scene (the star first in the card's old colour).
      const delay = Math.max(at, clear) + LAST_STAR_PAUSE;
      const star: Star = { to: c.rarity, from: ev.from.rarity, delay, duration: chainMs(ev.kind), top: 40, tilt: -12 - rand() * 10, event: ev.kind, climax: true };
      at = clear = delay + star.duration;
      return star;
    }
    const wish = wishes.get(i);
    if (wish) {
      // A wish: among the other stars, a little slower, caught by a golden comet on the way.
      const star: Star = { to: c.rarity, from: wish.from.rarity, delay: Math.max(at, bigClear), duration: WISH_MS, top: 16 + ((i * 37) % 48) + rand() * 6, tilt: -6 - rand() * 10, event: 'wish' };
      at = star.delay + gapAt(i, STAR_GAP) + 500;
      clear = Math.max(clear, star.delay + star.duration);
      bigClear = star.delay + star.duration;
      return star;
    }
    // The last star waits for the sky to empty, then a moment more.
    if (i === last && i > 0) at = Math.max(at, clear) + LAST_STAR_PAUSE;
    // With a black hole, every star but the last circles it first: a longer way. A big opening: only the first few
    // and the ones it swallows (BIG_OPENING).
    const orbit = !!hole && i !== last && (cards.length <= BIG_OPENING || i < ORBIT_FEW || hole.has(i));
    const rank = RARITIES.indexOf(c.rarity);
    const from = i === evolving ? RARITIES[rank >= 3 && rand() < COSMIC.deepFake ? rank - 2 : rank - 1] : c.rarity;
    const clash = from !== c.rarity;
    const big = !orbit && (top(c.rarity) || clash);
    if (big) at = Math.max(at, bigClear);
    const star: Star = { to: c.rarity, from, delay: at, duration: clash ? CLASH_AT + BOOM : orbit ? ORBIT_MS : flight(c.rarity), top: 16 + ((i * 37) % 48) + rand() * 6, tilt: -10 - rand() * 16, climax: i === last && i > 0, clash, orbit };
    // Many cards (several packs at once): the stars come closer together; a top card's star leaves a little room.
    at += gapAt(i, orbit ? ORBIT_GAP : STAR_GAP) + (top(c.rarity) && !orbit ? 250 : 0);
    clear = Math.max(clear, star.delay + star.duration);
    if (big) bigClear = star.delay + star.duration;
    return star;
  });
}
/**
 * The planet on the edge of the sky, drawn from what the stars show at first: an icy moon for Commons and
 * Rares, a violet gas giant with a ring for an Epic, a bigger one with a moon for two or more, a golden giant
 * with two moons and sparkles for a Legendary, an iridescent world with double rings for a Mythic or better.
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
 * The planet on the edge of the sky. Each time a star turns out rarer than it showed (evolving, a wish, a cosmic
 * event), a spark flies to it and it grows into the next world, with a flash. With a sky moment "capture", it catches a passing moon and keeps it in orbit.
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

/**
 * The fly-by: now and then a few of the pack's own cards drift across the sky as small glowing tokens before the
 * last star — only cards really in the pack (never one that isn't: no false hope), out of focus, haloed in the
 * colour their star shows. Never all of them, so it spoils nothing: one to FLYBY_MAX, the last slowest and half
 * lost in its own glow — the best card only now and then (FLYBY_BEST), else another of the pack's. Likelier the
 * better the pack (FLYBY_CHANCE by its best card); never a cosmic event's card or a wish's (their scenes are the
 * surprise). In a franchise or kind-of-work pack, its icon twinkles among them.
 * For testing, in dev only: localStorage "omnidle-force-flyby" = "1".
 */
const FLYBY_CHANCE: Record<Rarity, number> = { common: 0.15, rare: 0.15, epic: 0.3, legendary: 0.5, mythic: 0.8, omni: 0.8 };
const FLYBY_MAX = 3;
const FLYBY_BEST = 0.35;
interface Flyer {
  card: Card;
  /** The colour of its halo: what its star shows (an evolving star's first colour). */
  color: Rarity;
  delay: number;
  duration: number;
  top: number;
  size: number;
  /** The best card's: last, slowest, deepest in its glow. */
  best: boolean;
  tilt: number;
}
function flybyFor(ordered: Card[], shown: Rarity[], regular: number, wishes: Map<number, CosmicEvent>, from: number, until: number, best: Rarity, rand: () => number = Math.random): Flyer[] {
  let force = false;
  try {
    if (import.meta.env.DEV) force = localStorage.getItem('omnidle-force-flyby') === '1';
  } catch {
    // No storage: chance alone.
  }
  if (regular < 2 || until - from < 1500 || !(force || rand() < FLYBY_CHANCE[best])) return [];
  // The ordinary cards with a picture (no wish: its comet is the surprise), the best last.
  const pool = ordered.slice(0, regular).map((card, k) => ({ card, k })).filter(({ card, k }) => card.image && !wishes.has(k));
  if (pool.length < 2) return [];
  // The big, slow one: the best card now and then, else another of the pack's; one or two more before it.
  const shuffled = pool.slice(0, -1).sort(() => rand() - 0.5);
  const top = rand() < FLYBY_BEST ? pool[pool.length - 1] : shuffled.pop()!;
  const rest = shuffled.slice(0, 1 + Math.floor(rand() * (FLYBY_MAX - 1))).sort((a, b) => a.k - b.k);
  const bestMs = Math.min(3600, until - from);
  const others = Math.max(1200, Math.min(2600, until - from - 400));
  const flyers: Flyer[] = rest.map(({ card, k }, j) => ({
    card,
    color: shown[k],
    delay: from + ((until - bestMs - from) * j) / Math.max(1, rest.length) + rand() * 120,
    duration: others + rand() * 400,
    top: 14 + rand() * 62,
    size: 40 + RARITIES.indexOf(shown[k]) * 4 + rand() * 6,
    best: false,
    tilt: -14 + rand() * 28,
  }));
  flyers.push({ card: top.card, color: shown[top.k], delay: until - bestMs, duration: bestMs, top: 30 + rand() * 30, size: 76, best: true, tilt: -6 + rand() * 12 });
  return flyers;
}
/** The fly-by's tokens drifting across the sky (and the pack's icon twinkling among them). */
function Flyby({ flyers, glyph }: { flyers: Flyer[]; glyph?: string }) {
  if (!flyers.length) return null;
  const start = flyers[0].delay;
  const end = Math.max(...flyers.map((f) => f.delay + f.duration));
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {flyers.map((f, k) => {
        const c = RARITY_LIGHT[f.color];
        const focus = f.card.focus;
        return (
          <div key={k} className="absolute left-0 w-full" style={{ top: `${f.top}%`, transform: `rotate(${f.tilt * 0.3}deg)` }}>
            <div className={`pack-flyby ${f.best ? 'pack-flyby-best' : ''}`} style={{ animationDelay: `${f.delay}ms`, animationDuration: `${f.duration}ms`, ['--fly-tilt' as string]: `${f.tilt}deg` }}>
              <div
                className={`relative overflow-hidden rounded-full border-2 ${rainbowy(f.color) ? 'pack-twinkle-rainbow' : ''}`}
                style={{ width: f.size, height: f.size, borderColor: c, boxShadow: `0 0 ${f.best ? 34 : 14}px ${c}, 0 0 ${f.best ? 70 : 26}px ${c}88`, background: '#0b0618' }}
              >
                <img
                  src={f.card.image}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  style={{ objectPosition: focus ? `${focus.x}% ${focus.y}%` : '50% 25%', filter: f.best ? 'blur(3px) brightness(1.15)' : 'blur(1.2px)' }}
                />
                {/* Lost in its own light: a glow over the picture, thicker on the best one. */}
                <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, transparent ${f.best ? 25 : 45}%, ${c}${f.best ? 'cc' : '77'} 100%)` }} />
              </div>
            </div>
          </div>
        );
      })}
      {glyph &&
        Array.from({ length: 6 }, (_, k) => (
          <span
            key={`g${k}`}
            className="pack-flyby-glyph absolute text-2xl"
            style={{ left: `${10 + k * 15 + (k % 2) * 4}%`, top: `${18 + ((k * 29) % 58)}%`, animationDelay: `${start + ((end - start) * k) / 6}ms` }}
          >
            {glyph}
          </span>
        ))}
    </div>
  );
}

/** A great comet crossing the top of the sky, slow, its tail streaming behind in the best colour the stars show. */
function Comet({ at, color }: { at: number; color: string }) {
  return (
    <div className="sky-comet-way absolute left-0 top-[14%] w-full">
      <div className="sky-comet" style={{ animationDelay: `${at}ms`, ['--comet' as string]: color }}>
        <div className="sky-comet-tail" />
        <div className="sky-comet-head" />
      </div>
    </div>
  );
}

/** The late bloom's wink: a comet (with a meteor shower, now and then) in the card's true colour, falling onto it. */
function BloomWink({ kind, rarity }: { kind: WinkKind; rarity: Rarity }) {
  const colors = rainbowy(rarity) ? RAINBOW : [RARITY_LIGHT[rarity]];
  const streaks = useMemo(
    () =>
      kind === 'shower'
        ? Array.from({ length: 20 }, (_, k) => ({ x: -10 + Math.random() * 100, y: -10 + Math.random() * 55, delay: Math.random() * (BLOOM_HIT - 600), len: 8 + Math.random() * 12, color: colors[k % colors.length] }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {streaks.map((s, k) => (
        <span key={k} className="bloom-streak absolute" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.len}vmin`, animationDelay: `${s.delay}ms`, ['--bloom' as string]: s.color }} />
      ))}
      <div className="bloom-comet-way">
        <div className={`bloom-comet ${kind === 'comet' ? 'bloom-comet-big' : ''}`} style={{ animationDuration: `${BLOOM_HIT}ms`, ['--comet' as string]: colors[0] }}>
          <div className="sky-comet-tail" />
          <div className="sky-comet-head" />
        </div>
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
function Space({ tier, evolved, feed, moment, cometAt, cometColor }: { tier: SkyTier; evolved: number; feed: number; moment: SkyMoment | null; cometAt: number; cometColor: string }) {
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
      {moment === 'comet' && <Comet at={cometAt} color={cometColor} />}
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
      <Painted
        className="pack-ambient-rays absolute left-1/2 top-[40%] aspect-square w-[80vmax]"
        size={384}
        paint={(ctx, s) => (paintWedges(ctx, s, [[hexA(tint, '10'), 0, 5]], 22), maskRadial(ctx, s, s, [[0, 1], [0.96, 0]]))}
      />
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
 * screen and burst in the colour of the rarity it truly is.
 */
/**
 * A shooting star drawn only while it flies (from `from` to `to` ms after it's placed): fifty packs fly two hundred
 * and fifty, and each one waiting its turn kept its glowing layers alive all show long. `children` gets how late it
 * came in, to take off its CSS delay (counted from when it's drawn, not from the show's start).
 */
function InFlight({ from, to, children }: { from: number; to: number; children: (late: number) => ReactNode }) {
  const placed = useRef(performance.now());
  const [late, setLate] = useState<number | null>(() => (from <= 0 ? 0 : null));
  const [gone, setGone] = useState(false);
  useEffect(() => {
    // Counted from when it was placed: a star pushed back (the last one, held for suspense) keeps its place in time.
    const since = performance.now() - placed.current;
    const on = from > since ? window.setTimeout(() => setLate(performance.now() - placed.current), from - since) : (setLate((l) => l ?? since), 0);
    const off = window.setTimeout(() => setGone(true), Math.max(0, to - since));
    return () => (window.clearTimeout(on), window.clearTimeout(off));
  }, [from, to]);
  return late === null || gone ? null : <>{children(late)}</>;
}

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
/**
 * Soft light painted once into a small canvas, stretched by the graphics card. As CSS gradients the size of the
 * screen, the black hole's glows and the nebula took the browser several frames to draw the first time: the
 * black hole showing late or in pieces, pale squares where the screen wasn't drawn yet.
 */
function Painted({ className, size, paint, w = size, h = size, style }: { className: string; size: number; paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; w?: number; h?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    paint(ctx, w, h);
  });
  return <canvas ref={ref} width={w} height={h} className={className} style={style} aria-hidden />;
}
/** A CSS `radial-gradient(circle, …)` (its stops reach the farthest corner) painted over the whole square canvas. */
const paintRadial = (stops: [number, string][]) => (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, (s / 2) * Math.SQRT2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};
const HOLE_GLOW = paintRadial([[0, 'rgba(124,58,237,0.35)'], [0.18, 'rgba(124,58,237,0.35)'], [0.38, 'rgba(236,72,153,0.12)'], [0.66, 'rgba(236,72,153,0)']]);
const HOLE_LENS = paintRadial([[0, 'rgba(255,220,170,0)'], [0.3, 'rgba(255,220,170,0)'], [0.37, 'rgba(255,220,170,0.16)'], [0.46, 'rgba(196,181,253,0.12)'], [0.56, 'rgba(124,58,237,0.06)'], [0.68, 'rgba(124,58,237,0)']]);
/** Keeps what's painted only where a radial fade allows it: alpha along the radius (1 = half the canvas × k). */
const maskRadial = (ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, number][], k = 1) => {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(w / 2, h / 2);
  ctx.scale((w / 2) * k, (h / 2) * k);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(-10, -10, 20, 20);
  ctx.restore();
};
/** Wedges of light turning round the middle: each [colour, from°, to°], repeated every `period` degrees. */
const paintWedges = (ctx: CanvasRenderingContext2D, s: number, wedges: [string, number, number][], period: number) => {
  const c = s / 2;
  for (let base = 0; base < 360; base += period)
    for (const [color, a, b] of wedges) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, s, ((base + a - 90) * Math.PI) / 180, ((base + b - 90) * Math.PI) / 180);
      ctx.closePath();
      ctx.fill();
    }
};
const hexA = (color: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(color) ? color + alpha : color);
/** A Mythic's or Omni's halo round the pack: its colours turning in a soft ring. */
const HALO_COLORS = { mythic: ['#ff4fd8', '#ffcd3c', '#3cff9e', '#3cc7ff', '#a855f7', '#ff4fd8'], omni: ['#ff3b4e', '#ffcd3c', '#ffffff', '#ff3b4e', '#ffcd3c', '#ff3b4e'] };
const paintHalo = (colors: string[]) => (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createConicGradient(-Math.PI / 2, s / 2, s / 2);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  maskRadial(ctx, s, s, [[0, 0], [0.28, 0], [0.42, 1], [0.7, 0]], Math.SQRT2);
};
/**
 * The cone of light out of a torn pack: as wide as the pack at the bottom, widening upward, its sides and top
 * feathered well inside the canvas, so it has no edge whatever the screen's shape (a CSS mask set from a point
 * below it clipped the light against its box on some screens: a pale rectangle round the beam).
 */
const paintBeam = (stops: [number, string][]) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, h, 0, 0);
  for (const [at, c] of stops) g.addColorStop(at, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // The cone, drawn row by row on its own canvas, then kept from the light in one go (destination-in on each
  // row would wipe the rows already kept).
  const cone = document.createElement('canvas');
  cone.width = w;
  cone.height = h;
  const m = cone.getContext('2d');
  if (!m) return;
  for (let y = 0; y < h; y++) {
    const up = 1 - y / h; // 0 at the tear, 1 at the top
    const half = w * (0.2 + 0.24 * up); // the pack is ~38% of the width
    const soft = w * (0.04 + 0.14 * up);
    const row = m.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
    const f = Math.min(0.5, soft / (2 * half));
    row.addColorStop(0, 'rgba(0,0,0,0)');
    row.addColorStop(f, '#000');
    row.addColorStop(1 - f, '#000');
    row.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = row;
    m.fillRect(0, y, w, 1);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(cone, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
};
/** The black hole's band of hot light, flattened, crossing it. */
const HOLE_BAND = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  ['#ff9d4d', '#fff1d0', '#ff6a3d', '#ffd27a', '#ff4fd8', '#ffb86b', '#fff1d0', '#ff9d4d'].forEach((c, i, all) => g.addColorStop(i / (all.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  maskRadial(ctx, w, h, [[0, 0], [0.4, 0], [0.56, 1], [0.76, 1], [1, 0]]);
};

/** The accretion disc: hot light round the dark, in a ring (it turns whole). */
const HOLE_DISC = (ctx: CanvasRenderingContext2D, s: number) => {
  const c = ctx.createConicGradient(-Math.PI / 2, s / 2, s / 2);
  const stops: [number, string][] = [[0, '#ffb86b'], [0.2, '#ff4fd8'], [0.32, 'rgba(255,79,216,0)'], [0.5, '#7c3aed'], [0.64, '#3cc7ff'], [0.76, 'rgba(60,199,255,0)'], [0.9, '#ffd27a'], [1, '#ffb86b']];
  for (const [at, color] of stops) c.addColorStop(at, color);
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, s, s);
  // Its ring: a radial mask, as the CSS one was.
  ctx.globalCompositeOperation = 'destination-in';
  paintRadial([[0, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,0)'], [0.46, '#000'], [0.58, '#000'], [0.7, 'rgba(0,0,0,0)']])(ctx, s);
  ctx.globalCompositeOperation = 'source-over';
};

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
  // Closed: gone from the page, not left spinning, invisible.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGone(true), until + 800);
    return () => window.clearTimeout(t);
  }, [until]);
  if (gone) return null;
  return (
    <div className="pack-hole pointer-events-none absolute z-10" style={{ left: `${HOLE.x}%`, top: `${HOLE.y}%`, ['--hole-life' as string]: `${until + 600}ms` }} aria-hidden>
      <Painted className="pack-hole-glow" size={96} paint={HOLE_GLOW} />
      <Painted className="pack-hole-lens" size={96} paint={HOLE_LENS} />
      <Painted className="pack-hole-disc" size={192} paint={HOLE_DISC} />
      <Painted className="pack-hole-band" size={256} w={256} h={52} paint={HOLE_BAND} />
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
      <Painted className="pack-hole-band pack-hole-band-front" size={256} w={256} h={52} paint={HOLE_BAND} />
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
function Orbiter({ star, k, thick, swallowed, light }: { star: Star; k: number; thick: number; swallowed: boolean; /** A big opening: a smaller spark. */ light?: boolean }) {
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
    // The spark, then gone (dozens of them in a big opening stayed drawn).
    const at = star.delay + star.duration - 80;
    const t = window.setTimeout(() => setSpark(true), at);
    const off = window.setTimeout(() => setSpark(false), at + 1400);
    return () => (window.clearTimeout(t), window.clearTimeout(off));
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
            <Burst color={RARITY_LIGHT[star.to]} count={light ? 7 : 16} rainbow={rainbowy(star.to)} />
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

/** Its children until `ms`, then nothing (a cosmic scene cut where the next takes over). */
function Until({ ms, children }: { ms: number; children: React.ReactNode }) {
  const gone = useAt(ms);
  return gone ? null : <>{children}</>;
}

/** An event's scenes, one after the other, each cut at its burst but the last (see CHAIN). */
function Chain({ star }: { star: Star }) {
  const stages = stagesOf(star);
  return (
    <>
      {stages.map((st, j) => {
        const s = { ...star, delay: st.at, event: st.kind };
        const scene = st.kind === 'collision' ? <Embrace star={s} /> : st.kind === 'supernova' ? <Supernova star={s} /> : <BigBang star={s} />;
        return st.final ? <div key={j}>{scene}</div> : <Until key={j} ms={st.at + COSMIC_BOOM[st.kind]}>{scene}</Until>;
      })}
    </>
  );
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

/** The name of a cosmic event across the top as it starts; once it bursts, only that the card changed (what into: its turn tells). */
const rarityName = (r: Rarity) => RARITY_INFO[r].name.toUpperCase();
function CosmicTitle({ star, boom }: { star: Star; boom: boolean }) {
  const ev = COSMIC_NAME[star.event!];
  const on = useAt(star.delay);
  if (!on) return null;
  return (
    <div className="absolute inset-x-0 top-[9%] z-30 px-4 text-center">
      <p className="pack-cosmic-title text-balance font-display text-xl font-black tracking-[0.18em] text-white sm:text-4xl sm:tracking-[0.3em]">
        {ev.icon} {ev.name}
      </p>
      {boom && (
        <p className="pack-cosmic-result mt-2 font-display text-base font-black tracking-[0.18em] sm:text-2xl sm:tracking-[0.25em]">
          <span style={{ color: RARITY_LIGHT[star.from] }}>{rarityName(star.from)}</span>
          <span className="text-white"> → </span>
          <span className={star.to === 'omni' ? 'card-omni-name' : star.to === 'mythic' ? 'card-mythic-name' : ''} style={prismatic(star.to) ? undefined : { color: RARITY_LIGHT[star.to] }}>
            {rarityName(star.to)}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * A nebula behind the sky: soft clouds in the pack's colours drifting and turning, brighter with each world
 * the planet grows into (glowing cosmic layers; looks only).
 */
function Nebula({ colors, tier }: { colors: string[]; tier: SkyTier }) {
  const c = (k: number) => colors[k % colors.length] ?? '#a78bfa';
  // Clouds 60 × 42 vmax, set at (left, top) of the scene and pulled back a fifth of their size; alpha in hex.
  const clouds: [number, number, string, string][] = [[8, 12, c(0), '66'], [55, 4, c(1), '55'], [30, 48, c(2), '4d'], ...(tier >= 3 ? [[62, 52, c(colors.length - 1), '66'] as [number, number, string, string]] : [])];
  // A canvas a tenth of the screen's size, enough for light this soft.
  const W = 192;
  const H = Math.max(60, Math.round((W * window.innerHeight) / Math.max(1, window.innerWidth)));
  const vmax = Math.max(W, H) / 100;
  const paint = (ctx: CanvasRenderingContext2D) => {
    for (const [left, top, color, alpha] of clouds) {
      const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : '#a78bfa';
      const rx = 30 * vmax;
      const ry = 21 * vmax;
      const cx = (left / 100) * W - 12 * vmax + rx;
      const cy = (top / 100) * H - 8.4 * vmax + ry;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, hex + alpha);
      g.addColorStop(1, hex + '00');
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  };
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.28 + tier * 0.13, transition: 'opacity 0.9s ease-out' }}>
      <Painted className="absolute inset-0 size-full" size={W} w={W} h={H} paint={paint} />
    </div>
  );
}

/** Each build-up step's fusion colours: the light pouring into the card. */
const FUSION: Record<Step, string[]> = {
  0: ['#ffffff'],
  1: [RARITY_LIGHT.epic, '#f0abfc', '#ffffff'],
  2: [RARITY_LIGHT.legendary, '#fde68a', RARITY_LIGHT.epic, '#ffffff'],
  3: [...RAINBOW, '#ffffff'],
  4: ['#ff3b3b', '#ffcd3c', '#ff7a1a', '#ffffff', '#ffcd3c'],
};
/**
 * A fusion: sparks streaming in from all around and merging into the card, more and faster at each step, with a
 * glowing core swelling behind it (looks only: the card is already what it is).
 */
function Fusion({ step }: { step: Step }) {
  const n = [0, 18, 30, 44, 60][step];
  const colors = FUSION[step];
  const sparks = useMemo(
    () =>
      Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = 120 + Math.random() * 110;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d * 1.25, delay: Math.random() * 900, size: 3 + Math.random() * (2 + step), color: colors[k % colors.length] };
      }),
    [n, step, colors],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <div className="pack-fusion-core absolute left-1/2 top-1/2 rounded-full" style={{ background: `radial-gradient(circle, #fff 0%, ${colors[0]} 30%, transparent 70%)`, ['--core' as string]: `${1.4 + step * 0.45}` }} />
      {sparks.map((p, k) => (
        <span
          key={k}
          className="pack-fusion-spark absolute left-1/2 top-1/2 rounded-full"
          style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 ${p.size * 3}px ${p.color}`, ['--fx' as string]: `${p.x}px`, ['--fy' as string]: `${p.y}px`, animationDelay: `${p.delay}ms`, animationDuration: `${1100 - step * 150}ms` }}
        />
      ))}
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
              🌠 WISH · <span style={{ color: RARITY_LIGHT[star.from] }}>{rarityName(star.from)}</span> → <span style={{ color: RARITY_LIGHT[star.to] }}>{rarityName(star.to)}</span>
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
function PackStats({ deck, fresh, golden, packs = 1 }: { deck: Card[]; fresh: Set<string>; golden: boolean; packs?: number }) {
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
                {s.added > 0 && <div className="pack-bar-fill absolute inset-y-0 rounded-full bg-[#fbbf24]" style={{ left: `${before}%`, width: `${Math.max(0.8, now - before)}%`, animationDelay: `${0.1 + Math.min(k * 0.04, 0.5)}s` }} />}
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
        {golden ? (packs > 1 ? `One of the ${packs} packs was golden! The count to the next one starts again. ` : 'A golden pack! The count to the next one starts again. ') : goldenNext(goldenCount) ? 'Your next pack is golden! ' : `A golden pack in ${goldenLeft} pack${goldenLeft === 1 ? '' : 's'}. `}
        {gotTop ? 'A Legendary or better: your luck starts again from ×1.' : luck >= PITY_MAX ? 'Luck at its highest: the next pack has the best odds it can get.' : 'No Legendary this time: the next pack has better odds of one.'}
      </p>
    </div>
  );
}

/** Light rays turning behind a card (epic and up; a mythic's in rainbow). */
function Rays({ color, strong, rainbow }: { color: string; strong: boolean; rainbow?: boolean }) {
  // Painted once (a masked, turning gradient was redrawn by the graphics card every frame).
  const paint = (ctx: CanvasRenderingContext2D, s: number) => {
    if (rainbow) paintWedges(ctx, s, [['#ff4fd877', 0, 6], ['#ffcd3c77', 12, 18], ['#3cc7ff77', 24, 30]], 36);
    else paintWedges(ctx, s, [[hexA(color, strong ? '66' : '33'), 0, 8]], 24);
    maskRadial(ctx, s, s, [[0, 1], [0.2, 1], [0.65, 0]], Math.SQRT2);
  };
  return <Painted className="pack-rays pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[220%] rounded-full" size={256} paint={paint} />;
}

/**
 * Opening a pack, in four beats: swipe across the pack to tear it (light pours out, in the best colour inside),
 * a shooting star in its card's colour crosses the screen per card, the cards come one at a time from the deck
 * — each builds up as far as its rarity before it turns, light fusing into it, then bursts — and the five are
 * laid out together. The cards are drawn before any of it; the show only dresses them (see EVOLVE_CHANCE, Step).
 */
export function PackOpening({ pack, times = 1, cards, events = [], fresh, onClose, onAgain, canAgain, golden = false }: { pack: Pack; times?: number; cards: Card[]; events?: CosmicEvent[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean; golden?: boolean }) {
  // While it's open, the page underneath stops drawing what can't be seen (see html.pack-open in index.css).
  useEffect(() => {
    document.documentElement.classList.add('pack-open');
    return () => document.documentElement.classList.remove('pack-open');
  }, []);
  // Its pictures, fetched and decoded as the pack is torn: the fly-by and the cards then show at once, not loading in.
  useEffect(() => {
    for (const c of cards) {
      if (!c.image) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = c.image;
      img.decode?.().catch(() => {});
    }
  }, [cards]);
  // A golden pack's own light, gold where an ordinary pack's is lilac.
  const packLight = golden ? GOLDEN_LIGHT : PACK_LIGHT;
  const counts = useProgress((s) => s.cards);
  // An Ascended wrapper opens its own way (a golden pack keeps its gold, and the usual opening).
  const opening = useProgress((s) => (golden ? undefined : openingOf(s.wrapper)));
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
  // The swipe's speed sets the wait before the last star (TEAR_PAUSE_MAX): every star from it on comes later.
  const [pauseExtra, setPauseExtra] = useState(0);
  const extraRef = useRef(0);
  const peakSwipe = useRef(0);
  const shifted = (extra: number) => {
    const climaxAt = cosmos.stars.find((st) => st.climax)?.delay ?? Infinity;
    return extra ? cosmos.stars.map((st) => (st.delay >= climaxAt ? { ...st, delay: st.delay + extra } : st)) : cosmos.stars;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stars = useMemo(() => shifted(pauseExtra), [cosmos, pauseExtra]);
  // The deck: the ordinary cards, those back from the black hole, then the cosmic events'.
  const order = useMemo(() => {
    const ks = ordered.map((_, k) => k).filter((k) => !evAt.has(k));
    return [...ks.filter((k) => !cosmos.swallowed.has(k)), ...ks.filter((k) => cosmos.swallowed.has(k)), ...evAt.keys()];
  }, [ordered, evAt, cosmos]);
  const deck = useMemo(() => order.map((k) => ordered[k]), [order, ordered]);
  /** How each card of the deck builds up as it turns: as far as its rarity, and whether it near-misses the next step. */
  const plans = useMemo(() => {
    const forced = bloomForced();
    return deck.map((c) => {
      const bloom = (forced && !!BLOOM_CHANCE[c.rarity]) || Math.random() < (BLOOM_CHANCE[c.rarity] ?? 0);
      return { step: stepOf(c.rarity), near: !bloom && Math.random() < NEAR_MISS[stepOf(c.rarity)], bloom };
    });
  }, [deck]);
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
  // The best colour the stars show at first (an evolving star's first colour, a cosmic card's old one): the
  // tear's glow, the comet's tail and the planet's first world. It only climbs from there.
  const tease = useMemo(() => cosmos.stars.reduce<Rarity>((b, st) => (RARITIES.indexOf(st.from) > RARITIES.indexOf(b) ? st.from : b), 'common'), [cosmos]);
  // The planet starts from what the stars show, and grows a world each time one turns out rarer (at its burst).
  const skyStepsOf = (list: Star[]) => {
    const shown = list.map((st) => st.from);
    let now = skyTier(shown);
    const steps: { at: number; tier: SkyTier }[] = [];
    list
      .map((st, k) => ({ k, at: st.from === st.to ? null : st.event ? finalBoom(st) : st.delay + CLASH_AT }))
      .filter((x): x is { k: number; at: number } => x.at !== null)
      .sort((a, b) => a.at - b.at)
      .forEach(({ k, at }) => {
        shown[k] = list[k].to;
        const t = skyTier(shown);
        if (t > now) steps.push({ at: at + 450, tier: (now = t) });
      });
    return steps;
  };
  // The great comet (a sky moment) crosses during the wait before the last star: as if it brought something.
  const cometAt = Math.max(0, (stars.find((st) => st.climax)?.delay ?? 1500) - LAST_STAR_PAUSE - pauseExtra - 900);
  const [skyNow, setSkyNow] = useState<{ tier: SkyTier; n: number }>(() => ({ tier: skyTier(cosmos.stars.map((st) => st.from)), n: 0 }));
  const [feed, setFeed] = useState(0);
  const moment = useMemo(() => skyMomentFor(), []);
  // The fly-by (FLYBY_CHANCE): from soon after the first star to just before the last one (a fast tear's longer
  // wait included — the best token drifts by in it).
  const flyers = useMemo(() => {
    const climax = stars.find((st) => st.climax)?.delay;
    if (climax === undefined) return [];
    return flybyFor(ordered, cosmos.stars.map((st) => st.from), regular, wishAt, 400, climax - 250, best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cosmos, pauseExtra]);
  const [kept, setKept] = useState<Record<number, boolean>>({});
  const setAnomaly = useProgress((s) => s.setAnomaly);
  const addAnomalyOption = useProgress((s) => s.addAnomalyOption);
  // An anomaly left undecided as the opening ends (skipped past, never chosen): the card keeps what it wore, and this
  // one waits among its others, to switch to in the Album.
  const leaveUndecided = () => {
    for (const [at, a] of pending) if (!(at in kept) && deck[at]) addAnomalyOption(deck[at].id, a);
  };
  const close = () => (leaveUndecided(), onClose());
  const again = () => (leaveUndecided(), onAgain());
  const decide = (k: number, keep: boolean) => {
    const a = pending.get(k);
    if (!a || k in kept) return;
    setKept((x) => ({ ...x, [k]: keep }));
    if (keep) (setAnomaly(deck[k].id, a), sfx.streak());
    else sfx.click();
  };
  /** The black hole's cards still waiting on a choice (the summary's Keep all / Leave all). */
  const undecided = [...pending.keys()].filter((k) => !(k in kept));
  const decideAll = (keep: boolean) => {
    if (!undecided.length) return;
    setKept((x) => ({ ...x, ...Object.fromEntries(undecided.map((k) => [k, keep])) }));
    if (keep) {
      for (const k of undecided) setAnomaly(deck[k].id, pending.get(k)!);
      sfx.streak();
    } else sfx.click();
  };
  // Several cards back from the black hole and not chosen yet: all at once (at the top of the summary and at its end).
  const allChoice = undecided.length > 1 && (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border border-[#a78bfa]/60 bg-[#1b1530]/90 p-3 text-center text-white">
      <p className="font-display text-xs font-bold tracking-widest">🕳️ {undecided.length} CARDS CAME BACK CHANGED</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={() => decideAll(true)} className="rounded-md bg-[#a78bfa] px-3 py-1 font-display text-sm font-bold text-[#1b1530]">
          Keep all
        </button>
        <button type="button" onClick={() => decideAll(false)} className="rounded-md border border-white/40 px-3 py-1 font-display text-sm font-bold">
          Leave all
        </button>
      </div>
    </div>
  );
  // When the black hole closes: once every star round it has flown on or gone in (the last star comes after).
  const holeEnd = Math.max(0, ...stars.slice(0, regular - 1).map((s) => s.delay + s.duration));
  /** When the black hole swallows each star it takes (it flares). */
  const gulps = useMemo(() => [...cosmos.swallowed.keys()].map((k) => stars[k].delay + stars[k].duration - 80), [cosmos, stars]);
  const tints = useMemo(() => [...new Set(cosmos.stars.map((st) => RARITY_LIGHT[st.to]))], [cosmos]);
  // The tear glows in the best colour the stars show (an evolving star's first one: it may still get better).
  const shownBest = tease;
  const glow = RARITY_LIGHT[shownBest];
  // Mythic and Omni can't pass for an Epic: a rainbow (Mythic) or a red and gold (Omni) aura, glows on glows.
  const special = shownBest === 'mythic' || shownBest === 'omni' ? shownBest : null;
  const auraFilter = (n: number) =>
    special === 'mythic'
      ? `drop-shadow(0 0 ${n}px #ff4fd8) drop-shadow(0 0 ${n * 1.6}px #3cc7ff) drop-shadow(0 0 ${n * 2.2}px #ffcd3c)`
      : special === 'omni'
        ? `drop-shadow(0 0 ${n}px #ff3b4e) drop-shadow(0 0 ${n * 1.6}px #ffcd3c) drop-shadow(0 0 ${n * 2.2}px #ff3b4e)`
        : `drop-shadow(0 0 ${n}px ${glow})`;
  // The light pouring out of the tear, from the bottom up: [where, colour].
  const beam: [number, string][] =
    special === 'mythic'
      ? [[0, '#ffffff'], [0.12, '#ff4fd8'], [0.28, '#ffcd3c'], [0.44, '#3cff9e'], [0.6, '#3cc7ff'], [0.74, '#a855f799'], [0.92, '#a855f700']]
      : special === 'omni'
        ? [[0, '#ffffff'], [0.14, '#ff3b4e'], [0.34, '#ffcd3c'], [0.58, '#ff3b4e99'], [0.9, '#ff3b4e00']]
        : [[0, glow], [0.3, hexA(glow, '55')], [0.85, hexA(glow, '00')]];
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState<number | null>(null);
  const [tear, setTear] = useState(0);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [charging, setCharging] = useState(false);
  /** How far the card turning now has climbed (Step): what its build-up shows. */
  const [step, setStep] = useState<Step>(0);
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
  // The tear's live sound (the best shown colour's tone), its jagged line, its sparks.
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
    // The faster the swipe, the longer the sky holds its breath before the last star (a tap: no longer).
    extraRef.current = Math.round(Math.min(1, peakSwipe.current / FAST_SWIPE) * TEAR_PAUSE_MAX);
    setPauseExtra(extraRef.current);
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
      fly(0);
    }, 950);
  };
  /**
   * The shooting stars, from `from` ms into their show: 0 is all of it; a skip to a rare scene (a cosmic event)
   * starts just before it, the stars already gone and the sky as it would be by then.
   */
  const fly = (from: number) => {
    flyFrom.current = from;
    setFlownFrom(from);
    meteorStart.current = Date.now() - from;
    setPhase('meteor');
    // A star a card: each its own whoosh, the last the long one; a clash crashes and bursts.
    // The black hole: it opens with a hum as the first star flies.
    if (cosmos.hole) laterIn(() => (sfx.blackHole(), rumble(stage.current, 1800, 0.3, 3)), 0);
    // A star it pulls in: a rush of air, and a jolt as it goes.
    for (const k of cosmos.swallowed.keys()) laterIn(() => (sfx.swallow(), jolt(7, 400)), cosmos.stars[k].delay + cosmos.stars[k].duration - 300);
    // The stars as they now fly (the swipe may have pushed the last one back).
    const ss = shifted(extraRef.current);
    ss.forEach((s, k) => {
      if (s.event) return cosmicCues(s);
      laterIn(() => (k === regular - 1 ? sfx.meteor(top(s.to)) : sfx.whoosh()), s.delay);
      // An evolving star: the crash, a hard shake and the burst in its true colour.
      if (s.clash)
        laterIn(() => {
          sfx.clash();
          sfx.shimmer(5);
          jolt(14, 520);
          setFlash({ color: RARITY_LIGHT[s.to], key: Date.now(), rainbow: rainbowy(s.to) });
        }, s.delay + CLASH_AT);
    });
    // The planet evolving: a chime as it grows (already grown, for the steps a skip went past).
    skyStepsOf(ss).forEach(({ at, tier }, j) => {
      if (at < from) return (setFeed(j + 1), setSkyNow({ tier, n: j + 1 }));
      laterIn(() => setFeed(j + 1), at - 450);
      laterIn(() => (setSkyNow({ tier, n: j + 1 }), sfx.shimmer(4 + tier * 2)), at);
    });
    // A sky moment: its own sound.
    if (moment === 'comet') laterIn(() => (sfx.shimmer(10), sfx.suspense(2)), cometAt + 400);
    if (moment === 'shower') for (let t = 400; t < 3000; t += 450) laterIn(() => sfx.shimmer(2), t);
    if (moment === 'capture') laterIn(() => sfx.shimmer(6), 3300);
    // The wait before the last star (and each cosmic event): the screen trembles, harder and harder, to a quiet rising drone.
    // The first wait is longer the faster the pack was torn (its heartbeat with it).
    ss.filter((s) => s.climax).forEach((s, j) => {
      const pause = LAST_STAR_PAUSE + (j === 0 ? extraRef.current : 0);
      if (s.delay - pause < from) return;
      laterIn(() => (rumble(stage.current, pause, 0.5, 7), sfx.suspense(pause / 1000)), s.delay - pause);
      if (j === 0) heartbeat(s.delay - pause - from, s.delay - from);
    });
    const end = Math.max(...ss.map((s) => s.delay + s.duration));
    laterIn(() => setFlash({ color: packLight, key: Date.now() }), end - 100);
    laterIn(toReveal, end + 300);
  };
  /** The stars' show began this long before now (a skip into it): what's scheduled for before then doesn't play. */
  const flyFrom = useRef(0);
  const [flownFrom, setFlownFrom] = useState(0);
  const meteorStart = useRef(0);
  /** Something at `ms` into the stars' show, shifted by where it began. */
  const laterIn = (f: () => void, ms: number) => {
    const d = ms - flyFrom.current;
    if (d >= 0) later(f, d);
  };
  /** The first rare scene (two planets, a supernova, a Big Bang): a skip stops just before it. */
  const rareAt = useMemo(() => stars.find((st) => st.event && st.event !== 'wish')?.delay ?? null, [stars]);
  /** A cosmic event's sounds, jolts and flashes, timed to its scene. */
  const cosmicCues = (s: Star) => {
    for (const st of stagesOf(s)) stageCues(st.kind, st.at, st.final, RARITY_LIGHT[s.to]);
  };
  /** One scene of an event: its build-up, then its burst — or, when the event goes further, the pulse that carries it on. */
  const stageCues = (kind: CosmicKind, at: number, final: boolean, color: string) => {
    const boom = at + COSMIC_BOOM[kind];
    if (!final) laterIn(() => (sfx.shimmer(12), sfx.clash(), jolt(10, 420), buzz([30, 40, 30]), setFlash({ color: '#fff', key: Date.now() })), boom);
    if (kind === 'wish') {
      laterIn(() => sfx.whoosh(), at);
      laterIn(() => sfx.shimmer(8), boom - 500);
      laterIn(() => (sfx.streak(), jolt(6, 300), buzz(25), setFlash({ color: '#ffd86b', key: Date.now() })), boom);
      return;
    }
    laterIn(() => sfx.shimmer(6), at);
    if (kind === 'collision') {
      laterIn(() => (sfx.planets(COSMIC_BOOM.collision / 1000), rumble(stage.current, COSMIC_BOOM.collision, 0.2, 6)), at);
      if (final) laterIn(() => (sfx.embrace(), jolt(16, 600), buzz([40, 30, 90]), setFlash({ color, key: Date.now() })), boom);
    } else if (kind === 'supernova') {
      laterIn(() => sfx.whoosh(), at);
      laterIn(() => (sfx.swallow(), jolt(8, 300)), at + 900);
      laterIn(() => (sfx.swell((COSMIC_BOOM.supernova - 1000) / 1000), rumble(stage.current, COSMIC_BOOM.supernova - 1000, 0.3, 11)), at + 1000);
      if (final) {
        laterIn(() => (sfx.supernova(), jolt(24, 900), buzz([60, 40, 120]), setFlash({ color: '#fff', key: Date.now(), rainbow: true })), boom);
        laterIn(() => celebrate(), boom + 300);
      }
    } else {
      laterIn(() => sfx.meteor(true), at);
      laterIn(() => (sfx.collapse((COSMIC_BOOM.bigbang - 900) / 1000), rumble(stage.current, COSMIC_BOOM.bigbang - 1400, 0.2, 9)), at + 900);
      laterIn(() => (sfx.bigBang(), jolt(30, 1300), buzz([90, 50, 200]), setFlash({ color: '#ffcd3c', key: Date.now() })), boom);
      laterIn(() => celebrateBig(), boom + 250);
    }
  };
  /** A heartbeat from `from` to `to` (ms from now), quicker and quicker, felt too (haptics). */
  const heartbeat = (from: number, to: number) => {
    let gap = 680;
    for (let t = from; t < to; t += gap, gap = Math.max(260, gap * 0.86)) later(() => (sfx.heartbeat(), buzz(16)), t);
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
    peakSwipe.current = Math.max(peakSwipe.current, Math.abs(v));
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
  /** The late bloom: the cards that have bloomed already, the wink playing, and how to end it at once (a skip). */
  const [bloomed, setBloomed] = useState<ReadonlySet<number>>(() => new Set());
  const [wink, setWink] = useState<{ k: number; kind: WinkKind } | null>(null);
  const blooming = useRef<(() => void) | null>(null);
  useEffect(() => setBloomed(new Set()), [deck]);
  /** Does the card at `k` bloom late (never one back from the black hole, nor a cosmic event's: they have their own show)? */
  const bloomy = (k: number) => !!plans[k]?.bloom && !pending.has(k) && !cosmicAt.has(k) && !reducedMotion();
  /** The rarity the card at `k` shows: one lower until it has bloomed. */
  const looks = (k: number): Rarity => (bloomy(k) && !bloomed.has(k) ? lower(deck[k].rarity) : deck[k].rarity);
  const asShown = (k: number): Card => (looks(k) === deck[k].rarity ? deck[k] : { ...deck[k], rarity: looks(k) });
  const toReveal = () => {
    setPhase('reveal');
    setI(0);
    setFlipped(false);
    cue(0);
  };
  /**
   * A card arriving on top of the deck: it hums, the rarer the brighter. The last card, every pack: the room
   * dims and a low drone rises — the best is always kept for last.
   */
  const cue = (k: number) => {
    const c = deck[k];
    if (!c) return;
    sfx.shimmer([2, 3, 5, 8, 12, 16][RARITIES.indexOf(looks(k))]);
    if (k === deck.length - 1 && deck.length > 1 && !reducedMotion()) (sfx.suspense(1.4), buzz([20, 80, 20]));
  };
  /** The turn in progress (a card building up): a skip lands it at once. */
  const landing = useRef<(() => void) | null>(null);
  /** A near-miss: the next step flickering before it cracks. */
  const [flicker, setFlicker] = useState(false);
  /**
   * Turning the card at `k`: it builds up step by step, exactly as far as its rarity (Step), a pulse at the end
   * of each step — now and then the next one flickers and cracks (a near-miss) — and only then shows its face.
   */
  /** A card face up, in this rarity: its flash, sounds, confetti and shake. */
  const cheer = (c: Card, r: Rarity) => {
    setFlash({ color: RARITY_LIGHT[r], key: Date.now(), rainbow: rainbowy(r) });
    if (r === 'omni') {
        // The rarest pull of all: three showers, the strongest shake.
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 800);
        later(() => (celebrateBig(), sfx.victory()), 1700);
        // Then the legend speaks, once the fanfare has passed.
        if (c.voice) later(() => playVoice(c), 2400);
        jolt(22, 1000);
      } else if (r === 'mythic') {
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 900);
        if (c.voice) later(() => playVoice(c), 1300);
        jolt(18, 800);
      } else if (r === 'legendary') (sfx.victory(), celebrateBig(), jolt(14, 600));
      else if (r === 'epic') (sfx.streak(), celebrate(), jolt(6, 300));
      else if (r === 'rare') sfx.correct();
      else sfx.pop();
  };
  const turn = (k: number = i) => {
    const c = deck[k];
    const plan = plans[k];
    const bloom = bloomy(k) && !bloomed.has(k);
    // A late bloom builds up only as far as the rarity it passes for.
    const build = (bloom ? plan.step - 1 : plan.step) as Step;
    const go = () => {
      landing.current = null;
      setCharging(false);
      setStep(0);
      setFlicker(false);
      setFlipped(true);
      if (reducedMotion()) return;
      if (!bloom) return cheer(c, c.rarity);
      // It passes for one rarity lower… a beat… a wink from the sky, and it blooms.
      cheer(c, lower(c.rarity));
      const finish = () => {
        blooming.current = null;
        setWink(null);
        setBloomed((s) => new Set(s).add(k));
        cheer(c, c.rarity);
      };
      blooming.current = finish;
      later(() => (setWink({ k, kind: Math.random() < 0.5 ? 'comet' : 'shower' }), sfx.whoosh(), sfx.shimmer(14), buzz(15)), BLOOM_WAIT);
      later(finish, BLOOM_WAIT + BLOOM_HIT);
    };
    landing.current = go;
    if ((build === 0 && !plan.near) || reducedMotion()) return go();
    setCharging(true);
    // Each step a little more: a hum, then a drone and a heartbeat, then a jolt, then the screen shaking.
    const enter = (st: Step) => {
      setStep(st);
      if (st === 1) (sfx.shimmer(6), buzz(10));
      if (st === 2) (sfx.shimmer(10), buzz(20));
      if (st === 3) (sfx.shimmer(18), jolt(6, 400), buzz([20, 30, 20]));
      if (st === 4) (sfx.shimmer(24), jolt(12, 700), buzz([40, 30, 60]), rumble(stage.current, 1200, 0.4, 8));
    };
    for (let st = 1 as Step; st <= build; st++) {
      const at = STEP_AT[st];
      const now = st;
      later(() => enter(now), at);
    }
    let end = TURN_AT[build];
    if (plan.near) {
      // The next step bursts into life… flickers… and cracks.
      const next = (build + 1) as Step;
      later(() => (setStep(next), setFlicker(true), sfx.shimmer(10), buzz(25)), end);
      later(() => (setFlicker(false), setStep(build), sfx.near(), jolt(5, 220), buzz([15, 30, 15])), end + FLICKER_MS);
      end += FLICKER_MS + CRACK_MS;
    }
    if (build >= 2 || (plan.near && build === 1)) {
      later(() => sfx.suspense((end - STEP_AT[2]) / 1000), STEP_AT[2]);
      heartbeat(STEP_AT[2], end);
    }
    later(go, end);
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
    if (phase !== 'reveal' || charging || blooming.current) return;
    if (!flipped) return turn(i);
    // A card back from the black hole waits for the player's choice.
    if (pending.has(i) && !(i in kept)) return;
    if (i + 1 >= deck.length) return setPhase('summary');
    sfx.whoosh();
    setI(i + 1);
    setFlipped(false);
    cue(i + 1);
  };
  // The cards turn by hand only, a tap each (or Skip, to the next top card): none turns by itself.
  /**
   * Skip never skips past a top card: it goes straight to the next Legendary or better and turns it, with its
   * build-up (so where it stops says "a top card", never which). Pressed again while it builds up, it lands at
   * once; on a card already turned, it goes on to the next top card, and to the summary once there's none left.
   */
  const skip = () => {
    // A rare scene still to come (two planets, a supernova, a Big Bang): the skip goes only as far as just before
    // it, and it plays in full. A black hole: the skip goes to the stars, which it opens with.
    const rareFrom = rareAt === null || reducedMotion() ? null : Math.max(0, rareAt - LAST_STAR_PAUSE);
    const early = phase === 'choose' || phase === 'pack' || phase === 'torn';
    const toRare = rareFrom !== null && (early || (phase === 'meteor' && Date.now() - meteorStart.current < rareFrom));
    const toHole = !toRare && early && cosmos.hole && !reducedMotion();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    tearSnd.current?.stop();
    tearSnd.current = null;
    setHolding(false);
    if (toRare || toHole) return fly(toRare ? rareFrom! : 0);
    // A late bloom on its way: it blooms now.
    if (blooming.current) return blooming.current();
    // A top card charging: its turn now, without the wait.
    if (phase === 'reveal' && charging && landing.current) return landing.current();
    const from = phase === 'reveal' ? (flipped ? i + 1 : i) : 0;
    const next = deck.findIndex((_, k) => k >= from && plans[k].step >= 2);
    setCharging(false);
    setStep(0);
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
    turn(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return phase === 'summary' ? close() : skip();
      if (phase === 'choose' && /^[1-3]$/.test(e.key)) return choose(Number(e.key) - 1);
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      // A focused button (Skip, just clicked; the pack) would also be clicked when the key comes up — in Firefox, stopping
      // the key doesn't stop that, and the step was done twice (two scenes on screen at once): it loses the focus first.
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      if (phase === 'summary') close();
      else act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  /** Stops the summary's own scrolling (the Bottom button takes over). */
  const stopAutoScroll = useRef<() => void>(() => undefined);
  // The summary scrolls down by itself, quicker the more packs were opened, once its cards are dealt; a wheel, a
  // touch or a key from the player stops it (they take over).
  useEffect(() => {
    const el = stage.current;
    if (phase !== 'summary' || !el || reducedMotion()) return;
    const speed = Math.min(SUMMARY_SCROLL_MAX, SUMMARY_SCROLL_BASE + times * SUMMARY_SCROLL_PER_PACK);
    let raf = 0;
    let last = 0;
    let at = el.scrollTop;
    const step = (now: number) => {
      if (last) at += (speed * (now - last)) / 1000;
      last = now;
      const end = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.min(at, end);
      if (at < end) raf = requestAnimationFrame(step);
    };
    const start = window.setTimeout(() => (raf = requestAnimationFrame(step)), SUMMARY_DEAL + 500);
    const stop = () => (window.clearTimeout(start), cancelAnimationFrame(raf));
    stopAutoScroll.current = stop;
    const opts = { passive: true } as const;
    el.addEventListener('wheel', stop, opts);
    el.addEventListener('touchstart', stop, opts);
    el.addEventListener('pointerdown', stop, opts);
    window.addEventListener('keydown', stop);
    return () => {
      stop();
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [phase, times]);
  // Keep the page behind still while the pack is open: only the overlay scrolls.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  /** A finger held on the card: where (in the card), to draw the light under it. */
  const [press, setPress] = useState<{ x: number; y: number; key: number } | null>(null);
  /** The card was turned by its press: the click that follows it must not turn the page on. */
  const pressTurned = useRef(false);
  /** When the finger went down on the card (a hold, once it's been down CARD_HOLD_MS). */
  const pressStart = useRef<number | null>(null);
  const pressDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // A press that never became a click (the finger slid off) must not swallow the next tap.
    pressTurned.current = false;
    if (phase !== 'reveal' || flipped) return;
    // The release comes back here even if the finger slides off the card.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pressStart.current = Date.now();
    const r = e.currentTarget.getBoundingClientRect();
    setPress({ x: e.clientX - r.left, y: e.clientY - r.top, key: Date.now() });
    if (charging) return;
    pressTurned.current = true;
    // Every card turns on a press, one back from the black hole too (its anomaly is chosen once it's face up).
    turn(i);
  };
  /**
   * Let go: a card held (however long) turns over at once, wherever its build-up was. A quick tap leaves the
   * build-up to play out on its own.
   */
  const pressUp = () => {
    setPress(null);
    const held = pressStart.current !== null && Date.now() - pressStart.current >= CARD_HOLD_MS;
    pressStart.current = null;
    if (!held || phase !== 'reveal' || flipped || !charging || !landing.current) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    landing.current();
  };
  const style = card ? RARITY_STYLE[card.rarity] : null;
  /** What the card on top shows (a late bloom: one rarity lower, until it blooms). */
  const shown = card ? looks(i) : null;
  const winking = !!wink && wink.k === i;
  // Time slowing (step 2 and up): it spins front over back.
  const spinning = charging && step >= 2;
  // Rays behind the card: in its build-up's colour, then its own once turned.
  const rays = !card || !shown ? null : flipped ? (shown === 'epic' || top(shown) ? shown : null) : charging && step >= 1 ? STEP_LIGHT[step] : null;
  return (
    // The summary of five packs is taller than the screen: it scrolls inside the overlay (the page behind stays still).
    <div ref={box} className="pack-scene fixed inset-0 z-50 overflow-hidden bg-[#07060c]" style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${phase === 'pack' ? '#1e1b4b66' : `${phase === 'summary' ? light : phase === 'reveal' && flipped && shown ? RARITY_LIGHT[shown] : phase === 'torn' || phase === 'meteor' ? glow : packLight}${special && (phase === 'torn' || phase === 'meteor') ? '55' : '22'}`}, transparent 60%)` }}>
      {phase !== 'summary' && (
        <button type="button" onClick={skip} className="absolute right-4 top-4 z-30 rounded-full border border-white/30 px-3 py-1 text-xs font-bold tracking-widest text-white/80 hover:bg-white/10">
          {/* Always the same: a label that changed with what's left would tell it. */}
          SKIP ⏭
        </button>
      )}
      {/* Slow motion: the room darkens around a Legendary or better as it charges. */}
      {phase !== 'meteor' && <Ambient tint={phase === 'summary' ? light : phase === 'reveal' && flipped && shown ? RARITY_LIGHT[shown] : phase === 'torn' ? glow : packLight} />}
      {phase === 'reveal' && charging && step >= 2 && <div className={`pack-slowmo pointer-events-none fixed inset-0 ${flicker ? 'pack-flicker' : ''}`} aria-hidden />}
      {/* The last card, every pack: the room dims before it's turned. */}
      {phase === 'reveal' && !flipped && i === deck.length - 1 && deck.length > 1 && <div className="pack-lastcard pointer-events-none fixed inset-0" aria-hidden />}
      {/* Step 3 and up: its franchise's name sweeps across, in every colour (red and gold at step 4). */}
      {phase === 'reveal' && charging && card && step >= 3 && (
        <div className="pointer-events-none fixed inset-x-0 top-[12%] z-30 overflow-hidden" aria-hidden>
          <p className={`pack-banner ${step >= 4 ? 'card-omni-name' : 'card-mythic-name'} ${flicker ? 'pack-flicker' : ''} whitespace-nowrap text-center font-display text-3xl font-black tracking-[0.3em] sm:text-5xl`}>{card.franchise.toUpperCase()}</p>
        </div>
      )}
      {/* A golden pack: gold rays turning slowly behind everything, from the pick to the summary. */}
      {/* (Clipped in a box of its own: bigger than the screen to turn without corners, it must not make the overlay scroll.) */}
      {golden && (
        <div className="pointer-events-none fixed inset-0 overflow-clip" aria-hidden>
          <div className="golden-backdrop absolute -inset-1/2" />
        </div>
      )}
      {/* A late bloom's wink: falling onto the card, in its true colour. */}
      {phase === 'reveal' && winking && card && <BloomWink kind={wink!.kind} rarity={card.rarity} />}
      {flash && <div key={flash.key} className="pack-flash pointer-events-none fixed inset-0 z-40" style={{ background: flash.rainbow ? `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 85%)` : `radial-gradient(circle, #fff, ${flash.color} 45%, transparent 80%)` }} />}

      {/* The summary: straight to its end (Done, Open again), past fifty packs' worth of cards. */}
      {phase === 'summary' && (
        <button
          type="button"
          onClick={() => (stopAutoScroll.current(), stage.current?.scrollTo({ top: stage.current.scrollHeight, behavior: 'smooth' }))}
          className="fixed bottom-4 right-4 z-50 rounded-full border border-white/40 bg-black/70 px-4 py-2 font-display text-sm font-bold tracking-wider text-white backdrop-blur hover:border-white"
          aria-label="Scroll to the end of the summary"
        >
          ⬇ Bottom
        </button>
      )}
      {/* The stage: everything that shakes. Not clipped itself (the overlay clips), so the star field's bleed covers the borders mid-shake. */}
      <div ref={stage} className={`absolute inset-0 isolate p-4 ${phase === 'summary' ? 'flex justify-center overflow-y-auto' : 'grid place-items-center'}`}>
      {/* 0. Three packs: pick one. */}
      {phase === 'choose' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          {/* Several packs at once: only one of them is golden (its odds are its own, the others' are as ever). */}
          {golden && <p className="golden-banner golden-text text-center font-display text-3xl font-black tracking-[0.3em] sm:text-5xl">{times > 1 ? '★ A GOLDEN PACK INSIDE ★' : '★ GOLDEN PACK ★'}</p>}
          <p className="text-center font-display text-sm font-bold tracking-[0.35em] text-white/80">
            {golden ? (times > 1 ? `1 OF THE ${times} PACKS IS GOLDEN: ${GOLDEN.slots} LEGENDARY OR BETTER IN IT · CHOOSE YOUR PACK` : `${GOLDEN.slots} LEGENDARY OR BETTER INSIDE · CHOOSE YOUR PACK`) : 'CHOOSE YOUR PACK'}
          </p>
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
            role="button"
            aria-label="Swipe across the pack, or tap it, to tear it open"
          >
            <div key={`w${wobble}`} className={`relative ${holding ? 'pack-hold' : wobble ? 'pack-wobble' : ''}`} style={{ transform: holding ? undefined : `rotate(${lean}deg) skewX(${lean * -0.6}deg)`, transition: 'transform 0.12s ease-out' }}>
            {/* Mythic and Omni: a halo turning behind the pack as it tears. */}
            {special && (phase === 'torn' || (phase === 'pack' && tear > 0)) && (
              <Painted className="pack-halo pointer-events-none absolute left-1/2 top-1/2 -z-10" style={{ opacity: phase === 'torn' ? 1 : 0.3 + tear * 0.7 }} size={256} paint={paintHalo(HALO_COLORS[special])} />
            )}
            {/* The light inside, pouring out of the tear. */}
            {phase === 'torn' && (
              <Painted
                className="pack-beam pointer-events-none absolute left-1/2 w-[260%]"
                style={{ bottom: `${100 - TEAR_AT}%`, height: '70vh' }}
                size={128}
                w={128}
                h={256}
                paint={paintBeam(beam)}
              />
            )}
            {/* The pack below the cut, and the strip above it: they part along the same jagged line. */}
            <div className={`relative ${phase === 'torn' ? wholeClass(opening) : ''}`} style={phase === 'pack' && tear > 0 ? { filter: auraFilter(8 + tear * 30) } : phase === 'torn' && special ? { filter: auraFilter(26) } : undefined}>
            <div style={{ clipPath: `polygon(${pts(line)}, 100% 100%, 0 100%)` }} className={phase === 'torn' ? 'pack-glow' : ''}>
              <PackArt pack={pack} shine golden={golden} />
            </div>
            <div className={`absolute inset-0 ${phase === 'torn' ? (opening ? flapClass(opening) : 'pack-flap-fly') : ''}`} style={{ clipPath: `polygon(0 0, 100% 0, ${pts([...line].reverse())})`, transform: phase === 'pack' ? `rotate(${-tear * 7}deg) translateY(${-tear * 7}px)` : undefined, transformOrigin: '100% 100%' }}>
              <PackArt pack={pack} shine golden={golden} />
            </div>
            {phase === 'torn' && opening && <OpeningInside kind={opening} />}
            </div>
            {phase === 'torn' && opening && <OpeningAround kind={opening} />}
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
          {/* A nebula behind it all, in the pack's colours, glowing brighter as the planet grows. */}
          <Nebula colors={tints} tier={skyNow.tier} />
          {/* The fly-by: the pack's own cards drifting across, out of focus, before the last star. */}
          {/* Skipped to a rare scene: the fly-by, the black hole and the sky's moment were before it. */}
          {!flownFrom && <Flyby flyers={flyers} glyph={pack.id === 'general' ? undefined : pack.icon} />}
          <Space tier={skyNow.tier} evolved={skyNow.n} feed={feed} moment={flownFrom ? null : moment} cometAt={cometAt} cometColor={RARITY_LIGHT[tease]} />
          {cosmos.hole && !flownFrom && <BlackHole until={holeEnd} gulps={gulps} tints={tints} />}
          {stars.map((star, k) => {
            // Skipped into the show: the stars already gone aren't drawn, the others come that much sooner.
            if (flownFrom && star.delay + star.duration <= flownFrom) return null;
            const s = flownFrom ? { ...star, delay: star.delay - flownFrom } : star;
            const thick = top(s.to) ? 7 : RARITIES.indexOf(s.to) >= 2 ? 5 : 3;
            // A black hole: every star but the last circles it (and some go in).
            // A cosmic event: its own scene.
            // Each keyed by the skip too (as the plain stars below): skipped into the show, a scene starts afresh on its new
            // timing — kept, it held on to what it had already shown (its title, its burst) and two scenes overlapped.
            const at = `${k}:${flownFrom}`;
            if (s.event === 'wish') return <Wish key={at} star={s} thick={thick} />;
            // Over once its whole chain has played: its last scene (the planet born, its title) stayed on screen, under the
            // next event's (several in a big opening, one after the other).
            if (s.event)
              return (
                <Until key={at} ms={s.delay + s.duration}>
                  <Chain star={s} />
                </Until>
              );
            if (cosmos.hole && s.orbit) return <Orbiter key={at} star={s} k={k} thick={thick} swallowed={cosmos.swallowed.has(k)} light={stars.length > BIG_OPENING} />;
            // An evolving star crashes into another and bursts in its true colour.
            if (s.clash) return <Clash key={at} star={s} thick={thick} />;
            return (
              <InFlight key={`${k}:${flownFrom}`} from={s.delay - STAR_EARLY} to={s.delay + s.duration + STAR_EARLY}>
                {(late) => (
                  <div className="absolute left-0 w-full" style={{ top: `${s.top}%`, transform: `rotate(${s.tilt}deg)` }}>
                    <div className="pack-meteor relative rounded-full" style={{ animationDuration: `${s.duration}ms`, animationDelay: `${s.delay - late}ms`, width: `${top(s.to) ? 45 : 30}vw`, height: thick, transform: 'translateX(-60vw)' }}>
                      <div className="absolute inset-0 rounded-full" style={streak(s.to)} />
                      <div className="pack-meteor-head absolute right-0 top-1/2 rounded-full" style={{ width: thick * 5, height: thick * 5, ['--glow' as string]: RARITY_LIGHT[s.to] }} />
                      <div className={`pack-meteor-dust absolute inset-y-0 left-[15%] right-[10%] ${rainbowy(s.to) ? 'pack-twinkle-rainbow' : ''}`} />
                    </div>
                  </div>
                )}
              </InFlight>
            );
          })}
        </div>
      )}

      {/* 3. One card at a time from the deck. */}
      {phase === 'reveal' && card && style && shown && (
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5">
          <p className="font-display text-xs font-bold tracking-[0.35em] text-white/60">
            {pending.has(i) ? 'BACK FROM THE BLACK HOLE · ' : cosmicAt.has(i) ? `${COSMIC_NAME[cosmicAt.get(i)!.kind].icon} ${COSMIC_NAME[cosmicAt.get(i)!.kind].name} · ` : ''}CARD {i + 1} OF {deck.length}
          </p>
          <button
            type="button"
            onClick={() => (pressTurned.current ? (pressTurned.current = false) : act())}
            onPointerDown={pressDown}
            onPointerUp={pressUp}
            onPointerCancel={() => ((pressStart.current = null), setPress(null))}
            className="relative isolate w-52 touch-none outline-none sm:w-60"
            aria-label={flipped ? `${card.name} — next` : 'Turn the card'}
          >
            {/* The rest of the deck, underneath. */}
            {Array.from({ length: Math.min(3, deck.length - i - 1) }, (_, k) => (
              <div key={k} className="absolute inset-0 opacity-70" style={{ transform: `translate(${(k + 1) * 6}px, ${(k + 1) * 6}px)`, zIndex: -1 - k }}>
                <CardBack />
              </div>
            ))}
            {rays && (
              <div className={flicker ? 'pack-flicker' : ''}>
                <Rays color={RARITY_LIGHT[rays]} strong={flipped ? top(shown) : step >= 2} rainbow={rainbowy(rays)} />
              </div>
            )}
            {/* Building up: light pours into the card from all around, in the step's colours (a fusion). */}
            {charging && step >= 1 && !reducedMotion() && <Fusion key={`f${step}`} step={step} />}
            {/* Face down, a card leaks its colour round its edges and trembles, the rarer the more. */}
            <div
              key={i}
              className={`pack-card-in [perspective:1100px] ${!flipped && !charging && shown !== 'common' && !reducedMotion() ? 'pack-leak' : ''} ${winking ? 'pack-bloom-charge' : ''}`}
              style={{ ['--leak' as string]: RARITY_LIGHT[shown], ['--leak-size' as string]: `${6 + RARITIES.indexOf(shown) * 7}px`, ['--leak-shake' as string]: `${RARITIES.indexOf(shown) * 0.6}px`, ['--bloom' as string]: RARITY_LIGHT[card.rarity] }}
            >
              <div className={`relative transition-transform ${flipped ? 'duration-700 [transform:rotateY(180deg)]' : 'duration-300'} [transform-style:preserve-3d] ${charging ? (step === 3 ? 'pack-charge-spin pack-charge-prism' : step >= 2 ? 'pack-charge-spin' : 'pack-charge') : ''}`} style={charging && step >= 2 ? SPIN[step >= 4 ? 'omni' : step === 3 ? 'mythic' : 'legendary'] : undefined}>
                {/* Spinning front over back (time slowing): the back shows on both sides, the face stays hidden until the turn. */}
                <div className={spinning ? '' : '[backface-visibility:hidden]'}>
                  <CardBack rarity={charging && step >= 1 ? STEP_LIGHT[step] : shown === 'common' ? undefined : shown} />
                </div>
                <div className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] ${spinning ? 'opacity-0' : ''} ${flipped && bloomed.has(i) ? 'pack-bloom' : ''}`}>
                  <CardFace key={shown} card={asShown(i)} count={counts[card.id]} isNew={fresh.has(card.id)} animate={flipped} anomaly={pending.has(i) && kept[i] !== false ? pending.get(i) : undefined} />
                </div>
              </div>
            </div>
            {flipped && !reducedMotion() && <Burst key={`b${i}${shown}`} color={RARITY_LIGHT[shown]} rainbow={rainbowy(shown)} count={shown === 'omni' ? 100 : shown === 'mythic' ? 70 : shown === 'legendary' ? 46 : shown === 'epic' ? 32 : shown === 'rare' ? 18 : 10} />}
            {/* Held: a light grows under the finger, in the build-up's colour — pushing it on (or so it feels). */}
            {press && !flipped && <span key={press.key} className="pack-press pointer-events-none absolute z-20 rounded-full" style={{ left: press.x, top: press.y, ['--press' as string]: RARITY_LIGHT[STEP_LIGHT[step]] }} />}
            {flipped && fresh.has(card.id) && <span className="pack-stamp absolute -right-6 top-6 z-30 rounded-md border-4 border-coral px-2 py-0.5 font-display text-xl font-black tracking-widest text-coral">NEW!</span>}
          </button>
          <div className="min-h-14 text-center">
            {flipped ? (
              <div className="animate-pop">
                <p key={shown} className={`font-display text-sm font-bold tracking-[0.35em] ${bloomed.has(i) ? 'animate-pop' : ''} ${shown === 'omni' ? 'card-omni-name text-lg' : shown === 'mythic' ? 'card-mythic-name text-base' : ''}`} style={prismatic(shown) ? undefined : { color: RARITY_LIGHT[shown] }}>
                  {pending.get(i) === 'fake' && kept[i] !== false
                    ? '✦ MYTHIC ✦'
                    : shown === 'omni' ? '✪ OMNI ✪' : shown === 'mythic' ? '✦ MYTHIC ✦' : shown === 'legendary' ? '★ LEGENDARY ★' : RARITY_INFO[shown].name.toUpperCase()}
                </p>
                {winking && <p className="pack-bloom-hint text-xs font-bold tracking-widest" style={{ color: RARITY_LIGHT[card.rarity] }}>✨ wait… something&apos;s coming</p>}
                {bloomed.has(i) && <p className="text-xs font-bold tracking-widest text-white/70">✨ A late bloom — it looked {RARITY_INFO[lower(card.rarity)].name}</p>}
                {cosmicAt.has(i) && <p className="text-xs font-bold tracking-widest text-white/70">{COSMIC_DONE[cosmicAt.get(i)!.kind]} — it was {RARITY_INFO[cosmicAt.get(i)!.from.rarity].name}</p>}
                {card.title && <p className="text-sm italic text-white/80">{card.title}</p>}
                <p className="font-serif text-2xl font-bold text-white">{shownName(card.name, card.set)}</p>
              </div>
            ) : (
              <p className="font-display text-sm font-bold tracking-widest text-white/70">{charging ? (press ? 'LET GO TO TURN' : '…') : i === deck.length - 1 && deck.length > 1 ? 'THE LAST CARD · HOLD TO TURN' : 'TAP OR HOLD TO TURN'}</p>
            )}
          </div>
          {/* Back from the black hole: keep its anomaly, or let the card be. */}
          {flipped && pending.has(i) && <AnomalyChoice anomaly={pending.get(i)!} kept={kept[i]} onDecide={(keep) => decide(i, keep)} />}
          {/* The tray: the cards already turned. */}
          {/* Only the last ones (all a screen holds): fifty packs would line up two hundred cards, all redrawn at each turn. */}
          <div className="flex h-20 items-end justify-center gap-2">
            {(() => {
              const turned = flipped ? i + 1 : i;
              const from = Math.max(0, turned - TRAY_MAX);
              return (
                <>
                  {from > 0 && <span className="self-center font-display text-xs font-bold tracking-widest text-white/60">+{from}</span>}
                  {deck.slice(from, turned).map((_, j) => {
                    const k = from + j;
                    return (
                      <div key={k} data-still className="pack-tray-in w-12 rounded-[7%] sm:w-14" style={{ boxShadow: `0 0 6px ${RARITY_LIGHT[looks(k)]}88` }}>
                        <CardFace key={looks(k)} card={asShown(k)} tilt={false} still anomaly={kept[k] === true ? pending.get(k) : undefined} />
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. All five together. */}
      {phase === 'summary' && (
        <div className="my-auto w-full max-w-4xl space-y-6 py-4">
          <PackStats deck={deck} fresh={fresh} golden={golden} packs={times} />
          {allChoice}
          <div className={`grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4 ${deck.length > BIG_OPENING ? 'pack-summary-big' : ''}`}>
            {deck.map((c, k) => (
              <div key={k} className="animate-card-deal" style={{ animationDelay: `${dealAt(k, deck.length)}ms`, ['--deal-rot' as string]: `${((k % 5) - 2) * 6}deg` }}>
                <CardFace card={c} count={counts[c.id]} isNew={fresh.has(c.id)} hoverHero still calm={deck.length > BIG_OPENING} anomaly={kept[k] === true ? pending.get(k) : undefined} />
                {pending.has(k) && !(k in kept) && <AnomalyChoice compact anomaly={pending.get(k)!} onDecide={(keep) => decide(k, keep)} />}
                <p className="mt-2 text-center font-display text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_STYLE[c.rarity].text }}>
                  {pending.get(k) === 'fake' && kept[k] === true ? 'Mythic' : RARITY_INFO[c.rarity].name}
                </p>
                {cosmicAt.has(k) && <p className="text-center text-[10px] font-bold tracking-widest text-white/70" title={COSMIC_DONE[cosmicAt.get(k)!.kind]}>{COSMIC_NAME[cosmicAt.get(k)!.kind].icon} was {RARITY_INFO[cosmicAt.get(k)!.from.rarity].name}</p>}
                {!fresh.has(c.id) && <p className="pack-chip mt-0.5 text-center font-display text-[10px] font-bold tracking-widest text-white/60" style={{ animationDelay: `${dealAt(k, deck.length) + 250}ms` }}>+1 SPARE</p>}
              </div>
            ))}
          </div>
          {/* Again at the end: fifty packs' worth of cards scroll the first one far away. */}
          {allChoice}
          <div className="flex flex-wrap justify-center gap-3">
            {canAgain && (
              <button type="button" onClick={again} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                {times > 1 ? `Open ×${times} again` : 'Open another'} · <Coins n={pack.cost * times} />
              </button>
            )}
            <button type="button" onClick={close} className="btn-paper rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Done
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
