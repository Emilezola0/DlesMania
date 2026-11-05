// The Casino: a chill corner to play some DleCoins — the slots, pachinko, the capsule machine (icon frames)
// and the roulette. On average everything pays back a little less than it takes (src/data/tuning/casino.json).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DleCoin } from '../components/DleCoin';
import { Capsules } from '../casino/Capsules';
import { Pachinko } from '../casino/Pachinko';
import { Slots } from '../casino/Slots';
import { Roulette } from '../gacha/Roulette';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const TABS = [
  { id: 'slots', label: 'Slots', icon: '🍒' },
  { id: 'pachinko', label: 'Pachinko', icon: '⚪' },
  { id: 'capsules', label: 'Capsules', icon: '🥚' },
  { id: 'roulette', label: 'Roulette', icon: '🎡' },
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-wider">
            <span aria-hidden>🎰 </span>
            <span className="casino-title">Casino</span>
          </h1>
          <p className="text-sm text-ink-soft">A little chill zone. Play a few DleCoins, win a few back — on average every machine keeps a little of what it takes.</p>
        </div>
        <Link to="/shop" className="flex items-center gap-1.5 rounded-full border border-ochre/60 bg-ochre/10 px-3 py-1 font-bold tabular-nums">
          <DleCoin className="size-4" /> {coins.toLocaleString('en')}
        </Link>
      </header>
      <nav className="flex gap-1 rounded-lg border border-rule bg-tile p-1" aria-label="Casino machines">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-pressed={tab === t.id}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-display text-sm font-bold transition ${tab === t.id ? 'bg-paper text-ink shadow' : 'text-ink-soft hover:text-ink'}`}
          >
            <span aria-hidden>{t.icon}</span>
            <span className="max-[380px]:hidden">{t.label}</span>
            {t.id === 'capsules' && tokens > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-coral" title="A free capsule is waiting" />}
          </button>
        ))}
      </nav>
      <div key={tab} className="animate-pop">
        {tab === 'slots' && <Slots />}
        {tab === 'pachinko' && <Pachinko />}
        {tab === 'capsules' && <Capsules />}
        {tab === 'roulette' && <Roulette />}
      </div>
    </div>
  );
}
