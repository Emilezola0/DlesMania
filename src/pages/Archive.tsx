import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlameIcon } from '../components/Layout';
import { Glyph } from '../components/Glyph';
import { DOMAINS } from '../data';
import { EPOCH, LAUNCH, dateLocale, dayNumber, fromKey, isBirthday, toKey, todayKey } from '../lib/date';
import { isDomain } from '../lib/rounds';
import { BIRTHDAY_COINS, REWARD_DATES, REWARD_WINDOW_DAYS, rewardsOn } from '../lib/rewards';
import { useCloud } from '../cloud/state';
import { computeStreak, dayKey, summarizeDay, useProgress } from '../store/progress';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Archive() {
  const days = useProgress((s) => s.days);
  const myBirthday = useCloud((c) => c.birthday);
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
        <p className="text-ink-soft">Missed a day? Every past challenge stays playable, for each category.</p>
      </div>
      {isBirthday(today) && (
        <p className="page animate-pop rounded-md p-4 text-center font-display text-lg font-bold ring-2 ring-ochre/60">
          🎂 Happy birthday, Omnidle! Online since {fromKey(LAUNCH).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })} —{' '}
          {Number(today.slice(0, 4)) - Number(LAUNCH.slice(0, 4)) || 'opening day'}
          {Number(today.slice(0, 4)) - Number(LAUNCH.slice(0, 4)) === 1 ? ' year' : Number(today.slice(0, 4)) > Number(LAUNCH.slice(0, 4)) ? ' years' : ''}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setParams({ domain: d.id }, { replace: true })}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 font-display text-sm font-semibold tracking-wider transition ${
              d.id === domain ? 'border-ink bg-ink text-paper' : 'border-rule bg-card text-ink-soft hover:border-rule-strong'
            }`}
          >
            <Glyph seed={d.id} size={18} className={d.id === domain ? '' : d.tone} /> {d.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1 text-coral"><FlameIcon /> {streak.current}</span> current · best {streak.best}
        </span>
      </div>

      <div className="page rounded-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" disabled={!canPrev} onClick={() => shift(-1)} className="rounded-lg px-3 py-1.5 hover:bg-tile disabled:opacity-30">
            ←
          </button>
          <p className="font-bold">{month.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })}</p>
          <button type="button" disabled={!canNext} onClick={() => shift(1)} className="rounded-lg px-3 py-1.5 hover:bg-tile disabled:opacity-30">
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-xs text-ink-faint">
              {w}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={i} />;
            const playable = key >= EPOCH && key <= today;
            const sum = summarizeDay(days[dayKey(domain, key)]);
            const tone = sum.complete
              ? 'border-hit/70 bg-hit/20'
              : sum.finished > 0
                ? 'border-near/60 bg-near/15'
                : 'border-rule bg-card';
            const dayLabel = fromKey(key).getDate();
            // Omnidle's birthday: the day it went online, and every anniversary.
            const birthday = isBirthday(key);
            // The days that bring DleCoins to signed-in players: a holiday (its own symbol; Omnidle's birthday keeps its cake), and the player's birthday.
            const gift = rewardsOn(key, myBirthday);
            const marks = [
              birthday && { icon: '🎂', label: key === LAUNCH ? 'Omnidle went online this day' : `Omnidle's birthday${gift.date ? `: ${gift.date.coins.toLocaleString()} DleCoins, open ${REWARD_WINDOW_DAYS} days` : ''}` },
              gift.date && gift.date.id !== 'omnidle' && { icon: gift.date.emoji, label: `${gift.date.name.en}: ${gift.date.coins.toLocaleString()} DleCoins, open ${REWARD_WINDOW_DAYS} days` },
              gift.birthday && { icon: '🎈', label: `Your birthday: ${BIRTHDAY_COINS.toLocaleString()} DleCoins` },
            ].filter((m): m is { icon: string; label: string } => !!m);
            const special = marks.length > 0;
            const cake = special ? (
              <span className="pointer-events-none absolute right-0.5 top-0.5 flex text-sm leading-none sm:right-1 sm:top-1 sm:text-base" title={marks.map((m) => m.label).join(' · ')} aria-label={marks.map((m) => m.label).join(' · ')}>
                {marks.map((m) => (
                  <span key={m.icon}>{m.icon}</span>
                ))}
              </span>
            ) : null;
            if (!playable) {
              return (
                <span key={key} className="relative flex aspect-square items-center justify-center rounded-xl text-sm text-ink-faint/50">
                  {dayLabel}
                  {cake}
                </span>
              );
            }
            return (
              <Link
                key={key}
                to={`/daily/${domain}/${key}`}
                title={special ? marks.map((m) => `${m.icon} ${m.label}`).join('\n') : undefined}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition hover:border-ink-faint ${tone} ${
                  key === today ? 'ring-2 ring-accent' : special ? 'ring-2 ring-ochre/70' : ''
                }`}
              >
                {cake}
                <span className="font-bold">{dayLabel}</span>
                <span className="text-[10px] text-ink-soft">{sum.finished ? `${sum.score}` : `#${dayNumber(key)}`}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-hit/60" /> Completed</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-near/60" /> In progress</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-tile-strong" /> Not started</span>
          <span className="flex items-center gap-1.5">🎂 Omnidle&apos;s birthday</span>
        </div>
        <p className="mt-2 text-center text-xs text-ink-faint">
          Signed in, come by on these days for DleCoins: {REWARD_DATES.filter((d) => d.id !== 'omnidle').map((d) => `${d.emoji} ${d.name.en}`).join(', ')}, 🎂 Omnidle&apos;s birthday
          {' '}({REWARD_DATES[0].coins.toLocaleString()} each, open {REWARD_WINDOW_DAYS} days){myBirthday ? `, and 🎈 your birthday (${BIRTHDAY_COINS.toLocaleString()})` : ''} — plus a gift every day you come by.
        </p>
      </div>
    </div>
  );
}
