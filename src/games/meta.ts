import type { GameType } from '../types';

export interface GameMeta {
  type: GameType;
  name: string;
  icon: string;
  tagline: string;
  /** Maximum attempts before the round is lost. */
  maxAttempts: number;
}

export const GAME_META: Record<GameType, GameMeta> = {
  classic: { type: 'classic', name: 'Classic', icon: '🧩', tagline: 'Guess the work from its attributes', maxAttempts: 10 },
  quote: { type: 'quote', name: 'Quote', icon: '💬', tagline: 'Who said it — and where?', maxAttempts: 6 },
  audio: { type: 'audio', name: 'Soundtrack', icon: '🎧', tagline: 'Name the work behind the music', maxAttempts: 6 },
  emoji: { type: 'emoji', name: 'Emoji', icon: '😎', tagline: 'A synopsis told in emojis', maxAttempts: 6 },
  visual: { type: 'visual', name: 'Pixelated', icon: '🖼️', tagline: 'Recognise the blurred cover', maxAttempts: 6 },
  timeline: { type: 'timeline', name: 'Timeline', icon: '📅', tagline: 'Sort four works by release date', maxAttempts: 3 },
  item: { type: 'item', name: 'Iconic Item', icon: '🗡️', tagline: 'Whose weapon, gadget or symbol is this?', maxAttempts: 6 },
  location: { type: 'location', name: 'Location', icon: '🗺️', tagline: 'Where in the world are we?', maxAttempts: 6 },
  creator: { type: 'creator', name: 'Credits', icon: '🎬', tagline: 'Guess the work from its creators', maxAttempts: 6 },
  connections: { type: 'connections', name: 'Connections', icon: '🔗', tagline: 'Find four groups of four', maxAttempts: 4 },
};

export const GAME_TYPES = Object.keys(GAME_META) as GameType[];
