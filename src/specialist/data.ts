import onePiece from '../data/specialist/onepiece.json';
import { SILHOUETTES } from '../data/silhouettes';
import { compactText } from '../utils/textMatcher';

/** A One Piece character, as built by scripts/build-specialist-onepiece.mjs from the One Piece wiki. */
export interface OpCharacter {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  gender: string;
  affiliation: string;
  fruit: string[];
  fruitType: string[];
  haki: string[];
  /** Current or last known bounty in berries; 0 when none is known. */
  bounty: number;
  /** Centimetres; 0 when unknown. */
  height: number;
  origin: string;
  /** Debut chapter, and the arc it falls in. */
  chapter: number;
  arc: string;
}

export interface OpFruit {
  id: string;
  name: string;
  aliases: string[];
  english?: string;
  meaning?: string;
  type: string;
  users: string[];
  /** Only for fruits whose look has been shown. */
  image?: string;
  chapter?: number;
  arc?: string;
}

export interface OpCrew {
  id: string;
  name: string;
  aliases: string[];
  /** The crew's Jolly Roger. */
  flag: string;
  chapter?: number;
  arc?: string;
}

export interface OpLaugh {
  character: string;
  /** How the laugh is written ("Zehahaha"); a late hint, or the clue itself when there's no clip. */
  laugh: string;
  /** A clip of the laugh in the original Japanese voice, found by scripts/find-laugh-clips.mjs. */
  youtubeId?: string;
  start?: number;
}

interface OnePieceData {
  generated: string;
  characters: OpCharacter[];
  fruits: OpFruit[];
  crews: OpCrew[];
  laughs: OpLaugh[];
}

export const ONE_PIECE = onePiece as OnePieceData;

/** Anything a round can ask for: shown in suggestions, matched by any of its names. */
export interface Guessable {
  id: string;
  name: string;
  aliases?: string[];
}

export const characterById = new Map(ONE_PIECE.characters.map((c) => [c.id, c]));
export const fruitById = new Map(ONE_PIECE.fruits.map((f) => [f.id, f]));
export const crewById = new Map(ONE_PIECE.crews.map((c) => [c.id, c]));

/** The story arcs in order, to tell earlier from later and neighbours apart. */
export const ARC_ORDER = [...new Set([...ONE_PIECE.characters].sort((a, b) => a.chapter - b.chapter).map((c) => c.arc))];

/**
 * Silhouette pictures (transparent cut-outs) from the Who's That? roster, for the characters that
 * have one: the roster's names are matched against the character list.
 */
export const SILHOUETTE_OF: Map<string, string> = (() => {
  const roster = SILHOUETTES.find((s) => s.id === 'onepiece')?.entries ?? [];
  const out = new Map<string, string>();
  for (const c of ONE_PIECE.characters) {
    const names = [c.name, ...c.aliases].map(compactText);
    const hit = roster.find((r) => [r.name, ...r.aliases].some((n) => names.includes(compactText(n))));
    if (hit) out.set(c.id, hit.image);
  }
  return out;
})();

/** The pool each round draws its answer from. Characters are ranked by importance, so dailies use the best-known half. */
export const POOLS = {
  classic: ONE_PIECE.characters.slice(0, 160).map((c) => c.id),
  fruit: ONE_PIECE.fruits.filter((f) => f.image || f.users.some((u) => ONE_PIECE.characters.slice(0, 160).some((c) => c.name === u))).map((f) => f.id),
  // Laughs with a voice clip; the written laugh alone only if none have one.
  laugh: (ONE_PIECE.laughs.some((l) => l.youtubeId) ? ONE_PIECE.laughs.filter((l) => l.youtubeId) : ONE_PIECE.laughs).map((l) => l.character),
  flag: ONE_PIECE.crews.map((c) => c.id),
  silhouette: [...SILHOUETTE_OF.keys()],
  // Any of the best-known characters: the wiki portrait is blurred on a wanted poster.
  wanted: ONE_PIECE.characters.slice(0, 160).map((c) => c.id),
};

/** Bounties the way the series writes them: 3,000,000,000 → "3B", 550,000,000 → "550M". */
export function formatBounty(b: number): string {
  if (!b) return 'None';
  if (b >= 1e9) return `${+(b / 1e9).toFixed(3)}B`;
  if (b >= 1e6) return `${+(b / 1e6).toFixed(1)}M`;
  if (b >= 1e3) return `${+(b / 1e3).toFixed(1)}K`;
  return String(b);
}
