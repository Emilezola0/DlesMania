import type { ComponentType } from 'react';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import type { GameProps, GameType, RoundRecord } from '../types';
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

/** Games that play their own sounds for intermediate guesses (e.g. "one away", a solved group). */
const OWN_FEEDBACK = new Set<GameType>(['connections']);

/** Renders the right mini-game and adds the shared juice: sounds, confetti, glow and transitions. */
export function GameHost({ spec, record, onChange }: GameProps) {
  const Game = COMPONENTS[spec.type];

  const handleChange = (next: RoundRecord) => {
    if (next.status === 'won' && record.status !== 'won') {
      sfx.correct();
      celebrate();
    } else if (next.status === 'lost' && record.status !== 'lost') {
      sfx.lose();
    } else if (next.guesses.length > record.guesses.length && !OWN_FEEDBACK.has(spec.type)) {
      sfx.wrong();
    }
    onChange(next);
  };

  return (
    <div className="animate-round-in">
      <div className={`rounded-xl transition-shadow duration-700 ${record.status === 'won' ? 'animate-glow' : ''}`}>
        <Game spec={spec} record={record} onChange={handleChange} />
      </div>
    </div>
  );
}
