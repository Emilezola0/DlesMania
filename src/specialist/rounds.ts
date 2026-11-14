import { EPOCH, addDays } from '../lib/date';
import { hashString, mulberry32, pick } from '../lib/rng';
import { leastRecent } from '../lib/rounds';
import { POOLS } from './data';
import { LOL_POOLS } from './lol';
import { MARVEL_POOLS } from './marvel';
import { GENSHIN_POOLS } from './genshin';
import { WOW_POOLS } from './wow';
import { timelinePool } from './timeline';
import { simplePools } from './simple';
import { BLUEPRINT_POOLS } from './blueprint';
import FH_EXECUTIONS from '../data/specialist/forhonor-executions.json';
import { JLPT_POOLS } from './jlpt';
import { ARC_POOLS } from './arcraiders';
import { DL_POOLS } from './deadlock';
import { HSR_POOLS } from './hsr';
import { withFrench } from '../lib/langNow';

export type SpType = 'classic' | 'fruit' | 'laugh' | 'flag' | 'silhouette' | 'wanted' | 'ability' | 'splash' | 'film' | 'emoji' | 'voice' | 'wish' | 'constellation' | 'art' | 'titles' | 'timeline' | 'picture' | 'clue' | 'pins' | 'windows' | 'spotlight' | 'exotic' | 'execution' | 'kanji' | 'reading' | 'word' | 'ultcost' | 'dance' | 'mob' | 'gear' | 'place' | 'furniture' | 'material' | 'recipe' | 'sound' | 'item' | 'lightcone' | 'quote' | 'skin';

