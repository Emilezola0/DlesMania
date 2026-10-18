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

/** An image that can be blurred/pixelated. `image` is resolved from `wiki` by scripts/enrich-media.mjs. */
export interface MediaRef {
  /** English Wikipedia article title used to look up an image. */
  wiki?: string;
  /** Direct image URL (resolved or hand-picked). */
  image?: string;
}

export interface Clue extends MediaRef {
  name: string;
  description: string;
}

/**
 * A single guessable work: a game, anime, film or album.
 * The JSON shape is documented in schema/work.schema.json.
 */
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
  /** Games only: platforms it shipped on (partial matches in Classic). */
  platforms?: string[];
  characters?: string[];
  themes?: string[];
  /** Credit lines revealed one by one in the Creator mini-game. */
  credits: string[];
  /** Cover art / poster, used by the Pixelated mini-game. */
  cover?: MediaRef;
  quote?: { text: string; speaker?: string };
  /** Music only: notable track titles, revealed one by one in the Quote mini-game. */
  tracks?: string[];
  audio?: {
    /** Text description, shown when no clip is available and as a hint. */
    clue: string;
    youtubeId?: string;
    /** Second the snippet starts at. */
    start?: number;
    /** Search query used by scripts/enrich-media.mjs to find a clip. */
    query?: string;
  };
  emoji?: string;
  item?: Clue;
  location?: Clue;
  visual?: { icon: string; colors: [string, string] };
}

/** Yellow (straightforward) → Purple (trickiest), as in NYT Connections. */
export type ConnectionsLevel = 0 | 1 | 2 | 3;

export interface ConnectionsPuzzle {
  id: string;
  /** Domain whose daily can use it; 'mixed' puzzles appear in free play only. */
  domain: Domain | 'mixed';
  /** Optional universe the whole grid is about, e.g. "Final Fantasy". */
  theme?: string;
  groups: { label: string; level: ConnectionsLevel; items: [string, string, string, string] }[];
}

/** Everything needed to deterministically render one round. */
export interface RoundSpec {
  type: GameType;
  domain: Domain | 'mixed';
  /** Deterministic per-round seed (tile shuffles, timeline order...). */
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
