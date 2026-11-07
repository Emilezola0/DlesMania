// The claw machine's plushies (Casino → Claw): Omnidle's own little plush toys, won at the claw and kept on
// the shelf on the Account page. A plush won again is worth some DleCoins instead.

export type PlushRarity = 'common' | 'rare' | 'epic' | 'golden';

export interface Plush {
  id: string;
  name: string;
  /** Its face. */
  face: string;
  /** Its fabric: two colours, light then dark. */
  colors: [string, string];
  rarity: PlushRarity;
}

export const PLUSH_RARITY: Record<PlushRarity, { name: string; rank: number; duplicate: number; color: string }> = {
  common: { name: 'Common', rank: 0, duplicate: 60, color: '#9ca3af' },
  rare: { name: 'Rare', rank: 1, duplicate: 150, color: '#3b82f6' },
  epic: { name: 'Epic', rank: 2, duplicate: 400, color: '#a855f7' },
  golden: { name: 'Golden', rank: 3, duplicate: 1500, color: '#f59e0b' },
};

export const PLUSHIES: Plush[] = [
  { id: 'bunbun', name: 'Bunbun', face: '🐰', colors: ['#fde2ec', '#f9a8c4'], rarity: 'common' },
  { id: 'kuma', name: 'Kuma', face: '🐻', colors: ['#e7c9a9', '#a47148'], rarity: 'common' },
  { id: 'neko', name: 'Neko', face: '🐱', colors: ['#fed7aa', '#f59e0b'], rarity: 'common' },
  { id: 'kero', name: 'Kero', face: '🐸', colors: ['#bbf7d0', '#4ade80'], rarity: 'common' },
  { id: 'pen', name: 'Pen', face: '🐧', colors: ['#c7d2fe', '#4f63c9'], rarity: 'common' },
  { id: 'hiyo', name: 'Hiyo', face: '🐥', colors: ['#fef9c3', '#facc15'], rarity: 'common' },
  { id: 'tako', name: 'Tako', face: '🐙', colors: ['#fecdd3', '#f43f5e'], rarity: 'common' },
  { id: 'inu', name: 'Inu', face: '🐶', colors: ['#f5e6c8', '#c9a26b'], rarity: 'common' },
  { id: 'buta', name: 'Buta', face: '🐷', colors: ['#fce7f3', '#f472b6'], rarity: 'common' },
  { id: 'hamu', name: 'Hamu', face: '🐹', colors: ['#fef3c7', '#d6a35c'], rarity: 'common' },
  { id: 'panda', name: 'Panpan', face: '🐼', colors: ['#f8fafc', '#475569'], rarity: 'rare' },
  { id: 'kitsune', name: 'Kitsune', face: '🦊', colors: ['#ffedd5', '#ea580c'], rarity: 'rare' },
  { id: 'azarashi', name: 'Azarashi', face: '🦭', colors: ['#e0f2fe', '#7dd3fc'], rarity: 'rare' },
  { id: 'tsuki', name: 'Tsuki', face: '🌙', colors: ['#e0e7ff', '#6366f1'], rarity: 'rare' },
  { id: 'mochi', name: 'Mochi', face: '🍡', colors: ['#fdf2f8', '#a7f3d0'], rarity: 'rare' },
  { id: 'dino', name: 'Gao', face: '🦖', colors: ['#d9f99d', '#65a30d'], rarity: 'rare' },
  { id: 'dlecoin', name: 'DleCoin', face: '🪙', colors: ['#fef08a', '#d97706'], rarity: 'epic' },
  { id: 'cardback', name: 'Card Back', face: '🎴', colors: ['#ddd6fe', '#7c3aed'], rarity: 'epic' },
  { id: 'yume', name: 'Yume', face: '🦄', colors: ['#fae8ff', '#c084fc'], rarity: 'epic' },
  { id: 'omni-star', name: 'Golden Omni Star', face: '🌟', colors: ['#fff7c2', '#f59e0b'], rarity: 'golden' },
];

export const PLUSH_BY_ID = new Map(PLUSHIES.map((p) => [p.id, p]));

/** The best plush on a shelf: the rarest, the one won most among those. */
export function bestPlush(owned: Record<string, number> | undefined): Plush | undefined {
  let best: Plush | undefined;
  for (const p of PLUSHIES) {
    const n = owned?.[p.id] ?? 0;
    if (!n) continue;
    if (!best || PLUSH_RARITY[p.rarity].rank > PLUSH_RARITY[best.rarity].rank || (PLUSH_RARITY[p.rarity].rank === PLUSH_RARITY[best.rarity].rank && n > (owned?.[best.id] ?? 0))) best = p;
  }
  return best;
}
