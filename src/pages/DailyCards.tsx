// The four categories' cards with today's progress, and the Specialist's card: on the home page and on /daily. Kept
// apart from the Daily page (src/pages/Daily.tsx) so the home page doesn't load every game and every Specialist round.
import { Link } from 'react-router-dom';
import { DOMAINS } from '../data';
import { FlameIcon } from '../components/Layout';
import { GlyphSeal } from '../components/Glyph';
import { todayKey } from '../lib/date';
import { MAX_DAILY_SCORE } from '../lib/scoring';
import { useT } from '../lib/i18n';
import { computeStreak, dayKey, specialStreak, summarizeDay, useProgress } from '../store/progress';
import { UNIVERSES, isFeatured } from '../specialist/universes';

/** One card per category with today's progress. */
export function DailyCards() {
  const days = useProgress((s) => s.days);
  const today = todayKey();
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DOMAINS.map((d) => {
        const sum = summarizeDay(days[dayKey(d.id, today)]);
        const streak = computeStreak(days, d.id).current;
        return (
          <Link
            key={d.id}
            to={`/daily/${d.id}`}
            className="page group rounded-md p-6 transition hover:-translate-y-1"
          >
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
            <div className="mt-5 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < sum.finished ? d.fill : 'bg-tile-strong'}`} />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The Specialist under the four categories: its own daily in each universe, the owner's three most important (League
 * of Legends, One Piece, Overwatch) in gold with today's progress, and the way to every universe. On the home page too.
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
      <div className="grid gap-3 sm:grid-cols-3">
        {featured.map((u) => {
          const done = Object.values(special[`${u.id}:${today}`] ?? {}).filter((r) => r.status !== 'playing').length;
          const streak = specialStreak(special, u.id, u.types.length);
          return (
            <Link key={u.id} to={`/specialist/${u.id}`} className="golden-ready flex flex-col gap-1 rounded-md bg-gradient-to-br from-[#fde68a]/15 to-transparent p-4 transition hover:-translate-y-0.5">
              <span className="golden-text font-display text-lg font-bold">★ {u.label}</span>
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

