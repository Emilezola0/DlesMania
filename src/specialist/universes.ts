// The Specialist universes, light: their names, blurbs, rounds and banners, without the data their rounds are made
// of (src/specialist/rounds.ts brings that in). The home page and the Daily's Specialist card need only these.

export type SpType = 'classic' | 'fruit' | 'laugh' | 'flag' | 'silhouette' | 'wanted' | 'ability' | 'splash' | 'film' | 'emoji' | 'voice' | 'wish' | 'constellation' | 'art' | 'titles' | 'timeline' | 'picture' | 'clue' | 'pins' | 'windows' | 'spotlight' | 'exotic' | 'execution' | 'kanji' | 'reading' | 'word' | 'ultcost' | 'dance' | 'mob' | 'gear' | 'place' | 'furniture' | 'material' | 'recipe' | 'sound' | 'item' | 'lightcone' | 'quote' | 'skin' | 'technique';

/** The Specialist universes, each with its own rounds (one of each per daily). */
export const UNIVERSES = [
  {
    id: 'onepiece',
    // One of the four that matter most (the owner's call): shown in gold.
    featured: true,
    label: 'One Piece',
    ready: true,
    blurb: 'Classic, Devil Fruits, laughs, Jolly Rogers and wanted posters — 220 characters from the anime.',
    types: ['classic', 'fruit', 'laugh', 'flag', 'wanted', 'timeline'] as SpType[],
  },
  {
    id: 'lol',
    // One of the four that matter most (the owner's call): shown in gold.
    featured: true,
    label: 'League of Legends',
    ready: true,
    blurb: 'Classic, abilities, splash arts, skins, silhouettes, their champion select quotes and champions told in emojis — every champion, from Data Dragon and the League wiki.',
    // Quote, Emoji and Skins came later: added last, so the days already played keep their rounds.
    types: ['classic', 'ability', 'splash', 'silhouette', 'timeline', 'quote', 'emoji', 'skin'] as SpType[],
  },
  {
    id: 'marvel',
    label: 'Marvel (MCU)',
    ready: true,
    blurb: 'Classic on 180 characters, plus posters, emoji films and voice lines — every released film.',
    types: ['classic', 'film', 'emoji', 'voice', 'timeline'] as SpType[],
  },
  {
    id: 'genshin',
    label: 'Genshin Impact',
    ready: true,
    blurb: 'Classic, wish arts, silhouettes and constellations — every playable character.',
    types: ['classic', 'wish', 'silhouette', 'constellation', 'timeline'] as SpType[],
  },
  {
    id: 'wow',
    label: 'World of Warcraft',
    ready: true,
    blurb: 'Classic, art, silhouettes and titles — 120 of the best-known characters from the games.',
    types: ['classic', 'art', 'silhouette', 'titles', 'timeline'] as SpType[],
  },
  {
    id: 'forhonor',
    label: 'For Honor',
    ready: true,
    blurb: 'Classic by faction, class, gender and health, pictures, windows, the spotlight, weapons and executions in silhouette — all 39 heroes of the five factions.',
    // Executions joined once there were videos (scripts/build-forhonor-executions.mjs, 494 of them). Listed here without
    // loading that list, which the home page would otherwise download with the universes.
    types: ['picture', 'clue', 'windows', 'spotlight', 'execution', 'classic'] as SpType[],
  },
  {
    id: 'overwatch',
    // One of the four that matter most (the owner's call): shown in gold.
    featured: true,
    label: 'Overwatch',
    ready: true,
    blurb: "Classic by role, sub-role, nationality, health and age, voice lines from the wiki's recordings, ultimates and their charge cost, pictures and windows — every hero.",
    types: ['voice', 'clue', 'picture', 'windows', 'ultcost', 'classic'] as SpType[],
  },
  {
    id: 'dbz',
    // One of the four that matter most (the owner's call, added 27 November 2026): shown in gold.
    featured: true,
    label: 'Dragon Ball',
    ready: true,
    blurb: 'The Saiyans, the Z Fighters, the villains and the gods: Classic by race, gender and where they first appear, from the first series to Daima, their anime art up close and behind windows, and their signature techniques.',
    // Technique (whose is it?) in place of a Clue round: the same kind of line, the boss's techniques and many more.
    types: ['classic', 'picture', 'windows', 'technique'] as SpType[],
  },
  {
    id: 'forts',
    label: 'Forts',
    ready: true,
    blurb: 'Pictures and windows of commanders, weapons and devices, commanders in silhouette and by their abilities.',
    types: ['picture', 'clue', 'windows', 'silhouette'] as SpType[],
  },
  {
    id: 'ufouria',
    label: 'Ufouria: The Saga 2',
    ready: true,
    blurb: 'The heroes dancing in silhouette, Classic by kind, creature and where they are met, pictures, windows and the spotlight on heroes, enemies and things, and clues from the bestiary.',
    types: ['dance', 'picture', 'clue', 'windows', 'spotlight', 'classic'] as SpType[],
  },
  {
    id: 'hollowknight',
    label: 'Hollow Knight & Silksong',
    ready: true,
    blurb: 'The bugs of Hallownest and Pharloom: Classic by game, role and gender, their drawn art up close and behind windows, clues, and their own cries and songs.',
    types: ['classic', 'picture', 'windows', 'clue', 'voice'] as SpType[],
  },
  {
    id: 'mha',
    label: 'My Hero Academia',
    ready: true,
    blurb: 'The heroes, students and villains of U.A. and beyond: Classic by role, Quirk, gender, status and debut chapter, their anime art up close and behind windows, and clues.',
    types: ['classic', 'picture', 'windows', 'clue'] as SpType[],
  },
  {
    id: 'bg3',
    label: "Baldur's Gate 3",
    ready: true,
    blurb: "The companions, villains and allies of the Sword Coast: Classic by race, role and gender, Larian's painted portraits up close and behind windows, and clues.",
    types: ['classic', 'picture', 'windows', 'clue'] as SpType[],
  },
  {
    id: 'hxh',
    label: 'Hunter x Hunter',
    ready: true,
    blurb: 'The Hunters, the Phantom Troupe, the Zoldycks and the Chimera Ants: Classic by group, Nen type, gender, status and debut chapter, their anime art up close and behind windows, and clues.',
    types: ['classic', 'picture', 'windows', 'clue'] as SpType[],
  },
  {
    id: 'shrek',
    label: 'Shrek',
    ready: true,
    blurb: 'The ogres, the fairy-tale creatures and the royals of Far Far Away, and the faces of Puss in Boots: Classic by species, gender, status and the year of their first film, the films\' renders up close and behind windows, and clues.',
    types: ['classic', 'picture', 'windows', 'clue'] as SpType[],
  },
  {
    id: 'arcraiders',
    label: 'ARC Raiders',
    ready: true,
    blurb: 'Classic on the ARC machines, then the machines, weapons and gear, places, furniture, materials, crafting recipes and robot sounds — from the ARC Raiders Wiki.',
    types: ['classic', 'mob', 'gear', 'place', 'furniture', 'material', 'recipe', 'sound'] as SpType[],
  },
  {
    id: 'avatar',
    label: 'Avatar: The Last Airbender',
    ready: true,
    blurb: 'Classic by nation and bending, pictures from the show, windows, voice lines, and the characters by their story.',
    types: ['classic', 'picture', 'clue', 'windows', 'voice'] as SpType[],
  },
  {
    id: 'deadlock',
    label: 'Deadlock',
    ready: true,
    blurb: 'Classic by type, gender, health, clip and speed, the heroes by their card art and behind windows, their abilities, their own voice lines, and every item of the shop by its icon — from The Deadlock Wiki.',
    types: ['classic', 'picture', 'windows', 'ability', 'voice', 'item'] as SpType[],
  },
  {
    id: 'destiny',
    label: 'Destiny',
    ready: true,
    blurb: 'Classic on the best-known characters of both games, pictures, windows, clues — and every Exotic weapon by its icon.',
    types: ['classic', 'picture', 'clue', 'windows', 'exotic'] as SpType[],
  },
  {
    id: 'hsr',
    label: 'Honkai: Star Rail',
    ready: true,
    blurb: 'Classic by Path, Combat Type, rarity, faction and version, the characters by their splash art and behind windows, their own Light Cones and their own voices — from the Honkai: Star Rail Wiki.',
    types: ['classic', 'splash', 'windows', 'lightcone', 'voice'] as SpType[],
  },
  {
    id: 'jlpt',
    label: 'Japanese',
    ready: true,
    blurb: "Japanese from Coto Academy's JLPT list, N5 to N1: a kanji's meaning, a word's reading, a meaning back into Japanese.",
    types: ['kanji', 'reading', 'word'] as SpType[],
  },
  {
    id: 'unreal',
    label: 'Unreal Engine Blueprints',
    ready: true,
    blurb: 'Classic, pins and clues — guess the Blueprint node, from Branch to Spawn Actor from Class.',
    types: ['classic', 'pins', 'clue'] as SpType[],
  },
] as const;
export type UniverseId = (typeof UNIVERSES)[number]['id'];

