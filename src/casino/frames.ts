// Icon frames: rings worn around the player's icon (their avatar card), won from the Casino's capsule
// machine — or earned (a streak, a full set in the Album, every boss on Hard: never in the machine). Seasonal
// frames are in the machine only around their date (Halloween, Christmas, New Year, Omnidle's birthday). Each is drawn in CSS (src/casino/Frame.tsx, .avatar-frame in src/index.css): a ring, maybe a
// glow, maybe an ornament on its edge, maybe a little life (it turns, it pulses, it twinkles).

import CASINO from '../data/tuning/casino.json';
import REWARDS from '../data/rewards.json';
import { addDays, toKey } from '../lib/date';
import { hashString } from '../lib/rng';

/** Above Mythic: Celestial and Transcendent, whose frames do something to the icon itself (it floats, shines, has company). */
export type FrameRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'celestial' | 'transcendent';
export const FRAME_RARITIES: FrameRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'celestial', 'transcendent'];
export const FRAME_RARITY_NAME: Record<FrameRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic', celestial: 'Celestial', transcendent: 'Transcendent' };
export const FRAME_RARITY_COLOR: Record<FrameRarity, string> = { common: '#94a3b8', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24', mythic: '#ff4fd8', celestial: '#14d8c4', transcendent: '#ff3d6e' };

export interface Frame {
  id: string;
  name: string;
  rarity: FrameRarity;
  /** The ring itself: any CSS background. */
  ring: string;
  /** A soft light around it. */
  glow?: string;
  /** Something on its edge: a glyph, where. */
  ornament?: { glyph: string; at: 'top' | 'br' | 'bl' };
  /**
   * A little life: the ring turns, pulses, or sparkles twinkle on it; drift: they float off it (petals);
   * flicker: the ring crackles (thunder); blackhole and supernova: the Mythics' own (a ring of light bending
   * round a dark heart, a star swelling and bursting in every colour).
   */
  life?: 'spin' | 'pulse' | 'twinkle' | 'drift' | 'flicker' | 'blackhole' | 'supernova' | Beyond;
  /** What it does to the icon itself (Celestial and Transcendent): it floats, breathes, a light sweeps over it, or a rainbow. */
  icon?: 'float' | 'breathe' | 'sheen' | 'prism';
  /** What twinkles or drifts on it (✦ by default). */
  sparkle?: string;
  /** Seasonal: in the machine only around this reward date (an id of src/data/rewards.json). */
  season?: string;
  /** Earned, never in the machine: how (shown in the collection). */
  earn?: string;
}

/**
 * The lives above Mythic, all round the icon: an aurora wavering behind it; moons orbiting it, in front then
 * behind; stars falling behind it; a seraph's wings beating and a halo over it; a turning starfield and two
 * rings spinning round it like a gyroscope.
 */
export type Beyond = 'aurora' | 'orbit' | 'starfall' | 'seraph' | 'cosmos';

const metal = (light: string, mid: string, dark: string) => `conic-gradient(from 210deg, ${light}, ${mid} 25%, ${dark} 50%, ${mid} 75%, ${light})`;

export const FRAMES: Frame[] = [
  { id: 'copper', name: 'Copper', rarity: 'common', ring: metal('#f6b68a', '#c2703d', '#7a3e1d') },
  { id: 'mint', name: 'Mint', rarity: 'common', ring: 'linear-gradient(135deg, #a7f3d0, #34d399)' },
  { id: 'sky', name: 'Sky', rarity: 'common', ring: 'linear-gradient(135deg, #bae6fd, #3b82f6)' },
  { id: 'rose', name: 'Rose', rarity: 'common', ring: 'linear-gradient(135deg, #fecdd3, #f43f5e)' },
  { id: 'ink', name: 'Ink', rarity: 'common', ring: 'repeating-conic-gradient(#1f2937 0 15deg, #4b5563 15deg 30deg)' },
  { id: 'gold', name: 'Gold Ring', rarity: 'rare', ring: metal('#fff3b0', '#f5c542', '#a16207'), glow: '#fbbf24' },
  { id: 'starry', name: 'Starry', rarity: 'rare', ring: 'linear-gradient(135deg, #312e81, #6366f1)', glow: '#818cf8', life: 'twinkle' },
  { id: 'neon', name: 'Neon', rarity: 'rare', ring: 'linear-gradient(135deg, #22d3ee, #e879f9)', glow: '#e879f9', life: 'pulse' },
  { id: 'lucky', name: 'Lucky Coin', rarity: 'rare', ring: metal('#fde68a', '#d97706', '#78350f'), ornament: { glyph: '🪙', at: 'br' } },
  { id: 'crown', name: 'Crown', rarity: 'epic', ring: metal('#fff7c2', '#eab308', '#854d0e'), glow: '#facc15', ornament: { glyph: '👑', at: 'top' } },
  { id: 'flame', name: 'Flames', rarity: 'epic', ring: 'conic-gradient(#fde047, #f97316, #dc2626, #f97316, #fde047, #f97316, #dc2626, #f97316, #fde047)', glow: '#f97316', life: 'spin', ornament: { glyph: '🔥', at: 'br' } },
  { id: 'jackpot', name: 'Jackpot', rarity: 'epic', ring: 'repeating-conic-gradient(#dc2626 0 20deg, #fbbf24 20deg 40deg)', glow: '#fbbf24', life: 'twinkle', ornament: { glyph: '🎰', at: 'br' } },
  { id: 'clover', name: 'Four-Leaf', rarity: 'epic', ring: 'linear-gradient(135deg, #bbf7d0, #16a34a 60%, #14532d)', glow: '#4ade80', ornament: { glyph: '🍀', at: 'bl' } },
  { id: 'prism', name: 'Prism', rarity: 'legendary', ring: 'conic-gradient(#ff4fd8, #ffcd3c, #4ade80, #3cc7ff, #a78bfa, #ff4fd8)', glow: '#ffffff', life: 'spin' },
  { id: 'galaxy', name: 'Galaxy', rarity: 'legendary', ring: 'conic-gradient(from 90deg, #0f0a2e, #6d28d9, #ec4899, #0f0a2e, #2563eb, #0f0a2e)', glow: '#a78bfa', life: 'twinkle', ornament: { glyph: '🪐', at: 'top' } },
  { id: 'omni', name: 'Omni', rarity: 'legendary', ring: metal('#ffffff', '#fbbf24', '#b45309'), glow: '#fde68a', life: 'pulse', ornament: { glyph: '✦', at: 'top' } },
  // The elements (as the cards'): frost, a crackling storm, falling petals, a dark whirlpool.
  { id: 'ice', name: 'Ice', rarity: 'epic', ring: 'linear-gradient(135deg, #f0f9ff, #7dd3fc 45%, #0369a1)', glow: '#bae6fd', life: 'twinkle', sparkle: '❄' },
  { id: 'thunder', name: 'Thunder', rarity: 'epic', ring: 'conic-gradient(#facc15, #7c3aed, #fde047, #6d28d9, #facc15, #7c3aed, #fde047, #6d28d9, #facc15)', glow: '#facc15', life: 'flicker', sparkle: '⚡' },
  { id: 'sakura', name: 'Sakura', rarity: 'epic', ring: 'linear-gradient(135deg, #fdf2f8, #f9a8d4 50%, #be185d)', glow: '#f9a8d4', life: 'drift', sparkle: '🌸' },
  { id: 'abyss', name: 'Abyss', rarity: 'epic', ring: 'conic-gradient(#0b0420, #4c1d95, #0b0420, #7c3aed, #0b0420, #4c1d95, #0b0420)', glow: '#7c3aed', life: 'spin' },
  // The Mythics, rarest of the machine, after the packs' own wonders.
  { id: 'blackhole', name: 'Black Hole', rarity: 'mythic', ring: 'conic-gradient(#fff7ed, #fb923c 12%, #1c0a00 30%, #000 50%, #1c0a00 70%, #fb923c 88%, #fff7ed)', glow: '#fb923c', life: 'blackhole' },
  { id: 'supernova', name: 'Supernova', rarity: 'mythic', ring: 'conic-gradient(#ffffff, #ff4fd8, #ffcd3c, #ffffff, #3cc7ff, #a855f7, #ffffff)', glow: '#ffffff', life: 'supernova', sparkle: '✦' },
  // Above Mythic: the icon itself comes alive.
  { id: 'aurora', name: 'Aurora', rarity: 'celestial', ring: 'linear-gradient(160deg, #a7f3d0, #14d8c4 35%, #6366f1 70%, #c084fc)', glow: '#5eead4', life: 'aurora', icon: 'float' },
  { id: 'orbit', name: 'Orbit', rarity: 'celestial', ring: metal('#f1f5f9', '#94a3b8', '#1e293b'), glow: '#bae6fd', life: 'orbit', icon: 'breathe' },
  { id: 'starfall', name: 'Starfall', rarity: 'celestial', ring: 'conic-gradient(from 200deg, #0c1445, #3b82f6, #e0f2fe, #3b82f6, #0c1445, #1e3a8a, #0c1445)', glow: '#93c5fd', life: 'starfall', icon: 'sheen' },
  { id: 'seraph', name: 'Seraph', rarity: 'transcendent', ring: metal('#ffffff', '#fde68a', '#b45309'), glow: '#fff7d6', life: 'seraph', icon: 'float' },
  { id: 'cosmos', name: 'Cosmos', rarity: 'transcendent', ring: 'conic-gradient(#ff4fd8, #ffcd3c, #4ade80, #3cc7ff, #a855f7, #ff4fd8)', glow: '#ffffff', life: 'cosmos', icon: 'prism' },
  // Seasonal: in the machine only around their day (the reward dates), then back a year later.
  { id: 'pumpkin', name: 'Pumpkin', rarity: 'rare', season: 'halloween', ring: 'linear-gradient(135deg, #fed7aa, #f97316 50%, #431407)', glow: '#f97316', ornament: { glyph: '🎃', at: 'br' } },
  { id: 'snowflake', name: 'Snowflake', rarity: 'rare', season: 'christmas', ring: 'linear-gradient(135deg, #ffffff, #93c5fd 50%, #1e3a8a)', glow: '#dbeafe', life: 'twinkle', sparkle: '❄', ornament: { glyph: '🎄', at: 'br' } },
  { id: 'firework', name: 'Firework', rarity: 'rare', season: 'newyear', ring: 'conic-gradient(#f43f5e, #facc15, #22d3ee, #a855f7, #f43f5e)', glow: '#facc15', life: 'twinkle', sparkle: '✺', ornament: { glyph: '🎆', at: 'top' } },
  { id: 'cake', name: 'Birthday Cake', rarity: 'rare', season: 'omnidle', ring: 'linear-gradient(135deg, #fff1f2, #f9a8d4 45%, #a16207)', glow: '#fbcfe8', life: 'pulse', ornament: { glyph: '🎂', at: 'top' } },
];

/** Earned, never pulled: a daily streak, every boss on Hard (an album's frames are made per set, below). */
export const EARNED_FRAMES: Frame[] = [
  { id: 'streak-7', name: 'Ember', rarity: 'rare', earn: 'A 7-day streak', ring: 'linear-gradient(135deg, #fde68a, #f97316 60%, #9a3412)', glow: '#fb923c', ornament: { glyph: '🔥', at: 'br' } },
  { id: 'streak-30', name: 'Blaze', rarity: 'epic', earn: 'A 30-day streak', ring: 'conic-gradient(#fde047, #f97316, #dc2626, #f97316, #fde047)', glow: '#f97316', life: 'pulse', ornament: { glyph: '🔥', at: 'top' } },
  { id: 'streak-100', name: 'Eternal Flame', rarity: 'legendary', earn: 'A 100-day streak', ring: 'conic-gradient(#ffffff, #fde047, #f97316, #dc2626, #7c3aed, #f97316, #fde047, #ffffff)', glow: '#fde047', life: 'spin', sparkle: '✦', ornament: { glyph: '🔥', at: 'top' } },
  { id: 'boss-hard', name: 'Conqueror', rarity: 'legendary', earn: 'Beat every boss on Hard', ring: metal('#fecaca', '#dc2626', '#450a0a'), glow: '#ef4444', life: 'pulse', ornament: { glyph: '⚔', at: 'top' } },
];

/** A full set's frame: its own colour (from its id, the same everywhere), a book on its edge. */
export const albumFrame = (setId: string, name = 'Album'): Frame => {
  const h = hashString(setId) % 360;
  return { id: `album-${setId}`, name, rarity: 'epic', earn: 'Complete this set in the Album', ring: metal(`hsl(${h} 90% 85%)`, `hsl(${h} 75% 55%)`, `hsl(${h} 70% 25%)`), glow: `hsl(${h} 90% 65%)`, ornament: { glyph: '📖', at: 'br' } };
};

const BY_ID = new Map([...FRAMES, ...EARNED_FRAMES].map((f) => [f.id, f]));
export const FRAME_BY_ID = { get: (id: string): Frame | undefined => BY_ID.get(id) ?? (id.startsWith('album-') ? albumFrame(id.slice(6)) : undefined) };

/**
 * Ascendant: a machine frame won again climbs, ten evolutions, each a little grander (src/casino/Frame.tsx
 * `Ascendant`). Each copy won again is worth points by its rarity (a Transcendent's one copy as much as fifty
 * Commons'), and each evolution asks for so many (src/data/tuning/casino.json capsules.ascendant).
 */
export const ASCEND_MAX = 10;
const ASC = CASINO.capsules.ascendant as { points: Record<FrameRarity, number>; levels: number[] };
export const ascendPoints = (f: Pick<Frame, 'rarity'>, copies: number) => copies * (ASC.points[f.rarity] ?? 1);
/** A frame's evolution (0 to 10) from its copies won again. */
export const ascendLevel = (f: Pick<Frame, 'rarity'>, copies: number | undefined) => ASC.levels.filter((t) => ascendPoints(f, copies ?? 0) >= t).length;
/** Copies still to win for the next evolution (0 at the last). */
export function ascendToNext(f: Pick<Frame, 'rarity'>, copies: number | undefined): number {
  const next = ASC.levels[ascendLevel(f, copies)];
  return next === undefined ? 0 : Math.ceil((next - ascendPoints(f, copies ?? 0)) / (ASC.points[f.rarity] ?? 1));
}
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** The frame worn as friends see it: "<id>@<evolution>" (just the id at none). */
export const wornFrameId = (id: string | null | undefined, copies: Record<string, number> | undefined): string | null => {
  if (!id) return null;
  const f = FRAME_BY_ID.get(id);
  const lv = f && !f.earn ? ascendLevel(f, copies?.[id]) : 0;
  return lv ? `${id}@${lv}` : id;
};
/** A worn frame read back: the frame and its evolution. */
export const parseWorn = (s: string | null | undefined): { frame: Frame | undefined; level: number } => {
  if (!s) return { frame: undefined, level: 0 };
  const [id, lv] = s.split('@');
  return { frame: FRAME_BY_ID.get(id), level: Math.max(0, Math.min(ASCEND_MAX, Math.floor(Number(lv) || 0))) };
};

/** A seasonal frame's window, as its reward date's: from the day for windowDays days (Christmas runs into January). */
const seasonStart = (season: string, year: number) => {
  const d = REWARDS.dates.find((r) => r.id === season);
  return d ? toKey(new Date(year, d.month - 1, d.day)) : null;
};
/** In the machine today? Always, unless it's seasonal and out of its season. */
export function inSeason(f: Frame, today: string): boolean {
  if (!f.season) return true;
  const y = Number(today.slice(0, 4));
  return [y - 1, y].some((year) => {
    const start = seasonStart(f.season!, year);
    return !!start && today >= start && today < addDays(start, REWARDS.windowDays);
  });
}
/** When a seasonal frame is next in the machine (a date key), or null. */
export function nextSeason(f: Frame, today: string): string | null {
  if (!f.season) return null;
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) {
    const start = seasonStart(f.season, year);
    if (start && start > today) return start;
  }
  return null;
}
