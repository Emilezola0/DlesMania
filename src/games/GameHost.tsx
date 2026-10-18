import type { ComponentType } from 'react';
import type { GameProps, GameType } from '../types';
import ClassicGame from './ClassicGame';
import ClueGame from './ClueGame';
import ConnectionsGame from './ConnectionsGame';
import TimelineGame from './TimelineGame';

const COMPONENTS: Record<GameType, ComponentType<GameProps>> = {
  classic: ClassicGame,
  quote: ClueGame,
  audio: ClueGame,
  emoji: ClueGame,
  visual: ClueGame,
  item: ClueGame,
  location: ClueGame,
  creator: ClueGame,
  timeline: TimelineGame,
  connections: ConnectionsGame,
};

/** Renders the right mini-game for a round spec. */
export function GameHost(props: GameProps) {
  const Game = COMPONENTS[props.spec.type];
  return <Game {...props} />;
}
