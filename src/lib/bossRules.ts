// The Boss Battle's phases and difficulties: their names, rules and numbers. Apart from src/lib/boss.ts (the fight itself),
// so the rules window, open from every page, doesn't load the fight's name matching and the works lists with it.
import type { BossDifficulty } from '../store/progress';
import difficultyData from '../data/difficulties.json';
import type { SecretSettings, SignatureSettings } from '../types';

export const PHASES = [
  { name: 'Knowledge Blitz', roman: 'I', how: 'Type names before the timer runs out — press Enter after each one.' },
  { name: 'Radar Defense', roman: 'II', how: 'Swipe or press → when a card belongs. Reflect impostors with ← . Too many mistakes and the shield breaks.' },
  { name: 'Final Blow', roman: 'III', how: 'Name each flickering face before the timer burns out. Wrong answers cost time.' },
  {
    name: 'Name Chain',
    roman: 'IV',
    how: 'The guardian names something — answer with another of the same kind. Never repeat a name, yours or its, and keep the chain going to win.',
  },
  {
    name: 'Connections',
    roman: 'V',
    how: 'Five faces, ten words: place two under each — a name or what links it to the franchise. Submit when you think it’s right: a wrong board costs a heart.',
  },
] as const;

/** The phases in French (the EN/FR setting), in the same order. */
export const PHASES_FR = [
  { name: 'Blitz de savoir', how: 'Tape des noms avant la fin du chrono — appuie sur Entrée après chacun.' },
  { name: 'Défense radar', how: 'Glisse ou appuie sur → quand une carte fait partie de la franchise. Renvoie les imposteurs avec ←. Trop d’erreurs et le bouclier se brise.' },
  { name: 'Coup de grâce', how: 'Nomme chaque visage qui clignote avant que le chrono ne brûle. Une mauvaise réponse coûte du temps.' },
  { name: 'Chaîne de noms', how: 'Le gardien nomme quelque chose — réponds par un autre du même genre. Ne répète jamais un nom, le tien ou le sien, et tiens la chaîne pour gagner.' },
  { name: 'Connexions', how: 'Cinq visages, dix mots : place-en deux sous chacun — un nom ou ce qui le relie à la franchise. Valide quand tu penses avoir juste : une mauvaise grille coûte un cœur.' },
] as const;

/** The difficulties in French: their names and what they hold. */
export const DIFFICULTY_FR: Record<BossDifficulty, { label: string; blurb: string }> = {
  easy: { label: 'Facile', blurb: 'Trois phases courtes, des cartes nettes, des chronos généreux — un peu plus rapides à chaque manche gagnée.' },
  medium: { label: 'Moyen', blurb: 'Quatre phases, une manche chacune : des chronos plus serrés, des couleurs qui changent, des cartes qui tournent et une courte Chaîne de noms contre le gardien.' },
  hard: { label: 'Difficile', blurb: 'Quatre phases à pleine vitesse : zones inversées, leurres, boucliers à une seule erreur, visages déformés et chrono caché. Chaîne de noms comprise — puis la Signature du gardien : une seule bonne réponse pour gagner.' },
  hell: { label: 'Enfer', blurb: 'Les quatre phases du Difficile avec deux cœurs seulement, des chronos qui rétrécissent sans cesse et une longue Chaîne de noms — puis une cinquième phase, Connexions : cinq visages, dix mots, deux sous chacun. Une erreur coûte un cœur. La Signature à la fin.' },
};
/** A phase's name and rules, and a difficulty's, in the player's language. */
export const phaseIn = (i: number, fr: boolean) => ({ ...PHASES[i], ...(fr ? PHASES_FR[i] : {}) });
export const difficultyIn = (id: BossDifficulty, fr: boolean) => (fr ? DIFFICULTY_FR[id] : { label: DIFFICULTIES[id].label, blurb: DIFFICULTIES[id].blurb });

/** Phase index of the Name Chain (Medium and Hard). */
export const CHAIN_PHASE = 3;
/** Phase index of Connections (Hell). */
export const CONNECT_PHASE = 4;

/** Same ids as the store's saved choice. */
export type Difficulty = BossDifficulty;

/**
 * Everything a difficulty changes. Visual tricks come in levels:
 *   0 — clean cards and pictures
 *   1 — colour shifts, spinning cards, fading and clutter; the Final Blow picture turns and shifts hue
 *   2 — level 1, faster, plus reversed sorting zones, decoy zone flashes, a lockout on early
 *       swipes, inverted colours and a hidden seconds counter
 */
export interface DifficultySpec {
  id: Difficulty;
  label: string;
  blurb: string;
  /** Rounds to win in each of the five phases (0 = the phase isn't played); one life-bar segment per round. */
  rounds: number[];
  hearts: number;
  /** Extra answers on top of each Blitz prompt's count, and seconds allowed per answer. */
  blitzExtra: number;
  blitzSecondsPer: number;
  radarCards: number;
  radarImpostors: number;
  /** Mistakes the shield absorbs; one more breaks it. */
  radarMaxErrors: number;
  /** Per-card time: starts at `start` ms and drops by `step` per card, down to `min`. */
  radarMs: { start: number; step: number; min: number };
  /** Swipes in the first ms after a card appears count as mistakes ("too early"). */
  radarLockMs: number;
  /** Hard: each phase's second loop is shorter but much nastier; null = loops are alike. */
  secondLoop: SecondLoop | null;
  finaleTargets: number;
  finaleSeconds: number;
  finalePenaltyMs: number;
  distortion: 0 | 1 | 2;
  /** Seconds that still earn the speed bonus. */
  parSeconds: number;
  scoreMultiplier: number;
  /** Phase IV, the Name Chain (Medium, Hard); null when the difficulty has no fourth phase. */
  chain: SecretSettings | null;
  /** Phase V, Connections (Hell): seconds to place the ten words; null = not played. */
  connections: { seconds: number; bonus: number } | null;
  /** Secret phase after the boss's life runs out: the Signature challenge (Hard); null = none. */
  signature: SignatureSettings | null;
  /**
   * The pressure: every round won in a fight takes `step` off every clock, down to `min`; every
   * earlier win over this guardian at this difficulty takes `rematch` more (up to `rematchMax`).
   */
  pace: { step: number; min: number; rematch: number; rematchMax: number };
}

