// Cosmic anomalies: now and then a black hole opens during a pack opening, and now and then it swallows
// a shooting star. A swallowed star comes back once every other star has passed, and its card (shown
// last) can keep an anomaly — the player chooses. Each anomaly is an entry of ANOMALIES: its look is a
// class on the card (index.css) plus what CardFace reads here (a scrambling name, a rarity in disguise).
// More can be added by adding an entry and its styles.
import type { Rarity } from './cards';
// The chances and each anomaly's text live in src/data/tuning/anomalies.json (edited from the dev-only #/admin page);
// a new anomaly also needs its id in AnomalyId and its class in index.css.
import T from '../data/tuning/anomalies.json';

/** The chance a pack opening has a black hole. */
export const BLACK_HOLE_CHANCE = T.blackHoleChance;
/** With a black hole open: the chance each passing star is pulled in (never the best card's evolving star). */
export const ABSORB_CHANCE = T.absorbChance;

export type AnomalyId = 'corrupted' | 'fake';

export interface Anomaly {
  id: AnomalyId;
  name: string;
  icon: string;
  /** What it does to the card, for the choice. */
  blurb: string;
  /** The class the card wears (its frame), from index.css. */
  className: string;
  /** Its name scrambles now and then. */
  scramble?: boolean;
  /** It poses as a Mythic: the mythic's frame and light, its own rarity showing through. */
  posesAsMythic?: boolean;
}

export const ANOMALIES = Object.fromEntries(Object.entries(T.anomalies).map(([id, a]) => [id, { ...a, id }])) as Record<AnomalyId, Anomaly>;
export const ANOMALY_IDS = Object.keys(ANOMALIES) as AnomalyId[];

/** The anomaly a swallowed star brings back (the player can still say no). */
export const rollAnomaly = (rand: () => number = Math.random): AnomalyId => ANOMALY_IDS[Math.floor(rand() * ANOMALY_IDS.length)];


/** A name scrambled for an instant: its letters swapped for glitch characters, spaces kept. */
const GLITCH = '#%&@$*!?▚▞▓▒░<>/\\|=+0123456789ΣΨΩ';
export const scrambled = (name: string, rand: () => number = Math.random) => [...name].map((c) => (c === ' ' ? c : rand() < 0.65 ? GLITCH[Math.floor(rand() * GLITCH.length)] : c)).join('');

/** The rarity a card shows: a Fake Rarity looks Mythic. */
export const shownRarity = (rarity: Rarity, anomaly?: AnomalyId | null): Rarity => (anomaly && ANOMALIES[anomaly]?.posesAsMythic ? 'mythic' : rarity);
