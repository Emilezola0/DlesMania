// The cards: every franchise of Boss Battle makes a set — its guardian (legendary), its best-known
// faces (the Radar cards, best-known first: the first few epic, then rare, then common) and its
// deep cuts (the Final Blow cards: rare, then common). Only cards with a picture, each name once.
import { WHO_UNIVERSES } from '../arcade/whoAmI';
import { connectionThemes } from '../data';
import { BOSSES } from '../data/bosses';
import { hashString } from '../lib/rng';
import type { Domain } from '../types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_INFO: Record<Rarity, { name: string; gem: string; rank: number }> = {
  common: { name: 'Common', gem: '◆', rank: 0 },
  rare: { name: 'Rare', gem: '◆◆', rank: 1 },
  epic: { name: 'Epic', gem: '◆◆◆', rank: 2 },
  legendary: { name: 'Legendary', gem: '★', rank: 3 },
};

/** Each rarity's light: the glow from a torn pack, the shooting star, the bursts, an icon's ring. */
export const RARITY_LIGHT: Record<Rarity, string> = { common: '#e2e8f0', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24' };

export interface Card {
  id: string;
  name: string;
  image: string;
  /** The set: a Boss Battle id. */
  set: string;
  franchise: string;
  domain: Domain;
  rarity: Rarity;
  description: string;
  /** Number within its set, for the "12 / 35" corner. */
  no: number;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The most telling Who Am I? clues of a character, when it has some (the last one only spells the name). */
const CLUES = new Map(WHO_UNIVERSES.flatMap((u) => u.targets.map((t) => [t.name, t.clues.slice(-3, -1).join(' · ')] as const)));

/** When nothing more telling is known: a line by rarity, with the card's own name. */
const LINES: Record<'epic' | 'rare' | 'common' | 'deep', string[]> = {
  epic: ['{n}: an icon of {f} — everyone knows this face.', '{n}, the face of {f} for a generation of fans.', '{n}, a {f} legend in their own right.'],
  rare: ['{n}, a familiar face from {f}.', '{n}, a fan favourite of {f}.', 'Hard to picture {f} without {n}.'],
  common: ['{n}, part of the {f} roster.', '{n}, one of the many faces of {f}.', 'You have met {n} somewhere in {f}.'],
  deep: ['{n}: a deep cut from {f} — only true fans name this one.', 'Blink and you miss {n} in {f}.', '{n}, a {f} detail for the connoisseurs.'],
};
const line = (kind: keyof typeof LINES, name: string, franchise: string) => {
  const xs = LINES[kind];
  return xs[hashString(name) % xs.length].replace('{f}', franchise).replace('{n}', name);
};

/** "Name 5 Akatsuki members" → "Akatsuki members". */
const listTitle = (prompt: string) => {
  const t = prompt.replace(/^name (the )?(\d+ )?(every |all (the )?)?/i, '').trim();
  return t[0].toUpperCase() + t.slice(1);
};
const IRREGULAR: Record<string, string> = { elves: 'elf', heroes: 'hero', wolves: 'wolf', dwarves: 'dwarf', men: 'man', women: 'woman', children: 'child' };
function singular(word: string): string {
  const lower = word.toLowerCase();
  const keep = (s: string) => (word[0] === word[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);
  if (IRREGULAR[lower]) return keep(IRREGULAR[lower]);
  if (/ies$/.test(lower)) return word.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(lower) || lower.length <= 3) return word;
  if (/(ches|shes|xes|sses)$/.test(lower)) return word.slice(0, -2);
  return lower.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * A group's name, said of one of its members: "Members of the Fellowship" → "Member of the
 * Fellowship", "Damage heroes" → "Damage hero", "Talon agents, past or present" → "Talon agent,
 * past or present". Names that aren't plurals stay as they are ("Hokage", "Uchiha clan").
 */
function oneOf(label: string): string {
  const [head, ...rest] = label.split(',');
  const words = head.trim().split(/\s+/);
  const at = words.findIndex((w) => w === 'of' || w === 'by' || w === 'from');
  // "Students of Master Roshi": the word before "of"; "Original trilogy heroes": the last word.
  const i = at > 0 ? at - 1 : words.length - 1;
  words[i] = singular(words[i]);
  return [words.join(' '), ...rest].join(',');
}

/** Groups too broad to say anything about the one card ("Character", 42 names). */
const TOO_BROAD = 20;
const keyWord = (label: string) => label.split(/\s+/).sort((a, b) => b.length - a.length)[0].toLowerCase();

/**
 * What a card is, from every group it belongs to across the data — Boss Battle lists and
 * categories, Connections groups — the smallest (most telling) first: "Members of the Akatsuki ·
 * Uchiha clan". Two groups at most, and not two saying the same thing. (`oneOf` then says it of one.)
 */
const FACTS: Map<string, Map<string, string[]>> = (() => {
  const bySet = new Map<string, Map<string, { label: string; size: number }[]>>();
  const note = (set: string, name: string, label: string, size: number) => {
    if (size > TOO_BROAD || size < 2) return;
    const m = bySet.get(set) ?? new Map<string, { label: string; size: number }[]>();
    bySet.set(set, m);
    m.set(name, [...(m.get(name) ?? []), { label, size }]);
  };
  const THEME_SET: Record<string, string> = { dragonball: 'dbz' };
  for (const b of BOSSES) {
    for (const p of b.blitz) for (const a of p.answers) note(b.id, a.name, listTitle(p.prompt), p.answers.length);
    for (const c of b.secret?.categories ?? []) for (const e of c.entities) note(b.id, e.name, c.label, c.entities.length);
  }
  for (const t of connectionThemes) for (const c of t.categories) for (const item of c.items) note(THEME_SET[t.id] ?? t.id, item, c.label, c.items.length);
  const out = new Map<string, Map<string, string[]>>();
  for (const [set, names] of bySet) {
    const m = new Map<string, string[]>();
    for (const [name, facts] of names) {
      const keys = new Set<string>();
      const picked = [...facts]
        .sort((a, b) => a.size - b.size)
        .filter((f) => !keys.has(keyWord(f.label)) && keys.add(keyWord(f.label)))
        .slice(0, 2)
        .map((f) => f.label);
      m.set(name, picked);
    }
    out.set(set, m);
  }
  return out;
})();

/** A card's line: its Who Am I? clues, else the groups it belongs to, else a line with its name. */
function describe(set: string, name: string, kind: keyof typeof LINES, franchise: string): string {
  const clues = CLUES.get(name);
  if (clues) return clues;
  const facts = FACTS.get(set)?.get(name);
  if (facts?.length) return `${facts.map(oneOf).join(' · ')}.`;
  return line(kind, name, franchise);
}

export const CARDS: Card[] = (() => {
  const seen = new Set<string>();
  const out: Card[] = [];
  for (const b of BOSSES) {
    const set: Omit<Card, 'no'>[] = [];
    const add = (name: string, image: string | undefined, rarity: Rarity, description: string) => {
      if (!image || seen.has(name)) return;
      seen.add(name);
      set.push({ id: `${b.id}:${slug(name)}`, name, image, set: b.id, franchise: b.franchise, domain: b.domain, rarity, description });
    };
    add(b.boss.name, b.boss.image, 'legendary', `${b.boss.title}. The guardian of ${/^The /.test(b.franchise) ? b.franchise : `the ${b.franchise}`} Boss Battle.`);
    b.radar.members.forEach((m, i) => {
      const rarity: Rarity = i < 3 ? 'epic' : i < 8 ? 'rare' : 'common';
      add(m.label, m.image, rarity, describe(b.id, m.label, rarity, b.franchise));
    });
    b.finale.forEach((c, i) => add(c.label, c.image, i < 4 ? 'rare' : 'common', describe(b.id, c.label, 'deep', b.franchise)));
    set.forEach((c, i) => out.push({ ...c, no: i + 1 }));
  }
  return out;
})();

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The sets, in Boss Battle order: id, franchise, kind of work, size. */
export const SETS = BOSSES.map((b) => ({ id: b.id, franchise: b.franchise, domain: b.domain, size: CARDS.filter((c) => c.set === b.id).length, guardian: b.boss }));
export const setSize = (id: string) => SETS.find((s) => s.id === id)?.size ?? 0;
