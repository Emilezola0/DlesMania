import { Link } from 'react-router-dom';
import { RulesButton } from '../components/RulesModal';
import { Glyph, GlyphSeal, Ornament } from '../components/Glyph';
import { FlameIcon } from '../components/Layout';
import { DOMAINS, WORKS } from '../data';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { dayNumber, formatLong, todayKey } from '../lib/date';
import { computeStreak, summarizeDay, useProgress } from '../store/progress';
import { DailyCards, SpecialistCard } from './Daily';
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
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link to="/daily" className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('BEGIN TODAY', 'COMMENCER')}
            </Link>
            <Link to="/play" className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('FREE PLAY', 'JEU LIBRE')}
            </Link>
            <Link to="/boss" className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('BOSS BATTLE', 'COMBAT DE BOSS')}
            </Link>
            <Link to="/games" className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-widest">
              {t('MORE GAMES', 'PLUS DE JEUX')}
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
        <SpecialistCard />
      </section>

      <section className="space-y-5">
        <ChapterHeading numeral="II" title={t('The ten mini-games', 'Les dix mini-jeux')} link={{ to: '/play', label: t('Free play →', 'Jeu libre →') }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GAME_TYPES.map((type, i) => (
            <Link key={type} to={`/play?type=${type}`} className="page group rounded-md p-4 transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <GlyphSeal seed={type} size={38} className="transition-transform duration-500 group-hover:rotate-45" />
                <span className="font-display text-[10px] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-3 font-serif text-lg font-bold leading-tight">{GAME_META[type].name}</p>
              <p className="text-xs leading-snug text-ink-faint">{GAME_META[type].tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center font-serif text-base italic text-ink-faint">
        {WORKS.length} {t('works catalogued', 'œuvres répertoriées')} — {DOMAINS.map((d) => `${WORKS.filter((w) => w.domain === d.id).length} ${d.label.toLowerCase()}`).join(', ')}.
      </p>
    </div>
  );
}

function ChapterHeading({ numeral, title, link }: { numeral: string; title: string; link: { to: string; label: string } }) {
  return (
    <div className="flex items-end gap-4 border-b border-rule pb-2">
      <span className="font-display text-sm text-ink-faint">{numeral}.</span>
      <h2 className="text-3xl font-bold">{title}</h2>
      <Link to={link.to} className="ml-auto pb-1 font-display text-xs tracking-wider text-ink-soft hover:text-ink">
        {link.label}
      </Link>
    </div>
  );
}
