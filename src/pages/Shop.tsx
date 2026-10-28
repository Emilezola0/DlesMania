import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, DleCoin } from '../components/DleCoin';
import { CardBack, CardFace, RARITY_STYLE } from '../gacha/CardView';
import { CARDS, RARITY_INFO, SETS, type Card } from '../gacha/cards';
import { ARCADE_CAP, BOSS_COINS, CATEGORY_BONUS, MISSIONS, missionsFor } from '../gacha/economy';
import { BOOST, ODDS, bossBest, oddsWith, packsFor, pullPack, type Pack } from '../gacha/packs';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';

const PACKS = packsFor(SETS);
const DIFF_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

/** A pack's wrapper: its colours, a torn top edge, a shine. */
function PackArt({ pack, className = '' }: { pack: Pack; className?: string }) {
  const set = pack.boss ? SETS.find((s) => s.id === pack.boss) : undefined;
  return (
    <div
      className={`relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-lg text-white shadow-xl [container-type:inline-size] ${className}`}
      style={{ background: `linear-gradient(160deg, ${pack.colors[0]}, ${pack.colors[1]})`, clipPath: 'polygon(0 4%, 5% 0, 10% 4%, 15% 0, 20% 4%, 25% 0, 30% 4%, 35% 0, 40% 4%, 45% 0, 50% 4%, 55% 0, 60% 4%, 65% 0, 70% 4%, 75% 0, 80% 4%, 85% 0, 90% 4%, 95% 0, 100% 4%, 100% 100%, 0 100%)' }}
    >
      {set?.guardian.image ? (
        <img src={set.guardian.image} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-40 mix-blend-luminosity" />
      ) : null}
      <div className="relative text-center">
        <p className="text-[26cqw] leading-none drop-shadow">{pack.icon}</p>
        <p className="mt-[4cqw] px-[6cqw] font-display text-[10cqw] font-bold leading-tight drop-shadow">{pack.name.replace(' pack', '')}</p>
        <p className="mt-[2cqw] font-display text-[6cqw] font-semibold tracking-[0.3em] opacity-80">5 CARDS</p>
      </div>
      <div className="card-sheen pointer-events-none absolute inset-0" />
    </div>
  );
}

/** Opening a pack: shake, tap, burst, then five cards dealt face down to turn one by one. */
function Opening({ pack, cards, fresh, onClose, onAgain, canAgain }: { pack: Pack; cards: Card[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean }) {
  const [phase, setPhase] = useState<'pack' | 'burst' | 'cards'>('pack');
  const [shown, setShown] = useState<boolean[]>(() => cards.map(() => false));
  const counts = useProgress((s) => s.cards);
  const all = shown.every(Boolean);

  const tear = () => {
    if (phase !== 'pack') return;
    sfx.whoosh();
    setPhase('burst');
    window.setTimeout(() => setPhase('cards'), 550);
  };
  const flip = (i: number) => {
    if (shown[i]) return;
    const c = cards[i];
    setShown((s) => s.map((x, j) => x || j === i));
    if (c.rarity === 'legendary') (sfx.victory(), celebrateBig());
    else if (c.rarity === 'epic') (sfx.streak(), celebrate());
    else if (c.rarity === 'rare') sfx.correct();
    else sfx.select();
  };
  const next = () => {
    const i = shown.indexOf(false);
    if (i >= 0) flip(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase !== 'cards' || all)) onClose();
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (phase === 'pack') tear();
      else if (phase === 'cards') (all ? onClose() : next());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      {phase !== 'cards' ? (
        <button type="button" onClick={tear} className="w-56 sm:w-64" aria-label="Open the pack">
          <PackArt pack={pack} className={phase === 'pack' ? 'animate-pack-shake' : 'animate-pack-burst'} />
          {phase === 'pack' && <p className="mt-4 animate-pulse text-center font-display text-lg font-bold text-white">Tap to open</p>}
        </button>
      ) : (
        <div className="w-full max-w-4xl space-y-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {cards.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => flip(i)}
                className="animate-card-deal [perspective:900px]"
                style={{ animationDelay: `${i * 110}ms`, ['--deal-rot' as string]: `${(i - 2) * 8}deg` }}
                aria-label={shown[i] ? c.name : 'Turn this card'}
              >
                <div className={`relative transition-transform duration-700 [transform-style:preserve-3d] ${shown[i] ? '[transform:rotateY(180deg)]' : 'hover:-translate-y-1'}`}>
                  <div className="[backface-visibility:hidden]">
                    {/* The glow gives the rarity away a moment before the card turns. */}
                    <CardBack rarity={c.rarity === 'common' ? undefined : c.rarity} />
                  </div>
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <CardFace card={c} count={counts[c.id]} isNew={fresh.has(c.id)} />
                  </div>
                </div>
                {shown[i] && (
                  <p className="mt-2 animate-pop text-center font-display text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_STYLE[c.rarity].text }}>
                    {RARITY_INFO[c.rarity].name}
                  </p>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {!all ? (
              <button type="button" onClick={() => cards.forEach((_, i) => window.setTimeout(() => flip(i), i * 180))} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Turn them all
              </button>
            ) : (
              <>
                {canAgain && (
                  <button type="button" onClick={onAgain} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                    Open another · <Coins n={pack.cost} />
                  </button>
                )}
                <button type="button" onClick={onClose} className="btn-paper rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** /shop */
export default function Shop() {
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.cards);
  const bosses = useProgress((s) => s.bosses);
  const econ = econToday(useProgress((s) => s.econ));
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
            A boss beaten: {BOSS_COINS.easy} on Easy, {BOSS_COINS.medium} on Medium, {BOSS_COINS.hard} on Hard — once a day for each.
          </li>
          <li>
            The endless games (Games page, Free Play, Who&apos;s That?): a couple of coins a game, a few more for a new best — up to {ARCADE_CAP} a day ({econ.arcade}/{ARCADE_CAP} today).
          </li>
          <li>Three missions a day, a bonus each.</li>
        </ul>
        <p className="pt-1 text-xs">
          Odds per card: {Object.entries(ODDS).map(([r, p]) => `${RARITY_INFO[r as keyof typeof RARITY_INFO].name} ${p}%`).join(' · ')} — the fifth card is always Rare or better. With a Hard win:{' '}
          {Object.entries(oddsWith(BOOST.hard)).map(([r, p]) => `${RARITY_INFO[r as keyof typeof RARITY_INFO].name} ${Math.round(p * 10) / 10}%`).join(' · ')}.
        </p>
      </section>

      {opening && (
        <Opening
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
