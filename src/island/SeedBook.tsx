// Friends → Island → the Seed Book: every seed there is, found or not (a silhouette), with what each grows, the bag,
// and today's Seed of the Day. Stage 1 of the Island: the seeds come first; planting them comes with the Island.
import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { GAME_META } from '../games/meta';
import { tr } from '../lib/i18n';
import { useProgress } from '../store/progress';
import type { GameType } from '../types';
import { FAMILIES, FAMILY_BY_ID, HYBRIDS, ITEM_BY_ID, SEED, SEEDS, seedColors, seedLogNow, seedOfTheDay, useSeedDrops, type Seed } from './seeds';
import { ItemArt } from './sprites';

const nameOf = (x: { name: string; fr: string }) => tr(x.name, x.fr);
const sourceOf = (source: string) =>
  source in GAME_META ? GAME_META[source as GameType].name : source === 'boss' ? tr('Boss Battle', 'Combat de boss') : source === 'arcade' ? tr('the Arcade', 'l’Arcade') : tr('the JLPT games', 'les jeux JLPT');

/** A seed, drawn: an almond shape in its family's colours (two for a hybrid), with a sprout; a silhouette if not found. */
export function SeedArt({ seed, found = true, className = 'size-10' }: { seed: Seed; found?: boolean; className?: string }) {
  const id = 'seed' + useId().replace(/:/g, '');
  const [a, b] = seedColors(seed);
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={found ? a : '#6b7280'} />
          <stop offset="1" stopColor={found ? b : '#4b5563'} />
        </linearGradient>
      </defs>
      {found && seed.tier !== 'common' && <ellipse cx="20" cy="30" rx="18" ry="17" fill={a} opacity="0.25" />}
      <path d="M20 14 C31 14 34 28 32 36 C30 44 24 46 20 46 C16 46 10 44 8 36 C6 28 9 14 20 14 Z" fill={`url(#${id})`} stroke={found ? '#00000040' : '#00000030'} />
      {found && <path d="M14 24 C13 30 14 36 17 40" fill="none" stroke="#ffffff70" strokeWidth="2" strokeLinecap="round" />}
      <path d="M20 14 C20 9 21 6 23 3" fill="none" stroke={found ? '#16a34a' : '#6b7280'} strokeWidth="2" strokeLinecap="round" />
      <path d="M22 6 C26 2 31 3 32 5 C29 8 25 8 22 6 Z" fill={found ? '#22c55e' : '#6b7280'} />
      {found && seed.tier === 'rare' && <path d="M29 18 l1.2 2.6 2.8.3 -2.1 1.9 .6 2.8 -2.5-1.4 -2.5 1.4 .6-2.8 -2.1-1.9 2.8-.3 Z" fill="#fde047" />}
      {!found && (
        <text x="20" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="#e5e7eb">
          ?
        </text>
      )}
    </svg>
  );
}

