// More to play with for the franchises whose games had the least (src/data/extra.json, built by
// scripts/build-franchise-extra.mjs from each franchise's open data): characters and their facts, and
// Minecraft's mobs, foods and blocks. Games only — no cards come from it.
import data from '../data/extra.json';
import { BOSSES } from '../data/bosses';

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Notes in brackets out ("Ben Solo (along with a dozen apprentices)"). */
const bare = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim();

/** The site's own pictures of a franchise's people (its boss pages), by name and first name. */
function pictures(franchise: string) {
  const byName = new Map<string, string>();
  const b = BOSSES.find((x) => x.id === franchise);
  for (const c of [...(b?.radar.members ?? []), ...(b?.cardMembers ?? []), ...(b?.finale ?? [])]) if (c.image) for (const n of [c.label, ...(c.aliases ?? [])]) if (!byName.has(key(n))) byName.set(key(n), c.image);
  return (name: string, own?: string) => own || byName.get(key(name)) || byName.get(key(name.split(' ')[0])) || '';
}

export interface HpCharacter {
  id: string;
  name: string;
  aliases: string[];
  house: string;
  species: string;
  gender: string;
  ancestry: string;
  patronus: string;
  wand: string;
  wandLength: number;
  actor: string;
  alive: boolean;
  role: string;
  born: number;
  image: string;
}
const hpPicture = pictures('harrypotter');
export const HARRY_POTTER: HpCharacter[] = data.harrypotter.map((c) => ({ ...c, id: slug(c.name), image: hpPicture(c.name, c.image) }));

export interface SwCharacter {
  id: string;
  name: string;
  image: string;
  species: string;
  homeworld: string;
  gender: string;
  /** cm */
  height: number;
  mass: number;
  born: string;
  affiliations: string[];
  masters: string[];
  apprentices: string[];
}
const swPicture = pictures('starwars');
export const STAR_WARS: SwCharacter[] = data.starwars.map((c) => ({
  ...c,
  id: slug(c.name),
  image: swPicture(c.name, c.image),
  masters: c.masters.map(bare).filter(Boolean),
  apprentices: c.apprentices.map(bare).filter(Boolean),
  affiliations: c.affiliations.map(bare).filter(Boolean),
}));

export interface NarutoCharacter {
  id: string;
  name: string;
  image: string;
  sex: string;
  clan: string;
  village: string;
  affiliations: string[];
  natures: string[];
  rank: string;
  kekkeiGenkai: string[];
  classification: string[];
  team: string;
  occupation: string[];
  /** cm, Part II */
  height: number;
}
export const NARUTO: NarutoCharacter[] = data.naruto.map((c) => ({ ...c, id: slug(c.name) }));

export interface DbzCharacter {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  race: string;
  gender: string;
  affiliation: string;
  planet: string;
  maxKi: string;
  maxKiValue: number;
  transformations: number;
}
export const DRAGON_BALL: DbzCharacter[] = data.dbz.map((c) => ({ ...c, maxKiValue: c.maxKiValue ?? 0, id: slug(c.name) }));

const SCALE: [number, string][] = [
  [1e24, 'septillion'],
  [1e21, 'sextillion'],
  [1e18, 'quintillion'],
  [1e15, 'quadrillion'],
  [1e12, 'trillion'],
  [1e9, 'billion'],
];
/** A ki in words past a billion ("90 septillion"), in figures under it. */
export function formatKi(v: number): string {
  for (const [n, word] of SCALE) if (v >= n) return `${Number((v / n).toFixed(2))} ${word}`;
  return Math.round(v).toLocaleString('en');
}

export interface McThing {
  id: string;
  name: string;
  image?: string;
}
export const MINECRAFT = {
  mobs: data.minecraft.mobs.map((m) => ({ ...m, id: `mob-${slug(m.name)}` })),
  foods: data.minecraft.foods.map((f) => ({ ...f, id: `food-${slug(f.name)}` })),
  blocks: data.minecraft.blocks.map((b) => ({ ...b, id: `block-${slug(b.name)}` })),
};
