import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { DOMAINS, domainInfo } from '../data';
import { GameHost } from '../games/GameHost';
import { GAME_META } from '../games/meta';
import { dayNumber, formatLong, isPlayableDay, msUntilTomorrow, todayKey } from '../lib/date';
import { celebrateBig } from '../lib/fx';
import { buildDaily, isDomain } from '../lib/rounds';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { sfx } from '../lib/sfx';
import { roundEmoji, shareText } from '../lib/share';
import { computeStreak, dayKey, summarizeDay, useProgress } from '../store/progress';
import { EMPTY_RECORD, type Domain, type RoundRecord, type RoundSpec } from '../types';

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

/** One card per category with today's progress. */
export function DailyCards() {
  const days = useProgress((s) => s.days);
  const today = todayKey();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DOMAINS.map((d) => {
        const sum = summarizeDay(days[dayKey(d.id, today)]);
        const streak = computeStreak(days, d.id).current;
        return (
          <Link
            key={d.id}
            to={`/daily/${d.id}`}
            className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition hover:-translate-y-1 hover:border-zinc-600"
          >
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${d.accent}`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-4xl transition group-hover:scale-110">{d.icon}</p>
                <p className="mt-3 text-xl font-bold">{d.label}</p>
                <p className="text-sm text-zinc-500">{sum.complete ? '✓ Completed' : sum.finished ? `${sum.finished}/10 played` : 'Not started'}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tabular-nums">{sum.score}</p>
                <p className="text-xs text-zinc-500">/ {MAX_DAILY_SCORE}</p>
                {streak > 0 && <p className="mt-2 text-sm font-bold text-orange-300">🔥 {streak}</p>}
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full rounded-full bg-gradient-to-r ${d.accent} transition-all`} style={{ width: `${sum.finished * 10}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** /daily */
export function DailyHub() {
  const today = todayKey();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">{formatLong(today)}</p>
        <h1 className="text-3xl font-black tracking-tight">Daily #{dayNumber(today)}</h1>
        <p className="text-zinc-400">Four independent challenges, ten mini-games each. Same puzzles for everyone, reset at midnight.</p>
      </div>
      <DailyCards />
    </div>
  );
}

function Summary({ domain, date, specs, rounds, onPick }: { domain: Domain; date: string; specs: RoundSpec[]; rounds: Record<number, RoundRecord>; onPick: (i: number) => void }) {
  const days = useProgress((s) => s.days);
  const sum = summarizeDay(rounds);
  const streak = computeStreak(days, domain).current;
  const [copied, setCopied] = useState(false);
  const text = shareText(domain, date, specs, rounds, streak);
  const others = DOMAINS.filter((d) => d.id !== domain && !summarizeDay(days[dayKey(d.id, date)]).complete);

  const share = async () => {
    sfx.click();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <div className="animate-round-in mx-auto max-w-xl space-y-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{domainInfo(domain).label} complete</p>
      <p className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-7xl font-black text-transparent">{sum.score}</p>
      <p className="text-zinc-400">
        out of {MAX_DAILY_SCORE} · {sum.won}/10 rounds won{streak > 0 && <> · <span className="font-bold text-orange-300">🔥 {streak}-day streak</span></>}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {specs.map((s, i) => {
          const r = rounds[i];
          return (
            <button key={i} type="button" onClick={() => onPick(i)} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition hover:-translate-y-0.5 hover:border-zinc-600">
              <div className="text-2xl">{GAME_META[s.type].icon}</div>
              <div className="mt-1 truncate text-xs text-zinc-400">{GAME_META[s.type].name}</div>
              <div className="text-sm">{roundEmoji(r)} <span className={`font-bold ${r?.status === 'won' ? 'text-green-400' : 'text-red-400'}`}>{r?.score ?? 0}</span></div>
            </button>
          );
        })}
      </div>
      <pre className="mx-auto w-fit whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-left text-sm leading-relaxed text-zinc-300">
        {text.split('\n').slice(0, 3).join('\n')}
      </pre>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={share} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold transition hover:bg-indigo-500 active:scale-95">
          {copied ? '✓ Copied!' : 'Share result'}
        </button>
        {others[0] && (
          <Link to={`/daily/${others[0].id}${date === todayKey() ? '' : `/${date}`}`} className="rounded-xl border border-zinc-700 px-5 py-2.5 font-semibold hover:bg-zinc-800">
            Next: {others[0].icon} {others[0].label}
          </Link>
        )}
        <Link to={`/archive?domain=${domain}`} className="rounded-xl border border-zinc-700 px-5 py-2.5 font-semibold hover:bg-zinc-800">
          Past days
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

function DailyChallenge({ domain, date }: { domain: Domain; date: string }) {
  const navigate = useNavigate();
  const specs = useMemo(() => buildDaily(date, domain), [date, domain]);
  const key = dayKey(domain, date);
  const rounds = useProgress((s) => s.days[key]) ?? {};
  const setRound = useProgress((s) => s.setRound);
  const info = domainInfo(domain);

  const isOpen = (i: number) => (rounds[i]?.status ?? 'playing') === 'playing';
  const firstOpen = specs.findIndex((_, i) => isOpen(i));
  const [index, setIndex] = useState<number>(firstOpen);
  // Jump to the first unfinished round whenever the category or day changes.
  const [shown, setShown] = useState(key);
  if (shown !== key) {
    setShown(key);
    setIndex(firstOpen);
  }

  const sum = summarizeDay(rounds);
  const spec = index >= 0 ? specs[index] : undefined;
  const record = spec ? rounds[index] ?? EMPTY_RECORD : undefined;
  const nextOpen = specs.findIndex((_, i) => i !== index && isOpen(i));

  const onChange = (r: RoundRecord) => {
    setRound(domain, date, index, r);
    const finishedNow = r.status !== 'playing' && record?.status === 'playing';
    if (finishedNow && nextOpen < 0) {
      // Last round of the day: big finish.
      window.setTimeout(() => {
        sfx.streak();
        celebrateBig();
      }, 600);
    }
  };

  const goTo = (i: number) => {
    sfx.click();
    setIndex(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{formatLong(date)}</p>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="mr-2">{info.icon}</span>
            {info.label} <span className="text-zinc-500">#{dayNumber(date)}</span>
            {date !== todayKey() && <span className="ml-2 align-middle text-sm font-semibold text-amber-400">archive</span>}
          </h1>
        </div>
        <div className="flex items-end gap-4">
          <select
            aria-label="Category"
            value={domain}
            onChange={(e) => navigate(`/daily/${e.target.value}${date === todayKey() ? '' : `/${date}`}`)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.label}
              </option>
            ))}
          </select>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Score</p>
            <p className="text-2xl font-black tabular-nums">
              {sum.score}
              <span className="text-base text-zinc-500"> / {MAX_DAILY_SCORE}</span>
            </p>
          </div>
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
              onClick={() => goTo(i)}
              title={GAME_META[s.type].name}
              className={`flex flex-col items-center rounded-xl border p-2 transition hover:-translate-y-0.5 hover:border-zinc-500 ${tone} ${
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
        <section key={`${key}-${index}`} className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Round {index + 1} of 10</p>
            <h2 className="text-2xl font-bold">
              {GAME_META[spec.type].icon} {GAME_META[spec.type].name}
            </h2>
            <p className="text-sm text-zinc-400">{GAME_META[spec.type].tagline}</p>
          </div>

          <GameHost spec={spec} record={record} onChange={onChange} />

          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => goTo(nextOpen)}
                className="animate-pop rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 transition hover:scale-105 hover:bg-zinc-200 active:scale-95"
              >
                {nextOpen >= 0 ? 'Next round →' : 'See results →'}
              </button>
            </div>
          )}
        </section>
      ) : (
        <Summary domain={domain} date={date} specs={specs} rounds={rounds} onPick={goTo} />
      )}
    </div>
  );
}

/** /daily/:domain and /daily/:domain/:date */
export default function Daily() {
  const { domain, date = todayKey() } = useParams();
  if (!isDomain(domain)) return <Navigate to="/daily" replace />;
  if (!isPlayableDay(date)) return <Navigate to={`/daily/${domain}`} replace />;
  return <DailyChallenge domain={domain} date={date} />;
}