function SeedTile({ seed, n, found }: { seed: Seed; n: number; found: boolean }) {
  return (
    <div className={`flex min-w-0 items-start gap-2 rounded-md border p-2 ${found ? 'border-rule bg-card' : 'border-dashed border-rule/70 bg-tile/40'}`}>
      <span className="relative shrink-0">
        <SeedArt seed={seed} found={found} />
        {n > 0 && <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white tabular-nums">×{n}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {found ? nameOf(seed) : '???'}
          {seed.tier === 'rare' && <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-ochre">{tr('rare', 'rare')}</span>}
        </span>
        {seed.cross && (
          <span className="block text-[11px] text-ink-soft">
            {found
              ? seed.cross.map((f) => `${FAMILY_BY_ID.get(f)!.icon} ${nameOf(FAMILY_BY_ID.get(f)!)}`).join(' × ')
              : tr('Cross two families to find it', 'Croise deux familles pour la trouver')}
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap gap-1">
          {seed.grows.map((g) => {
            const item = ITEM_BY_ID.get(g)!;
            return (
              <span key={g} title={found ? nameOf(item) : undefined} className="inline-flex items-center gap-0.5 rounded bg-tile px-1 text-[11px]">
                {found ? (
                  <>
                    <ItemArt id={g} className="size-4 text-[11px]" /> {nameOf(item)}
                  </>
                ) : (
                  '?'
                )}
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
}

export function SeedBook() {
  const seeds = useProgress((s) => s.seeds ?? {});
  const found = useProgress((s) => s.seedsFound ?? {});
  const log = seedLogNow(useProgress((s) => s.seedLog));
  const sotd = seedOfTheDay();
  const inBag = Object.values(seeds).reduce((a, b) => a + b, 0);
  const foundN = SEEDS.filter((s) => found[s.id]).length;
  return (
    <div className="page space-y-4 rounded-md p-4">
      <div>
        <h2 className="font-display text-2xl font-bold">🌱 {tr('Island · Seed Book', 'Île · Herbier')}</h2>
        <p className="text-sm text-ink-soft">
          {tr(
            'Every game has its own seeds. Finish one of today’s rounds for its seed; the better your score, the likelier its rare one. Soon, plant two seeds together on your Island to grow blocks, lights, music and frames for your cards.',
            'Chaque jeu a ses graines. Termine une manche du jour pour sa graine ; plus ton score est bon, plus sa graine rare a de chances de tomber. Bientôt, plante deux graines ensemble sur ton île pour faire pousser blocs, lumières, musique et cadres pour tes cartes.',
          )}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          {tr(`${inBag} in your bag · ${foundN} / ${SEEDS.length} found`, `${inBag} dans ton sac · ${foundN} / ${SEEDS.length} trouvées`)}
        </p>
      </div>

      {/* Today: the Seed of the Day, and the capped sources. */}
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="flex items-center gap-3 rounded-md border border-accent/60 bg-accent/5 p-3">
          <SeedArt seed={sotd} className="size-14 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-accent">{tr('Seed of the Day', 'Graine du jour')}</p>
            <p className="font-display text-lg font-bold">{nameOf(sotd)}</p>
            <p className="text-xs text-ink-soft">
              {log.sotd
                ? tr('✓ Yours today.', '✓ À toi aujourd’hui.')
                : tr('Finish all ten of today’s rounds in one category to get it. Tomorrow, another.', 'Termine les dix manches du jour d’une catégorie pour l’avoir. Demain, une autre.')}{' '}
              {!log.sotd && (
                <Link to="/" className="font-semibold text-accent underline">
                  {tr('Play', 'Jouer')}
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="space-y-1 rounded-md border border-rule bg-card/60 p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{tr('Also today', 'Aussi aujourd’hui')}</p>
          {(['boss', 'arcade', 'jlpt'] as const).map((k) => (
            <p key={k} className="flex justify-between gap-2">
              <span>
                {FAMILY_BY_ID.get(k)!.icon} {k === 'boss' ? tr('Boss Battle', 'Combat de boss') : k === 'arcade' ? tr('Arcade', 'Arcade') : tr('JLPT games', 'Jeux JLPT')}
              </span>
              <span className="tabular-nums text-ink-soft">
                {log.n[k] ?? 0} / {SEED.perDay}
              </span>
            </p>
          ))}
        </div>
      </div>

      {/* The families, one per game. */}
      <div className="grid gap-3 md:grid-cols-2">
        {FAMILIES.map((f) => (
          <section key={f.id} className="space-y-1.5 rounded-md border border-rule p-2.5" style={{ borderLeft: `4px solid ${f.color}` }}>
            <p className="font-display font-bold">
              {f.icon} {tr(`${f.name} seeds`, `Graines ${f.fr}`)} <span className="text-xs font-semibold text-ink-soft">· {tr('from', 'de')} {sourceOf(f.source)}</span>
            </p>
            {SEEDS.filter((s) => s.family === f.id).map((s) => (
              <SeedTile key={s.id} seed={s} n={seeds[s.id] ?? 0} found={!!found[s.id]} />
            ))}
          </section>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="font-display text-lg font-bold">🧬 {tr('Hybrids', 'Hybrides')}</h3>
        <p className="text-xs text-ink-soft">
          {tr('Two families’ seeds crossed on your Island make a hybrid (coming with the Island). Today’s Seed of the Day is one of them.', 'Deux graines de familles différentes croisées sur ton île donnent un hybride (avec l’île, bientôt). La graine du jour en est un.')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HYBRIDS.map((s) => (
            <SeedTile key={s.id} seed={s} n={seeds[s.id] ?? 0} found={!!found[s.id]} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Seeds just dropped: a little card at the bottom of the screen for a few seconds each. */
export function SeedDrops() {
  const drops = useSeedDrops((s) => s.drops);
  if (!drops.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {drops.map((d) => (
        <SeedDrop key={d.key} drop={d} />
      ))}
    </div>
  );
}

function SeedDrop({ drop }: { drop: { key: number; ids: string[]; fresh: string[] } }) {
  const clear = useSeedDrops((s) => s.clear);
  useEffect(() => {
    const t = window.setTimeout(() => clear(drop.key), 3500);
    return () => window.clearTimeout(t);
  }, [drop.key, clear]);
  return (
    <Link to="/friends?tab=island" className="seed-drop pointer-events-auto flex items-center gap-2 rounded-full border border-rule bg-card px-3 py-1.5 text-sm font-semibold shadow-lg">
      {drop.ids.map((id, k) => {
        const s = SEEDS.find((x) => x.id === id)!;
        return (
          <span key={k} className="flex items-center gap-1">
            <SeedArt seed={s} className="size-6" />
            {nameOf(s)}
            {drop.fresh.includes(id) && <span className="rounded bg-accent px-1 text-[10px] font-bold uppercase text-white">{tr('new', 'nouveau')}</span>}
          </span>
        );
      })}
    </Link>
  );
}
