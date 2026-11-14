import lol from '../data/specialist/lol.json';
import lolQuotes from '../data/specialist/lol-quotes.json';
import lolEmoji from '../data/specialist/lol-emoji.json';
import lolSkins from '../data/specialist/lol-skins.json';
import lolFrench from '../data/specialist/lol-fr.json';
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

/**
 * Each champion's own lines (scripts/build-specialist-lol-quotes.mjs, from the League wiki): the champion select
 * line every player knows, then the ban line and lines said while moving, as later clues. Its name is masked.
 */
export const LOL_QUOTES = (lolQuotes as { generated: string; quotes: Record<string, { pick: string; ban?: string; more: string[] }> }).quotes;
/** A champion told in five emojis, vaguest first, one more shown with each miss (written for Omnidle). */
export const LOL_EMOJI = lolEmoji as Record<string, string[]>;

/** A champion's skin (scripts/build-specialist-lol-skins.mjs, Data Dragon): its splash number and its names. */
export interface LolSkin {
  num: number;
  name: string;
  /** The French name, when it differs (Data Dragon fr_FR). */
  fr?: string;
}
/** Every champion's skins with a splash of their own (not the base skin, not chromas). */
export const LOL_SKINS = (lolSkins as { skins: Record<string, LolSkin[]> }).skins;
export const skinSplash = (championId: string, num: number) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_${num}.jpg`;

export const LOL_POOLS = {
  classic: LOL.champions.filter((c) => c.complete).map((c) => c.id),
  ability: LOL.champions.map((c) => c.id),
  splash: LOL.champions.map((c) => c.id),
  silhouette: [...LOL_SILHOUETTE_OF.keys()],
  quote: LOL.champions.filter((c) => LOL_QUOTES[c.id]).map((c) => c.id),
  emoji: LOL.champions.filter((c) => LOL_EMOJI[c.id]).map((c) => c.id),
  skin: LOL.champions.filter((c) => LOL_SKINS[c.id]?.length).map((c) => c.id),
};

export const ABILITY_KEY_NAME = { P: 'passive', Q: 'Q', W: 'W', E: 'E', R: 'ultimate (R)' } as const;
export const ABILITY_KEY_NAME_FR = { P: 'passif', Q: 'Q', W: 'W', E: 'E', R: 'ultime (R)' } as const;

/** League in French (scripts/build-specialist-lol-fr.mjs, Data Dragon fr_FR): each champion's title and ability names. */
export const LOL_FRENCH = lolFrench as { titles: Record<string, string>; abilities: Record<string, Record<'P' | 'Q' | 'W' | 'E' | 'R', string>> };
