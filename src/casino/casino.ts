// The Casino's machines (src/pages/Casino.tsx): what a spin, a ball or a capsule gives. The numbers live in
// src/data/tuning/casino.json (edited from the admin page); the roulette's are in economy.json.
import T from '../data/tuning/casino.json';
import { FRAMES, type Frame, type FrameRarity } from './frames';

export const SLOTS = T.slots;
export const PACHINKO = T.pachinko;
export const CAPSULES = T.capsules;

export type SlotSymbol = 'cherry' | 'bell' | 'star' | 'card' | 'gem' | 'coin' | 'seal';
type SymbolSpec = { id: string; weight: number; three: number; two?: number };
const SYMBOLS = SLOTS.symbols as SymbolSpec[];
export const SLOT_SYMBOLS = SYMBOLS.map((s) => s.id as SlotSymbol);
const TOTAL = SYMBOLS.reduce((t, s) => t + s.weight, 0);

/** A symbol, drawn by its weight. */
export function slotSymbol(r = Math.random()): SlotSymbol {
  let x = r * TOTAL;
  for (const s of SYMBOLS) if ((x -= s.weight) < 0) return s.id as SlotSymbol;
  return SYMBOLS[0].id as SlotSymbol;
}

/** The five lines, as the row each reel's symbol is on: the three rows, then the two diagonals. */
export const LINES: [number, number, number][] = [
  [0, 0, 0],
  [1, 1, 1],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];

export interface SlotWin {
  line: number;
  symbol: SlotSymbol;
  /** Three in a line, or two from the left (the symbols that pay for two). */
  count: 2 | 3;
  coins: number;
}
export interface SlotResult {
  /** [reel][row]: three reels of three. */
  grid: SlotSymbol[][];
  wins: SlotWin[];
  coins: number;
}

/** What a line of three (or two) pays at bet ×1, in coins. */
export const linePay = (symbol: SlotSymbol, count: 2 | 3) => {
  const s = SYMBOLS.find((x) => x.id === symbol);
  return s ? ((count === 3 ? s.three : (s.two ?? 0)) * SLOTS.cost) / LINES.length : 0;
};

/** The wins on a grid, at a bet. */
export function slotWins(grid: SlotSymbol[][], bet: number): SlotWin[] {
  const wins: SlotWin[] = [];
  LINES.forEach((rows, line) => {
    const [a, b, c] = rows.map((row, reel) => grid[reel][row]);
    if (a === b && b === c) wins.push({ line, symbol: a, count: 3, coins: Math.round(linePay(a, 3) * bet) });
    else if (a === b && linePay(a, 2) > 0) wins.push({ line, symbol: a, count: 2, coins: Math.round(linePay(a, 2) * bet) });
  });
  return wins;
}

export function rollSlots(bet: number): SlotResult {
  const grid = [0, 1, 2].map(() => [0, 1, 2].map(() => slotSymbol()));
  const wins = slotWins(grid, bet);
  return { grid, wins, coins: wins.reduce((t, w) => t + w.coins, 0) };
}

/** Pachinko: a ball's way down (0 = left, 1 = right at each row), the pocket it ends in, what it pays. */
export interface Ball {
  path: (0 | 1)[];
  pocket: number;
  coins: number;
}
export const PACHINKO_ROWS = PACHINKO.pockets.length - 1;
export function dropBall(): Ball {
  const path = Array.from({ length: PACHINKO_ROWS }, () => (Math.random() < 0.5 ? 0 : 1) as 0 | 1);
  const pocket = path.reduce<number>((t, s) => t + s, 0);
  return { path, pocket, coins: PACHINKO.pockets[pocket] };
}

/** A capsule: a frame drawn by rarity (then any of that rarity), and the coins back if it's one already owned. */
export function rollCapsule(owned: string[]): { frame: Frame; duplicate: boolean; coins: number } {
  const odds = CAPSULES.odds as Record<FrameRarity, number>;
  const rarities = (Object.keys(odds) as FrameRarity[]).filter((r) => odds[r] > 0 && FRAMES.some((f) => f.rarity === r));
  let x = Math.random() * rarities.reduce((t, r) => t + odds[r], 0);
  const rarity = rarities.find((r) => (x -= odds[r]) < 0) ?? rarities[0];
  const pool = FRAMES.filter((f) => f.rarity === rarity);
  const frame = pool[Math.floor(Math.random() * pool.length)];
  const duplicate = owned.includes(frame.id);
  return { frame, duplicate, coins: duplicate ? (CAPSULES.duplicate as Record<FrameRarity, number>)[rarity] : 0 };
}
