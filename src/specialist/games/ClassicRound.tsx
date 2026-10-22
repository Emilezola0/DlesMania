import { GuessInput } from '../../components/GuessInput';
import type { RoundRecord } from '../../types';
import { ARC_ORDER, ONE_PIECE, characterById, formatBounty, type OpCharacter } from '../data';
import { LOL, championById, type LolChampion } from '../lol';
import { MARVEL, filmById, mcuCharacterById, type McuCharacter } from '../marvel';
import { GENSHIN, compareVersions, giCharacterById, type GiCharacter } from '../genshin';
import { SP_META, spScore, type SpRound } from '../rounds';
import { SpOutcome } from './SpGuessRound';

type Verdict = 'hit' | 'near' | 'miss';

interface Column<T> {
  label: string;
  show: (c: T) => string;
  judge: (g: T, t: T) => Verdict;
  /** For numbers: ▲ when the answer is higher / later. */
  arrow?: (g: T, t: T) => number;
}

/** Lists (Haki, positions, regions...): all shared is a hit, some shared is near. */
const overlap = (g: string[], t: string[]): Verdict => {
  const shared = g.filter((x) => t.includes(x)).length;
  if (shared === t.length && g.length === t.length) return 'hit';
  return shared ? 'near' : 'miss';
};
/** Numbers: equal is a hit, within `ratio` is near. */
const close = (g: number, t: number, ratio: number): Verdict => (g === t ? 'hit' : g && t && Math.abs(g - t) <= t * ratio ? 'near' : 'miss');
const same = <T,>(key: (c: T) => string) => (g: T, t: T): Verdict => (key(g) === key(t) ? 'hit' : 'miss');
const arcIndex = (c: OpCharacter) => ARC_ORDER.indexOf(c.arc);

const ONE_PIECE_COLUMNS: Column<OpCharacter>[] = [
  { label: 'Gender', show: (c) => c.gender, judge: same((c) => c.gender) },
  { label: 'Affiliation', show: (c) => c.affiliation, judge: same((c) => c.affiliation) },
  { label: 'Devil Fruit', show: (c) => c.fruitType.join(', '), judge: (g, t) => overlap(g.fruitType, t.fruitType) },
  { label: 'Haki', show: (c) => (c.haki.length ? c.haki.join(', ') : 'None'), judge: (g, t) => (!g.haki.length && !t.haki.length ? 'hit' : overlap(g.haki, t.haki)) },
  { label: 'Bounty', show: (c) => formatBounty(c.bounty), judge: (g, t) => close(g.bounty, t.bounty, 0.25), arrow: (g, t) => t.bounty - g.bounty },
  { label: 'Height', show: (c) => (c.height ? `${c.height} cm` : '?'), judge: (g, t) => close(g.height, t.height, 0.08), arrow: (g, t) => (g.height && t.height ? t.height - g.height : 0) },
  { label: 'Origin', show: (c) => c.origin, judge: same((c) => c.origin) },
  {
    label: 'First arc',
    show: (c) => c.arc,
    judge: (g, t) => (g.arc === t.arc ? 'hit' : Math.abs(arcIndex(g) - arcIndex(t)) <= 1 ? 'near' : 'miss'),
    arrow: (g, t) => t.chapter - g.chapter,
  },
];

const LOL_COLUMNS: Column<LolChampion>[] = [
  { label: 'Gender', show: (c) => c.gender, judge: same((c) => c.gender) },
  { label: 'Positions', show: (c) => c.positions.join(', '), judge: (g, t) => overlap(g.positions, t.positions) },
  { label: 'Species', show: (c) => c.species.join(', '), judge: (g, t) => overlap(g.species, t.species) },
  { label: 'Resource', show: (c) => c.resource, judge: same((c) => c.resource) },
  { label: 'Range', show: (c) => c.range, judge: same((c) => c.range) },
  { label: 'Regions', show: (c) => c.regions.join(', '), judge: (g, t) => overlap(g.regions, t.regions) },
  { label: 'Release', show: (c) => (c.year ? String(c.year) : '?'), judge: same((c) => String(c.year)), arrow: (g, t) => t.year - g.year },
];

const debutOf = (c: McuCharacter) => filmById.get(c.debut)!;

const MARVEL_COLUMNS: Column<McuCharacter>[] = [
  { label: 'Gender', show: (c) => c.gender, judge: same((c) => c.gender) },
  { label: 'Species', show: (c) => c.species, judge: same((c) => c.species) },
  { label: 'Team', show: (c) => c.team, judge: same((c) => c.team) },
  { label: 'Status', show: (c) => c.status, judge: same((c) => c.status) },
  {
    label: 'Debut',
    show: (c) => `${debutOf(c).name} (${debutOf(c).year})`,
    // Same film, or a neighbour in release order, is close.
    judge: (g, t) => (g.debut === t.debut ? 'hit' : Math.abs(debutOf(g).order - debutOf(t).order) <= 2 ? 'near' : 'miss'),
    arrow: (g, t) => debutOf(t).order - debutOf(g).order,
  },
  { label: 'Phase', show: (c) => `Phase ${c.phase}`, judge: same((c) => String(c.phase)), arrow: (g, t) => t.phase - g.phase },
  { label: 'Films', show: (c) => String(c.films), judge: (g, t) => (g.films === t.films ? 'hit' : Math.abs(g.films - t.films) <= 1 ? 'near' : 'miss'), arrow: (g, t) => t.films - g.films },
];

