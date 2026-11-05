// ARC Raiders' Specialist universe: the ARC machines, the weapons and equipment, the places, the containers
// you search (the furniture), the materials, the crafting recipes and the machines' sounds — all from the
// ARC Raiders Wiki (scripts/build-specialist-arcraiders.mjs), each kind with its own list of answers.
import DATA from '../data/specialist/arcraiders.json';

export interface ArcThing {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  /** Shown as hints, vaguest first, and under the answer. */
  traits: Record<string, string>;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const traits = (pairs: [string, string | undefined][]) => Object.fromEntries(pairs.filter(([, v]) => v && v !== '?' && v.trim())) as Record<string, string>;
/** "2,050", "~4000", "23000 /", "~2000-4000": the first number. */
const healthOf = (s: string) => Number((s.replace(/,/g, '').match(/\d+/) ?? ['0'])[0]);

export const ARC_MACHINES: (ArcThing & { pictures: string[]; health: number })[] = DATA.arcs.map((a) => ({
  id: `arc-${slug(a.name)}`,
  name: a.name,
  // "Surveyor" for the "ARC Surveyor".
  aliases: a.name.startsWith('ARC ') ? [a.name.slice(4)] : [],
  image: a.image,
  pictures: a.pictures.length ? a.pictures : [a.image],
  health: healthOf(a.health),
  traits: traits([
    ['Armor', a.armor],
    ['Attack', a.attack],
    ['Weak spot', a.weakness],
    ['Health', a.health.replace(/\s*\/\s*$/, '')],
  ]),
}));

export const ARC_GEAR: ArcThing[] = DATA.gear.map((g) => ({
  id: `gear-${slug(g.name)}`,
  name: g.name,
  aliases: [],
  image: g.image,
  traits: traits([
    ['Kind', g.kind],
    ['Type', g.type],
    ['Rarity', g.rarity],
  ]),
}));

export const ARC_PLACES: ArcThing[] = DATA.places.map((p) => ({ id: `place-${slug(p.name)}`, name: p.name, aliases: p.name.startsWith('The ') ? [p.name.slice(4)] : [], image: '', traits: traits([['Kind', p.kind]]) }));
const placeByName = new Map(ARC_PLACES.map((p) => [p.name, p]));
export const ARC_PLACE_PICTURES = DATA.placePictures.filter((p) => placeByName.has(p.answer)).map((p) => ({ answer: placeByName.get(p.answer)!.id, image: p.image }));
// A place's own picture, for the answer banner: its first.
for (const p of ARC_PLACES) p.image = ARC_PLACE_PICTURES.find((x) => x.answer === p.id)?.image ?? '';

export const ARC_FURNITURE: ArcThing[] = DATA.furniture.map((f) => ({ id: `furniture-${slug(f.name)}`, name: f.name, aliases: [], image: f.image, traits: {} }));

export const ARC_MATERIALS: ArcThing[] = DATA.materials.map((m) => ({
  id: `material-${slug(m.name)}`,
  name: m.name,
  aliases: [],
  image: m.image,
  traits: traits([
    ['Kind', `${m.kind} material`],
    ['Rarity', m.rarity],
  ]),
}));

const kindOf = new Map([...ARC_GEAR.map((g) => [g.name, g.traits.Kind] as const), ...DATA.materials.map((m) => [m.name, `${m.kind} material`] as const)]);
export const ARC_RECIPES: (ArcThing & { ingredients: string[]; station: string })[] = DATA.recipes.map((r) => ({
  id: `recipe-${slug(r.name)}`,
  name: r.name,
  aliases: [],
  image: r.image,
  ingredients: r.ingredients,
  station: r.station,
  traits: traits([
    ['Crafted at', r.station],
    ['Kind', kindOf.get(r.name)],
  ]),
}));

const arcByName = new Map(ARC_MACHINES.map((a) => [a.name, a]));
export const ARC_SOUNDS = DATA.sounds.filter((s) => arcByName.has(s.answer)).map((s) => ({ ...s, answer: arcByName.get(s.answer)!.id }));

/** Classic: the machines whose armor, attack, weak spot and health are all known. */
export const ARC_CLASSIC = ARC_MACHINES.filter((a) => a.traits.Armor && a.traits.Attack && a.traits['Weak spot'] && a.health);

export const ARC_GENERATED = DATA.generated;

export const ARC_POOLS = {
  classic: ARC_CLASSIC.map((a) => a.id),
  mob: ARC_MACHINES.map((a) => a.id),
  gear: ARC_GEAR.map((g) => g.id),
  // A place round's id is its picture's index (a map has several pictures).
  place: ARC_PLACE_PICTURES.map((_, i) => `place:${i}`),
  furniture: ARC_FURNITURE.map((f) => f.id),
  material: ARC_MATERIALS.map((m) => m.id),
  recipe: ARC_RECIPES.map((r) => r.id),
  // A sound round's id is its clip's index.
  sound: ARC_SOUNDS.map((_, i) => `sound:${i}`),
};