/** The share of the clocks left: 1 for a first round of a first fight, less as the fight and the rematches go on. */
export const paceFactor = (d: DifficultySpec, cleared: number, wins: number) =>
  Math.max(d.pace.min, 1 - d.pace.step * cleared - Math.min(d.pace.rematchMax, d.pace.rematch * wins));

/** The difficulty with every clock scaled by `f` (Blitz, Radar, Final Blow, Name Chain, Signature). */
export function paced(d: DifficultySpec, f: number): DifficultySpec {
  if (f >= 1) return d;
  const sl = d.secondLoop;
  return {
    ...d,
    blitzSecondsPer: d.blitzSecondsPer * f,
    radarMs: { start: d.radarMs.start * f, step: d.radarMs.step * f, min: d.radarMs.min * f },
    finaleSeconds: d.finaleSeconds * f,
    secondLoop: sl && { ...sl, blitz: { ...sl.blitz, secondsPer: sl.blitz.secondsPer * f }, radar: { ...sl.radar, speed: sl.radar.speed * f }, finale: { ...sl.finale, seconds: sl.finale.seconds * f } },
    chain: d.chain && { ...d.chain, turnSeconds: d.chain.turnSeconds * f },
    connections: d.connections && { ...d.connections, seconds: d.connections.seconds * f },
    signature: d.signature && { ...d.signature, seconds: d.signature.seconds * f },
  };
}

/**
 * The numbers live in src/data/difficulties.json so balancing is a data edit, not a code change
 * (checked by `npm run data:validate`).
 */
export const DIFFICULTIES = Object.fromEntries(
  Object.entries(difficultyData).map(([id, spec]) => [id, { ...spec, id }]),
) as unknown as Record<Difficulty, DifficultySpec>;

/**
 * Hard's second loops: every phase's second round is shorter but harder. Visual difficulty stays
 * static and on the picture only — zoom, a strong colour shift, a turn (no blur) — so the
 * input, buttons and layout never move.
 */
export interface SecondLoop {
  blitz: BlitzEscalation;
  radar: RadarEscalation;
  finale: FinaleEscalation;
}

/** Knowledge Blitz: fewer answers, far less time per answer. */
export interface BlitzEscalation {
  countDelta: number;
  secondsPer: number;
}

/** Static picture distortion shared by the Radar and Final Blow second loops. */
export interface PictureDistortion {
  /** Zoom range on a random spot of the picture. */
  zoom: [number, number];
  /** Hue shift range in degrees (applied with a random sign). */
  hue: [number, number];
  /** Chance a picture is turned. */
  flip: number;
  /** Angles a turned picture can take (default: upside down only). */
  turns?: number[];
}

/** Radar Defense: fewer, faster cards with distorted pictures. */
export interface RadarEscalation extends PictureDistortion {
  cards: number;
  impostors: number;
  /** Multiplier on each card's time (0.65 = 35% less). */
  speed: number;
}

/** Final Blow: fewer faces, a much shorter clock, distorted pictures. */
export interface FinaleEscalation extends PictureDistortion {
  targets: number;
  seconds: number;
}

/** A still distortion drawn for one picture. */
export interface PictureFx {
  scale: number;
  /** Zoom origin, in % of the picture. */
  x: number;
  y: number;
  hue: number;
  /** Rotation in degrees (0 = upright). */
  turn: number;
}

export function drawPictureFx(p: PictureDistortion, rand: () => number): PictureFx {
  return {
    scale: p.zoom[0] + rand() * (p.zoom[1] - p.zoom[0]),
    x: 20 + rand() * 60,
    y: 15 + rand() * 55,
    hue: (rand() < 0.5 ? -1 : 1) * (p.hue[0] + rand() * (p.hue[1] - p.hue[0])),
    turn: rand() < p.flip ? (p.turns?.length ? p.turns[Math.floor(rand() * p.turns.length)] : 180) : 0,
  };
}

/** CSS for a still distortion: only ever put on the picture element. */
export const pictureStyle = (fx: PictureFx) => ({
  transform: `scale(${fx.scale})${fx.turn ? ` rotate(${fx.turn}deg)` : ''}`,
  transformOrigin: `${fx.x}% ${fx.y}%`,
  filter: `hue-rotate(${fx.hue}deg) saturate(1.7)`,
});

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[];

/** Boss life: one segment per round across the three phases. */
export const totalRounds = (d: DifficultySpec) => d.rounds.reduce((a, b) => a + b, 0);

/** Whether this loop of a phase (0 = first) is an escalated one. */
export const escalated = (d: DifficultySpec, loop: number) => loop > 0 && !!d.secondLoop;

/** Radar per-card time for the i-th card of a loop. */
export const radarCardMs = (d: DifficultySpec, i: number, loop = 0) =>
  Math.round(Math.max(d.radarMs.min, d.radarMs.start - i * d.radarMs.step) * (escalated(d, loop) ? d.secondLoop!.radar.speed : 1));
