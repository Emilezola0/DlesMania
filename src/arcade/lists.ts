import { BOSSES } from '../data/bosses';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { JLPT_LEVELS, JLPT_THEMES, type JlptEntry } from './jlpt';
import { romajiSpellings, toHiragana } from '../lib/romaji';
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

// JLPT's lists are its themes (below), not its boss's Blitz.
const fromBosses: NameList[] = BOSSES.filter((b) => b.id !== 'jlpt').flatMap((b) =>
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

/**
 * JLPT themes: every word of a theme, named in Japanese — in romaji ("inu", long vowels or not), in kana or
 * in kanji. A word listed twice (two levels, two senses) counts once.
 */
/** Words to name: each once, shown with its kana and romaji, named by any of them (or in kanji). */
function wordAnswers(entries: JlptEntry[]) {
  const words = new Map<string, { name: string; aliases: string[] }>();
  for (const e of entries) {
    if (words.has(e.text)) continue;
    const readings = e.reading.split(/[/／・、\s]+/).filter(Boolean);
    const forms = e.text.split(/[/／\s]+/).filter(Boolean);
    words.set(e.text, {
      // The word, its kana and its romaji: every name named shows how it's read.
      name: readings[0] && readings[0] !== e.text ? `${e.text} · ${readings[0]} (${romajiSpellings(readings[0])[0]})` : `${e.text} (${romajiSpellings(e.text)[0]})`,
      aliases: [...new Set([...forms, ...readings, ...readings.map(toHiragana), ...readings.flatMap(romajiSpellings)])],
    });
  }
  return [...words.values()];
}

/** Kanji to name: by the kanji itself, or by any of its readings (on or kun, kana or romaji; a kun reading's okurigana or not). */
function kanjiAnswers(entries: JlptEntry[]) {
  const seen = new Set<string>();
  return entries.flatMap((e) => {
    if (seen.has(e.text)) return [];
    seen.add(e.text);
    const readings = e.reading
      .split(/[・、/\s]+/)
      .flatMap((r) => [r.replace(/[.\-～~]/g, ''), r.split('.')[0].replace(/[-～~]/g, '')])
      .map(toHiragana)
      .filter(Boolean);
    return [{ name: `${e.text} · ${e.reading}`, aliases: [...new Set([e.text, ...readings, ...readings.flatMap(romajiSpellings)])] }];
  });
}

/** Grammar points to name: as the list writes them, without the ～ (and a reading in brackets as another way). */
function grammarAnswers(points: string[]) {
  return points.map((g) => {
    const bare = g.replace(/[～~]/g, '').trim();
    const inBrackets = /[（(]([^）)]+)[）)]/.exec(bare)?.[1];
    const outside = bare.replace(/[（(][^）)]*[）)]/g, '').trim();
    const kana = [outside, inBrackets].filter((x): x is string => !!x && /^[ぁ-ゖァ-ヶー\s]+$/.test(x));
    return { name: g, aliases: [...new Set([bare, outside, ...(inBrackets ? [inBrackets] : []), ...kana.map(toHiragana), ...kana.flatMap((k) => romajiSpellings(k.replace(/\s/g, '')))].filter(Boolean))] };
  });
}

/** Whole levels: every word, every kanji or every grammar point of N5 … N1. */
const KIND_LABEL = { vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' } as const;
const jlptLevels: NameList[] = JLPT_LEVELS.flatMap((l) =>
  (['vocab', 'kanji', 'grammar'] as const).map((kind) => {
    const deck = l.decks.find((d) => d.kind === kind);
    const answers = kind === 'grammar' ? grammarAnswers(l.grammar) : kind === 'kanji' ? kanjiAnswers(deck!.entries) : wordAnswers(deck!.entries);
    return { id: `jlpt-${l.level.toLowerCase()}-${kind}`, title: `${l.level} ${KIND_LABEL[kind]}`, franchise: 'JLPT', domain: 'anime' as Domain, answers, seconds: timeFor(answers.length) };
  }),
);

const jlpt: NameList[] = [
  ...jlptLevels,
  ...JLPT_THEMES.map((t) => {
    const answers = wordAnswers(t.entries);
    return { id: `jlpt-${t.id.replace(/^theme-/, '')}`, title: `${t.icon} ${t.label} in Japanese`, franchise: 'JLPT', domain: 'anime' as Domain, answers, seconds: timeFor(answers.length) };
  }),
];

/** Same title in one franchise (two bosses can ask for the same thing): the first stays. */
export const NAME_LISTS: NameList[] = [...rosters, ...fromBosses, ...jlpt].filter((l, i, all) => all.findIndex((o) => o.id === l.id) === i);

export const nameList = (id: string | undefined) => NAME_LISTS.find((l) => l.id === id);

/** Lists grouped by franchise, in the order they come. */
export function listsByFranchise(): [string, NameList[]][] {
  const groups = new Map<string, NameList[]>();
  for (const l of NAME_LISTS) groups.set(l.franchise, [...(groups.get(l.franchise) ?? []), l]);
  return [...groups];
}