export const universe = (id: string) => UNIVERSES.find((u) => u.id === id);

const localBanner = (id: string) => `${import.meta.env?.BASE_URL ?? './'}art/specialist/${id}.webp`;
const wikiBanner = (path: string) => `https://static.wikia.nocookie.net/${path}/revision/latest/scale-to-width-down/960`;
/**
 * Each universe's banner, blurred behind its card on the Specialist page: the game's Steam key art, a splash or
 * official wallpaper (from the wikis, which only let a browser fetch them), Mount Fuji for Japanese; none for
 * Unreal's Blueprints, drawn as a blueprint grid instead.
 */
export const UNIVERSE_BANNER: Record<UniverseId, string | null> = {
  onepiece: localBanner('onepiece'),
  lol: localBanner('lol'),
  marvel: wikiBanner('marvelcinematicuniverse/images/d/d4/Endgame_Banner.jpg'),
  genshin: wikiBanner('gensin-impact/images/9/96/Version_1.2_Wallpaper_1.webp'),
  wow: wikiBanner('wowpedia/images/3/38/Jeremy_Sun_wow_wallpaper.jpg'),
  forhonor: localBanner('forhonor'),
  overwatch: localBanner('overwatch'),
  // Toriyama's art of the cast for Dragon Ball Super (Dragon Ball Wiki).
  dbz: wikiBanner('dragonball/images/b/b9/Dragon_Ball_Super_representation.png'),
  forts: localBanner('forts'),
  ufouria: localBanner('ufouria'),
  hollowknight: localBanner('hollowknight'),
  mha: localBanner('mha'),
  bg3: localBanner('bg3'),
  // The leads on the 2023 mobile game's main visual (Hunterpedia).
  hxh: wikiBanner('hunterxhunter/images/e/e5/DeNA_2023_HxH_Mobage_Main_Visual.png'),
  shrek: wikiBanner('shrek/images/a/a3/Shrek_group_windmill_render.jpg'),
  arcraiders: localBanner('arcraiders'),
  avatar: localBanner('avatar'),
  deadlock: localBanner('deadlock'),
  destiny: localBanner('destiny'),
  hsr: wikiBanner('houkai-star-rail/images/6/62/First_Closed_Beta_Wallpaper.png'),
  jlpt: localBanner('jlpt'),
  unreal: null,
};
/** The universes shown in gold (the owner's four most important). */
export const isFeatured = (id: string) => UNIVERSES.some((u) => u.id === id && 'featured' in u && u.featured);
