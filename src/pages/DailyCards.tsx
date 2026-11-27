// The day's dailies (DailyHub: the title, the four categories' cards with today's progress, the Specialist's card): the
// home page and /daily. Kept apart from the Daily page (src/pages/Daily.tsx) so the home page doesn't load every game and
// every Specialist round.
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { DOMAINS } from '../data/domains';
import { FlameIcon } from '../components/Layout';
import { Glyph, GlyphSeal, Ornament } from '../components/Glyph';
import { formatLong, msUntilTomorrow, todayKey } from '../lib/date';
import { RulesButton } from '../components/RulesModal';
import { useUi } from '../store/ui';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { useT } from '../lib/i18n';
import { computeStreak, dayKey, specialStreak, summarizeDay, useProgress } from '../store/progress';
import { UNIVERSES, UNIVERSE_BANNER, isFeatured } from '../specialist/universes';

/** Time left before the next dailies (midnight), ticking. */
function NextDaily() {
  const [ms, setMs] = useState(msUntilTomorrow);
  useEffect(() => {
    const tick = window.setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return <span className="font-mono tabular-nums">{pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>;
}

/** The day's dailies: the home page, and /daily. */
export function DailyHub() {
  const today = todayKey();
  const t = useT();
  const days = useProgress((s) => s.days);
  const done = DOMAINS.filter((d) => summarizeDay(days[dayKey(d.id, today)]).complete).length;
  // The Specialist lives with the other games: here only for a player who knows the rest (past the drawer).
  const fullSide = useUi((s) => s.fullSide);
  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-card/70 px-3 py-1 text-xs font-semibold text-ink-soft';
  return (
    <div className="space-y-10">
      {/* Centred, without the day's number (the owner's call): the date says which day it is. */}
      <header className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex items-center gap-3" aria-hidden>
          {DOMAINS.map((d) => (
            <Glyph key={d.id} seed={d.id} size={20} className={d.tone} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-display text-xs tracking-[0.3em] text-ink-faint">{formatLong(today).toUpperCase()}</p>
          <h1 className="daily-title text-5xl font-bold leading-none sm:text-6xl">{t('Daily', 'Défi du jour')}</h1>
        </div>
        <Ornament className="w-full max-w-xs" />
        <p className="mx-auto max-w-xl font-serif text-lg italic leading-relaxed text-ink-soft">
          {t('Four independent challenges, ten mini-games each. Same puzzles for everyone, reset at midnight.', 'Quatre défis indépendants, dix mini-jeux chacun. Les mêmes énigmes pour tout le monde, remises à zéro à minuit.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className={`${chip} ${done === DOMAINS.length ? 'border-hit/60 text-hit' : ''}`}>
            {done === DOMAINS.length ? '✓ ' : ''}
            {t(`${done}/${DOMAINS.length} done today`, `${done}/${DOMAINS.length} faits aujourd’hui`)}
          </span>
          <span className={chip}>
            {t('Next in', 'Prochain dans')} <NextDaily />
          </span>
          <RulesButton tab="daily" label={t('How to play', 'Règles du jeu')} className="rounded-full bg-card/70 py-1" />
        </div>
      </header>
      <DailyCards />
      {fullSide && <SpecialistCard />}
    </div>
  );
}

/** One card per category with today's progress. */
export function DailyCards() {
  const days = useProgress((s) => s.days);
  const today = todayKey();
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DOMAINS.map((d) => {
        const rounds = days[dayKey(d.id, today)];
        const sum = summarizeDay(rounds);
        const streak = computeStreak(days, d.id).current;
        // The category's own colour (its glyph's): the glow behind the seal, the light round the card when pointed at.
        const tone = { '--tone': `var(--color-${d.fill.replace('bg-', '')})` } as CSSProperties;
        const action = sum.complete ? t('See results', 'Voir les résultats') : sum.finished ? t('Continue', 'Continuer') : t('Play', 'Jouer');
        return (
          <Link
            key={d.id}
            to={`/daily/${d.id}`}
            style={tone}
            className={`daily-card page group isolate rounded-md p-6 transition duration-300 hover:-translate-y-1 ${sum.complete ? 'daily-card-done' : ''}`}
          >
            <span className="daily-card-wash pointer-events-none absolute inset-0 -z-10 rounded-md" aria-hidden />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <GlyphSeal seed={d.id} size={52} tone={d.tone} className="transition-transform duration-500 group-hover:rotate-45" />
                <div>
                  <p className="font-serif text-2xl font-bold leading-tight">{d.label}</p>
                  <p className="font-display text-[11px] tracking-[0.2em] text-ink-faint">
                    {sum.complete ? t('COMPLETED', 'TERMINÉ') : sum.finished ? t(`${sum.finished} OF 10 PLAYED`, `${sum.finished} SUR 10 JOUÉS`) : t('NOT STARTED', 'PAS COMMENCÉ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-4xl font-bold tabular-nums leading-none">{sum.score}</p>
                <p className="text-xs text-ink-faint">/ {MAX_DAILY_SCORE}</p>
                {streak > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-coral">
                    <FlameIcon /> {streak}
                  </p>
                )}
              </div>
            </div>
            {/* The ten rounds: won in the category's colour, lost in red, still to play left grey. */}
            <div className="mt-5 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => {
                const status = rounds?.[i]?.status;
                return <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${status === 'won' ? d.fill : status === 'lost' ? 'bg-miss/60' : 'bg-tile-strong'}`} />;
              })}
            </div>
            <p className="mt-3 flex items-center justify-end gap-1 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--tone)] opacity-75 transition group-hover:opacity-100">
              {action} <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The Specialist under the four categories: its own daily in each universe, the owner's four most important (League
 * of Legends, One Piece, Overwatch, Dragon Ball) in gold, each on its banner (blurred, as on the Specialist page) with today's progress, and the way to every universe. On the home page too.
 */
export function SpecialistCard() {
  const special = useProgress((s) => s.special);
  const today = todayKey();
  const featured = UNIVERSES.filter((u) => isFeatured(u.id));
  const t = useT();
  return (
    <section className="page space-y-4 rounded-md p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[11px] tracking-[0.25em] text-ink-faint">{t('ONE UNIVERSE, EVERY ANGLE', 'UN UNIVERS, SOUS TOUS LES ANGLES')}</p>
          <h2 className="font-serif text-3xl font-bold leading-tight">{t('Specialist', 'Spécialiste')}</h2>
          <p className="text-sm text-ink-soft">{t(`A daily of its own in each of ${UNIVERSES.length} universes: rounds made only from it.`, `Un défi du jour à part dans chacun des ${UNIVERSES.length} univers : des manches faites uniquement de lui.`)}</p>
        </div>
        <Link to="/specialist" className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold">
          {t('Every universe →', 'Tous les univers →')}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {featured.map((u) => {
          const done = Object.values(special[`${u.id}:${today}`] ?? {}).filter((r) => r.status !== 'playing').length;
          const streak = specialStreak(special, u.id, u.types.length);
          const banner = UNIVERSE_BANNER[u.id];
          return (
            <Link key={u.id} to={`/specialist/${u.id}`} className="golden-ready group relative isolate flex min-h-24 flex-col justify-between gap-1 overflow-hidden rounded-md bg-gradient-to-br from-[#fde68a]/15 to-transparent p-4 transition hover:-translate-y-0.5">
              {/* The universe's banner, blurred behind it (as on the Specialist page), a little clearer when pointed at. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                {banner && <img src={banner} alt="" loading="lazy" draggable={false} className="size-full scale-110 object-cover opacity-60 blur-[3px] transition duration-500 group-hover:opacity-75 group-hover:blur-[2px]" />}
                <span className="absolute inset-0 bg-gradient-to-br from-card/85 via-card/60 to-card/35" />
              </span>
              <span className="golden-text font-display text-lg font-bold leading-tight">★ {u.label}</span>
              <span className="flex items-center justify-between text-xs text-ink-faint">
                {done >= u.types.length ? t('Today: done', 'Aujourd’hui : fait') : done ? t(`Today: ${done}/${u.types.length}`, `Aujourd’hui : ${done}/${u.types.length}`) : t('Today: not started', 'Aujourd’hui : pas commencé')}
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-coral">
                    <FlameIcon /> {streak}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

