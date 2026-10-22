import type { ComponentType, ReactNode } from 'react';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import type { GameProps, GameType, RoundRecord } from '../types';
import ClassicGame from './ClassicGame';
import ClueGame from './ClueGame';
import ConnectionsGame from './ConnectionsGame';
import TilesGame from './TilesGame';
import TimelineGame from './TimelineGame';

const COMPONENTS: Record<GameType, ComponentType<GameProps>> = {
  classic: ClassicGame,
  quote: ClueGame,
  audio: ClueGame,
  voice: ClueGame,
  emoji: ClueGame,
  visual: ClueGame,
  item: ClueGame,
  location: ClueGame,
  tiles: TilesGame,
  timeline: TimelineGame,
  connections: ConnectionsGame,
};

/** Games that play their own sounds for intermediate guesses (e.g. "one away", a solved group). */
const OWN_FEEDBACK = new Set<GameType>(['connections']);

interface FxProps {
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
  /** The game plays its own sound for intermediate guesses. */
  ownFeedback?: boolean;
  /** Renders the round with the change handler that adds the effects. */
  children: (onChange: (record: RoundRecord) => void) => ReactNode;
}

/** The shared juice around any round: sounds, confetti, glow and the slide-in. Used by the Specialist rounds too. */
export function GameHostFx({ record, onChange, ownFeedback = false, children }: FxProps) {
  const handleChange = (next: RoundRecord) => {
    if (next.status === 'won' && record.status !== 'won') {
      sfx.correct();
      celebrate();
    } else if (next.status === 'lost' && record.status !== 'lost') {
      sfx.lose();
    } else if (next.guesses.length > record.guesses.length && !ownFeedback) {
      sfx.wrong();
    }
    onChange(next);
  };

  return (
    <div className="animate-round-in">
      <div className={`rounded-xl transition-shadow duration-700 ${record.status === 'won' ? 'animate-glow' : ''}`}>{children(handleChange)}</div>
    </div>
  );
}

/** Renders the right mini-game with the shared juice. */
export function GameHost({ spec, record, onChange }: GameProps) {
  const Game = COMPONENTS[spec.type];
  return (
    <GameHostFx record={record} onChange={onChange} ownFeedback={OWN_FEEDBACK.has(spec.type)}>
      {(change) => <Game spec={spec} record={record} onChange={change} />}
    </GameHostFx>
  );
}
