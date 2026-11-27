import { Link } from 'react-router-dom';
import { GlyphSeal } from '../components/Glyph';
import { useEffect, useRef, useState } from 'react';
import { DOMAINS } from '../data/domains';
import type { Work } from '../types';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { DailyHub } from './DailyCards';
import { useT } from '../lib/i18n';

export default function Home() {
  const t = useT();

  return (
    <div className="space-y-14">
      {/* The day's dailies, first thing (as on /daily): the four categories, today's progress, the rules. */}
      <DailyHub />

      {/* The kinds of rounds a daily is made of, to know them (playing them freely is Free Play, on the full side). */}
      <section className="space-y-5">
        <ChapterHeading title={t('The mini-games', 'Les mini-jeux')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GAME_TYPES.map((type, i) => (
            <div key={type} className="page group rounded-md p-4">
              <div className="flex items-start justify-between">
                <GlyphSeal seed={type} size={38} className="transition-transform duration-500 group-hover:rotate-45" />
                <span className="font-display text-[10px] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-3 font-serif text-lg font-bold leading-tight">{GAME_META[type].name}</p>
              <p className="text-xs leading-snug text-ink-faint">{GAME_META[type].tagline}</p>
            </div>
          ))}
        </div>
      </section>

      <WorksCount />
    </div>
  );
}

function ChapterHeading({ numeral, title, link }: { numeral?: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end gap-4 border-b border-rule pb-2">
      {numeral && <span className="font-display text-sm text-ink-faint">{numeral}.</span>}
      <h2 className="text-3xl font-bold">{title}</h2>
      {link && (
        <Link to={link.to} className="ml-auto pb-1 font-display text-xs tracking-wider text-ink-soft hover:text-ink">
          {link.label}
        </Link>
      )}
    </div>
  );
}

/**
 * How many works the dailies draw from. The works lists weigh about a megabyte: they're only loaded once this line, at
 * the bottom of the page, comes into view (phones would otherwise download them before anything else).
 */
function WorksCount() {
  const t = useT();
  const [works, setWorks] = useState<Work[] | null>(null);
  const line = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let live = true;
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        void import('../data').then((m) => live && setWorks(m.WORKS));
      },
      { rootMargin: '200px' },
    );
    if (line.current) seen.observe(line.current);
    return () => {
      live = false;
      seen.disconnect();
    };
  }, []);
  return (
    <p ref={line} className="min-h-[1.5em] text-center font-serif text-base italic text-ink-faint">
      {works && (
        <>
          {works.length} {t('works catalogued', 'œuvres répertoriées')} — {DOMAINS.map((d) => `${works.filter((w) => w.domain === d.id).length} ${d.label.toLowerCase()}`).join(', ')}.
        </>
      )}
    </p>
  );
}