/** The Specialist universes, each with its own rounds (one of each per daily). */
export const UNIVERSES = [
  {
    id: 'onepiece',
    // One of the three that matter most (the owner's call): shown in gold.
    featured: true,
    label: 'One Piece',
    ready: true,
    blurb: 'Classic, Devil Fruits, laughs, Jolly Rogers and wanted posters — 220 characters from the anime.',
    types: ['classic', 'fruit', 'laugh', 'flag', 'wanted', 'timeline'] as SpType[],
  },
  {
    id: 'lol',
    // One of the three that matter most (the owner's call): shown in gold.
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
    // Executions join once there are videos (scripts/build-forhonor-executions.mjs); added last, so earlier days keep their rounds.
    types: ['picture', 'clue', 'windows', 'spotlight', ...(FH_EXECUTIONS.length ? ['execution'] : []), 'classic'] as SpType[],
  },
  {
    id: 'overwatch',
    // One of the three that matter most (the owner's call): shown in gold.
    featured: true,
    label: 'Overwatch',
    ready: true,
    blurb: "Classic by role, sub-role, nationality, health and age, voice lines from the wiki's recordings, ultimates and their charge cost, pictures and windows — every hero.",
    types: ['voice', 'clue', 'picture', 'windows', 'ultcost', 'classic'] as SpType[],
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
/** The universes shown in gold (the owner's three most important). */
export const isFeatured = (id: string) => UNIVERSES.some((u) => u.id === id && 'featured' in u && u.featured);

export const SP_META: Record<SpType, { name: string; icon: string; tagline: string; maxAttempts: number }> = {
  classic: { name: 'Classic', icon: '🧩', tagline: 'Find them from their traits', maxAttempts: 12 },
  fruit: { name: 'Devil Fruit', icon: '🍈', tagline: 'Name the Devil Fruit', maxAttempts: 6 },
  laugh: { name: 'Laugh', icon: '😆', tagline: 'Whose signature laugh is this?', maxAttempts: 6 },
  flag: { name: 'Jolly Roger', icon: '☠️', tagline: 'Which crew flies this flag?', maxAttempts: 6 },
  silhouette: { name: 'Silhouette', icon: '👤', tagline: 'Who is hiding in the shadow?', maxAttempts: 6 },
  wanted: { name: 'Wanted', icon: '📜', tagline: 'Who is on the wanted poster?', maxAttempts: 6 },
  ability: { name: 'Ability', icon: '✨', tagline: 'Whose ability is this?', maxAttempts: 6 },
  splash: { name: 'Splash Art', icon: '🖼️', tagline: 'Whose splash art is this?', maxAttempts: 6 },
  skin: { name: 'Skins', icon: '🎭', tagline: 'Who wears this skin?', maxAttempts: 6 },
  film: { name: 'Film', icon: '🎬', tagline: 'Which film is this poster from?', maxAttempts: 6 },
  emoji: { name: 'Emoji', icon: '😎', tagline: 'Told in emojis', maxAttempts: 6 },
  quote: { name: 'Quote', icon: '💬', tagline: 'Who says this in game?', maxAttempts: 6 },
  voice: { name: 'Voice Line', icon: '🎙️', tagline: 'Who is speaking? (their English voice)', maxAttempts: 6 },
  wish: { name: 'Wish Art', icon: '🌠', tagline: 'Whose wish art is this?', maxAttempts: 6 },
  art: { name: 'Art', icon: '🖼️', tagline: 'Who is in this picture?', maxAttempts: 6 },
  timeline: { name: 'Timeline', icon: '⏳', tagline: 'Who came first?', maxAttempts: 4 },
  titles: { name: 'Titles', icon: '📜', tagline: 'Who goes by these titles?', maxAttempts: 6 },
  constellation: { name: 'Constellation', icon: '✦', tagline: 'Whose constellation is this?', maxAttempts: 6 },
  picture: { name: 'Picture', icon: '🖼️', tagline: 'Who or what is in the picture?', maxAttempts: 6 },
  windows: { name: 'Windows', icon: '🪟', tagline: 'Windows open with each miss', maxAttempts: 6 },
  spotlight: { name: 'Spotlight', icon: '🔦', tagline: 'The light widens with each miss', maxAttempts: 6 },
  dance: { name: 'Dance', icon: '💃', tagline: 'Who is dancing in the shadow?', maxAttempts: 4 },
  ultcost: { name: 'Ultimate Cost', icon: '⚡', tagline: 'Whose ultimate costs this many points?', maxAttempts: 6 },
  kanji: { name: 'Kanji', icon: '字', tagline: 'What does this kanji mean?', maxAttempts: 6 },
  reading: { name: 'Reading', icon: '読', tagline: 'How is this word read?', maxAttempts: 6 },
  word: { name: 'Word', icon: '語', tagline: 'Which Japanese word means this?', maxAttempts: 6 },
  execution: { name: 'Execution', icon: '🗡️', tagline: 'Whose execution is this?', maxAttempts: 6 },
  exotic: { name: 'Exotic', icon: '✦', tagline: 'Which Exotic weapon is this?', maxAttempts: 6 },
  clue: { name: 'Clue', icon: '🔎', tagline: 'Name them from a clue', maxAttempts: 6 },
  mob: { name: 'Mobs', icon: '🤖', tagline: 'Which ARC machine is this?', maxAttempts: 6 },
  gear: { name: 'Weapons & Gear', icon: '🔫', tagline: 'Name the weapon or the equipment', maxAttempts: 6 },
  place: { name: 'Locations', icon: '🗺️', tagline: 'Where is this?', maxAttempts: 6 },
  furniture: { name: 'Furniture', icon: '🗄️', tagline: 'What would you search here?', maxAttempts: 6 },
  material: { name: 'Materials', icon: '🔩', tagline: 'Which material is this?', maxAttempts: 6 },
  recipe: { name: 'Crafting', icon: '🛠️', tagline: 'What does this recipe make?', maxAttempts: 6 },
  sound: { name: 'Robot Sounds', icon: '🔊', tagline: 'Which ARC makes this sound?', maxAttempts: 6 },
  lightcone: { name: 'Light Cone', icon: '🎞️', tagline: 'Whose Light Cone is this?', maxAttempts: 6 },
  item: { name: 'Items', icon: '🛒', tagline: 'Which item of the shop is this?', maxAttempts: 6 },
  pins: { name: 'Pins', icon: '🔌', tagline: 'Which node has these pins?', maxAttempts: 6 },
};

/** The universes' blurbs, and the rounds' names and taglines, in French (they switch with the EN/FR setting). */
const UNIVERSE_FR: Partial<Record<UniverseId, { blurb: string; label?: string }>> = {
  "onepiece": {
    "blurb": "Classique, fruits du démon, rires, Jolly Rogers et avis de recherche — 220 personnages de l’anime."
  },
  "lol": {
    "blurb": "Classique, compétences, splash arts, skins, silhouettes, leurs répliques de sélection et des champions racontés en emojis — tous les champions, depuis Data Dragon et le wiki de League."
  },
  "marvel": {
    "blurb": "Classique sur 180 personnages, plus des affiches, des films en emojis et des répliques — tous les films sortis.",
    "label": "Marvel (MCU)"
  },
  "genshin": {
    "blurb": "Classique, arts de vœu, silhouettes et constellations — tous les personnages jouables."
  },
  "wow": {
    "blurb": "Classique, art, silhouettes et titres — 120 des personnages les plus connus des jeux."
  },
  "forhonor": {
    "blurb": "Classique par faction, classe, genre et santé, images, fenêtres, projecteur, armes et exécutions en silhouette — les 39 héros des cinq factions."
  },
  "overwatch": {
    "blurb": "Classique par rôle, sous-rôle, nationalité, santé et âge, répliques tirées des enregistrements du wiki, ultimes et leur coût de charge, images et fenêtres — tous les héros."
  },
  "forts": {
    "blurb": "Images et fenêtres des commandants, armes et dispositifs, commandants en silhouette et par leurs pouvoirs."
  },
  "ufouria": {
    "blurb": "Les héros qui dansent en silhouette, Classique par type, créature et lieu de rencontre, images, fenêtres et projecteur sur héros, ennemis et objets, et des indices tirés du bestiaire."
  },
  "hollowknight": {
    "blurb": "Les insectes d’Hallownest et de Pharloom : Classique par jeu, rôle et genre, leurs dessins en gros plan et derrière des fenêtres, des indices, et leurs propres cris et chants."
  },
  "mha": {
    "blurb": "Les héros, élèves et vilains de Yuei et d’ailleurs : Classique par rôle, Alter, genre, statut et chapitre de première apparition, leurs images de l’anime en gros plan et derrière des fenêtres, et des indices."
  },
  "bg3": {
    "blurb": "Les compagnons, méchants et alliés de la Côte des Épées : Classique par race, rôle et genre, les portraits peints de Larian en gros plan et derrière des fenêtres, et des indices."
  },
  "hxh": {
    "blurb": "Les Hunters, la Brigade fantôme, les Zoldik et les Fourmis-Chimères : Classique par groupe, type de Nen, genre, statut et chapitre de première apparition, leurs images de l’anime en gros plan et derrière des fenêtres, et des indices."
  },
  "shrek": {
    "blurb": "Les ogres, les créatures de contes et les têtes couronnées de Fort Fort Lointain, et les visages du Chat Potté : Classique par espèce, genre, statut et année de leur premier film, les rendus des films en gros plan et derrière des fenêtres, et des indices."
  },
  "arcraiders": {
    "blurb": "Classique sur les machines ARC, puis les machines, armes et équipements, lieux, mobilier, matériaux, recettes de fabrication et sons de robots — depuis le wiki d’ARC Raiders."
  },
  "avatar": {
    "blurb": "Classique par nation et maîtrise, images de la série, fenêtres, répliques, et les personnages par leur histoire.",
    "label": "Avatar, le dernier maître de l’air"
  },
  "deadlock": {
    "blurb": "Classique par type, genre, santé, chargeur et vitesse, les héros par leur carte et derrière des fenêtres, leurs capacités, leurs propres répliques, et chaque objet de la boutique par son icône — depuis le wiki de Deadlock."
  },
  "destiny": {
    "blurb": "Classique sur les personnages les plus connus des deux jeux, images, fenêtres, indices — et chaque arme exotique par son icône."
  },
  "hsr": {
    "blurb": "Classique par Voie, type de combat, rareté, faction et version, les personnages par leur splash art et derrière des fenêtres, leurs propres cônes de lumière et leurs propres voix — depuis le wiki de Honkai: Star Rail."
  },
  "jlpt": {
    "blurb": "Le japonais de la liste JLPT de Coto Academy, du N5 au N1 : le sens d’un kanji, la lecture d’un mot, un sens à retraduire en japonais.",
    "label": "Japonais"
  },
  "unreal": {
    "blurb": "Classique, pins et indices — devine le nœud Blueprint, de Branch à Spawn Actor from Class."
  }
};
for (const u of UNIVERSES) if (UNIVERSE_FR[u.id]) withFrench(u as { blurb: string; label: string }, UNIVERSE_FR[u.id]!);
const SP_FR: Record<SpType, [string, string]> = {
  "classic": [
    "Classique",
    "Trouve-les grâce à leurs traits"
  ],
  "fruit": [
    "Fruit du démon",
    "Nomme le fruit du démon"
  ],
  "laugh": [
    "Rire",
    "À qui est ce rire ?"
  ],
  "flag": [
    "Jolly Roger",
    "Quel équipage arbore ce pavillon ?"
  ],
  "silhouette": [
    "Silhouette",
    "Qui se cache dans l'ombre ?"
  ],
  "wanted": [
    "Avis de recherche",
    "Qui est sur l'avis de recherche ?"
  ],
  "ability": [
    "Compétence",
    "À qui est cette compétence ?"
  ],
  "splash": [
    "Splash art",
    "À qui est ce splash art ?"
  ],
  "skin": [
    "Skins",
    "Qui porte ce skin ?"
  ],
  "film": [
    "Film",
    "De quel film vient cette affiche ?"
  ],
  "emoji": [
    "Emoji",
    "Raconté en emojis"
  ],
  "quote": [
    "Citation",
    "Qui dit ça en jeu ?"
  ],
  "voice": [
    "Réplique",
    "Qui parle ? (voix anglaise)"
  ],
  "wish": [
    "Art de vœu",
    "À qui est cet art de vœu ?"
  ],
  "art": [
    "Art",
    "Qui est sur cette image ?"
  ],
  "timeline": [
    "Chronologie",
    "Qui est arrivé en premier ?"
  ],
  "titles": [
    "Titres",
    "Qui porte ces titres ?"
  ],
  "constellation": [
    "Constellation",
    "À qui est cette constellation ?"
  ],
  "picture": [
    "Image",
    "Qui ou quoi est sur l'image ?"
  ],
  "windows": [
    "Fenêtres",
    "Des fenêtres s'ouvrent à chaque erreur"
  ],
  "spotlight": [
    "Projecteur",
    "La lumière s'élargit à chaque erreur"
  ],
  "dance": [
    "Danse",
    "Qui danse dans l'ombre ?"
  ],
  "ultcost": [
    "Coût d'ultime",
    "Quelle ultime coûte autant de points ?"
  ],
  "kanji": [
    "Kanji",
    "Que veut dire ce kanji ?"
  ],
  "reading": [
    "Lecture",
    "Comment se lit ce mot ?"
  ],
  "word": [
    "Mot",
    "Quel mot japonais veut dire ceci ?"
  ],
  "execution": [
    "Exécution",
    "À qui est cette exécution ?"
  ],
  "exotic": [
    "Exotique",
    "Quelle est cette arme exotique ?"
  ],
  "clue": [
    "Indice",
    "Nomme-les à partir d’un indice"
  ],
  "mob": [
    "Machines",
    "Quelle machine ARC est-ce ?"
  ],
  "gear": [
    "Armes et équipement",
    "Nomme l'arme ou l'équipement"
  ],
  "place": [
    "Lieux",
    "Où est-ce ?"
  ],
  "furniture": [
    "Mobilier",
    "Que fouillerais-tu ici ?"
  ],
  "material": [
    "Matériaux",
    "Quel matériau est-ce ?"
  ],
  "recipe": [
    "Fabrication",
    "Que fabrique cette recette ?"
  ],
  "sound": [
    "Sons de robots",
    "Quel ARC fait ce bruit ?"
  ],
  "lightcone": [
    "Cône de lumière",
    "À qui est ce cône de lumière ?"
  ],
  "item": [
    "Objets",
    "Quel objet de la boutique est-ce ?"
  ],
  "pins": [
    "Pins",
    "Quel nœud a ces pins ?"
  ]
};
for (const [type, [name, tagline]] of Object.entries(SP_FR)) withFrench(SP_META[type as SpType], { name, tagline });

/** One round: what to guess, and a seed for anything random about how it's shown. */
export interface SpRound {
  type: SpType;
  targetId: string;
  seed: number;
}

/** Points for a round won on the n-th try: Classic allows more tries, so each costs less. */
export function spScore(type: SpType, attempts: number): number {
  return type === 'classic' ? Math.max(20, 100 - (attempts - 1) * 8) : Math.max(10, 100 - (attempts - 1) * 15);
}

export const maxScore = (id: UniverseId) => universe(id)!.types.length * 100;

const POOLS_OF: Record<UniverseId, Partial<Record<SpType, string[]>>> = {
  onepiece: { ...POOLS, timeline: timelinePool('onepiece') },
  lol: { ...LOL_POOLS, timeline: timelinePool('lol') },
  marvel: { ...MARVEL_POOLS, timeline: timelinePool('marvel') },
  genshin: { ...GENSHIN_POOLS, timeline: timelinePool('genshin') },
  wow: { ...WOW_POOLS, timeline: timelinePool('wow') },
  forhonor: simplePools('forhonor'),
  overwatch: simplePools('overwatch'),
  forts: simplePools('forts'),
  ufouria: simplePools('ufouria'),
  hollowknight: simplePools('hollowknight'),
  mha: simplePools('mha'),
  bg3: simplePools('bg3'),
  hxh: simplePools('hxh'),
  shrek: simplePools('shrek'),
  arcraiders: ARC_POOLS,
  avatar: simplePools('avatar'),
  deadlock: DL_POOLS,
  hsr: HSR_POOLS,
  destiny: simplePools('destiny'),
  jlpt: JLPT_POOLS,
  unreal: BLUEPRINT_POOLS,
};

/**
 * From this day on, a One Piece Devil Fruit round only draws a fruit that has a picture (the owner's call). The days
 * before keep the pool they were drawn from: their saved answers stay on the same fruit.
 */
export const FRUIT_PICTURES_FROM = '2026-11-15';
/** The answers a round type draws from (a daily's Sat Nov 14 13:03:53     2026; none for practice, which follows today's rules). */
const poolOf = (id: UniverseId, type: SpType, date?: string) =>
  id === 'onepiece' && type === 'fruit' && (!date || date >= FRUIT_PICTURES_FROM) ? POOLS.fruitPictured : (POOLS_OF[id][type] ?? []);

/** How many answers a round type can draw from. */
export const poolSize = (id: UniverseId, type: SpType) => poolOf(id, type).length;

/**
 * A random round of one type; `avoid` keeps one answer from coming up twice in a day or a session,
 * and `lastUsed` (dailies) prefers the answers that haven't come up for the longest time.
 */
export function randomRound(id: UniverseId, type: SpType, rand: () => number, avoid: Set<string> = new Set(), lastUsed?: Map<string, number>, date?: string): SpRound {
  const all = poolOf(id, type, date);
  const pool = all.filter((x) => !avoid.has(x));
  return { type, targetId: pick(leastRecent(pool.length ? pool : all, (x) => x, lastUsed), rand), seed: Math.floor(rand() * 2 ** 31) };
}

/** The day's rounds, one of each type, the same for everyone (seeded by the date). */
export function buildSpecialistDaily(id: UniverseId, date: string): SpRound[] {
  const key = `${id}:${date}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;
  const rand = mulberry32(hashString(`omnidle:specialist:${id}:${date}`));
  const used = new Set<string>();
  // No repeats across days: each round prefers what hasn't been an answer for the longest time.
  const lastUsed = new Map<string, number>();
  for (let day = EPOCH, n = 0; day < date; day = addDays(day, 1), n++) {
    // Timeline and Skins rounds came later: leaving them out keeps the days already played as they were.
    for (const r of buildSpecialistDaily(id, day)) if (r.type !== 'timeline' && r.type !== 'skin') lastUsed.set(r.targetId, n);
  }
  const rounds = universe(id)!.types.map((type) => {
    const round = randomRound(id, type, rand, used, lastUsed, date);
    used.add(round.targetId);
    return round;
  });
  dailyCache.set(key, rounds);
  return rounds;
}

/** Specialist dailies already built, by "universe:date" (each day depends on the days before it). */
const dailyCache = new Map<string, SpRound[]>();
