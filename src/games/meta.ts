import settings from '../data/settings.json';
import type { GameType } from '../types';
import { withFrench } from '../lib/langNow';

export interface GameMeta {
  type: GameType;
  name: string;
  icon: string;
  tagline: string;
  /** Maximum attempts before the round is lost. */
  maxAttempts: number;
}

export const GAME_META: Record<GameType, GameMeta> = {
  classic: withFrench({ type: 'classic', name: 'Classic', icon: '🧩', tagline: 'Guess the work from its attributes', maxAttempts: 10 }, { name: 'Classique', tagline: "Devine l'œuvre d'après ses attributs" }),
  quote: withFrench({ type: 'quote', name: 'Quote', icon: '💬', tagline: 'Who said it — and where?', maxAttempts: 6 }, { name: 'Citation', tagline: 'Qui l’a dit — et où ?' }),
  audio: withFrench({ type: 'audio', name: 'Soundtrack', icon: '🎧', tagline: 'Name the work behind the music', maxAttempts: 6 }, { name: 'Bande-son', tagline: "Nomme l'œuvre derrière la musique" }),
  voice: withFrench({ type: 'voice', name: 'Voice Line', icon: '🎙️', tagline: 'Whose voice is this — and from which work?', maxAttempts: 6 }, { name: 'Réplique', tagline: 'À qui est cette voix — et de quelle œuvre ?' }),
  emoji: withFrench({ type: 'emoji', name: 'Emoji', icon: '😎', tagline: 'A synopsis told in emojis', maxAttempts: 6 }, { name: 'Emoji', tagline: 'Un synopsis raconté en emojis' }),
  visual: withFrench({ type: 'visual', name: 'Pixelated', icon: '🖼️', tagline: 'Recognise the pixelated cover', maxAttempts: 6 }, { name: 'Pixelisé', tagline: 'Reconnais la jaquette pixelisée' }),
  timeline: withFrench({ type: 'timeline', name: 'Timeline', icon: '📅', tagline: 'Sort four works by release date', maxAttempts: 3 }, { name: 'Chronologie', tagline: 'Classe quatre œuvres par date de sortie' }),
  item: withFrench({ type: 'item', name: 'Guess from the Image', icon: '🗡️', tagline: 'Name the work this picture comes from', maxAttempts: 6 }, { name: "Devine d'après l'image", tagline: "Nomme l'œuvre d'où vient cette image" }),
  location: withFrench({ type: 'location', name: 'Location', icon: '🗺️', tagline: 'Name the work from one of its places', maxAttempts: 6 }, { name: 'Lieu', tagline: "Nomme l'œuvre d'après l'un de ses lieux" }),
  tiles: withFrench({ type: 'tiles', name: 'Cover Puzzle', icon: '🔳', tagline: 'Name the work behind a scrambled, disguised cover', maxAttempts: 6 }, { name: 'Puzzle de jaquette', tagline: "Nomme l'œuvre derrière une jaquette mélangée et déguisée" }),
  connections: withFrench({ type: 'connections', name: 'Connections', icon: '🔗', tagline: 'Sort the tiles into hidden groups', maxAttempts: settings.connections.maxMistakes }, { name: 'Connexions', tagline: 'Range les tuiles en groupes cachés' }),
};

export const GAME_TYPES = Object.keys(GAME_META) as GameType[];
