import wow from '../data/specialist/wow.json';

/** A World of Warcraft character, as built by scripts/build-specialist-wow.mjs from the Warcraft Wiki. */
export interface WowCharacter {
  id: string;
  name: string;
  aliases: string[];
  /** Small picture for the suggestions (the infobox art). */
  image: string;
  /** The infobox art, bigger. */
  art?: string;
  /** A render on a transparent background, for the silhouette. */
  render?: string;
  gender: string;
  /** Race family ("Orc" for Mag'har orcs, "Dragon" for every flight). */
  race: string;
  faction: string;
  /** The closest World of Warcraft class, or "None". */
  class: string;
  status: string;
  titles: string[];
  /** First game they appeared in: an index in `WOW.games` (hand-written, so some have none). */
  debut?: number;
}

interface WowData {
  generated: string;
  /** The Warcraft games in release order, with their year. */
  games: string[];
  characters: WowCharacter[];
}

export const WOW = wow as WowData;

export const wowCharacterById = new Map(WOW.characters.map((c) => [c.id, c]));

/** One-word honorifics say nothing about who it is. */
const VAGUE_TITLE = /^(lady|lord|king|queen|prince|princess|archmage|miss|sir|warchief|chieftain|leader|keeper|shadow|champion|the)$/i;

/** Titles worth showing as a clue: not vague, and not giving the name away. */
export function telltaleTitles(c: WowCharacter): string[] {
  const words = [c.name, ...c.aliases].flatMap((n) => n.toLowerCase().split(/[\s,]+/)).filter((w) => w.length >= 4);
  return c.titles.filter((t) => !VAGUE_TITLE.test(t) && !words.some((w) => t.toLowerCase().includes(w)));
}

export const WOW_POOLS = {
  classic: WOW.characters.map((c) => c.id),
  art: WOW.characters.filter((c) => c.art).map((c) => c.id),
  silhouette: WOW.characters.filter((c) => c.render).map((c) => c.id),
  titles: WOW.characters.filter((c) => telltaleTitles(c).length >= 2).map((c) => c.id),
};
