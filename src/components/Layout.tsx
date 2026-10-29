import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { computeStreak, useProgress, type ThemeChoice } from '../store/progress';
import { useUi } from '../store/ui';
import { NameLangSwitch } from './NameLangSwitch';
import { DleCoin } from './DleCoin';
import { useCloud } from '../cloud/state';
import { Spinner } from './Spinner';
import { sfx } from '../lib/sfx';
import { GlyphSeal, Ornament } from './Glyph';
import { RulesModal } from './RulesModal';
import { UpdateBanner } from './UpdateBanner';
import { GradeBackPay } from './GradeBackPay';

/** Every game outside the daily and the bosses lives under "Games" (see src/pages/GamesHub.tsx). */
export const GAME_PATHS = ['/games', '/whos-that', '/specialist', '/rank', '/higher-lower', '/name-them-all', '/guess-the-year', '/rail-rush', '/memory', '/odd-one-out', '/who-am-i', '/wordle', '/quick-sort', '/six-degrees', '/expedition', '/map-quiz', '/crossroads', '/summit', '/shop', '/album', '/trades'];

const NAV = [
  { to: '/daily', label: 'Daily' },
  { to: '/play', label: 'Free Play', short: 'Play' },
  { to: '/boss', label: 'Boss Battle', short: 'Boss' },
  { to: '/games', label: 'Games', also: GAME_PATHS },
  // On the narrowest phones there's no room for every entry; the archive is still one tap away from each daily.
  { to: '/archive', label: 'Archive', wideOnly: true },
] as { to: string; label: string; short?: string; wideOnly?: boolean; also?: string[] }[];

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

/** The speaker button: opens a small panel to switch effects on or off and set both volumes. */
function SoundMenu({ sound, toggleSound }: { sound: boolean; toggleSound: () => void }) {
  const [open, setOpen] = useState(false);
  const sfxVolume = useProgress((s) => s.sfxVolume);
  const clipVolume = useProgress((s) => s.clipVolume);
  const setVolume = useProgress((s) => s.setVolume);
  const box = useRef<HTMLDivElement>(null);
  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  const muted = !sound || sfxVolume === 0;
  const slider = (label: string, kind: 'sfxVolume' | 'clipVolume', value: number, max: number, disabled = false) => (
    <label className={`block space-y-1 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex justify-between font-display text-[11px] uppercase tracking-widest text-ink-faint">
        {label} <span className={`tabular-nums ${value > 100 ? 'font-bold text-coral' : ''}`}>{value}%{value > 100 ? ' boost' : ''}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(e) => setVolume(kind, Number(e.target.value))}
        // Effects: a click to hear the new level.
        onPointerUp={() => kind === 'sfxVolume' && sfx.click()}
        className="w-full accent-[var(--color-accent,currentColor)]"
      />
    </label>
  );
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Sound and volume"
        aria-label="Sound and volume"
        aria-expanded={open}
        className="rounded-md p-1 text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:p-1.5"
      >
        <SpeakerIcon on={!muted} />
      </button>
      {open && (
        <div className="animate-pop absolute right-0 top-full z-40 mt-2 w-60 space-y-3 rounded-md border border-rule-strong bg-card p-4 shadow-2xl">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Sound effects
            <input type="checkbox" checked={sound} onChange={toggleSound} className="size-4 accent-[var(--color-accent,currentColor)]" />
          </label>
          {slider('Effects volume', 'sfxVolume', sfxVolume, 200, !sound)}
          {slider('Clips & voices', 'clipVolume', clipVolume, 100)}
          <p className="text-[11px] leading-snug text-ink-faint">
            Effects can be boosted up to 200%. Clips & voices (soundtracks, voice lines, laughs) play through YouTube, which stops at 100%.
          </p>
        </div>
      )}
    </div>
  );
}

// The equipped cards (icon, background, reactions, aura) and the card catalogue behind them: only
// downloaded once a card is equipped.
const cardLayers = () => import('../gacha/LayoutCards');
const CardLayers = lazy(() => cardLayers().then((m) => ({ default: m.CardLayers })));
const AvatarIcon = lazy(() => cardLayers().then((m) => ({ default: m.AvatarIcon })));

/** While a page's code arrives: a quiet spinner where the page will be. */
function PageLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner />
    </div>
  );
}

/** The account: a person when signed out, the player's initial when in, with a dot for the save's state. */
function AccountButton() {
  const { status, email, name } = useCloud();
  const avatar = useProgress((s) => (s.avatar && s.cards[s.avatar] ? s.avatar : null));
  const signedIn = !!email && status !== 'signedOut';
  const dot = status === 'synced' ? 'bg-hit' : status === 'syncing' ? 'bg-ochre animate-pulse' : status === 'error' ? 'bg-coral' : status === 'offline' ? 'bg-ink-faint' : '';
  return (
    <Link
      to="/account"
      title={signedIn ? `Signed in as ${email}` : 'Sign in to play on all your devices'}
      aria-label="Account"
      className="relative grid size-7 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:size-8"
    >
      {avatar ? (
        <Suspense fallback={<span className="size-6 rounded-full bg-tile min-[420px]:size-7" />}>
          <AvatarIcon id={avatar} className="size-6 min-[420px]:size-7" />
        </Suspense>
      ) : signedIn ? (
        <span className="grid size-6 place-items-center rounded-full bg-accent font-display text-xs font-bold uppercase text-on-strong">{(name ?? email ?? '?')[0]}</span>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M4.8 20c1.2-3.6 4-5.4 7.2-5.4s6 1.8 7.2 5.4" />
        </svg>
      )}
      {signedIn && dot && <span className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-paper ${dot}`} />}
    </Link>
  );
}

