import genshin from '../data/specialist/genshin.json';

/** A Genshin Impact playable character, as built by scripts/build-specialist-genshin.mjs from the Genshin wiki. */
export interface GiCharacter {
  id: string;
  name: string;
  aliases: string[];
  /** Square icon. */
  image: string;
  /** Full wish splash art. */
  wish?: string;
  /** Official full-body art on white (cut out for the silhouette). */
  portrait?: string;
  gender: string;
  /** Short / Medium / Tall. */
  body: string;
  element: string;
  weapon: string;
  region: string;
  rarity: number;
  /** Version they were released in ("1.3"). */
  version: string;
  affiliation: string;
  constellation?: string;
  title?: string;
}

interface GenshinData {
  generated: string;
  characters: GiCharacter[];
}

export const GENSHIN = genshin as GenshinData;

export const giCharacterById = new Map(GENSHIN.characters.map((c) => [c.id, c]));

/** Versions compare as numbers part by part: 1.3 < 4.0 < 5.10. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  return (x[0] - y[0]) * 1000 + ((x[1] ?? 0) - (y[1] ?? 0));
}

export const GENSHIN_POOLS = {
  classic: GENSHIN.characters.map((c) => c.id),
  wish: GENSHIN.characters.filter((c) => c.wish).map((c) => c.id),
  silhouette: GENSHIN.characters.filter((c) => c.portrait).map((c) => c.id),
  constellation: GENSHIN.characters.filter((c) => c.constellation).map((c) => c.id),
};
