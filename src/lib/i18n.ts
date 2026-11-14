// The interface in the player's language (the EN/FR switch, `nameLang`): each text is written in both, the French
// right next to the English, and the one shown follows the setting.
import { useProgress } from '../store/progress';
import { frNow } from './langNow';

/** Whether the game is in French (read when called: for text built in handlers too). */
export const isFr = () => frNow();

/** The interface's words: English, or French when the game is in French. */
export function useT(): (en: string, fr: string) => string {
  const fr = useProgress((s) => s.nameLang) === 'fr';
  return (en, frText) => (fr ? frText : en);
}

/** Whether the game is in French, as a hook (re-renders when the setting changes). */
export const useFr = () => useProgress((s) => s.nameLang) === 'fr';

/** The same as `useT`, read when called (handlers, lib code). */
export const tr = (en: string, fr: string) => (isFr() ? fr : en);

/** A text kept in data in both languages: `{ en, fr }` or a field and its `…Fr` twin. */
export const pick = (en: string, fr: string | undefined, french: boolean) => (french && fr) || en;


export { withFrench } from './langNow';
