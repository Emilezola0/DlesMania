import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DOMAINS } from '../data';
import { EPOCH, dayNumber, fromKey, toKey, todayKey } from '../lib/date';
import { isDomain } from '../lib/rounds';
import { computeStreak, dayKey, summarizeDay, useProgress } from '../store/progress';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Archive() {
  const days = useProgress((s) => s.days);
  const [params, setParams] = useSearchParams();
  const param = params.get('domain') ?? undefined;
  const domain = isDomain(param) ? param : 'games';
  const streak = computeStreak(days, domain);
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = fromKey(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];

  const canPrev = toKey(first) > EPOCH;
  const canNext = toKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= today;
  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Archive</h1>
        <p className="text-zinc-400">Missed a day? Every past challenge stays playable, for each category.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setParams({ domain: d.id }, { replace: true })}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              d.id === domain ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {d.icon} {d.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-zinc-400">
          🔥 {streak.current} current · best {streak.best}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" disabled={!canPrev} onClick={() => shift(-1)} className="rounded-lg px-3 py-1.5 hover:bg-zinc-800 disabled:opacity-30">
            ←
          </button>
          <p className="font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          <button type="button" disabled={!canNext} onClick={() => shift(1)} className="rounded-lg px-3 py-1.5 hover:bg-zinc-800 disabled:opacity-30">
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-xs text-zinc-500">
              {w}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={i} />;
            const playable = key >= EPOCH && key <= today;
            const sum = summarizeDay(days[dayKey(domain, key)]);
            const tone = sum.complete
              ? 'border-green-500/60 bg-green-500/20'
              : sum.finished > 0
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-zinc-800 bg-zinc-900';
            const dayLabel = fromKey(key).getDate();
            if (!playable) {
              return (
                <span key={key} className="flex aspect-square items-center justify-center rounded-xl text-sm text-zinc-700">
                  {dayLabel}
                </span>
              );
            }
            return (
              <Link
                key={key}
                to={`/daily/${domain}/${key}`}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition hover:border-zinc-500 ${tone} ${
                  key === today ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                <span className="font-bold">{dayLabel}</span>
                <span className="text-[10px] text-zinc-400">{sum.finished ? `${sum.score}` : `#${dayNumber(key)}`}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-green-500/60" /> Completed</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-amber-500/50" /> In progress</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-zinc-700" /> Not started</span>
        </div>
      </div>
    </div>
  );
}
