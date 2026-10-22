import lol from '../data/specialist/lol.json';
import { SILHOUETTES } from '../data/silhouettes';

/** A League of Legends champion, as built by scripts/build-specialist-lol.mjs (Data Dragon + the League wiki). */
export interface LolChampion {
  id: string;
  name: string;
  aliases: string[];
  title: string;
  /** Square portrait. */
  image: string;
  /** Base-skin splash art. */
  splash: string;
  gender: string;
  positions: string[];
  species: string[];
  resource: string;
  range: string;
  regions: string[];
  classes: string[];
  /** Release year; 0 when not known yet. */
  year: number;
  abilities: { key: 'P' | 'Q' | 'W' | 'E' | 'R'; name: string; icon: string }[];
  /** False for champions too new for the wiki's data: they sit out Classic. */
  complete: boolean;
}

interface LolData {
  generated: string;
  version: string;
  champions: LolChampion[];
}

export const LOL = lol as LolData;

export const championById = new Map(LOL.champions.map((c) => [c.id, c]));

/** Who's That? renders (transparent cut-outs), matched to champions by name. */
export const LOL_SILHOUETTE_OF: Map<string, string> = (() => {
  const roster = SILHOUETTES.find((s) => s.id === 'lol')?.entries ?? [];
  const byName = new Map(roster.map((r) => [r.name, r.image]));
  return new Map(LOL.champions.filter((c) => byName.has(c.name)).map((c) => [c.id, byName.get(c.name)!]));
})();

export const LOL_POOLS = {
  classic: LOL.champions.filter((c) => c.complete).map((c) => c.id),
  ability: LOL.champions.map((c) => c.id),
  splash: LOL.champions.map((c) => c.id),
  silhouette: [...LOL_SILHOUETTE_OF.keys()],
};

export const ABILITY_KEY_NAME = { P: 'passive', Q: 'Q', W: 'W', E: 'E', R: 'ultimate (R)' } as const;
