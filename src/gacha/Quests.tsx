// Quests (the Games page and the Shop): an Easy, a Medium and a Hard one at a time. Claim one and the next of
// its tier comes up at once; all of them change at midnight, done or not (src/gacha/economy.ts).
import { useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { QUEST_TIERS, QUESTS, questAt, questReward, questsNow, type QuestTier } from './economy';
import { tr, withFrench } from '../lib/i18n';

const TIER: Record<QuestTier, { name: string; color: string }> = {
  easy: withFrench({ name: 'Easy', color: '#22c55e' }, { name: 'Facile' }),
  medium: withFrench({ name: 'Medium', color: '#f59e0b' }, { name: 'Moyenne' }),
  hard: withFrench({ name: 'Hard', color: '#ef4444' }, { name: 'Difficile' }),
};

export function Quests({ compact = false }: { compact?: boolean }) {
  const econ = econToday(useProgress((s) => s.econ));
  const book = questsNow(useProgress((s) => s.quests), econ.date);
  const claim = useProgress((s) => s.claimQuest);
  const [fresh, setFresh] = useState<QuestTier | null>(null);
  const [paid, setPaid] = useState<{ tier: QuestTier; coins: number } | null>(null);

  const take = (tier: QuestTier) => {
    const coins = claim(tier);
    if (coins === false) return sfx.wrong();
    sfx.coins(8);
    if (tier === 'hard') celebrate();
    setPaid({ tier, coins });
    setFresh(tier);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={compact ? 'font-display text-sm uppercase tracking-[0.25em] text-ink-faint' : 'font-display text-lg font-bold'}>{tr('📜 Quests', '📜 Quêtes')}</h2>
        <span className="text-xs text-ink-soft">
          {tr(
            `Claim one and a new one comes up · all change at midnight · the first ${QUESTS.fullPerDay} of each tier a day pay in full, then half`,
            `Récupères-en une et une nouvelle apparaît · tout change à minuit · les ${QUESTS.fullPerDay} premières de chaque niveau paient en entier chaque jour, puis moitié`,
          )}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {QUEST_TIERS.map((tier) => {
          const slot = book.slots[tier];
          const q = questAt(econ.date, tier, slot.n);
          const got = Math.min(q.need, Math.max(0, (econ.counters[q.kind] ?? 0) - slot.start));
          const ready = got >= q.need;
          const reward = questReward(q, book.done[tier]);
          return (
            <div
              key={`${tier}:${slot.n}`}
              className={`page flex flex-col gap-2 rounded-md border-l-4 p-3 ${fresh === tier ? 'animate-pop' : ''} ${ready ? 'ring-2 ring-hit' : ''}`}
              style={{ borderLeftColor: TIER[tier].color }}
            >
              <p className="flex items-center justify-between font-display text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: TIER[tier].color }}>
                <span>{TIER[tier].name}</span>
                <span className="text-ink-faint">{book.done[tier] ? tr(`${book.done[tier]} done today`, `${book.done[tier]} faite(s) aujourd’hui`) : tr('Quest 1', 'Quête 1')}</span>
              </p>
              <p className="font-semibold">
                {q.icon} {q.text}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-tile">
                <div className="h-full transition-[width]" style={{ width: `${(got / q.need) * 100}%`, background: TIER[tier].color }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {got}/{q.need}
                  {paid?.tier === tier && <span className="animate-pop ml-2 font-semibold text-hit">+{paid.coins}!</span>}
                </span>
                <button type="button" disabled={!ready} onClick={() => take(tier)} className="btn-accent rounded-md px-3 py-1 text-sm font-bold disabled:opacity-40">
                  {tr('Claim', 'Récupérer')} <Coins n={reward} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
