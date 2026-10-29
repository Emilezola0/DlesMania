// French names, for every game: one dictionary (English name → French name) gathered from
// src/data/french-names.json (hand-checked, built by scripts/add-french-titles.mjs), the franchise
// wikis' French pages (src/data/french-names-wiki.json, scripts/find-french-names.mjs), Who's That's
// French names, the works' French titles, and the boss battles' own French spellings (handed over by
// src/data/bosses.ts when it loads). Games accept a French name wherever they accept the English
// one, and show it when names are in French (the EN/FR setting).
import { WORKS } from '../data';
import { SILHOUETTES } from '../data/silhouettes';
import raw from '../data/french-names.json';
import wiki from '../data/french-names-wiki.json';
import { useProgress, type NameLang } from '../store/progress';

let dict: Map<string, string> | null = null;
/** French names known only within one franchise ("set:Name"): Overwatch's Mercy is Ange, For Honor's isn't. */
const bySet = new Map<string, string>();
/** Names that mean different things in different franchises (a Mercy in Overwatch and in For Honor). */
const ambiguous = new Set<string>();
/** Names handed over before the dictionary was built. */
const pending: [string, string][] = [];

/** Built on first use, once every data module has loaded. The first source to name something wins. */
function french(): Map<string, string> {
  if (dict) return dict;
  dict = new Map(Object.entries(raw as Record<string, string>));
  const add = (en: string, fr: string) => !dict!.has(en) && dict!.set(en, fr);
  for (const s of SILHOUETTES) for (const e of s.entries) if (e.fr) add(e.name, e.fr);
  for (const w of WORKS) if (w.nameFr) add(w.name, w.nameFr);
  for (const [en, fr] of Object.entries(wiki as Record<string, string>)) add(en, fr);
  for (const [en, fr] of pending) add(en, fr);
  return dict;
}

/**
 * French names from a data module that loads later (the boss battles): `set` keeps them to their
 * franchise; a pair marked shared (the name means the same thing everywhere) also goes in the dictionary.
 * ambiguousNames: names several franchises use, which only take a French name given for their own.
 */
export function addFrench(set: string, pairs: [string, string, boolean][], ambiguousNames: string[] = []) {
  for (const n of ambiguousNames) ambiguous.add(n);
  for (const [en, fr, shared] of pairs) {
    bySet.set(`${set}:${en}`, fr);
    if (!shared) continue;
    if (dict) !dict.has(en) && dict.set(en, fr);
    else pending.push([en, fr]);
  }
}

/** The French name of something, when it differs from the English one (`set`: its franchise, when known). */
export const frenchOf = (name: string | undefined, set?: string): string | undefined => {
  if (!name) return undefined;
  const own = set ? bySet.get(`${set}:${name}`) : undefined;
  if (own) return own;
  // A name several franchises use: only a French name given for this one.
  if (set && ambiguous.has(name)) return undefined;
  return french().get(name);
};

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
export const nameIn = (name: string, lang: NameLang, set?: string) => (lang === 'fr' && frenchOf(name, set)) || name;

/** A name as the player wants to see it (read from the setting when called: for text built in handlers, too). */
export const shownName = (name: string, set?: string) => nameIn(name, useProgress.getState().nameLang, set);

/** `nameIn` with the player's setting. */
export function useNameIn(): (name: string, set?: string) => string {
  const lang = useProgress((s) => s.nameLang);
  return (name: string, set?: string) => nameIn(name, lang, set);
}
