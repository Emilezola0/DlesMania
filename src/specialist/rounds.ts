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
import { JLPT_POOLS } from './jlpt';
import { ARC_POOLS } from './arcraiders';
import { DL_POOLS } from './deadlock';
import { HSR_POOLS } from './hsr';
import { withFrench } from '../lib/langNow';

// The universes themselves: src/specialist/universes.ts (light, for pages that only list them).
export * from './universes';
import { UNIVERSES, universe, type SpType, type UniverseId } from './universes';

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
