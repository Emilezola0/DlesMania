import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sfx } from '../lib/sfx';
import { useT } from '../lib/i18n';
import { GlyphSeal } from './Glyph';

/** What waits past the drawer, shown on its open face (a reminder, not links: the whole drawer is one). */
const BEYOND: [string, string][] = [
  ['Free Play', 'Jeu libre'],
  ['Boss Battle', 'Combat de boss'],
  ['Games', 'Jeux'],
  ['Album', 'Album'],
  ['Casino', 'Casino'],
];

type StartViewTransition = (update: () => Promise<void>) => { finished: Promise<void> };

/** Until the new page has drawn (past its spinner, if its code was still on its way), at most a little over a second. */
async function pageSettled() {
  // (A frame, or a moment where frames are paused: a tab in the background.)
  const frame = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });
  await frame();
  await frame();
  const until = performance.now() + 1200;
  while (document.querySelector('[data-page-loading]') && performance.now() < until) await new Promise((r) => setTimeout(r, 40));
}

/**
 * The portal's light (its ring and its glow), put in the page for the new side's snapshot only: its own
 * view-transition-name lifts it above the two pages, where index.css opens it out from the drawer and fades it.
 */
function addPortal(kind: 'open' | 'close'): HTMLElement[] {
  const portal = document.createElement('div');
  portal.className = 'drawer-portal';
  portal.setAttribute('aria-hidden', 'true');
  portal.innerHTML = '<span class="drawer-portal-glow"></span><span class="drawer-portal-ring"></span>';
  document.body.append(portal);
  if (kind === 'open') return [portal];
  // Closing: the burst of light as it snaps shut.
  const flash = document.createElement('div');
  flash.className = 'drawer-flash';
  flash.setAttribute('aria-hidden', 'true');
  document.body.append(flash);
  return [portal, flash];
}

/**
 * Through the drawer as into another dimension, a view transition of the whole page animated in index.css
 * (html[data-drawer]), centred on the drawer's edge (--drawer-x/y). Opening: the dailies are drawn into the drawer,
 * twisting and blurring, a ring of light opens out of it and the rest of the site comes through it. Closing: the full
 * side is swallowed by the left edge, whirling, the ring tightening with it, and the portal snaps shut in a flash that lights
 * up the dailies behind. Where there's no view transition (or motion is reduced) the link simply goes there.
 */
function useDrawerLink(to: string, kind: 'open' | 'close') {
  const navigate = useNavigate();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    sfx.click();
    // A new tab or window: the browser's own.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
    if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    const html = document.documentElement;
    // The portal's centre: the strip that peeks out (on the right edge to open, the left one to close).
    const edge = e.currentTarget.getBoundingClientRect();
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    const x = kind === 'open' ? w - 8 : 8;
    const y = Math.round(edge.top + edge.height / 2);
    // How far the portal must open to fill the whole screen: to its farthest corner (and a little past it). The ring's
    // box is sized so that, at its last scale (4.5), its band (0.88 of its radius) is that far out.
    const reach = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 32;
    html.style.setProperty('--drawer-x', `${x}px`);
    html.style.setProperty('--drawer-y', `${y}px`);
    html.style.setProperty('--drawer-r', `${reach}px`);
    html.style.setProperty('--portal-d', `${Math.ceil((2 * reach) / (4.5 * 0.88))}px`);
    html.dataset.drawer = kind;
    let portal: HTMLElement[] = [];
    const done = start.call(document, async () => {
      navigate(to);
      window.scrollTo(0, 0);
      portal = addPortal(kind);
      await pageSettled();
    });
    void done.finished.finally(() => {
      portal.forEach((p) => p.remove());
      delete html.dataset.drawer;
    });
  };
}

const EDGE =
  'group fixed z-30 flex h-28 w-56 items-stretch border-rule-strong bg-card text-ink-soft shadow-[0_6px_24px_-12px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none';

/** The strip that peeks out: a grip and the drawer's name, read bottom to top. */
function Grip({ label, side }: { label: string; side: 'left' | 'right' }) {
  return (
    <span className={`flex w-4 shrink-0 flex-col items-center justify-center gap-1.5 border-rule sm:w-[1.375rem] ${side === 'right' ? 'border-r' : 'order-last border-l'}`} aria-hidden>
      <span className="h-5 w-[3px] rounded-full bg-ink-faint/60 transition group-hover:bg-accent" />
      <span className="rotate-180 font-display text-[8px] font-bold uppercase leading-none tracking-[0.18em] text-ink-faint [writing-mode:vertical-rl] group-hover:text-ink sm:text-[9px]">
        {label}
      </span>
    </span>
  );
}

/**
 * On the daily side, a drawer left slightly open on the right edge: a strip of it peeks out (inside the page's margin,
 * clear of the games' controls) and, pointed at or focused, it slides further out. Tapping it opens the drawer: the
 * rest of the site (the games hub, with the full header back) slides in from the right.
 */
export function MoreDrawer() {
  const t = useT();
  const open = useDrawerLink('/games', 'open');
  return (
    <Link
      to="/games"
      onClick={open}
      aria-label={t('Everything else: games, boss, album, casino, account', 'Tout le reste : jeux, boss, album, casino, compte')}
      title={t('Everything else', 'Tout le reste')}
      className={`more-drawer ${EDGE} right-0 translate-x-[calc(100%-1rem)] rounded-l-lg border border-r-0 hover:translate-x-0 focus-visible:translate-x-0 sm:translate-x-[calc(100%-1.375rem)] sm:hover:translate-x-0 sm:focus-visible:translate-x-0`}
    >
      <Grip side="right" label={t('More', 'Plus')} />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3" aria-hidden>
        <span className="flex items-center gap-2 whitespace-nowrap font-display text-sm font-bold text-ink">
          <GlyphSeal seed="omnidle" size={18} />
          {t('Everything else', 'Tout le reste')} <span className="ml-auto transition group-hover:translate-x-0.5">→</span>
        </span>
        <span className="text-[11px] leading-snug text-ink-faint">{BEYOND.map(([en, fr]) => t(en, fr)).join(' · ')}</span>
      </span>
    </Link>
  );
}

/**
 * On the full side, the drawer's other edge, peeking out on the left: tapping it closes the drawer (the full side slides
 * back out to the right) and goes back to the dailies.
 */
export function CloseDrawer() {
  const t = useT();
  const close = useDrawerLink('/', 'close');
  return (
    <Link
      to="/"
      onClick={close}
      aria-label={t('Close: back to the dailies', 'Refermer : retour aux défis du jour')}
      title={t('Back to the dailies', 'Retour aux défis du jour')}
      className={`more-drawer more-drawer-left ${EDGE} left-0 -translate-x-[calc(100%-1rem)] rounded-r-lg border border-l-0 hover:translate-x-0 focus-visible:translate-x-0 sm:-translate-x-[calc(100%-1.375rem)] sm:hover:translate-x-0 sm:focus-visible:translate-x-0`}
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3" aria-hidden>
        <span className="flex items-center gap-2 whitespace-nowrap font-display text-sm font-bold text-ink">
          <span className="transition group-hover:-translate-x-0.5">←</span> {t('The dailies', 'Défis du jour')}
          <GlyphSeal seed="omnidle" size={18} className="ml-auto" />
        </span>
        <span className="text-[11px] leading-snug text-ink-faint">{t('Close the drawer: only the day’s riddles.', 'Refermer le tiroir : rien que les énigmes du jour.')}</span>
      </span>
      <Grip side="left" label={t('Daily', 'Défis')} />
    </Link>
  );
}
