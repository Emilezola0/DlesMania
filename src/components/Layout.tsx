import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { computeStreak, dayKey, summarizeDay, useProgress, type ThemeChoice } from '../store/progress';
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
import { RetiredCards } from './RetiredCards';
import { AlbumNews } from './AlbumNews';
import { BirthdayReward } from './BirthdayReward';
import { todayKey } from '../lib/date';
import { AvatarFrame, useWornFrame } from '../casino/Frame';
import { useFr, useT } from '../lib/i18n';

/** Every game outside the daily and the bosses lives under "Games" (see src/pages/GamesHub.tsx). */
export const GAME_PATHS = ['/games', '/whos-that', '/specialist', '/rank', '/higher-lower', '/jlpt', '/name-them-all', '/guess-the-year', '/rail-rush', '/memory', '/odd-one-out', '/who-am-i', '/wordle', '/quick-sort', '/six-degrees', '/expedition', '/map-quiz', '/crossroads', '/summit', '/shop'];

const NAV = [
  { to: '/daily', label: 'Daily', fr: 'Du jour' },
  { to: '/play', label: 'Free Play', short: 'Play', fr: 'Jeu libre', shortFr: 'Libre' },
  { to: '/boss', label: 'Boss Battle', short: 'Boss', fr: 'Combat de boss', shortFr: 'Boss' },
  { to: '/games', label: 'Games', also: GAME_PATHS, fr: 'Jeux' },
  { to: '/album', label: 'Album', also: ['/trades'] },
  { to: '/casino', label: 'Casino' },
  // Two small figures, as the Archive is a calendar: the bars have no room for one more word.
  { to: '/friends', label: 'Friends', phoneIcon: true, fr: 'Amis' },
  // The archive: a small calendar, today's date on it.
  { to: '/archive', label: 'Archive', icon: true, fr: 'Archives' },
] as { to: string; label: string; short?: string; fr?: string; shortFr?: string; also?: string[]; icon?: boolean; phoneIcon?: boolean }[];
/** A menu entry's name in the player's language. */
const navLabel = (n: (typeof NAV)[number], fr: boolean) => (fr && n.fr) || n.label;
const navShort = (n: (typeof NAV)[number], fr: boolean) => (fr ? n.shortFr ?? n.fr : n.short) ?? n.label;

/** Two small figures, side by side: Friends, in the phones' bottom bar. */
function FriendsIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.9-3.2 3.2-4.9 6-4.9s5.1 1.7 6 4.9" />
      <circle cx="16.5" cy="9.5" r="2.6" />
      <path d="M16.2 14.6c2.3.1 4 1.6 4.8 4.4" />
    </svg>
  );
}

/** A little calendar page with today's day on it: the Archive. */
export function CalendarIcon({ className = 'size-[22px]' }: { className?: string }) {
  const day = Number(todayKey().slice(8));
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <text x="12" y="18.2" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
        {day}
      </text>
    </svg>
  );
}

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

