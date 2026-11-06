// Honkai: Star Rail's rounds: Classic on the characters, their splash art zoomed in or behind windows, their own
// Light Cone, and a combat line in their own voice.
import { useEffect, useRef, useState } from 'react';
import { ObscuredImage } from '../../components/ObscuredImage';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import { useProgress } from '../../store/progress';
import type { RoundRecord } from '../../types';
import { HSR_CHARACTERS, HSR_CLASSIC, HSR_CONES, HSR_VOICES, versionValue, type HsrCharacter } from '../hsr';
import type { SpRound } from '../rounds';
import { ClassicGrid, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

const character = (id: string) => HSR_CHARACTERS.find((c) => c.id === id)!;
const detail = (c: HsrCharacter) => Object.values(c.traits).join(' · ');
const hintsFor = (c: HsrCharacter, extra: string[] = []) => [...Object.entries(c.traits).map(([k, v]) => `${k}: ${v}`), ...extra, `Their name starts with “${c.name[0]}”`];

/** Splash Art: the character's splash art, zoomed in, pulling back with each miss. */
export function HsrSplashRound({ round, record, onChange }: Props) {
  const c = character(round.targetId);
  const [focus] = useState<[number, number]>(() => {
    const rand = mulberry32(round.seed);
    return [35 + Math.round(rand() * 30), 25 + Math.round(rand() * 30)];
  });
  return (
    <SpGuessRound
      type="splash"
      question="Whose splash art is this?"
      pool={HSR_CHARACTERS}
      targetId={c.id}
      hints={hintsFor(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: detail(c) }}
      noPictures
      clue={(wrong, done) => <ZoomImage src={c.splash} alt="Splash art to guess" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Windows: the splash art behind tiles that open with each miss. */
export function HsrWindowsRound({ round, record, onChange }: Props) {
  const c = character(round.targetId);
  return (
    <SpGuessRound
      type="windows"
      question="Who is behind the windows?"
      pool={HSR_CHARACTERS}
      targetId={c.id}
      hints={hintsFor(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: detail(c) }}
      noPictures
      clue={(wrong, done) => <ObscuredImage src={c.splash} alt="Picture behind windows" step={wrong} revealed={done} seed={round.seed} />}
    />
  );
}

/** Light Cone: a character's own Light Cone, behind windows; its name comes as a late hint. */
export function HsrConeRound({ round, record, onChange }: Props) {
  const lc = HSR_CONES[Number(round.targetId.split(':')[1])];
  const c = character(lc.answer);
  const hints = hintsFor(c);
  return (
    <SpGuessRound
      type="lightcone"
      question="Whose Light Cone is this?"
      pool={HSR_CHARACTERS}
      targetId={c.id}
      hints={[...hints.slice(0, -1), `The Light Cone: “${lc.name}”`, hints.at(-1)!]}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `Light Cone: ${lc.name}` }}
      noPictures
      clue={(wrong, done) => (
        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
          <ObscuredImage src={lc.image} alt="Light Cone to name" step={wrong} revealed={done} seed={round.seed} />
          {done && <p className="font-display font-bold">{lc.name}</p>}
        </div>
      )}
    />
  );
}

/** Voice: one of the character's own combat lines (the wiki's recordings); the words are shown at the end. */
export function HsrVoiceRound({ round, record, onChange }: Props) {
  const v = HSR_VOICES[Number(round.targetId.split(':')[1])];
  const c = character(v.answer);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);
  const play = () => {
    audio.current?.pause();
    const a = new Audio(v.audio);
    a.volume = Math.min(1, useProgress.getState().clipVolume / 100);
    audio.current = a;
    void a.play().catch(() => setFailed(true));
  };
  useEffect(() => () => audio.current?.pause(), []);
  return (
    <SpGuessRound
      type="voice"
      question="Who is speaking?"
      pool={HSR_CHARACTERS}
      targetId={c.id}
      hints={hintsFor(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `“${v.text}”` }}
      noPictures
      clue={() => (
        <div className="page mx-auto flex max-w-sm flex-col items-center gap-3 rounded-md px-6 py-8 text-center">
          <button type="button" onClick={play} className="btn-accent grid size-20 place-items-center rounded-full text-3xl" aria-label="Play the voice line">
            🔊
          </button>
          <p className="text-xs text-ink-faint">{failed ? 'The recording would not play — try again, or go by the hints.' : 'Original English voice'}</p>
        </div>
      )}
    />
  );
}

const COLUMNS: Column<HsrCharacter>[] = [
  { label: 'Gender', show: (c) => c.gender, judge: same((c) => c.gender) },
  { label: 'Path', show: (c) => c.path, judge: same((c) => c.path) },
  { label: 'Combat Type', show: (c) => c.element, judge: same((c) => c.element) },
  { label: 'Rarity', show: (c) => `${c.rarity}★`, judge: same((c) => String(c.rarity)), arrow: (g, t) => t.rarity - g.rarity },
  { label: 'Faction', show: (c) => c.faction, judge: same((c) => c.faction) },
  { label: 'Version', show: (c) => c.version, judge: (g, t) => (g.version === t.version ? 'hit' : g.version.split('.')[0] === t.version.split('.')[0] ? 'near' : 'miss'), arrow: (g, t) => versionValue(t.version) - versionValue(g.version) },
];
const BY_ID = new Map(HSR_CLASSIC.map((c) => [c.id, c]));
export function HsrClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={HSR_CLASSIC} byId={BY_ID} columns={COLUMNS} noun="character" detail={detail} />;
}
