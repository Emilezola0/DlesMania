// Icon frames: rings worn around the player's icon (their avatar card), won from the Casino's capsule
// machine. Each is drawn in CSS (src/casino/Frame.tsx, .avatar-frame in src/index.css): a ring, maybe a
// glow, maybe an ornament on its edge, maybe a little life (it turns, it pulses, it twinkles).

export type FrameRarity = 'common' | 'rare' | 'epic' | 'legendary';
export const FRAME_RARITIES: FrameRarity[] = ['common', 'rare', 'epic', 'legendary'];
export const FRAME_RARITY_NAME: Record<FrameRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const FRAME_RARITY_COLOR: Record<FrameRarity, string> = { common: '#94a3b8', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24' };

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
  /** A little life: the ring turns, pulses, or sparkles twinkle on it. */
  life?: 'spin' | 'pulse' | 'twinkle';
}

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
];

export const FRAME_BY_ID = new Map(FRAMES.map((f) => [f.id, f]));
