import { useState } from 'react';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import type { SpRound } from '../rounds';
import { SIMPLE, simpleCharacter, type SimpleCharacter, type SimpleUniverse } from '../simple';
import { ClassicGrid, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Hints, vaguest first: the traits one by one, then the first letter. */
const hintsFor = (c: SimpleCharacter) => [...Object.entries(c.traits).map(([k, v]) => `${k}: ${v}`), `Their name starts with “${c.name[0]}”`];
const detail = (c: SimpleCharacter) => Object.values(c.traits).join(' · ');

/** Picture: the card art, cropped tight, pulling back with each miss. */
export const pictureRoundFor = (u: SimpleUniverse['id']) =>
  function SimplePictureRound({ round, record, onChange }: Props) {
    const c = simpleCharacter(u, round.targetId)!;
    const [focus] = useState<[number, number]>(() => {
      const rand = mulberry32(round.seed);
      return [35 + Math.round(rand() * 30), 25 + Math.round(rand() * 30)];
    });
    return (
      <SpGuessRound
        type="picture"
        question="Who — or what — is in this picture?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image, detail: detail(c) }}
        noPictures
        clue={(wrong, done) => <ZoomImage src={c.image} alt="Picture to guess" step={wrong} revealed={done} focus={focus} />}
      />
    );
  };

/** Clue: a line about them (a weapon, an ability, a moment of the story) — name who it is. */
export const clueRoundFor = (u: SimpleUniverse['id'], question: string) =>
  function SimpleClueRound({ round, record, onChange }: Props) {
    const clue = SIMPLE[u].clues[Number(round.targetId)];
    const c = simpleCharacter(u, clue.answer)!;
    return (
      <SpGuessRound
        type="clue"
        question={question}
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image || undefined, detail: detail(c) }}
        noPictures
        clue={() => (
          <blockquote className="page mx-auto max-w-xl rounded-md px-6 py-8 text-center font-serif text-2xl italic leading-snug">“{clue.text}”</blockquote>
        )}
      />
    );
  };

/** Classic: every trait of a guess compared with the answer's. */
export const classicRoundFor = (u: SimpleUniverse['id'], noun: string) => {
  const columns: Column<SimpleCharacter>[] = SIMPLE[u].columns.map((label) => ({ label, show: (c) => c.traits[label], judge: same((c) => c.traits[label]) }));
  const byId = new Map(SIMPLE[u].characters.map((c) => [c.id, c]));
  return function SimpleClassicRound(props: Props) {
    return <ClassicGrid {...props} pool={SIMPLE[u].characters} byId={byId} columns={columns} noun={noun} detail={detail} />;
  };
};
