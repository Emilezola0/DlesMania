import { connectionThemes, connectionsPuzzles, type ThemeBank } from '../data';
import { BOSSES } from '../data/bosses';
import { shuffle } from '../lib/rng';
import { ONE_PIECE } from '../specialist/data';
import { DRAGON_BALL, HARRY_POTTER, NARUTO, STAR_WARS } from '../specialist/extra';

/** A theme as a graph: two cards are linked when a sub-category holds both. */
export interface SixGraph {
  bank: ThemeBank;
  cards: { label: string; image?: string }[];
  /** For a card, the cards it links to and through which sub-categories. */
  links: Map<string, Map<string, string[]>>;
}

export interface SixPuzzle {
  from: string;
  to: string;
  /** Steps on the shortest chain. */
  par: number;
  /** One shortest chain, shown when the player gives up. */
  path: string[];
}

const graphs = new Map<string, SixGraph>();

const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** A link too broad to tell anything (half the cast shares it), or no link at all. */
const VAGUE = /^(unknown|none|human|male|female|other|n\/a|)$/i;
/** A list's label that says only what kind of thing it is ("Fighter", "Item"): no link. */
const KIND_ONLY = /^(fighters?|items?|characters?|main characters|places?|planets?|droid|magical objects?|enemies|villains)$/i;
/** People and things to link, with their other names. */
type Named = { name: string; aliases?: string[] };
/** A group of them that share something: its label (the link shown) and members. */
type Group = { label: string; members: Named[] };

/**
 * More links than the theme's own categories: what else the site knows about the same franchise — its
 * boss's Blitz lists and Name Chain categories, and its characters' facts (house, clan, village, planet,
 * affiliations, master and apprentice…). A link shared by too many (a whole village) is left out.
 */
function moreGroups(themeId: string, theme: string): Group[] {
  const groups: Group[] = [];
  const by = <T,>(xs: T[], label: string, of: (x: T) => string | string[], named: (x: T) => Named) => {
    const m = new Map<string, Named[]>();
    for (const x of xs) for (const v of [of(x)].flat()) if (v && !VAGUE.test(v)) m.set(v, [...(m.get(v) ?? []), named(x)]);
    for (const [v, members] of m) groups.push({ label: `${label}: ${v}`, members });
  };
  // Smash Bros. holds the Nintendo casts (Mario's, Zelda's, the Pokémon) in its lists.
  const bosses = BOSSES.filter((b) => b.id === (themeId === 'dragonball' ? 'dbz' : themeId) || (b.id === 'smash' && ['mario', 'zelda', 'pokemon'].includes(themeId)));
  // The groups of the Connections puzzles about the same franchise (the Nintendo ones for Mario, Zelda, Pokémon).
  const nintendo = ['mario', 'zelda', 'pokemon'].includes(themeId);
  for (const p of connectionsPuzzles)
    if (p.theme && (key(p.theme) === key(theme) || (nintendo && p.theme === 'Nintendo')))
      for (const g of p.groups) groups.push({ label: g.label, members: g.items.map((i) => ({ name: i.label })) });
  for (const boss of bosses) {
    for (const p of boss.blitz) groups.push({ label: p.prompt.replace(/^name (the |both )?(\d+ )?(every |all (the )?)?/i, '').replace(/^./, (c) => c.toUpperCase()), members: p.answers });
    for (const c of boss.secret?.categories ?? []) groups.push({ label: c.label, members: c.entities });
  }
  if (themeId === 'harrypotter') {
    const n = (c: (typeof HARRY_POTTER)[number]) => ({ name: c.name, aliases: c.aliases });
    by(HARRY_POTTER, 'House', (c) => c.house, n);
    by(HARRY_POTTER, 'Patronus', (c) => c.patronus, n);
    by(HARRY_POTTER, 'Wand core', (c) => c.wand.split(', ')[1] ?? '', n);
  }
  if (themeId === 'starwars') {
    const n = (c: (typeof STAR_WARS)[number]) => ({ name: c.name });
    by(STAR_WARS, 'Homeworld', (c) => c.homeworld, n);
    by(STAR_WARS, 'Species', (c) => c.species, n);
    by(STAR_WARS, 'Affiliation', (c) => c.affiliations, n);
    for (const c of STAR_WARS) for (const m of c.masters) groups.push({ label: 'Master and apprentice', members: [{ name: m }, { name: c.name }] });
  }
  if (themeId === 'naruto') {
    const n = (c: (typeof NARUTO)[number]) => ({ name: c.name });
    by(NARUTO, 'Village', (c) => c.village, n);
    by(NARUTO, 'Clan', (c) => c.clan, n);
    by(NARUTO, 'Team', (c) => c.team, n);
    by(NARUTO, 'Kekkei genkai', (c) => c.kekkeiGenkai, n);
    by(NARUTO, 'Rank', (c) => c.rank, n);
  }
  if (themeId === 'dragonball') {
    const n = (c: (typeof DRAGON_BALL)[number]) => ({ name: c.name, aliases: c.aliases });
    by(DRAGON_BALL, 'Race', (c) => c.race, n);
    by(DRAGON_BALL, 'Affiliation', (c) => c.affiliation, n);
    by(DRAGON_BALL, 'From', (c) => c.planet, n);
  }
  if (themeId === 'onepiece') {
    const n = (c: (typeof ONE_PIECE.characters)[number]) => ({ name: c.name, aliases: c.aliases });
    by(ONE_PIECE.characters, 'Affiliation', (c) => c.affiliation, n);
    by(ONE_PIECE.characters, 'From', (c) => c.origin, n);
    by(ONE_PIECE.characters, 'Devil Fruit', (c) => c.fruitType, n);
  }
  return groups;
}

