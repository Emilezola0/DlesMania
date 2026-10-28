import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, DleCoin } from '../components/DleCoin';
import { CARDS, RARITY_INFO, SETS, type Card } from '../gacha/cards';
import { ARCADE_AFTER_CAP, ARCADE_BEST_BONUS, ARCADE_CAP, ARCADE_COINS, BOSS_LOSS, BOSS_WEEKLY, BOSS_WIN, CATEGORY_BONUS, MISSIONS, missionsFor } from '../gacha/economy';
import { PackArt } from '../gacha/PackArt';
import { PackOpening } from '../gacha/PackOpening';
import { BOOST, ODDS, bossBest, oddsWith, packsFor, pullPack, type Pack } from '../gacha/packs';
import { sfx } from '../lib/sfx';
import { bossWeekNow, econToday, useProgress } from '../store/progress';

const PACKS = packsFor(SETS);
const DIFF_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

/** /shop */
export default function Shop() {
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.cards);
  const bosses = useProgress((s) => s.bosses);
  const econ = econToday(useProgress((s) => s.econ));
  const bossWeek = bossWeekNow(useProgress((s) => s.bossWeek));
  const openPack = useProgress((s) => s.openPack);
  const claim = useProgress((s) => s.claimMission);
  const [opening, setOpening] = useState<{ pack: Pack; cards: Card[]; fresh: Set<string>; key: number } | null>(null);
  const missions = missionsFor(econ.date);
  const collected = useMemo(() => CARDS.filter((c) => owned[c.id]).length, [owned]);

  const boostOf = (p: Pack) => (p.boss ? bossBest(bosses, p.boss) : null);
  const buy = (p: Pack) => {
    const best = boostOf(p);
    if (p.boss && !best) return;
    const cards = pullPack(p, best ? BOOST[best] : 1);
    const fresh = new Set(cards.filter((c) => !owned[c.id]).map((c) => c.id));
    if (!openPack(p.cost, cards.map((c) => c.id))) return sfx.wrong();
    sfx.click();
    setOpening({ pack: p, cards, fresh, key: Date.now() });
  };

  const general = PACKS.filter((p) => !p.boss);
  const franchise = PACKS.filter((p) => p.boss);
  const PackTile = ({ p }: { p: Pack }) => {
    const best = boostOf(p);
    const locked = !!p.boss && !best;
    const afford = coins >= p.cost;
    const set = p.boss ? SETS.find((s) => s.id === p.boss) : undefined;
    return (
      <div className={`page flex flex-col gap-2 rounded-md p-3 ${locked ? 'opacity-70' : ''}`}>
        <div className={locked ? 'grayscale' : ''}>
          <PackArt pack={p} />
        </div>
        <p className="font-display text-sm font-bold leading-tight">{p.name}</p>
        <p className="text-xs text-ink-soft">{p.blurb}</p>
        {best && best !== 'easy' && (
          <p className="text-xs font-semibold text-hit" title={`Epic ×${BOOST[best]}, legendary ×${BOOST[best]}`}>
            ⚡ {DIFF_NAME[best]} beaten: rarer cards ×{BOOST[best]}
          </p>
        )}
        {locked ? (
          <Link to={`/boss/${p.boss}`} className="btn-paper mt-auto rounded-md px-3 py-2 text-center text-xs font-bold">
            🔒 Beat {set?.guardian.name ?? 'the boss'} to unlock
          </Link>
        ) : (
          <button type="button" disabled={!afford} onClick={() => buy(p)} className="btn-accent mt-auto rounded-md px-3 py-2 font-display text-sm font-bold disabled:opacity-40">
            Open · <Coins n={p.cost} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Games
          </Link>
          <h1 className="text-5xl font-bold">Card Shop</h1>
          <p className="max-w-xl text-ink-soft">
            Play to earn DleCoins, then open packs of cards from every franchise. {collected} of {CARDS.length} collected —{' '}
            <Link to="/album" className="font-semibold text-accent underline-offset-2 hover:underline">
              see your album
            </Link>
            .
          </p>
        </div>
        <div className="page rounded-md px-5 py-3 text-right">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Your DleCoins</p>
          <Coins n={coins} className="text-4xl" />
          <p className="text-xs text-ink-soft">+{econ.earned} today</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Today&apos;s missions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {missions.map((k) => {
            const m = MISSIONS[k];
            const n = Math.min(m.need, econ.counters[k] ?? 0);
            const done = econ.claimed.includes(k);
            const ready = !done && n >= m.need;
            return (
              <div key={k} className={`page flex flex-col gap-2 rounded-md p-3 ${done ? 'opacity-60' : ''}`}>
                <p className="font-semibold">
                  {m.icon} {m.text}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-tile">
                  <div className="h-full bg-hit transition-[width]" style={{ width: `${(n / m.need) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">
                    {n}/{m.need}
                  </span>
                  {done ? (
                    <span className="font-semibold text-hit">✓ Claimed</span>
                  ) : (
                    <button type="button" disabled={!ready} onClick={() => (sfx.streak(), claim(k))} className="btn-accent rounded-md px-3 py-1 text-sm font-bold disabled:opacity-40">
                      Claim <Coins n={m.reward} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Packs</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {general.map((p) => (
            <PackTile key={p.id} p={p} />
          ))}
        </div>
        <h3 className="pt-2 font-display font-bold">Franchise packs</h3>
        <p className="text-sm text-ink-soft">Beat a franchise&apos;s Boss Battle to unlock its pack. Win it on Medium or Hard and its rare cards come more often.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {franchise.map((p) => (
            <PackTile key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="page space-y-2 rounded-md p-4 text-sm text-ink-soft">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <DleCoin /> Earning DleCoins
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Every daily round you finish: 6 to 16 coins, the better your score the more (2 for a lost round); +{CATEGORY_BONUS} for playing all ten of a category.</li>
          <li>Specialist dailies: the same per round.</li>
          <li>
            Every Boss Battle: {BOSS_WIN.easy} for a win on Easy, {BOSS_WIN.medium} on Medium, {BOSS_WIN.hard} on Hard ({BOSS_LOSS} for a loss) — and the first win over each boss at each difficulty
            this week pays +{BOSS_WEEKLY.easy}, +{BOSS_WEEKLY.medium} or +{BOSS_WEEKLY.hard} more ({bossWeek.keys.length} of {SETS.length * 3} taken this week; they come back every Monday).
          </li>
          <li>
            Every game from the Games page, Free Play and Who&apos;s That?: {ARCADE_COINS} coins, +{ARCADE_BEST_BONUS} for a new best — in full up to {ARCADE_CAP} a day ({Math.min(econ.arcade, ARCADE_CAP)}/
            {ARCADE_CAP} today), then {ARCADE_AFTER_CAP} a game, as long as you play.
          </li>
          <li>Three missions a day, a bonus each.</li>
        </ul>
        <p className="pt-1 text-xs">
          Odds per card: {Object.entries(ODDS).map(([r, p]) => `${RARITY_INFO[r as keyof typeof RARITY_INFO].name} ${p}%`).join(' · ')} — the fifth card is always Rare or better. With a Hard win:{' '}
          {Object.entries(oddsWith(BOOST.hard)).map(([r, p]) => `${RARITY_INFO[r as keyof typeof RARITY_INFO].name} ${Math.round(p * 10) / 10}%`).join(' · ')}.
        </p>
      </section>

      {opening && (
        <PackOpening
          key={opening.key}
          pack={opening.pack}
          cards={opening.cards}
          fresh={opening.fresh}
          canAgain={coins >= opening.pack.cost}
          onAgain={() => buy(opening.pack)}
          onClose={() => setOpening(null)}
        />
      )}
    </div>
  );
}
