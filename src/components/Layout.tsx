import { NavLink, Outlet } from 'react-router-dom';
import { computeStreak, useProgress } from '../store/progress';
import { GlyphSeal, Ornament } from './Glyph';

const NAV = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play' },
  { to: '/archive', label: 'Archive' },
];

/** Line-drawn icons in the same ink as the glyphs. */
export function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}

export function FlameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.7 3.2-5.6 4-9.5 2.6 1.6 3.6 3.9 3.4 6.3 1-.6 1.8-1.7 2.1-3 1.9 1.7 3.5 3.8 3.5 6.2 0 3.4-2.6 6-6.5 6z" />
      <path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.4-2.4 2.7-4.1 1.3 1.7 2.7 2.5 2.7 4.1 0 1.5-1.1 2.6-2.7 2.6z" />
    </svg>
  );
}

export function Layout() {
  const days = useProgress((s) => s.days);
  const sound = useProgress((s) => s.sound);
  const toggleSound = useProgress((s) => s.toggleSound);
  const { current } = computeStreak(days);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-4">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <GlyphSeal seed="omnidle" size={36} className="transition-transform duration-500 group-hover:rotate-90" />
            <span className="hidden font-display text-lg font-bold tracking-[0.18em] min-[420px]:inline">OMNIDLE</span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-2.5 py-1.5 font-display text-[13px] font-semibold tracking-wider transition sm:px-3 ${
                    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
                  }`
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
            className="rounded-md p-1.5 text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            <SpeakerIcon on={sound} />
          </button>
          <span
            title="Days in a row with at least one category completed"
            className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-bold sm:flex ${
              current > 0 ? 'border-coral/60 bg-coral/10 text-coral' : 'border-rule-strong text-ink-faint'
            }`}
          >
            <FlameIcon /> {current}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-ink-faint">
        <Ornament className="mb-4" />
        <p className="font-serif text-sm italic">
          Omnidle — a daily pop-culture challenge across games, anime, cinema &amp; music. Progress is saved in your browser.
        </p>
        <p className="mt-1">A fan project; all works, images and clips belong to their respective owners.</p>
      </footer>
    </div>
  );
}
