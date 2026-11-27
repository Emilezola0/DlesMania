import { Link } from 'react-router-dom';
import { RulesButton } from '../components/RulesModal';
import { Glyph, GlyphSeal, Ornament } from '../components/Glyph';
import { FlameIcon } from '../components/Layout';
import { useEffect, useRef, useState } from 'react';
import { DOMAINS } from '../data/domains';
import type { Work } from '../types';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { dayNumber, formatLong, todayKey } from '../lib/date';
import { computeStreak, summarizeDay, useProgress } from '../store/progress';
import { DailyCards } from './DailyCards';
import { useT } from '../lib/i18n';

export default function Home() {
  const days = useProgress((s) => s.days);
  const streak = computeStreak(days);
  const completed = Object.values(days).filter((d) => summarizeDay(d).complete).length;
  const today = todayKey();
  const t = useT();

  return (
    <div className="space-y-14">
      {/* Title page of the manual. */}
      <section className="page rounded-md px-6 py-10 text-center sm:px-12 sm:py-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <div className="flex items-center gap-3 text-ink-soft">
            {DOMAINS.map((d) => (
              <Glyph key={d.id} seed={d.id} size={22} className={d.tone} />
            ))}
          </div>
          <p className="font-display text-xs tracking-[0.3em] text-ink-faint">
            {formatLong(today).toUpperCase()} · {t('DAILY', 'DÉFI')} №{dayNumber(today)}
          </p>
          <h1 className="text-5xl font-bold leading-[1.02] sm:text-7xl">
            {t('The Book of', 'Le Livre des')}
            <br />
            <span className="italic text-accent">{t('Forty Riddles', 'Quarante Énigmes')}</span>
          </h1>
          <Ornament className="w-full max-w-sm" />
          <p className="max-w-lg font-serif text-xl italic leading-relaxed text-ink-soft">
            {t(
              'Four realms — games, anime, cinema and music. Ten trials each, every day. Decipher them from attributes, quotes, soundtracks, faded images and strange little symbols.',
              'Quatre royaumes — jeux vidéo, anime, cinéma et musique. Dix épreuves chacun, chaque jour. Déchiffre-les à partir d’attributs, de citations, de bandes-son, d’images effacées et d’étranges petits symboles.',
            )}
          </p>
          {/* The daily side: only the dailies here (Free Play, the bosses and the rest are past the drawer on the right). */}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link to="/daily" className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('BEGIN TODAY', 'COMMENCER')}
            </Link>
            <Link to="/archive" className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('PAST DAYS', 'JOURS PASSÉS')}
            </Link>
          </div>
          <RulesButton tab="daily" label={t('How to play', 'Règles du jeu')} />
          <div className="mt-4 grid w-full max-w-md grid-cols-3 divide-x divide-rule border-y border-rule py-3 text-center">
            <div>
              <p className="inline-flex items-center gap-1 font-serif text-3xl font-bold text-coral">
                <FlameIcon className="size-5" /> {streak.current}
              </p>
              <p className="font-display text-[10px] tracking-[0.2em] text-ink-faint">{t('STREAK', 'SÉRIE')}</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-bold">{streak.best}</p>
              <p className="font-display text-[10px] tracking-[0.2em] text-ink-faint">{t('BEST', 'RECORD')}</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-bold">{completed}</p>
              <p className="font-display text-[10px] tracking-[0.2em] text-ink-faint">{t('COMPLETED', 'TERMINÉS')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <ChapterHeading numeral="I" title={t('Today’s trials', 'Les épreuves du jour')} link={{ to: '/archive', label: t('Archive →', 'Archives →') }} />
        <DailyCards />
      </section>

      {/* The kinds of rounds a daily is made of, to know them (playing them freely is Free Play, on the full side). */}
      <section className="space-y-5">
        <ChapterHeading numeral="II" title={t('The mini-games', 'Les mini-jeux')} />
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

function ChapterHeading({ numeral, title, link }: { numeral: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end gap-4 border-b border-rule pb-2">
      <span className="font-display text-sm text-ink-faint">{numeral}.</span>
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
