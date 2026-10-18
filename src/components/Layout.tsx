import { NavLink, Outlet } from 'react-router-dom';
import { computeStreak, useProgress } from '../store/progress';

const NAV = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play' },
  { to: '/archive', label: 'Archive' },
];

export function Layout() {
  const days = useProgress((s) => s.days);
  const sound = useProgress((s) => s.sound);
  const toggleSound = useProgress((s) => s.toggleSound);
  const { current } = computeStreak(days);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 text-base">◎</span>
            <span className="hidden min-[420px]:inline">
              Omni<span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">dle</span>
            </span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggleSound}
            title={sound ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-pressed={sound}
            className="rounded-lg px-2 py-1.5 text-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            {sound ? '🔊' : '🔇'}
          </button>
          <span
            title="Days in a row with at least one category completed"
            className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-bold sm:flex ${
              current > 0 ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-zinc-700 text-zinc-500'
            }`}
          >
            🔥 {current}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Omnidle — a daily pop-culture challenge across games, anime, cinema & music. Progress is saved in your browser.
      </footer>
    </div>
  );
}
