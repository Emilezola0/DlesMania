// Honkai: Star Rail's Specialist universe: the playable characters (Path, Combat Type, rarity, faction, version),
// their icons and splash art, their own Light Cones and a few combat lines in their own voices — all from the
// Honkai: Star Rail Wiki (scripts/build-specialist-hsr.mjs).
import DATA from '../data/specialist/hsr.json';

export interface HsrCharacter {
  id: string;
  name: string;
  aliases: string[];
  /** Square icon (drawn). */
  image: string;
  /** Full splash art (drawn). */
  splash: string;
  gender: string;
  rarity: number;
  path: string;
  element: string;
  faction: string;
  world: string;
  /** Version they were released in ("2.3"). */
  version: string;
  traits: Record<string, string>;
}

/** Versions compare part by part: 1.6 < 2.0 < 3.10. */
export const versionValue = (v: string) => {
  const [a, b] = v.split('.').map(Number);
  return a * 100 + (b ?? 0);
};

export const HSR_CHARACTERS: HsrCharacter[] = DATA.characters.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  splash: c.splash,
  gender: c.gender,
  rarity: c.rarity,
  path: c.path,
  element: c.element,
  faction: c.faction,
  world: c.world,
  version: c.version,
  traits: { Path: c.path, 'Combat Type': c.element, Rarity: `${c.rarity}★`, Faction: c.faction },
}));
const byName = new Map(HSR_CHARACTERS.map((c) => [c.name, c]));

/** Every character's own Light Cone (the four-stars have none). */
export const HSR_CONES = DATA.characters.flatMap((c) => ('lightcone' in c && c.lightcone ? [{ answer: c.id, name: c.lightcone.name, image: c.lightcone.image }] : []));

/** Combat lines in the character's own English voice (the wiki's recordings). */
export const HSR_VOICES = DATA.characters.flatMap((c) => c.voices.map((v) => ({ answer: byName.get(c.name)!.id, audio: v.audio, text: v.text })));

export const HSR_GENERATED = DATA.generated;

/** Classic: everyone whose traits are known. */
export const HSR_CLASSIC = HSR_CHARACTERS.filter((c) => c.gender !== 'Unknown' && c.path && c.element);

export const HSR_POOLS = {
  classic: HSR_CLASSIC.map((c) => c.id),
  splash: HSR_CHARACTERS.filter((c) => c.splash).map((c) => c.id),
  windows: HSR_CHARACTERS.filter((c) => c.splash).map((c) => c.id),
  // A Light Cone or voice round's id is its index (one character has several lines).
  lightcone: HSR_CONES.map((_, i) => `cone:${i}`),
  voice: HSR_VOICES.map((_, i) => `voice:${i}`),
};
