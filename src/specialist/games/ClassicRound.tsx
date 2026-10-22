import { GuessInput } from '../../components/GuessInput';
import type { RoundRecord } from '../../types';
import { ARC_ORDER, ONE_PIECE, characterById, formatBounty, type OpCharacter } from '../data';
import { SP_META, spScore, type SpRound } from '../rounds';
import { SpOutcome } from './SpGuessRound';

type Verdict = 'hit' | 'near' | 'miss';

interface Column {
  label: string;
  show: (c: OpCharacter) => string;
  judge: (g: OpCharacter, t: OpCharacter) => Verdict;
  /** For numbers: ▲ when the answer is higher / later. */
  arrow?: (g: OpCharacter, t: OpCharacter) => number;
}

/** Lists (Haki, fruit types): all shared is a hit, some shared is near. */
const overlap = (g: string[], t: string[]): Verdict => {
  const shared = g.filter((x) => t.includes(x)).length;
  if (shared === t.length && g.length === t.length) return 'hit';
  return shared ? 'near' : 'miss';
};
/** Numbers: equal is a hit, within `ratio` is near. */
const close = (g: number, t: number, ratio: number): Verdict => (g === t ? 'hit' : g && t && Math.abs(g - t) <= t * ratio ? 'near' : 'miss');
const arcIndex = (c: OpCharacter) => ARC_ORDER.indexOf(c.arc);

const COLUMNS: Column[] = [
  { label: 'Gender', show: (c) => c.gender, judge: (g, t) => (g.gender === t.gender ? 'hit' : 'miss') },
  { label: 'Affiliation', show: (c) => c.affiliation, judge: (g, t) => (g.affiliation === t.affiliation ? 'hit' : 'miss') },
  { label: 'Devil Fruit', show: (c) => c.fruitType.join(', '), judge: (g, t) => overlap(g.fruitType, t.fruitType) },
  { label: 'Haki', show: (c) => (c.haki.length ? c.haki.join(', ') : 'None'), judge: (g, t) => (!g.haki.length && !t.haki.length ? 'hit' : overlap(g.haki, t.haki)) },
  { label: 'Bounty', show: (c) => formatBounty(c.bounty), judge: (g, t) => close(g.bounty, t.bounty, 0.25), arrow: (g, t) => t.bounty - g.bounty },
  { label: 'Height', show: (c) => (c.height ? `${c.height} cm` : '?'), judge: (g, t) => close(g.height, t.height, 0.08), arrow: (g, t) => (g.height && t.height ? t.height - g.height : 0) },
  { label: 'Origin', show: (c) => c.origin, judge: (g, t) => (g.origin === t.origin ? 'hit' : 'miss') },
  {
    label: 'First arc',
    show: (c) => c.arc,
    judge: (g, t) => (g.arc === t.arc ? 'hit' : Math.abs(arcIndex(g) - arcIndex(t)) <= 1 ? 'near' : 'miss'),
    arrow: (g, t) => t.chapter - g.chapter,
  },
];

const VERDICT_CLASS: Record<Verdict, string> = {
  hit: 'bg-hit border-hit text-on-strong',
  near: 'bg-near border-near text-on-pastel',
  miss: 'bg-miss border-miss text-on-strong',
};

const grid = { gridTemplateColumns: `1.5fr repeat(${COLUMNS.length}, 1fr)` };

/** One Piece Classic: guess a character, every trait is compared with the answer's. */
export function ClassicRound({ round, record, onChange }: { round: SpRound; record: RoundRecord; onChange: (r: RoundRecord) => void }) {
  const target = characterById.get(round.targetId)!;
  const max = SP_META.classic.maxAttempts;
  const done = record.status !== 'playing';

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === target.id;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? spScore('classic', guesses.length) : 0 });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-ink-soft">Guess the mystery character. Each guess shows how their traits compare.</p>
      {!done && <GuessInput pool={ONE_PIECE.characters} exclude={record.guesses} onGuess={guess} placeholder="Type a character…" />}
      <p className="text-center text-xs text-ink-faint">
        {record.guesses.length} / {max} guesses
      </p>

      {record.guesses.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="space-y-2" style={{ minWidth: 160 + COLUMNS.length * 92 }}>
            <div className="grid gap-2 px-1 text-[11px] uppercase tracking-wider text-ink-faint" style={grid}>
              <span>Character</span>
              {COLUMNS.map((c) => (
                <span key={c.label} className="text-center">
                  {c.label}
                </span>
              ))}
            </div>
            {[...record.guesses].reverse().map((id) => {
              const g = characterById.get(id);
              if (!g) return null;
              return (
                <div key={id} className="grid gap-2" style={grid}>
                  <div className="flex items-center gap-2 rounded-lg border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold">
                    <img src={g.image} alt="" className="size-10 shrink-0 rounded-md bg-tile object-cover object-top" />
                    <span className="leading-tight">{g.name}</span>
                  </div>
                  {COLUMNS.map((c, i) => {
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

      {done && <SpOutcome won={record.status === 'won'} name={target.name} image={target.image} detail={`${target.affiliation} · ${target.arc}`} />}
    </div>
  );
}
