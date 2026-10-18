import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Pill } from '../components/Pill';
import { domainInfo } from '../data';
import { GameHost } from '../games/GameHost';
import { GAME_META } from '../games/meta';
import { dayNumber, formatLong, isPlayableDay, msUntilTomorrow, todayKey } from '../lib/date';
import { buildDaily } from '../lib/rounds';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { summarizeDay, useProgress } from '../store/progress';
import { EMPTY_RECORD, type RoundRecord, type RoundSpec } from '../types';

function roundEmoji(r?: RoundRecord): string {
  if (!r || r.status === 'playing') return '⬛';
  if (r.status === 'lost') return '🟥';
  return r.score >= 70 ? '🟩' : '🟨';
}

function Countdown() {
  const [ms, setMs] = useState(msUntilTomorrow());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}

function Summary({ date, specs, rounds, onPick }: { date: string; specs: RoundSpec[]; rounds: Record<number, RoundRecord>; onPick: (i: number) => void }) {
  const sum = summarizeDay(rounds);
  const [copied, setCopied] = useState(false);
  const grid = specs.map((_, i) => roundEmoji(rounds[i])).join('');
  const share = `Omnidle #${dayNumber(date)} — ${sum.score}/${MAX_DAILY_SCORE}\n${grid.slice(0, grid.length / 2)}\n${grid.slice(grid.length / 2)}`;

  return (
    <div className="animate-pop mx-auto max-w-xl space-y-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Challenge complete</p>
      <p className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-7xl font-black text-transparent">{sum.score}</p>
      <p className="text-zinc-400">
        out of {MAX_DAILY_SCORE} · {sum.won}/10 rounds won
      </p>
      <div className="grid grid-cols-5 gap-2">
        {specs.map((s, i) => {
          const r = rounds[i];
          return (
            <button key={i} type="button" onClick={() => onPick(i)} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition hover:border-zinc-600">
              <div className="text-2xl">{GAME_META[s.type].icon}</div>
              <div className="mt-1 text-xs text-zinc-400">{GAME_META[s.type].name}</div>
              <div className={`text-sm font-bold ${r?.status === 'won' ? 'text-green-400' : 'text-red-400'}`}>{r?.score ?? 0}</div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(share).then(() => setCopied(true));
          }}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold hover:bg-indigo-500"
        >
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <Link to="/archive" className="rounded-xl border border-zinc-700 px-5 py-2.5 font-semibold hover:bg-zinc-800">
          Play past days
        </Link>
        <Link to="/play" className="rounded-xl border border-zinc-700 px-5 py-2.5 font-semibold hover:bg-zinc-800">
          Free play
        </Link>
      </div>
      {date === todayKey() && (
        <p className="text-sm text-zinc-500">
          Next challenge in <Countdown />
        </p>
      )}
    </div>
  );
}

export default function Daily() {
  const params = useParams();
  const date = params.date ?? todayKey();
  const valid = isPlayableDay(date);
  const specs = useMemo(() => (valid ? buildDaily(date) : []), [date, valid]);
  const rounds = useProgress((s) => s.days[date]) ?? {};
  const setRound = useProgress((s) => s.setRound);

  const firstOpen = specs.findIndex((_, i) => (rounds[i]?.status ?? 'playing') === 'playing');
  const [index, setIndex] = useState<number>(firstOpen);
  // Jump to the first unfinished round whenever the day changes (not on every record update).
  const [shownDate, setShownDate] = useState(date);
  if (shownDate !== date) {
    setShownDate(date);
    setIndex(firstOpen);
  }

  if (!valid) return <Navigate to="/daily" replace />;

  const sum = summarizeDay(rounds);
  const spec = index >= 0 ? specs[index] : undefined;
  const record = spec ? rounds[index] ?? EMPTY_RECORD : undefined;
  const nextOpen = specs.findIndex((_, i) => i !== index && (rounds[i]?.status ?? 'playing') === 'playing');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{formatLong(date)}</p>
          <h1 className="text-3xl font-black tracking-tight">
            Daily #{dayNumber(date)}
            {date !== todayKey() && <span className="ml-2 align-middle text-sm font-semibold text-amber-400">archive</span>}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Score</p>
          <p className="text-2xl font-black">
            {sum.score}
            <span className="text-base text-zinc-500"> / {MAX_DAILY_SCORE}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {specs.map((s, i) => {
          const r = rounds[i];
          const state = !r || r.status === 'playing' ? 'open' : r.status;
          const tone =
            state === 'won' ? 'border-green-500/60 bg-green-500/15' : state === 'lost' ? 'border-red-500/50 bg-red-500/10' : 'border-zinc-800 bg-zinc-900';
          return (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              title={GAME_META[s.type].name}
              className={`flex flex-col items-center rounded-xl border p-2 transition hover:border-zinc-500 ${tone} ${
                i === index ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950' : ''
              }`}
            >
              <span className="text-xl">{GAME_META[s.type].icon}</span>
              <span className="text-[10px] font-semibold text-zinc-400">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {spec && record ? (
        <section className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Round {index + 1} of 10</p>
              <h2 className="text-2xl font-bold">
                {GAME_META[spec.type].icon} {GAME_META[spec.type].name}
              </h2>
              <p className="text-sm text-zinc-400">{GAME_META[spec.type].tagline}</p>
            </div>
            <Pill>{spec.domain === 'mixed' ? '🌐 All domains' : `${domainInfo(spec.domain).icon} ${domainInfo(spec.domain).label}`}</Pill>
          </div>

          <GameHost key={`${date}-${index}`} spec={spec} record={record} onChange={(r) => setRound(date, index, r)} />

          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setIndex(nextOpen)}
                className="rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 transition hover:bg-zinc-200"
              >
                {nextOpen >= 0 ? 'Next round →' : 'See results →'}
              </button>
            </div>
          )}
        </section>
      ) : (
        <Summary date={date} specs={specs} rounds={rounds} onPick={setIndex} />
      )}
    </div>
  );
}
