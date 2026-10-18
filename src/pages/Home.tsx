import { Link } from 'react-router-dom';
import { DOMAINS, WORKS } from '../data';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { dayNumber, todayKey } from '../lib/date';
import { computeStreak, summarizeDay, useProgress } from '../store/progress';
import { DailyCards } from './Daily';

export default function Home() {
  const days = useProgress((s) => s.days);
  const streak = computeStreak(days);
  const completed = Object.values(days).filter((d) => summarizeDay(d).complete).length;

  return (
    <div className="space-y-12">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-400">Daily #{dayNumber(todayKey())}</p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Four categories.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Forty daily puzzles.</span>
          </h1>
          <p className="max-w-lg text-lg text-zinc-400">
            Guess video games, anime, movies and albums from attributes, quotes, soundtracks, blurred images, emojis and more.
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3">
            <p className="text-2xl font-black text-orange-300">🔥 {streak.current}</p>
            <p className="text-xs text-zinc-500">Streak</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3">
            <p className="text-2xl font-black">{streak.best}</p>
            <p className="text-xs text-zinc-500">Best</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3">
            <p className="text-2xl font-black">{completed}</p>
            <p className="text-xs text-zinc-500">Dailies done</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Today’s challenges</h2>
          <Link to="/archive" className="text-sm text-zinc-400 hover:text-white">
            Archive →
          </Link>
        </div>
        <DailyCards />
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Ten mini-games</h2>
          <Link to="/play" className="text-sm text-zinc-400 hover:text-white">
            Free play →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GAME_TYPES.map((t) => (
            <Link
              key={t}
              to={`/play?type=${t}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:bg-zinc-900"
            >
              <p className="text-2xl">{GAME_META[t].icon}</p>
              <p className="mt-2 font-semibold">{GAME_META[t].name}</p>
              <p className="text-xs leading-snug text-zinc-500">{GAME_META[t].tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-sm text-zinc-600">
        {WORKS.length} works across {DOMAINS.map((d) => `${WORKS.filter((w) => w.domain === d.id).length} ${d.label.toLowerCase()}`).join(', ')}.
      </p>
    </div>
  );
}
