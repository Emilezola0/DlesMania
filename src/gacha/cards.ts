// The cards: every franchise of Boss Battle makes a set — its guardian (legendary), its best-known
// faces (the Radar cards, best-known first: the first few epic, then rare, then common) and its
// deep cuts (the Final Blow cards: rare, then common). Only cards with a picture, each name once.
import { WHO_UNIVERSES } from '../arcade/whoAmI';
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

const LINES: Record<'epic' | 'rare' | 'common' | 'deep', string[]> = {
  epic: ['An icon of {f} — everyone knows this face.', 'The face of {f} for a generation of fans.', 'A {f} legend in their own right.'],
  rare: ['A familiar face from {f}.', 'A fan favourite of {f}.', 'Hard to picture {f} without them.'],
  common: ['Part of the {f} roster.', 'One of the many faces of {f}.', 'You have met them somewhere in {f}.'],
  deep: ['A deep cut from {f}: only true fans name this one.', 'Blink and you miss it in {f}.', 'A {f} detail for the connoisseurs.'],
};
const line = (kind: keyof typeof LINES, name: string, franchise: string) => {
  const xs = LINES[kind];
  return xs[hashString(name) % xs.length].replace('{f}', franchise);
};

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
    add(b.boss.name, b.boss.image, 'legendary', `${b.boss.title}. The guardian of the ${b.franchise} Boss Battle.`);
    b.radar.members.forEach((m, i) => {
      const rarity: Rarity = i < 3 ? 'epic' : i < 8 ? 'rare' : 'common';
      add(m.label, m.image, rarity, CLUES.get(m.label) || line(rarity === 'epic' ? 'epic' : rarity === 'rare' ? 'rare' : 'common', m.label, b.franchise));
    });
    b.finale.forEach((c, i) => add(c.label, c.image, i < 4 ? 'rare' : 'common', CLUES.get(c.label) || line('deep', c.label, b.franchise)));
    set.forEach((c, i) => out.push({ ...c, no: i + 1 }));
  }
  return out;
})();

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The sets, in Boss Battle order: id, franchise, kind of work, size. */
export const SETS = BOSSES.map((b) => ({ id: b.id, franchise: b.franchise, domain: b.domain, size: CARDS.filter((c) => c.set === b.id).length, guardian: b.boss }));
export const setSize = (id: string) => SETS.find((s) => s.id === id)?.size ?? 0;
