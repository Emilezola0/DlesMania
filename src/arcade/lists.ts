import { BOSSES } from '../data/bosses';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import type { BlitzPrompt, Domain } from '../types';

/** A list to name in full against the clock. */
export interface NameList {
  id: string;
  /** "Devil Fruits", "Champions from Demacia"... */
  title: string;
  franchise: string;
  domain: Domain;
  answers: BlitzPrompt['answers'];
  /** Time allowed, in seconds. */
  seconds: number;
}

/** "Name 5 champions from Demacia" → "Champions from Demacia"; "Name the 6 Infinity Stones" → "Infinity Stones". */
const titleOf = (prompt: string) => {
  const t = prompt.replace(/^name (the )?(\d+ )?(every |all (the )?)?/i, '').trim();
  return t[0].toUpperCase() + t.slice(1);
};

/** Eight seconds a name, between a minute and a half and ten minutes. */
const timeFor = (n: number) => Math.min(600, Math.max(90, n * 8));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const fromBosses: NameList[] = BOSSES.flatMap((b) =>
  b.blitz
    // A few answers make a poor list: the Blitz asks for some of them, here it's all of them.
    .filter((p) => p.answers.length >= 6)
    .map((p) => ({ id: `${b.id}-${slug(titleOf(p.prompt))}`, title: titleOf(p.prompt), franchise: b.franchise, domain: b.domain, answers: p.answers, seconds: timeFor(p.answers.length) })),
);

const roster = (id: string, title: string, franchise: string, domain: Domain, items: { name: string; aliases?: string[] }[]): NameList => ({
  id,
  title,
  franchise,
  domain,
  answers: items.map((x) => ({ name: x.name, aliases: x.aliases ?? [] })),
  seconds: timeFor(items.length),
});

/** Whole rosters from the Specialist data: the big ones. */
const rosters: NameList[] = [
  roster('lol-champions', 'Every champion', 'League of Legends', 'games', LOL.champions),
  roster('genshin-characters', 'Every playable character', 'Genshin Impact', 'games', GENSHIN.characters),
  roster('mcu-films', 'Every MCU film', 'Marvel Cinematic Universe', 'cinema', MARVEL.films),
];

/** Same title in one franchise (two bosses can ask for the same thing): the first stays. */
export const NAME_LISTS: NameList[] = [...rosters, ...fromBosses].filter((l, i, all) => all.findIndex((o) => o.id === l.id) === i);

export const nameList = (id: string | undefined) => NAME_LISTS.find((l) => l.id === id);

/** Lists grouped by franchise, in the order they come. */
export function listsByFranchise(): [string, NameList[]][] {
  const groups = new Map<string, NameList[]>();
  for (const l of NAME_LISTS) groups.set(l.franchise, [...(groups.get(l.franchise) ?? []), l]);
  return [...groups];
}
