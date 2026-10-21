import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { computeStreak, useProgress, type ThemeChoice } from '../store/progress';
import { useUi } from '../store/ui';
import { GlyphSeal, Ornament } from './Glyph';
import { RulesModal } from './RulesModal';

const NAV = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play', short: 'Play' },
  { to: '/boss', label: 'Boss Battle', short: 'Boss' },
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

export function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {theme === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </>
      )}
      {theme === 'dark' && <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />}
      {theme === 'system' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

const THEME_LABEL: Record<ThemeChoice, string> = { system: 'Theme: follows your system', light: 'Theme: light', dark: 'Theme: dark' };
const THEME_COLOR = { light: '#efe6d2', dark: '#1b1924' };

/** Mirrors the stored choice onto <html data-theme> (the inline script in index.html does it before first paint). */
function useApplyTheme(theme: ThemeChoice) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (theme === 'system') delete root.dataset.theme;
      else root.dataset.theme = theme;
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[dark ? 'dark' : 'light']);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
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
  const theme = useProgress((s) => s.theme);
  const cycleTheme = useProgress((s) => s.cycleTheme);
  const { current } = computeStreak(days);
  const openRules = useUi((s) => s.openRules);
  const onBoss = useLocation().pathname.startsWith('/boss');
  useApplyTheme(theme);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-4">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <GlyphSeal seed="omnidle" size={36} className="transition-transform duration-500 group-hover:rotate-90" />
            <span className="hidden font-display text-lg font-bold tracking-[0.18em] min-[560px]:inline">OMNIDLE</span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-1.5 py-1.5 font-display text-[13px] font-semibold tracking-wider transition min-[400px]:px-2.5 sm:px-3 ${
                    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
                  }`
                }
              >
                {n.short ? (
                  <>
                    <span className="sm:hidden">{n.short}</span>
                    <span className="hidden sm:inline">{n.label}</span>
                  </>
                ) : (
                  n.label
                )}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => openRules(onBoss ? 'boss' : 'daily')}
            title="How to play"
            aria-label="How to play"
            className="grid size-8 place-items-center rounded-md text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            <span className="grid size-[18px] place-items-center rounded-full border-[1.6px] border-current font-display text-[11px] font-bold">?</span>
          </button>
          <button
            type="button"
            onClick={toggleSound}
            title={sound ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-pressed={sound}
            className="rounded-md p-1.5 text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            <SpeakerIcon on={sound} />
          </button>
          <button
            type="button"
            onClick={cycleTheme}
            title={`${THEME_LABEL[theme]} (click to change)`}
            aria-label={THEME_LABEL[theme]}
            className="rounded-md p-1.5 text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            <ThemeIcon theme={theme} />
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
      <RulesModal />

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
