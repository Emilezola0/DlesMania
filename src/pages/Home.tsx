import { Link } from 'react-router-dom';
import { DOMAINS, WORKS } from '../data';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { dayNumber, todayKey } from '../lib/date';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { computeStreak, summarizeDay, useProgress } from '../store/progress';

export default function Home() {
  const days = useProgress((s) => s.days);
  const today = todayKey();
  const sum = summarizeDay(days[today]);
  const streak = computeStreak(days);
  const completedDays = Object.values(days).filter((d) => summarizeDay(d).complete).length;

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-400">Daily #{dayNumber(today)}</p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Ten games.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">One daily ritual.</span>
          </h1>
          <p className="max-w-md text-lg text-zinc-400">
            Guess video games, anime, movies and albums through attributes, quotes, emojis, soundtracks, pixel art and more.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/daily" className="rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 transition hover:bg-zinc-200">
              {sum.complete ? 'View today’s results' : sum.finished ? `Continue (${sum.finished}/10)` : 'Play today’s challenge'}
            </Link>
            <Link to="/play" className="rounded-xl border border-zinc-700 px-6 py-3 font-bold transition hover:bg-zinc-800">
              Free play
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Today</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-black">{sum.score}</span>
            <span className="text-zinc-500">/ {MAX_DAILY_SCORE}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all" style={{ width: `${sum.finished * 10}%` }} />
          </div>
          <p className="mt-2 text-sm text-zinc-400">{sum.finished} of 10 rounds played</p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-zinc-900 p-3">
              <p className="text-2xl font-black text-orange-300">🔥 {streak.current}</p>
              <p className="text-xs text-zinc-500">Streak</p>
            </div>
            <div className="rounded-xl bg-zinc-900 p-3">
              <p className="text-2xl font-black">{streak.best}</p>
              <p className="text-xs text-zinc-500">Best</p>
            </div>
            <div className="rounded-xl bg-zinc-900 p-3">
              <p className="text-2xl font-black">{completedDays}</p>
              <p className="text-xs text-zinc-500">Days done</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Four domains</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {DOMAINS.map((d) => (
            <Link
              key={d.id}
              to={`/play?domain=${d.id}`}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-0.5 hover:border-zinc-600"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${d.accent}`} />
              <p className="text-3xl">{d.icon}</p>
              <p className="mt-2 font-bold">{d.label}</p>
              <p className="text-xs text-zinc-500">{WORKS.filter((w) => w.domain === d.id).length} entries</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Ten mini-games</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GAME_TYPES.map((t) => (
            <Link
              key={t}
              to={`/play?type=${t}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-indigo-500/60 hover:bg-zinc-900"
            >
              <p className="text-2xl">{GAME_META[t].icon}</p>
              <p className="mt-2 font-semibold">{GAME_META[t].name}</p>
              <p className="text-xs leading-snug text-zinc-500">{GAME_META[t].tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