/**
 * Which card a person or thing is: by its name (the card's, or the full name it stands for), another name, or a
 * first or last name no one else in the theme has.
 */
function cardMatcher(cards: { label: string; src?: string }[], everyone: Named[]) {
  const card = new Map(cards.flatMap((c) => [[key(c.label), c.label] as const, ...(c.src ? [[key(c.src), c.label] as const] : [])]));
  // A card that says who it is takes a first name only with the rest of its full name: "Ron Weasley" is Ron
  // (Ronald Weasley), but Fū Yamanaka isn't Fu (Fū, the jinchūriki).
  const short = new Map(cards.map((c) => [key(c.label), c]));
  const fits = (c: { src?: string }, words: string[], w: string) => {
    if (!c.src) return true;
    const full = new Set(c.src.split(/[\s.]+/).map(key));
    return words.length > 1 && words.every((x) => x === w || full.has(x));
  };
  // How many people go by each word of their names: a shared surname ("Weasley") picks no one.
  const uses = new Map<string, number>();
  // (Full names only: "Ron" on its own is the same Ron as "Ron Weasley".)
  for (const name of new Set(everyone.map((p) => p.name.trim())))
    if (/\s/.test(name)) for (const w of new Set(name.split(/[\s.]+/).map(key))) uses.set(w, (uses.get(w) ?? 0) + 1);
  return (p: Named): string | undefined => {
    for (const n of [p.name, ...(p.aliases ?? [])]) if (card.has(key(n))) return card.get(key(n));
    const words = p.name.split(/[\s.]+/).map(key).filter(Boolean);
    for (const w of [words[0], words.at(-1)]) if (w && short.has(w) && (uses.get(w) ?? 0) <= 1 && fits(short.get(w)!, words, w)) return short.get(w)!.label;
    return undefined;
  };
}

export function sixGraph(themeId: string): SixGraph {
  if (graphs.has(themeId)) return graphs.get(themeId)!;
  const bank = connectionThemes.find((t) => t.id === themeId)!;
  const cards = bank.cards.map((c) => (typeof c === 'string' ? { label: c } : { label: c.label, image: c.image, src: c.src }));
  const links = new Map<string, Map<string, string[]>>(cards.map((c) => [c.label, new Map()]));
  const link = (label: string, items: string[]) => {
    for (const a of items)
      for (const b of items) {
        if (a === b) continue;
        const m = links.get(a)!;
        if (!m.get(b)?.includes(label)) m.set(b, [...(m.get(b) ?? []), label]);
      }
  };
  for (const cat of bank.categories) link(cat.label, cat.items.filter((i) => links.has(i)));
  // And every other link the site knows of, between the theme's cards (not too broad: up to 30 of them).
  const groups = moreGroups(themeId, bank.theme);
  const match = cardMatcher(cards, groups.flatMap((g) => g.members));
  for (const g of groups) {
    if (KIND_ONLY.test(g.label)) continue;
    const items = [...new Set(g.members.map(match).filter((x): x is string => !!x))];
    if (items.length >= 2 && items.length <= 30) link(g.label, items);
  }
  const g = { bank, cards, links };
  graphs.set(themeId, g);
  return g;
}

/** Shortest chain from one card to another (breadth-first), or null when they aren't connected. */
export function shortestPath(g: SixGraph, from: string, to: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const next of g.links.get(cur)?.keys() ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      queue.push(next);
    }
  }
  if (!prev.has(to)) return null;
  const path: string[] = [];
  for (let at: string | null = to; at; at = prev.get(at) ?? null) path.unshift(at);
  return path;
}

/** Two cards 2 to 4 links apart (3 when possible): never linked directly, always reachable. */
export function sixPuzzle(themeId: string, rand: () => number = Math.random): SixPuzzle {
  const g = sixGraph(themeId);
  const labels = g.cards.map((c) => c.label).filter((l) => (g.links.get(l)?.size ?? 0) > 0);
  let fallback: SixPuzzle | null = null;
  for (let i = 0; i < 300; i++) {
    const [from, to] = shuffle(labels, rand);
    const path = shortestPath(g, from, to);
    if (!path) continue;
    const par = path.length - 1;
    if (par === 3) return { from, to, par, path };
    if (par >= 2 && par <= 4) fallback ??= { from, to, par, path };
  }
  if (!fallback) throw new Error(`No Six Degrees puzzle for ${themeId}`);
  return fallback;
}

/** Stars: 3 for a chain at par with no wrong link, 2 for one step over (or a couple of slips), 1 otherwise. */
export function sixStars(steps: number, par: number, wrong: number): number {
  if (steps <= par && wrong === 0) return 3;
  if (steps <= par + 1 && wrong <= 2) return 2;
  return 1;
}

export const SIX_ROUNDS = 1;
export const SIX_THEMES = connectionThemes.map((t) => ({ id: t.id, theme: t.theme }));
