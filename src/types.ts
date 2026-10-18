export type Domain = 'games' | 'anime' | 'cinema' | 'music';

export type GameType =
  | 'classic'
  | 'quote'
  | 'audio'
  | 'emoji'
  | 'visual'
  | 'timeline'
  | 'item'
  | 'location'
  | 'creator'
  | 'connections';

/** A single guessable work: a game, anime, film or album. */
export interface Work {
  id: string;
  name: string;
  /** Disambiguation shown in autocomplete (artist for albums, etc.). */
  subtitle?: string;
  aliases?: string[];
  domain: Domain;
  year: number;
  genres: string[];
  /** Studio, developer, publisher or record label. */
  studio: string;
  /** Primary creator: director, lead designer, mangaka or artist. */
  creator: string;
  origin: string;
  /** Games: platform family. Anime: TV / Film. Cinema: Live-action / Animated. Music: release type. */
  format: string;
  /** Anime only: Manga / Original / Light Novel... */
  source?: string;
  /** Credit lines revealed one by one in the Creator mini-game. */
  credits: string[];
  quote?: { text: string; speaker?: string };
  audio?: string;
  emoji?: string;
  item?: { name: string; description: string };
  location?: { name: string; description: string };
  visual?: { icon: string; colors: [string, string] };
}

export interface ConnectionsPuzzle {
  id: string;
  groups: { label: string; items: [string, string, string, string] }[];
}

/** Everything needed to deterministically render one round. */
export interface RoundSpec {
  type: GameType;
  domain: Domain | 'mixed';
  seed: number;
  targetId?: string;
  workIds?: string[];
  puzzleId?: string;
}

export type RoundStatus = 'playing' | 'won' | 'lost';

/** Persisted gameplay state of one round. Each game derives its view from `guesses`. */
export interface RoundRecord {
  status: RoundStatus;
  guesses: string[];
  score: number;
}

export interface GameProps {
  spec: RoundSpec;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

export const EMPTY_RECORD: RoundRecord = { status: 'playing', guesses: [], score: 0 };
