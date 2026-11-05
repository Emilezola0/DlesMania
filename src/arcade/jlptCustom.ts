// The words a player adds to their JLPT review list themselves — written, read and meant as they typed
// them (kept in their progress, src/store/progress.ts, and synced with their account). This small module
// is what both the store and the JLPT data (src/arcade/jlpt.ts) see, so the store never loads the list.
export interface CustomWord {
  /** As it's written: kanji, kana or both. */
  text: string;
  /** Its reading, in kana. */
  reading: string;
  meaning: string;
  /** When it was added (ms). */
  at: number;
}

export const CUSTOM_LEVEL = 'Mine';
export const isCustomId = (id: string) => id.startsWith('Custom:');
export const newCustomId = () => `Custom:word:${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

let words: Record<string, CustomWord> = {};
/** The store tells this module of the player's words whenever they change. */
export const setCustomWords = (w: Record<string, CustomWord> | undefined) => void (words = w ?? {});
export const customWord = (id: string) => words[id];