const THEME_LABEL: Record<ThemeChoice, [string, string]> = {
  system: ['Theme: follows your system', 'Thème : celui du système'],
  light: ['Theme: light', 'Thème : clair'],
  dark: ['Theme: dark', 'Thème : sombre'],
};
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
  const t = useT();
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
        title={t('Sound and volume', 'Son et volume')}
        aria-label={t('Sound and volume', 'Son et volume')}
        aria-expanded={open}
        className="rounded-md p-1 text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:p-1.5"
      >
        <SpeakerIcon on={!muted} />
      </button>
      {open && (
        <div className="animate-pop absolute right-0 top-full z-40 mt-2 w-60 space-y-3 rounded-md border border-rule-strong bg-card p-4 shadow-2xl">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {t('Sound effects', 'Effets sonores')}
            <input type="checkbox" checked={sound} onChange={toggleSound} className="size-4 accent-[var(--color-accent,currentColor)]" />
          </label>
          {slider(t('Effects volume', 'Volume des effets'), 'sfxVolume', sfxVolume, 200, !sound)}
          {slider(t('Clips & voices', 'Clips et voix'), 'clipVolume', clipVolume, 100)}
          <p className="text-[11px] leading-snug text-ink-faint">
            {t(
              'Effects can be boosted up to 200%. Clips & voices (soundtracks, voice lines, laughs) play through YouTube, which stops at 100%.',
              "Les effets peuvent monter jusqu'à 200 %. Clips et voix (bandes-son, répliques, rires) passent par YouTube, qui s'arrête à 100 %.",
            )}
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
/** Whether a win's moment is playing (html.moment-on): read here without loading the card catalogue. */
function useMomentOn(): boolean {
  const [on, setOn] = useState(() => document.documentElement.classList.contains('moment-on'));
  useEffect(() => {
    const html = document.documentElement;
    const watch = new MutationObserver(() => setOn(html.classList.contains('moment-on')));
    watch.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => watch.disconnect();
  }, []);
  return on;
}
const AvatarIcon = lazy(() => cardLayers().then((m) => ({ default: m.AvatarIcon })));
// The name (in its Boutique style) and title beside the icon: lazy, as titles need the cards.
const ProfileTag = lazy(() => import('../casino/ProfileTag').then((m) => ({ default: m.ProfileTag })));

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
  const frame = useWornFrame();
  const signedIn = !!email && status !== 'signedOut';
  const t = useT();
  const dot = status === 'synced' ? 'bg-hit' : status === 'syncing' ? 'bg-ochre animate-pulse' : status === 'error' ? 'bg-coral' : status === 'offline' ? 'bg-ink-faint' : '';
  return (
    <Link
      to="/account"
      title={signedIn ? t(`Signed in as ${email}`, `Connecté : ${email}`) : t('Sign in to play on all your devices', 'Connecte-toi pour jouer sur tous tes appareils')}
      aria-label={t('Account', 'Compte')}
      className="relative grid size-7 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:size-8"
    >
      {avatar ? (
        <Suspense fallback={<span className="size-6 rounded-full bg-tile min-[420px]:size-7" />}>
          <AvatarFrame frame={frame}>
            <AvatarIcon id={avatar} className="size-6 min-[420px]:size-7" />
          </AvatarFrame>
        </Suspense>
      ) : signedIn ? (
        <AvatarFrame frame={frame}>
          <span className="grid size-6 place-items-center rounded-full bg-accent font-display text-xs font-bold uppercase text-on-strong">{(name ?? email ?? '?')[0]}</span>
        </AvatarFrame>
      ) : (
        // No card, not signed in: the plain figure, in its frame if one is worn.
        <AvatarFrame frame={frame}>
          <span className="grid size-6 place-items-center">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20c1.2-3.6 4-5.4 7.2-5.4s6 1.8 7.2 5.4" />
            </svg>
          </span>
        </AvatarFrame>
      )}
      {signedIn && dot && <span className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-paper ${dot}`} />}
    </Link>
  );
}

/** The DleCoin balance, to the Card Shop; coins just earned float up from it. */
function CoinChip() {
  const coins = useProgress((s) => s.coins);
  const t = useT();
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
      title={t('DleCoins — the Card Shop', 'DleCoins — la boutique de cartes')}
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

/**
 * Space and Enter go on to the next question in every game: once a round is over, they press its "next"
 * button (marked data-next) — never while typing in a field, nor over a button that has the focus (it
 * answers them itself).
 */
function useNextKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // Nor with the Enter that sent the last answer: the round ends while the key is still on its way (the field
      // it was typed in is gone by then), and the answer must stay on screen until the player moves on.
      const field = 'input, textarea, select, button, a[href], [role="button"]';
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && t !== document.body && (t.isContentEditable || t.matches(field) || !t.isConnected)) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.isContentEditable || a.matches(field))) return;
      const next = [...document.querySelectorAll<HTMLButtonElement>('[data-next]')].filter((b) => !b.disabled && b.offsetParent !== null).at(-1);
      if (!next) return;
      e.preventDefault();
      next.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** How many times, and how long apart (ms), a picture of the site's own that failed to load is tried again. */
const IMAGE_RETRIES = 3;
const IMAGE_RETRY_MS = 3000;

/**
 * A picture served with the site (public/art…) that fails to load is tried again a few seconds later, a few
 * times: right after an update the site can be missing its files for a minute, and a slow connection can
 * drop one. Pictures from elsewhere are left to their own fallbacks.
 */
function useImageRetry() {
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.src) return;
      const url = new URL(img.src, window.location.href);
      if (url.origin !== window.location.origin) return;
      const tries = Number(url.searchParams.get('retry') ?? 0);
      if (tries >= IMAGE_RETRIES) return;
      window.setTimeout(() => {
        // Still the same picture (not swapped for another meanwhile): ask for it again, past any cache.
        if (!img.isConnected || new URL(img.src, window.location.href).pathname !== url.pathname) return;
        url.searchParams.set('retry', String(tries + 1));
        img.src = url.toString();
      }, IMAGE_RETRY_MS * (tries + 1));
    };
    // Load errors don't bubble: caught on their way down.
    window.addEventListener('error', onError, true);
    return () => window.removeEventListener('error', onError, true);
  }, []);
}

/**
 * The top bar slips away while the page scrolls down (more room to play) and comes back as soon as it scrolls
 * up, wherever that is: no need to go all the way back to the top. Near the top, and while it has focus, it stays.
 */
function useHeaderHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setHidden(false), [pathname]);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - last;
        // A few pixels either way are a jitter, not a scroll.
        if (Math.abs(dy) < 6) return;
        last = y;
        const inside = document.querySelector('header')?.contains(document.activeElement);
        setHidden(dy > 0 && y > 120 && !inside);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return hidden;
}

export function Layout() {
  useNextKey();
  useImageRetry();
  const days = useProgress((s) => s.days);
  const sound = useProgress((s) => s.sound);
  const toggleSound = useProgress((s) => s.toggleSound);
  const theme = useProgress((s) => s.theme);
  const cycleTheme = useProgress((s) => s.cycleTheme);
  const { current } = computeStreak(days);
  const openRules = useUi((s) => s.openRules);
  const { pathname } = useLocation();
  // Today's dailies not all done (Music doesn't count, the owner's call): the Daily link stands out.
  const dailyLeft = (['games', 'anime', 'cinema'] as const).some((d) => !summarizeDay(days[dayKey(d, todayKey())]).complete);
  const onBoss = pathname.startsWith('/boss');
  const headerHidden = useHeaderHidden();
  useApplyTheme(theme);
  // A card on show, or a franchise's theme picked outright.
  const equipped = useProgress((s) => !!(s.avatar || s.backdrop || (s.uiTheme && s.uiTheme !== 'icon' && s.uiTheme !== 'off') || s.rotation?.avatar?.cards.length || s.rotation?.backdrop?.cards.length));
  // A win's video still playing keeps the card layers there, though the last card was just taken off: only a refresh
  // stops one (html.moment-on, set by CardReactions while it lasts).
  const momentOn = useMomentOn();
  const fr = useFr();
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip max-sm:pb-14">
      {(equipped || momentOn) && (
        <Suspense fallback={null}>
          <CardLayers />
        </Suspense>
      )}
      <header data-site-header className={`sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${headerHidden ? '-translate-y-full' : ''}`}>
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-3 py-2.5 min-[420px]:gap-2 min-[420px]:px-4">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <GlyphSeal seed="omnidle" size={36} className="transition-transform duration-500 group-hover:rotate-90" />
            <span data-logo className="hidden font-display text-lg font-bold tracking-[0.18em] min-[560px]:inline sm:hidden lg:inline">OMNIDLE</span>
          </NavLink>
          <nav className="ml-auto hidden items-center gap-1 text-sm sm:flex sm:gap-0 lg:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive: exact }) => {
                  const isActive = exact || !!n.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
                  return `whitespace-nowrap border-b-2 px-1 py-1.5 font-display text-[12px] font-semibold tracking-normal transition min-[420px]:px-2 min-[420px]:text-[13px] min-[420px]:tracking-wider sm:px-1 sm:tracking-normal lg:px-[7px] lg:tracking-wider ${
                    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
                  } ${n.to === '/daily' && dailyLeft ? 'nav-daily-left' : ''}`;
                }}
                title={n.icon || n.phoneIcon ? navLabel(n, fr) : undefined}
                aria-label={n.icon || n.phoneIcon ? navLabel(n, fr) : undefined}
              >
                {n.icon ? (
                  <CalendarIcon className="-my-1 size-[22px]" />
                ) : n.phoneIcon ? (
                  <FriendsIcon className="-my-1 size-[22px]" />
                ) : n.short ? (
                  <>
                    <span className="xl:hidden">{navShort(n, fr)}</span>
                    <span className="hidden xl:inline">{navLabel(n, fr)}</span>
                  </>
                ) : (
                  navLabel(n, fr)
                )}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => openRules(onBoss ? 'boss' : 'daily')}
            title={t('How to play', 'Comment jouer')}
            aria-label={t('How to play', 'Comment jouer')}
            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-tile hover:text-ink max-sm:ml-auto min-[420px]:size-8"
          >
            <span className="grid size-[18px] place-items-center rounded-full border-[1.6px] border-current font-display text-[11px] font-bold">?</span>
          </button>
          <SoundMenu sound={sound} toggleSound={toggleSound} />
          <NameLangSwitch display="inline-flex sm:hidden lg:inline-flex" />
          <button
            type="button"
            onClick={cycleTheme}
            title={`${t(...THEME_LABEL[theme])} ${t('(click to change)', '(clique pour changer)')}`}
            aria-label={t(...THEME_LABEL[theme])}
            className="rounded-md p-1 text-ink-soft transition hover:bg-tile hover:text-ink min-[420px]:p-1.5"
          >
            <ThemeIcon theme={theme} />
          </button>
          <span
            title={t('Days in a row with at least one category completed', "Jours d'affilée avec au moins une catégorie terminée")}
            className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-bold lg:flex ${
              current > 0 ? 'border-coral/60 bg-coral/10 text-coral' : 'border-rule-strong text-ink-faint'
            }`}
          >
            <FlameIcon /> {current}
          </span>
          <CoinChip />
          <AccountButton />
          <Suspense fallback={null}>
            <ProfileTag className="hidden max-w-[5.5rem] min-[380px]:max-sm:flex xl:flex xl:max-w-[8.5rem]" />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      {/* Phones: the menu along the bottom, within reach of a thumb. */}
      <nav className="phone-tabs fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label={t('Main menu', 'Menu principal')}>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive: exact }) => {
              const isActive = exact || !!n.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
              return `${n.icon || n.phoneIcon ? 'grid flex-none place-items-center px-3' : 'flex-1'} border-t-2 py-3 text-center font-display text-xs font-semibold ${isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft'} ${n.to === '/daily' && dailyLeft ? 'nav-daily-left' : ''}`;
            }}
            aria-label={n.icon || n.phoneIcon ? navLabel(n, fr) : undefined}
          >
            {n.icon ? <CalendarIcon className="size-5" /> : n.phoneIcon ? <FriendsIcon /> : navShort(n, fr)}
          </NavLink>
        ))}
      </nav>
      <RulesModal />
      <UpdateBanner />
      <GradeBackPay />
      <RetiredCards />
      <AlbumNews />
      <BirthdayReward />

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-ink-faint">
        <Ornament className="mb-4" />
        <p className="font-serif text-sm italic">
          {t(
            'Omnidle — a daily pop-culture challenge across games, anime, cinema & music. Progress is saved in your browser.',
            'Omnidle — un défi quotidien de culture pop : jeux vidéo, anime, cinéma et musique. La progression est sauvegardée dans ton navigateur.',
          )}
        </p>
        <p className="mt-1">
          {t(
            'A free fan project, not affiliated with any of these companies; all works, images and clips belong to their respective owners.',
            'Un projet de fan gratuit, sans lien avec aucune de ces sociétés ; les œuvres, images et clips appartiennent à leurs propriétaires respectifs.',
          )}
        </p>
        <p className="mt-1">
          {t('Own something shown here and want it removed?', "Quelque chose qui t'appartient est montré ici et tu veux qu'il soit retiré ?")}{' '}
          <a href="https://github.com/Emilezola0/DlesMania/issues" target="_blank" rel="noreferrer" className="underline hover:text-ink">
            {t('Tell us', 'Dis-le-nous')}
          </a>{' '}
          {t('and it will be taken down.', 'et ce sera retiré.')}
        </p>
        <p className="mt-2 font-display tracking-wider opacity-70">v{__APP_RELEASE__}</p>
      </footer>
    </div>
  );
}
