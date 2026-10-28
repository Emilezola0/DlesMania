// French names, for every game: one dictionary (English name → French name) gathered from
// src/data/french-names.json (built by scripts/add-french-titles.mjs), Who's That's French names
// and the works' French titles. Games accept a French name wherever they accept the English one,
// and show it when names are in French (the EN/FR setting).
import { WORKS } from '../data';
import { SILHOUETTES } from '../data/silhouettes';
import raw from '../data/french-names.json';
import { useProgress, type NameLang } from '../store/progress';

let dict: Map<string, string> | null = null;

/** Built on first use, once every data module has loaded. */
function french(): Map<string, string> {
  if (dict) return dict;
  dict = new Map(Object.entries(raw as Record<string, string>));
  for (const s of SILHOUETTES) for (const e of s.entries) if (e.fr && !dict.has(e.name)) dict.set(e.name, e.fr);
  for (const w of WORKS) if (w.nameFr && !dict.has(w.name)) dict.set(w.name, w.nameFr);
  return dict;
}

/** The French name of something, when it differs from the English one. */
export const frenchOf = (name: string | undefined): string | undefined => (name ? french().get(name) : undefined);

/** A list of spellings with the French names of each one added. */
export const withFrench = (names: (string | undefined)[]): string[] => {
  const out = names.filter((n): n is string => !!n);
  for (const n of [...out]) {
    const fr = frenchOf(n);
    if (fr && !out.includes(fr)) out.push(fr);
  }
  return out;
};

/** A name in the chosen language: its French one, if it has one, when names are in French. */
export const nameIn = (name: string, lang: NameLang) => (lang === 'fr' && frenchOf(name)) || name;

/** A name as the player wants to see it (read from the setting when called: for text built in handlers, too). */
export const shownName = (name: string) => nameIn(name, useProgress.getState().nameLang);

/** `nameIn` with the player's setting. */
export function useNameIn(): (name: string) => string {
  const lang = useProgress((s) => s.nameLang);
  return (name: string) => nameIn(name, lang);
}
