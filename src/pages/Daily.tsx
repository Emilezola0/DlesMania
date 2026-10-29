import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { DOMAINS, domainInfo, getWork } from '../data';
import { getPuzzle } from '../lib/connections';
import { FlameIcon } from '../components/Layout';
import { Glyph, GlyphSeal, Ornament } from '../components/Glyph';
import { GameHost } from '../games/GameHost';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { dayNumber, formatLong, isPlayableDay, msUntilTomorrow, todayKey } from '../lib/date';
import { celebrateBig } from '../lib/fx';
import { buildDaily, isDomain } from '../lib/rounds';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { sfx } from '../lib/sfx';
import { roundEmoji, shareText } from '../lib/share';
import { computeStreak, dayKey, summarizeDay, useProgress } from '../store/progress';
import { EMPTY_RECORD, type Domain, type RoundRecord, type RoundSpec } from '../types';
import { RulesButton } from '../components/RulesModal';
import { GroupHost, GroupJoin } from '../components/GroupCode';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

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
            className="page group rounded-md p-6 transition hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <GlyphSeal seed={d.id} size={52} tone={d.tone} className="transition-transform duration-500 group-hover:rotate-45" />
                <div>
                  <p className="font-serif text-2xl font-bold leading-tight">{d.label}</p>
                  <p className="font-display text-[11px] tracking-[0.2em] text-ink-faint">
                    {sum.complete ? 'COMPLETED' : sum.finished ? `${sum.finished} OF 10 PLAYED` : 'NOT STARTED'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-4xl font-bold tabular-nums leading-none">{sum.score}</p>
                <p className="text-xs text-ink-faint">/ {MAX_DAILY_SCORE}</p>
                {streak > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-coral">
                    <FlameIcon /> {streak}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < sum.finished ? d.fill : 'bg-tile-strong'}`} />
              ))}
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-[0.25em] text-ink-faint">{formatLong(today).toUpperCase()}</p>
          <h1 className="text-5xl font-bold">Daily №{dayNumber(today)}</h1>
          <p className="font-serif text-lg italic text-ink-soft">Four independent challenges, ten mini-games each. Same puzzles for everyone, reset at midnight.</p>
        </div>
        <RulesButton tab="daily" label="How to play" />
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
      <p className="text-sm font-display uppercase tracking-[0.3em] text-ink-faint">{domainInfo(domain).label} complete</p>
      <GlyphSeal seed={domain} size={64} tone={domainInfo(domain).tone} className="mx-auto" />
      <p className="font-serif text-8xl font-bold leading-none">{sum.score}</p>
      <p className="text-ink-soft">
        out of {MAX_DAILY_SCORE} · {sum.won}/10 rounds won
        {streak > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 font-bold text-coral">
            <FlameIcon /> {streak}-day streak
          </span>
        )}
      </p>
      <Ornament />
      <div className="grid grid-cols-5 gap-2">
        {specs.map((s, i) => {
          const r = rounds[i];
          return (
            <button key={i} type="button" onClick={() => onPick(i)} className="page rounded-md p-3 transition hover:-translate-y-0.5">
              <Glyph seed={s.type} size={26} className="mx-auto" />
              <div className="mt-1 truncate text-xs text-ink-soft">{GAME_META[s.type].name}</div>
              <div className="text-sm">{roundEmoji(r)} <span className={`font-bold ${r?.status === 'won' ? 'text-hit' : 'text-miss'}`}>{r?.score ?? 0}</span></div>
            </button>
          );
        })}
      </div>
      <pre className="mx-auto w-fit whitespace-pre-wrap rounded-md border border-dashed border-rule-strong bg-card/70 px-5 py-3 text-left text-sm leading-relaxed text-ink-soft">
        {text.split('\n').slice(0, 3).join('\n')}
      </pre>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={share} className="btn-accent rounded-md px-5 py-2.5 font-semibold">
          {copied ? '✓ Copied!' : 'Share result'}
        </button>
        {others[0] && (
          <Link to={`/daily/${others[0].id}${date === todayKey() ? '' : `/${date}`}`} className="btn-paper inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-semibold">
            Next: <Glyph seed={others[0].id} size={18} className={others[0].tone} /> {others[0].label}
          </Link>
        )}
        <Link to={`/archive?domain=${domain}`} className="btn-paper rounded-md px-5 py-2.5 font-semibold">
          Past days
        </Link>
      </div>
      {date === todayKey() && <GroupHost domain={domain} date={date} />}
      {date === todayKey() && (
        <p className="text-sm text-ink-faint">
          Next challenge in <Countdown />
        </p>
      )}
    </div>
  );
}

function specsValid(specs: RoundSpec[]): boolean {
  try {
    return specs.length === 10 && specs.every((s) => {
      if (!GAME_TYPES.includes(s.type)) return false;
      if (s.targetId) getWork(s.targetId);
      s.workIds?.forEach(getWork);
      return !s.puzzleId || !!getPuzzle(s.puzzleId);
    });
  } catch {
    return false;
  }
}

function DailyChallenge({ domain, date }: { domain: Domain; date: string }) {
  const navigate = useNavigate();
  const key = dayKey(domain, date);
  const saved = useProgress((s) => s.specs[key]);
  const saveSpecs = useProgress((s) => s.saveSpecs);
  // Reuse the rounds this day was first played with; fall back if they reference removed data.
  const specs = useMemo(() => (saved && specsValid(saved) ? saved : buildDaily(date, domain)), [saved, date, domain]);
  useEffect(() => {
    if (!saved || !specsValid(saved)) saveSpecs(domain, date, specs);
  }, [saved, specs, domain, date, saveSpecs]);
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
          <p className="font-display text-xs tracking-[0.25em] text-ink-faint">{formatLong(date).toUpperCase()}</p>
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-bold">
            <GlyphSeal seed={domain} size={44} tone={info.tone} />
            {info.label} <span className="text-ink-faint">№{dayNumber(date)}</span>
            {date !== todayKey() && <span className="rounded-sm border border-coral/60 px-1.5 font-display text-[11px] tracking-widest text-coral">ARCHIVE</span>}
          </h1>
        </div>
        <div className="flex items-end gap-4">
          <RulesButton tab="daily" />
          <select
            aria-label="Category"
            value={domain}
            onChange={(e) => navigate(`/daily/${e.target.value}${date === todayKey() ? '' : `/${date}`}`)}
            className="rounded-md border border-rule-strong bg-card px-3 py-2 font-display text-sm tracking-wider"
          >
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <div className="text-right">
            <p className="text-xs font-display uppercase tracking-widest text-ink-faint">Score</p>
            <p className="font-serif text-3xl font-bold tabular-nums">
              {sum.score}
              <span className="text-base text-ink-faint"> / {MAX_DAILY_SCORE}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {specs.map((s, i) => {
          const r = rounds[i];
          const state = !r || r.status === 'playing' ? 'open' : r.status;
          const tone =
            state === 'won' ? 'border-hit/70 bg-hit/15' : state === 'lost' ? 'border-miss/60 bg-miss/10' : 'border-rule bg-card';
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              title={GAME_META[s.type].name}
              className={`flex flex-col items-center gap-0.5 rounded-md border p-2 transition hover:-translate-y-0.5 hover:border-ink-faint ${tone} ${
                i === index ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''
              }`}
            >
              <Glyph seed={s.type} size={22} />
              <span className="font-display text-[10px] font-semibold text-ink-soft">{ROMAN[i]}</span>
            </button>
          );
        })}
      </div>

      {date === todayKey() && !sum.complete && (
        <div className="flex justify-center">
          <GroupJoin domain={domain} date={date} onJoined={() => setIndex(-1)} />
        </div>
      )}

      {spec && record ? (
        <section key={`${key}-${index}`} className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs font-display uppercase tracking-widest text-ink-faint">Round {index + 1} of 10</p>
            <h2 className="flex items-center gap-2 text-3xl font-bold">
              <Glyph seed={spec.type} size={28} className={info.tone} /> {GAME_META[spec.type].name}
            </h2>
            <p className="font-serif text-lg italic text-ink-soft">{GAME_META[spec.type].tagline}</p>
          </div>

          <GameHost spec={spec} record={record} onChange={onChange} />

          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => goTo(nextOpen)}
                className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider"
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
