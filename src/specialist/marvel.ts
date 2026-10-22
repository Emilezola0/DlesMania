import marvel from '../data/specialist/marvel.json';

/** An MCU film, as built by scripts/build-specialist-marvel.mjs from the MCU wiki. */
export interface McuFilm {
  id: string;
  name: string;
  aliases: string[];
  year: number;
  date: string;
  phase: number;
  director: string;
  boxOffice?: string;
  poster?: string;
  /** Hand-written summary for the Emoji round. */
  emoji?: string;
  /** Release order, from 1. */
  order: number;
}

/** An MCU character. */
export interface McuCharacter {
  id: string;
  name: string;
  aliases: string[];
  image: string;
  gender: string;
  species: string;
  team: string;
  status: string;
  actor?: string;
  /** True when one actor clearly owns the role (the boss's Signature names them). */
  castable: boolean;
  /** A clip of the character speaking in the original English version (scripts/find-marvel-voice-clips.mjs). */
  voice?: { youtubeId: string; start?: number };
  /** Id of their first film, the Phase it's in, and how many films they're in. */
  debut: string;
  phase: number;
  films: number;
}

interface MarvelData {
  generated: string;
  films: McuFilm[];
  characters: McuCharacter[];
}

export const MARVEL = marvel as MarvelData;

export const filmById = new Map(MARVEL.films.map((f) => [f.id, f]));
export const mcuCharacterById = new Map(MARVEL.characters.map((c) => [c.id, c]));

/** The best-known characters a film introduced, for hints. */
export const introducedIn = (filmId: string) => MARVEL.characters.filter((c) => c.debut === filmId);

export const MARVEL_POOLS = {
  // Dailies draw from the best-known 120; practice can still be asked about anyone through the guess box.
  classic: MARVEL.characters.slice(0, 120).map((c) => c.id),
  film: MARVEL.films.filter((f) => f.poster).map((f) => f.id),
  emoji: MARVEL.films.filter((f) => f.emoji).map((f) => f.id),
  voice: MARVEL.characters.filter((c) => c.voice).map((c) => c.id),
};