const GENSHIN_COLUMNS: Column<GiCharacter>[] = [
  { label: 'Gender', show: (c) => c.gender, judge: same((c) => c.gender) },
  { label: 'Element', show: (c) => c.element, judge: same((c) => c.element) },
  { label: 'Weapon', show: (c) => c.weapon, judge: same((c) => c.weapon) },
  { label: 'Region', show: (c) => c.region, judge: same((c) => c.region) },
  { label: 'Rarity', show: (c) => `${c.rarity}★`, judge: same((c) => String(c.rarity)) },
  { label: 'Body', show: (c) => c.body, judge: same((c) => c.body) },
  {
    label: 'Version',
    show: (c) => c.version,
    // The same major version (4.x) is close.
    judge: (g, t) => (g.version === t.version ? 'hit' : g.version.split('.')[0] === t.version.split('.')[0] ? 'near' : 'miss'),
    arrow: (g, t) => compareVersions(t.version, g.version),
  },
];

const VERDICT_CLASS: Record<Verdict, string> = {
  hit: 'bg-hit border-hit text-on-strong',
  near: 'bg-near border-near text-on-pastel',
  miss: 'bg-miss border-miss text-on-strong',
};

interface GridProps<T extends { id: string; name: string; aliases: string[]; image: string }> {
  round: SpRound;
  record: RoundRecord;
  onChange: (r: RoundRecord) => void;
  pool: T[];
  byId: Map<string, T>;
  columns: Column<T>[];
  noun: string;
  detail: (t: T) => string;
}

/** Guess an answer; every trait of each guess is compared with the answer's. */
function ClassicGrid<T extends { id: string; name: string; aliases: string[]; image: string }>({ round, record, onChange, pool, byId, columns, noun, detail }: GridProps<T>) {
  const target = byId.get(round.targetId)!;
  const max = SP_META.classic.maxAttempts;
  const done = record.status !== 'playing';
  const grid = { gridTemplateColumns: `1.5fr repeat(${columns.length}, 1fr)` };

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === target.id;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? spScore('classic', guesses.length) : 0 });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-ink-soft">Guess the mystery {noun}. Each guess shows how their traits compare.</p>
      {!done && <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder={`Type a ${noun}…`} />}
      <p className="text-center text-xs text-ink-faint">
        {record.guesses.length} / {max} guesses
      </p>

      {record.guesses.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="space-y-2" style={{ minWidth: 160 + columns.length * 92 }}>
            <div className="grid gap-2 px-1 text-[11px] uppercase tracking-wider text-ink-faint" style={grid}>
              <span className="capitalize">{noun}</span>
              {columns.map((c) => (
                <span key={c.label} className="text-center">
                  {c.label}
                </span>
              ))}
            </div>
            {[...record.guesses].reverse().map((id) => {
              const g = byId.get(id);
              if (!g) return null;
              return (
                <div key={id} className="grid gap-2" style={grid}>
                  <div className="flex items-center gap-2 rounded-lg border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold">
                    <img src={g.image} alt="" className="size-10 shrink-0 rounded-md bg-tile object-cover object-top" />
                    <span className="leading-tight">{g.name}</span>
                  </div>
                  {columns.map((c, i) => {
                    const verdict = c.judge(g, target);
                    const dir = verdict !== 'hit' && c.arrow ? Math.sign(c.arrow(g, target)) : 0;
                    return (
                      <div
                        key={c.label}
                        style={{ animationDelay: `${i * 80}ms` }}
                        className={`animate-flip flex min-h-14 flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center text-xs font-semibold leading-tight ${VERDICT_CLASS[verdict]}`}
                      >
                        <span>{c.show(g)}</span>
                        {dir !== 0 && <span className="text-base leading-none">{dir > 0 ? '▲' : '▼'}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-hit" /> Exact</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-near" /> Partial or close</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-miss" /> Wrong</span>
        <span>▲▼ Higher / later</span>
      </div>

      {done && <SpOutcome won={record.status === 'won'} name={target.name} image={target.image} detail={detail(target)} />}
    </div>
  );
}

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (r: RoundRecord) => void;
}

/** One Piece Classic: gender, affiliation, Devil Fruit, Haki, bounty, height, origin, first arc. */
export function ClassicRound(props: Props) {
  return (
    <ClassicGrid {...props} pool={ONE_PIECE.characters} byId={characterById} columns={ONE_PIECE_COLUMNS} noun="character" detail={(t) => `${t.affiliation} · ${t.arc}`} />
  );
}

/** Marvel Classic: gender, species, team, status, debut film, Phase, number of films. */
export function MarvelClassicRound(props: Props) {
  return (
    <ClassicGrid {...props} pool={MARVEL.characters} byId={mcuCharacterById} columns={MARVEL_COLUMNS} noun="character" detail={(t) => `${t.actor ? `Played by ${t.actor} · ` : ''}${debutOf(t).name}`} />
  );
}

/** Genshin Classic: gender, element, weapon, region, rarity, body type, version. */
export function GenshinClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={GENSHIN.characters} byId={giCharacterById} columns={GENSHIN_COLUMNS} noun="character" detail={(t) => `${t.element} · ${t.region} · v${t.version}`} />;
}

/** League Classic: gender, positions, species, resource, range, regions, release year. */
export function LolClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={LOL.champions} byId={championById} columns={LOL_COLUMNS} noun="champion" detail={(t) => `${t.title} · ${t.regions.join(', ')}`} />;
}
