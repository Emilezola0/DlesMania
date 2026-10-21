import { create } from 'zustand';

export type RulesTab = 'daily' | 'boss';

/** Transient UI state shared across pages (not persisted). */
interface UiState {
  rules: RulesTab | null;
  openRules: (tab?: RulesTab) => void;
  closeRules: () => void;
}

export const useUi = create<UiState>()((set) => ({
  rules: null,
  openRules: (tab = 'daily') => set({ rules: tab }),
  closeRules: () => set({ rules: null }),
}));
