// The Casino: a chill corner to play some DleCoins — the slots, pachinko, the capsule machine (icon frames)
// the roulette, scratch cards (a few a day, paying back more than they cost), the claw machine (paid in tokens: plushies and prizes), and the Daily Card Shop (cards for the tokens the machines give). On average the machines pay back a little less than they take (src/data/tuning/casino.json); the roulette a little more, capped by its daily spins (economy.json).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DleCoin } from '../components/DleCoin';
import { BlackMarket } from '../casino/BlackMarket';
import { Boutique } from '../casino/Boutique';
import { Capsules } from '../casino/Capsules';
import { Claw } from '../casino/Claw';
import { CardShop, TokenCount } from '../casino/DailyCardShop';
import { Pachinko } from '../casino/Pachinko';
import { Scratch } from '../casino/Scratch';
import { Slots } from '../casino/Slots';
import { Roulette } from '../gacha/Roulette';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const TABS = [
  { id: 'slots', label: 'Slots', icon: '🍒' },
  { id: 'pachinko', label: 'Pachinko', icon: '⚪' },
  { id: 'capsules', label: 'Capsules', icon: '🥚' },
  { id: 'roulette', label: 'Roulette', icon: '🎡' },
  { id: 'scratch', label: 'Scratch', icon: '🎫' },
  { id: 'claw', label: 'Claw', icon: '🕹️' },
  { id: 'shop', label: 'Daily Shop', icon: '🃏' },
  { id: 'boutique', label: 'Boutique', icon: '🎀' },
  { id: 'black', label: 'Black Market', short: 'Market', icon: '🕶️' },
] as const;
type Tab = (typeof TABS)[number]['id'];
const KEY = 'omnidle:casino:tab';

function savedTab(): Tab {
  try {
    const t = localStorage.getItem(KEY);
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'slots';
  } catch {
    return 'slots';
  }
}

export default function Casino() {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.capsuleTokens ?? 0);
  const [tab, setTab] = useState<Tab>(savedTab);
  const pick = (t: Tab) => {
    sfx.select();
    setTab(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Remembered or not, it still works.
    }
  };
  return (
    <div className="casino-floor space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 max-sm:gap-2">
        <div>
          <h1 className="font-display text-3xl font-black tracking-wider">
            <span aria-hidden>🎰 </span>
            <span className="casino-title">Casino</span>
          </h1>
          <p className="text-sm text-ink-soft max-sm:text-xs">A little chill zone. Play a few DleCoins, win a few back — on average the machines keep a little of what they take (the roulette gives a little back, if you play it a lot), and every coin you put in earns casino tokens 🎟️ for the Daily Card Shop and the Boutique.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => pick('shop')} aria-label="Casino tokens: open the Daily Card Shop">
            <TokenCount />
          </button>
          <Link to="/shop" className="flex items-center gap-1.5 rounded-full border border-ochre/60 bg-ochre/10 px-3 py-1 font-bold tabular-nums">
            <DleCoin className="size-4" /> {coins.toLocaleString('en')}
          </Link>
        </div>
      </header>
      {/* A grid on a phone (three across), two rows on a tablet, one row on a wide screen: every tab in reach. */}
      <nav className="grid grid-cols-3 gap-1 rounded-lg border border-rule bg-tile p-1 sm:grid-cols-5 lg:flex" aria-label="Casino machines">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-pressed={tab === t.id}
            className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 py-2 font-display text-xs font-bold transition sm:gap-1.5 sm:text-sm ${tab === t.id ? 'bg-paper text-ink shadow' : 'text-ink-soft hover:text-ink'}`}
          >
            <span aria-hidden>{t.icon}</span>
            <span className="truncate">{'short' in t ? <><span className="sm:hidden">{t.short}</span><span className="max-sm:hidden">{t.label}</span></> : t.label}</span>
            {t.id === 'capsules' && tokens > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-coral" title="A free capsule is waiting" />}
          </button>
        ))}
      </nav>
      <div key={tab} className="animate-pop">
        {tab === 'slots' && <Slots />}
        {tab === 'pachinko' && <Pachinko />}
        {tab === 'capsules' && <Capsules />}
        {tab === 'roulette' && <Roulette />}
        {tab === 'scratch' && <Scratch />}
        {tab === 'claw' && <Claw />}
        {tab === 'shop' && <CardShop />}
        {tab === 'boutique' && <Boutique />}
        {tab === 'black' && <BlackMarket />}
      </div>
    </div>
  );
}
