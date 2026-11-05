// Deadlock's Specialist universe: the heroes (their stats, card art, abilities and voice lines) and the
// shop's items — all from The Deadlock Wiki (scripts/build-specialist-deadlock.mjs).
import DATA from '../data/specialist/deadlock.json';

export interface DlHero {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  traits: Record<string, string>;
  gender: string;
  type: string;
  health: number;
  clip: number;
  speed: number;
  year: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Yamato's infobox gives no pronouns; she is a woman in the game.
const GENDER_FIX: Record<string, string> = { Yamato: 'Female' };

export const DL_HEROES: DlHero[] = DATA.heroes.map((h) => {
  const gender = GENDER_FIX[h.name] ?? h.gender;
  return {
    id: `hero-${slug(h.name)}`,
    name: h.name,
    aliases: [...(h.name.startsWith('The ') ? [h.name.slice(4)] : []), ...(h.name.includes('&') ? [h.name.replace('&', 'and')] : [])],
    image: h.image,
    gender,
    type: h.type,
    health: h.health,
    clip: h.clip,
    speed: h.speed,
    year: h.year,
    traits: Object.fromEntries(
      [
        ['Type', h.type],
        ['Gender', gender === 'Unknown' ? '' : gender],
        ['Health', String(h.health)],
        ['Clip size', String(h.clip)],
      ].filter(([, v]) => v),
    ),
  };
});
const heroByName = new Map(DL_HEROES.map((h) => [h.name, h]));

/** Every hero's four abilities, the ultimate last. */
export const DL_ABILITIES = DATA.heroes.flatMap((h) => h.abilities.filter((a) => a.image).map((a) => ({ answer: heroByName.get(h.name)!.id, name: a.name, image: a.image, ultimate: a.slot === 4 })));

export const DL_VOICES = DATA.heroes.flatMap((h) => h.voices.map((v) => ({ answer: heroByName.get(h.name)!.id, audio: v.audio, text: 'text' in v ? (v.text as string) : undefined })));

export interface DlItem {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  traits: Record<string, string>;
}
export const DL_ITEMS: DlItem[] = DATA.items.map((i) => ({
  id: `item-${slug(i.name)}`,
  name: i.name,
  aliases: [],
  image: i.image,
  traits: { Kind: `${i.slot} item`, Tier: `Tier ${i.tier} (${i.cost.toLocaleString('en')} souls)`, ...(i.active ? { Use: 'Active' } : { Use: 'Passive' }) },
}));

export const DL_GENERATED = DATA.generated;

/** Classic: heroes whose type and gender are known. */
export const DL_CLASSIC = DL_HEROES.filter((h) => h.type && h.gender !== 'Unknown' && h.year);

export const DL_POOLS = {
  classic: DL_CLASSIC.map((h) => h.id),
  picture: DL_HEROES.filter((h) => h.image).map((h) => h.id),
  windows: DL_HEROES.filter((h) => h.image).map((h) => h.id),
  // An ability or voice round's id is its index (a hero has several).
  ability: DL_ABILITIES.map((_, i) => `ability:${i}`),
  voice: DL_VOICES.map((_, i) => `voice:${i}`),
  item: DL_ITEMS.map((i) => i.id),
};
