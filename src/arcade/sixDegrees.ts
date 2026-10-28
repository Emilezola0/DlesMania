import { connectionThemes, type ThemeBank } from '../data';
import { shuffle } from '../lib/rng';

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

export function sixGraph(themeId: string): SixGraph {
  if (graphs.has(themeId)) return graphs.get(themeId)!;
  const bank = connectionThemes.find((t) => t.id === themeId)!;
  const cards = bank.cards.map((c) => (typeof c === 'string' ? { label: c } : { label: c.label, image: c.image }));
  const links = new Map<string, Map<string, string[]>>(cards.map((c) => [c.label, new Map()]));
  for (const cat of bank.categories) {
    for (const a of cat.items) {
      for (const b of cat.items) {
        if (a === b) continue;
        const m = links.get(a)!;
        m.set(b, [...(m.get(b) ?? []), cat.label]);
      }
    }
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

export const SIX_ROUNDS = 5;
export const SIX_THEMES = connectionThemes.map((t) => ({ id: t.id, theme: t.theme }));
