import { Link } from 'react-router-dom';
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

/**
 * On the daily side, a drawer left slightly open on the right edge: a strip of it peeks out (inside the page's margin,
 * clear of the games' controls) and, pointed at or focused, it slides further out. Tapping it goes to everything else
 * (the games hub, with the full header back).
 */
export function MoreDrawer() {
  const t = useT();
  return (
    <Link
      to="/games"
      onClick={() => sfx.click()}
      aria-label={t('Everything else: games, boss, album, casino, account', 'Tout le reste : jeux, boss, album, casino, compte')}
      title={t('Everything else', 'Tout le reste')}
      className="more-drawer group fixed right-0 z-30 flex h-28 w-56 translate-x-[calc(100%-1rem)] items-stretch rounded-l-lg border border-r-0 border-rule-strong bg-card text-ink-soft shadow-[-6px_6px_24px_-12px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:translate-x-0 focus-visible:translate-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:translate-x-[calc(100%-1.375rem)] sm:hover:translate-x-0 sm:focus-visible:translate-x-0"
    >
      {/* The edge that peeks out: a grip and the drawer's name, read bottom to top. */}
      <span className="flex w-4 shrink-0 flex-col items-center justify-center gap-1.5 border-r border-rule sm:w-[1.375rem]" aria-hidden>
        <span className="more-drawer-grip h-5 w-[3px] rounded-full bg-ink-faint/60 transition group-hover:bg-accent" />
        <span className="font-display text-[8px] font-bold uppercase leading-none tracking-[0.18em] text-ink-faint [writing-mode:vertical-rl] rotate-180 group-hover:text-ink sm:text-[9px]">
          {t('More', 'Plus')}
        </span>
      </span>
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
