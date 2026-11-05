// Deadlock's rounds: Classic on the heroes, their card art zoomed in or behind windows, an ability's icon,
// a voice line in the hero's own voice, and an item of the shop by its icon.
import { useEffect, useRef, useState } from 'react';
import { ObscuredImage } from '../../components/ObscuredImage';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import { useProgress } from '../../store/progress';
import type { RoundRecord } from '../../types';
import { DL_ABILITIES, DL_CLASSIC, DL_HEROES, DL_ITEMS, DL_VOICES, type DlHero } from '../deadlock';
import type { SpRound } from '../rounds';
import { ClassicGrid, close, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

const hero = (id: string) => DL_HEROES.find((h) => h.id === id)!;
const detail = (h: DlHero) => Object.values(h.traits).join(' · ');
const hintsFor = (h: DlHero, extra: string[] = []) => [...Object.entries(h.traits).map(([k, v]) => `${k}: ${v}`), ...extra, `Their name starts with “${h.name[0]}”`];

/** Picture: the hero's card art, zoomed in, pulling back with each miss. */
export function DlPictureRound({ round, record, onChange }: Props) {
  const h = hero(round.targetId);
  const [focus] = useState<[number, number]>(() => {
    const rand = mulberry32(round.seed);
    return [35 + Math.round(rand() * 30), 20 + Math.round(rand() * 30)];
  });
  return (
    <SpGuessRound
      type="picture"
      question="Which hero is this?"
      pool={DL_HEROES}
      targetId={h.id}
      hints={hintsFor(h)}
      record={record}
      onChange={onChange}
      answer={{ name: h.name, image: h.image, detail: detail(h) }}
      noPictures
      clue={(wrong, done) => <ZoomImage src={h.image} alt="Picture to guess" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Windows: the card art behind tiles that open with each miss. */
export function DlWindowsRound({ round, record, onChange }: Props) {
  const h = hero(round.targetId);
  return (
    <SpGuessRound
      type="windows"
      question="Which hero is behind the windows?"
      pool={DL_HEROES}
      targetId={h.id}
      hints={hintsFor(h)}
      record={record}
      onChange={onChange}
      answer={{ name: h.name, image: h.image, detail: detail(h) }}
      noPictures
      clue={(wrong, done) => <ObscuredImage src={h.image} alt="Picture behind windows" step={wrong} revealed={done} seed={round.seed} />}
    />
  );
}

/** Ability: an ability's icon, turned and blurred, clearing with each miss; its name comes as a late hint. */
export function DlAbilityRound({ round, record, onChange }: Props) {
  const a = DL_ABILITIES[Number(round.targetId.split(':')[1])];
  const h = hero(a.answer);
  const steps = [
    { blur: 6, turn: 180 },
    { blur: 4, turn: 90 },
    { blur: 3, turn: 45 },
    { blur: 2, turn: 0 },
    { blur: 1, turn: 0 },
    { blur: 0, turn: 0 },
  ];
  return (
    <SpGuessRound
      type="ability"
      question="Whose ability is this?"
      pool={DL_HEROES}
      targetId={h.id}
      hints={[...hintsFor(h).slice(0, -1), `The ability: ${a.name}${a.ultimate ? ' (ultimate)' : ''}`, hintsFor(h).at(-1)!]}
      record={record}
      onChange={onChange}
      answer={{ name: h.name, image: h.image, detail: `${a.name}${a.ultimate ? ' · ultimate' : ''}` }}
      noPictures
      clue={(wrong, done) => {
        const s = done ? { blur: 0, turn: 0 } : steps[Math.min(wrong, steps.length - 1)];
        return (
          <div className="mx-auto flex flex-col items-center gap-2">
            <div className="grid size-40 place-items-center rounded-xl bg-[#1d1a17]">
              <img src={a.image} alt="" draggable={false} className="size-28 select-none object-contain transition duration-500" style={{ filter: `blur(${s.blur}px) ${done ? '' : 'grayscale(1)'}`, transform: `rotate(${s.turn}deg)` }} />
            </div>
            {done && <p className="font-display font-bold">{a.name}</p>}
          </div>
        );
      }}
    />
  );
}

/** Voice: one of the hero's own lines (the wiki's recordings). */
export function DlVoiceRound({ round, record, onChange }: Props) {
  const v = DL_VOICES[Number(round.targetId.split(':')[1])];
  const h = hero(v.answer);
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
      pool={DL_HEROES}
      targetId={h.id}
      hints={hintsFor(h)}
      record={record}
      onChange={onChange}
      answer={{ name: h.name, image: h.image, detail: v.text ? `“${v.text}”` : detail(h) }}
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

/** Items: an item of the shop by its icon, behind windows. */
export function DlItemRound({ round, record, onChange }: Props) {
  const i = DL_ITEMS.find((x) => x.id === round.targetId)!;
  return (
    <SpGuessRound
      type="item"
      question="Which item is this?"
      pool={DL_ITEMS}
      targetId={i.id}
      hints={[...Object.entries(i.traits).map(([k, v]) => `${k}: ${v}`), `${i.name.split(/\s+/).length} word(s)`, `Its name starts with “${i.name[0]}”`]}
      record={record}
      onChange={onChange}
      answer={{ name: i.name, image: i.image, detail: Object.values(i.traits).join(' · ') }}
      noPictures
      clue={(wrong, done) => (
        <div className="mx-auto max-w-xs rounded-md bg-[#1d1a17] p-3">
          <ObscuredImage src={i.image} alt="Icon to name" step={wrong} revealed={done} seed={round.seed} />
        </div>
      )}
    />
  );
}

const COLUMNS: Column<DlHero>[] = [
  { label: 'Gender', show: (h) => h.gender, judge: same((h) => h.gender) },
  { label: 'Type', show: (h) => h.type, judge: same((h) => h.type) },
  { label: 'Health', show: (h) => String(h.health), judge: (g, t) => close(g.health, t.health, 0.05), arrow: (g, t) => t.health - g.health },
  { label: 'Clip size', show: (h) => String(h.clip), judge: (g, t) => close(g.clip, t.clip, 0.2), arrow: (g, t) => t.clip - g.clip },
  { label: 'Move speed', show: (h) => `${h.speed} m/s`, judge: (g, t) => close(g.speed, t.speed, 0.04), arrow: (g, t) => t.speed - g.speed },
  { label: 'Released', show: (h) => String(h.year), judge: same((h) => String(h.year)), arrow: (g, t) => t.year - g.year },
];
const BY_ID = new Map(DL_CLASSIC.map((h) => [h.id, h]));
export function DlClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={DL_CLASSIC} byId={BY_ID} columns={COLUMNS} noun="hero" detail={detail} />;
}
