import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, DleCoin } from '../components/DleCoin';
import { CARDS, RARITIES, RARITY_INFO, RARITY_LIGHT, SETS, type Card, type Rarity } from '../gacha/cards';
import { CLEAR_PER_ANSWER, HOT_BONUS, HOT_PLAYS, hotNow, EXPEDITION_BOSS_MAX, EXPEDITION_CAP, EXPEDITION_ROOM_MAX, ARCADE_BEST_BONUS, ARCADE_CAP, ARCADE_LOSS, ARCADE_RUN_MAX, ARCADE_SET_MAX, ARCADE_WIN, BOSS_LOSS, BOSS_WEEKLY, BOSS_WIN, CATEGORY_BONUS, LONG_MISSIONS, longMissionsFor, MISSIONS, missionsFor, type Period } from '../gacha/economy';
import { GRADE_REWARD_SHARE, gradeReward } from '../gacha/grades';
import { addDays, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { PackArt } from '../gacha/PackArt';
import { PackOpening } from '../gacha/PackOpening';
import { BOOST, PACK_SIZE, PITY_MAX, PITY_STEP, TOP_CAP, bossBest, clampPity, lastCardOdds, oddsWith, packsFor, pityLuck, pullPacks, type Pack } from '../gacha/packs';
import { sfx } from '../lib/sfx';
import { booksNow, bossWeekNow, econToday, useProgress } from '../store/progress';

const PACKS = packsFor(SETS);
const DIFF_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard', hell: 'Hell' } as const;

/** Days until a period's missions change: next Monday, or the 1st of next month. */
function daysLeft(p: Period): number {
  const today = todayKey();
  let d = 1;
  while (d < 32) {
    const next = addDays(today, d);
    if (p === 'week' ? new Date(`${next}T12:00:00Z`).getUTCDay() === 1 : next.slice(0, 7) !== today.slice(0, 7)) return d;
    d++;
  }
  return d;
}

/** A percentage, as many decimals as it needs to show anything ("0.010%"). */
const pct = (x: number) => `${x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x >= 0.1 ? x.toFixed(2) : x.toFixed(3)}%`;

/**
 * A rarity's chances: per card, and of at least one in a pack — four cards on the odds, the last
 * one at least rare (see lastCardOdds).
 */
function chances(odds: Record<Rarity, number>, r: Rarity) {
  const p = odds[r] / 100;
  const last = lastCardOdds(odds)[r] / 100;
  const pack = 1 - Math.pow(1 - p, PACK_SIZE - 1) * (1 - last);
  return { card: odds[r], pack: pack * 100 };
}

/** Every rarity's odds: a plain pack, and a franchise pack once its guardian falls on Medium or Hard. */
function DropRates() {
  const columns = [
    { label: 'Any pack', boost: 1 },
    { label: 'Guardian beaten on Medium', boost: BOOST.medium },
    { label: 'Guardian beaten on Hard', boost: BOOST.hard },
    { label: 'Guardian beaten on Hell', boost: BOOST.hell },
  ].map((c) => ({ ...c, odds: oddsWith(c.boost) }));
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">Drop rates</h2>
      <p className="text-sm text-ink-soft">
        Each pack has {PACK_SIZE} different cards; the last is always Rare or better. Once a card&apos;s rarity is drawn, every franchise of the pack has the same chance, however many cards it has. A franchise pack&apos;s odds go up once you&apos;ve beaten its guardian on Medium (×
        {BOOST.medium} Epic), Hard (×{BOOST.hard}) or Hell (×{BOOST.hell} Epic; Rare and Legendary up by half as much, Mythic and Omni by a quarter). And every pack opened without a Legendary or better raises the odds of a Legendary by {Math.round(PITY_STEP * 100)}% (up to ×{PITY_MAX}) until one drops — then they go back to normal. Whatever stacks up, a card is never more than {TOP_CAP.legendary}% Legendary, {TOP_CAP.mythic}% Mythic or {TOP_CAP.omni}% Omni. Per card, and in brackets the chance of at least one in a pack (without that luck).
      </p>
      <div className="page overflow-x-auto rounded-md">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-rule text-left font-display text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-3 py-2">Rarity</th>
              {columns.map((c) => (
                <th key={c.label} className="px-3 py-2 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RARITIES.map((r) => (
              <tr key={r} className="border-b border-rule/60 last:border-0">
                <td className="px-3 py-2 font-semibold">
                  <span style={{ color: RARITY_LIGHT[r] }}>{RARITY_INFO[r].gem}</span> {RARITY_INFO[r].name}
                </td>
                {columns.map((c) => {
                  const x = chances(c.odds, r);
                  return (
                    <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                      <span className="font-semibold text-ink">{pct(x.card)}</span>
                      {r !== 'common' && <span className="text-ink-faint"> ({pct(x.pack)})</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint">
        {RARITIES.map((r) => `${RARITY_INFO[r].name}: ${CARDS.filter((c) => c.rarity === r).length}`).join(' · ')} cards in all — when a pack has none of a rarity left to give, the
        card drops to the rarity below.
      </p>
    </section>
  );
}

/** One mission: its goal, a progress bar, and its claim. */
function Mission({ m, n, done, onClaim }: { m: { icon: string; text: string; need: number; reward: number }; n: number; done: boolean; onClaim: () => void }) {
  const got = Math.min(m.need, n);
  const ready = !done && got >= m.need;
  return (
    <div className={`page flex flex-col gap-2 rounded-md p-3 ${done ? 'opacity-60' : ''} ${ready ? 'ring-2 ring-hit' : ''}`}>
      <p className="font-semibold">
        {m.icon} {m.text}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-tile">
        <div className="h-full bg-hit transition-[width]" style={{ width: `${(got / m.need) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-soft">
          {got}/{m.need}
        </span>
        {done ? (
          <span className="font-semibold text-hit">✓ Claimed</span>
        ) : (
          <button type="button" disabled={!ready} onClick={onClaim} className="btn-accent rounded-md px-3 py-1 text-sm font-bold disabled:opacity-40">
            Claim <Coins n={m.reward} />
          </button>
        )}
      </div>
    </div>
  );
}

/** A box for gift codes: each pays once. */
function RedeemCode() {
  const redeem = useProgress((s) => s.redeemCode);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const r = redeem(code);
    if (r.ok) {
      sfx.streak();
      celebrate();
      setMsg({ ok: true, text: `+${r.coins} DleCoins! ${r.note}` });
      setCode('');
    } else {
      sfx.wrong();
      setMsg({ ok: false, text: r.reason === 'used' ? 'You already redeemed this code.' : "That code doesn't exist (yet)." });
    }
  };
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">🎁 Gift codes</h2>
      <form onSubmit={submit} className="page flex flex-wrap items-center gap-2 rounded-md p-3">
        <input
          value={code}
          onChange={(e) => (setCode(e.target.value), setMsg(null))}
          placeholder="Enter a code"
          aria-label="Gift code"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 py-2 font-display font-bold uppercase tracking-widest placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
        />
        <button type="submit" disabled={!code.trim()} className="btn-accent rounded-md px-4 py-2 font-display font-bold disabled:opacity-40">
          Redeem
        </button>
        {msg && <p className={`w-full text-sm font-semibold ${msg.ok ? 'animate-pop text-hit' : 'text-coral'}`}>{msg.text}</p>}
      </form>
    </section>
  );
}

/** /shop */
export default function Shop() {
  const coins = useProgress((s) => s.coins);
  const hotGame = useProgress((s) => s.hotGame);
  const owned = useProgress((s) => s.cards);
  const bosses = useProgress((s) => s.bosses);
  const econ = econToday(useProgress((s) => s.econ));
  const bossWeek = bossWeekNow(useProgress((s) => s.bossWeek));
  const openPack = useProgress((s) => s.openPack);
  const pity = useProgress((s) => clampPity(s.pity));
  const claim = useProgress((s) => s.claimMission);
  const claimLong = useProgress((s) => s.claimLongMission);
  const books = booksNow(useProgress((s) => s.missionBooks));
  const [opening, setOpening] = useState<{ pack: Pack; cards: Card[]; fresh: Set<string>; key: number } | null>(null);
  const missions = missionsFor(econ.date);
  const collected = useMemo(() => CARDS.filter((c) => owned[c.id]).length, [owned]);

  const boostOf = (p: Pack) => (p.boss ? bossBest(bosses, p.boss) : null);
  const buy = (p: Pack) => {
    const best = boostOf(p);
    if (p.boss && !best) return;
    const pull = pullPacks(p, 1, best ? BOOST[best] : 1, pity);
    const cards = pull.packs[0];
    const fresh = new Set(cards.filter((c) => !owned[c.id]).map((c) => c.id));
    if (!openPack(p.cost, cards.map((c) => c.id), 1, pull.pity)) return sfx.wrong();
    sfx.click();
    setOpening({ pack: p, cards, fresh, key: Date.now() });
  };
  /** Five packs at once: 25 cards in one opening, the rarest last. */
  const MANY = 5;
  const buyMany = (p: Pack) => {
    const best = boostOf(p);
    if (p.boss && !best) return;
    // One pack after another, each with the luck the ones before it left.
    const pull = pullPacks(p, MANY, best ? BOOST[best] : 1, pity);
    const cards = pull.packs
      .flat()
      .sort((a, b) => RARITY_INFO[a.rarity].rank - RARITY_INFO[b.rarity].rank);
    const fresh = new Set(cards.filter((c) => !owned[c.id]).map((c) => c.id));
    if (!openPack(p.cost * MANY, cards.map((c) => c.id), MANY, pull.pity)) return sfx.wrong();
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
          <div className="mt-auto flex flex-col gap-1.5">
            <button type="button" disabled={!afford} onClick={() => buy(p)} className="btn-accent rounded-md px-3 py-2 font-display text-sm font-bold disabled:opacity-40">
              Open · <Coins n={p.cost} />
            </button>
            {/* Five at once, when the coins are there. */}
            {coins >= p.cost * MANY && (
              <button type="button" onClick={() => buyMany(p)} className="btn-paper rounded-md px-3 py-1.5 font-display text-xs font-bold">
                Open ×{MANY} · <Coins n={p.cost * MANY} />
              </button>
            )}
          </div>
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
          {/* Luck: the packs since the last Legendary or better raise their odds. */}
          <p
            className={`mt-1 text-xs font-semibold ${pity > 0 ? 'text-ochre' : 'text-ink-faint'}`}
            title={`Every pack without a Legendary or better: +${Math.round(PITY_STEP * 100)}% to Legendary odds, up to ×${PITY_MAX}. Back to ×1 when one drops.`}
          >
            ✨ Luck ×{pityLuck(pity).toFixed(2)}{pity > 0 ? ` · ${pity} pack${pity === 1 ? '' : 's'} without a Legendary` : ''}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Today&apos;s missions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {missions.map((k) => (
            <Mission key={k} m={MISSIONS[k]} n={econ.counters[k] ?? 0} done={econ.claimed.includes(k)} onClaim={() => (sfx.streak(), claim(k))} />
          ))}
        </div>
      </section>

      {(['week', 'month'] as const).map((p) => {
        const book = books[p];
        const left = daysLeft(p);
        return (
          <section key={p} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{p === 'week' ? 'This week' : 'This month'}&apos;s missions</h2>
              <span className="text-sm text-ink-soft">
                New ones in {left} day{left === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {longMissionsFor(p, book.period).map((k) => (
                <Mission
                  key={k}
                  m={LONG_MISSIONS[p][k]}
                  n={book.counters[k] ?? 0}
                  done={book.claimed.includes(k)}
                  onClaim={() => (sfx.victory(), celebrate(), claimLong(p, k))}
                />
              ))}
            </div>
          </section>
        );
      })}

      <RedeemCode />

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

      <DropRates />

      <section className="page space-y-2 rounded-md p-4 text-sm text-ink-soft">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <DleCoin /> Earning DleCoins
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Every daily round you finish: 6 to 16 coins, the better your score the more (2 for a lost round); +{CATEGORY_BONUS} for playing all ten of a category.</li>
          <li>Specialist dailies: the same per round.</li>
          <li>
            Every Boss Battle: {BOSS_WIN.easy} for a win on Easy, {BOSS_WIN.medium} on Medium, {BOSS_WIN.hard} on Hard, {BOSS_WIN.hell} on Hell ({BOSS_LOSS} for a loss) — and the first win over each boss at each difficulty
            this week pays +{BOSS_WEEKLY.easy}, +{BOSS_WEEKLY.medium}, +{BOSS_WEEKLY.hard} or +{BOSS_WEEKLY.hell} more ({bossWeek.keys.length} of {SETS.length * 4} taken this week; they come back every Monday).
          </li>
          <li>
            Every game from the Games page, Free Play and Who&apos;s That?, by how it went: a win {ARCADE_WIN} coins, a loss {ARCADE_LOSS}; a set of rounds up to {ARCADE_SET_MAX} by your score; an
            endless run (Higher or Lower, Summit, Rail Rush…) more and more the further you get — they get harder as you go — up to {ARCADE_RUN_MAX}. +{ARCADE_BEST_BONUS} for a new best. In full up to {ARCADE_CAP} a day
            ({Math.min(econ.arcade, ARCADE_CAP)}/{ARCADE_CAP} today), then half as much, as long as you play. A whole Name Them All list or a whole To the
            Last level cleared: +{CLEAR_PER_ANSWER} a name on top, once a day per list.
          </li>
          <li>
            The Hot Game: one game of the Games page pays +{Math.round(HOT_BONUS * 100)}% ({hotNow(hotGame, econ.date).game.title} right now). After {HOT_PLAYS} games of it, or the next day, the bonus moves to another.
          </li>
          <li>
            Expeditions: every room won pays, a little more each act, up to {EXPEDITION_ROOM_MAX} a room and {EXPEDITION_BOSS_MAX} a boss. In full up to {EXPEDITION_CAP} a day ({Math.min(econ.expedition ?? 0, EXPEDITION_CAP)}/{EXPEDITION_CAP} today), then a quarter as much.
          </li>
          <li>
            Every card grade reached: Bronze, Silver, Gold, Radiant, Celestial and Singularity pay {GRADE_REWARD_SHARE[2]}×, {GRADE_REWARD_SHARE[3]}×, {GRADE_REWARD_SHARE[4]}×, {GRADE_REWARD_SHARE[5]}×, {GRADE_REWARD_SHARE[6]}× and {GRADE_REWARD_SHARE[7]}× what the four spares would fetch traded in — a Common's Bronze {gradeReward('common', 2)}, a Legendary's Singularity {gradeReward('legendary', 7)}. Singularity also asks for the card's boss beaten on Hell.
          </li>
          <li>Three missions a day, three a week and three a month, a bonus each.</li>
        </ul>
        <p className="pt-1 text-xs">Every rarity's odds, per card and per pack: see Drop rates above.</p>
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
