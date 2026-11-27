import { create } from 'zustand';

export type RulesTab = 'daily' | 'boss';

/** Kept on this device once the player has gone past the dailies (the drawer on the right): see `fullSide` below. */
const FULL_SIDE_KEY = 'omnidle:full-side';
function readFullSide(): boolean {
  try {
    return localStorage.getItem(FULL_SIDE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Transient UI state shared across pages (not persisted, but for `fullSide`). */
interface UiState {
  rules: RulesTab | null;
  openRules: (tab?: RulesTab) => void;
  closeRules: () => void;
  /**
   * Whether this player has ever been on the full side (games, boss, album, casino…). The daily side stays bare either
   * way; this only decides whether it may still mention the rest (the DleCoins a daily pays, the news over the pages),
   * which a player who only plays the dailies never sees.
   */
  fullSide: boolean;
  markFullSide: () => void;
}

export const useUi = create<UiState>()((set, get) => ({
  rules: null,
  openRules: (tab = 'daily') => set({ rules: tab }),
  closeRules: () => set({ rules: null }),
  fullSide: readFullSide(),
  markFullSide: () => {
    if (get().fullSide) return;
    try {
      localStorage.setItem(FULL_SIDE_KEY, '1');
    } catch {
      /* private mode: kept for this visit only */
    }
    set({ fullSide: true });
  },
}));

/** The daily side of the site: the home page, the dailies and their archive. Everything else is the full side. */
export function isDailySide(pathname: string): boolean {
  return pathname === '/' || pathname === '/daily' || pathname.startsWith('/daily/') || pathname === '/archive';
}