/** The DleCoin balance, to the Card Shop; coins just earned float up from it. */
function CoinChip() {
  const coins = useProgress((s) => s.coins);
  const last = useRef(coins);
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const d = coins - last.current;
    last.current = coins;
    if (d <= 0) return;
    setGain({ n: d, key: Date.now() });
    const t = window.setTimeout(() => setGain(null), 1600);
    return () => window.clearTimeout(t);
  }, [coins]);
  return (
    <Link
      to="/shop"
      title="DleCoins — the Card Shop"
      className="relative flex shrink-0 items-center gap-1 rounded-full border border-ochre/60 bg-ochre/10 px-2 py-0.5 text-sm font-bold tabular-nums text-ink transition hover:bg-ochre/20 min-[420px]:px-2.5 min-[420px]:py-1"
    >
      <DleCoin className="size-4" />
      <span className="hidden min-[380px]:inline">{coins.toLocaleString('en')}</span>
      {gain && (
        <span key={gain.key} className="coin-gain pointer-events-none absolute -bottom-5 right-0 whitespace-nowrap font-display text-xs font-bold text-ochre">
          +{gain.n}
        </span>
      )}
    </Link>
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
  const { pathname } = useLocation();
  const onBoss = pathname.startsWith('/boss');
  useApplyTheme(theme);
  const equipped = useProgress((s) => !!(s.avatar || s.backdrop));

  return (
    <div className="flex min-h-screen flex-col">
      {equipped && (
        <Suspense fallback={null}>
          <CardLayers />
        </Suspense>
      )}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-3 py-2.5 min-[420px]:gap-2 min-[420px]:px-4 sm:gap-4">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <GlyphSeal seed="omnidle" size={36} className="transition-transform duration-500 group-hover:rotate-90" />
            <span data-logo className="hidden font-display text-lg font-bold tracking-[0.18em] min-[560px]:inline">OMNIDLE</span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive: exact }) => {
                  const isActive = exact || !!n.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
                  return `${n.wideOnly ? 'hidden min-[420px]:block' : ''} whitespace-nowrap border-b-2 px-1 py-1.5 font-display text-[12px] font-semibold tracking-normal transition min-[420px]:px-2 min-[420px]:text-[13px] min-[420px]:tracking-wider sm:px-2 lg:px-3 ${
                    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
                  }`;
                }}
              >
                {n.short ? (
                  <>
                    <span className="xl:hidden">{n.short}</span>
                    <span className="hidden xl:inline">{n.label}</span>
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
            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:size-8"
          >
            <span className="grid size-[18px] place-items-center rounded-full border-[1.6px] border-current font-display text-[11px] font-bold">?</span>
          </button>
          <SoundMenu sound={sound} toggleSound={toggleSound} />
          <NameLangSwitch display="hidden lg:inline-flex" />
          <button
            type="button"
            onClick={cycleTheme}
            title={`${THEME_LABEL[theme]} (click to change)`}
            aria-label={THEME_LABEL[theme]}
            className="rounded-md p-1 text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:p-1.5"
          >
            <ThemeIcon theme={theme} />
          </button>
          <span
            title="Days in a row with at least one category completed"
            className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-bold lg:flex ${
              current > 0 ? 'border-coral/60 bg-coral/10 text-coral' : 'border-rule-strong text-ink-faint'
            }`}
          >
            <FlameIcon /> {current}
          </span>
          <CoinChip />
          <AccountButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <RulesModal />
      <UpdateBanner />
      <GradeBackPay />

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-ink-faint">
        <Ornament className="mb-4" />
        <p className="font-serif text-sm italic">
          Omnidle — a daily pop-culture challenge across games, anime, cinema &amp; music. Progress is saved in your browser.
        </p>
        <p className="mt-1">A fan project; all works, images and clips belong to their respective owners.</p>
        <p className="mt-1 text-[11px]">
          Mythic Howitzer's shot: “Sexton artillery firing” by LouiseBrown1981,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Sexton_artillery_firing.oga" className="underline" target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
          ,{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline" target="_blank" rel="noreferrer">
            CC BY-SA 3.0
          </a>
          , cut to the shot.
        </p>
      </footer>
    </div>
  );
}
