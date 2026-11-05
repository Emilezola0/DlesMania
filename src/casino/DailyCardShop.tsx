// The Daily Card Shop (a Casino tab): today's cards, bought with casino tokens only — one token for every
// CARD_SHOP.coinsPerToken DleCoins paid into the machines. The same shelf for everyone, new every midnight.
import { useEffect, useMemo, useState } from 'react';
import { CardFace } from '../gacha/CardView';
import { RARITY_INFO, RARITY_LIGHT } from '../gacha/cards';
import { todayKey } from '../lib/date';
import { celebrate, celebrateBig } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CARD_SHOP, shopFor } from './cardShop';

/** Time left until midnight, as "5 h 12 min". */
function untilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

export function TokenCount({ className = '' }: { className?: string }) {
  const chips = useProgress((s) => s.chips ?? 0);
  return (
    <span className={`flex items-center gap-1.5 rounded-full border border-coral/50 bg-coral/10 px-3 py-1 font-bold tabular-nums ${className}`} title="Casino tokens: spend them in the Daily Card Shop">
      <span aria-hidden>🎟️</span> {chips.toLocaleString('en')}
    </span>
  );
}

export function CardShop() {
  const [day, setDay] = useState(todayKey);
  const [left, setLeft] = useState(untilMidnight);
  // A new shelf at midnight, without a reload.
  useEffect(() => {
    const t = window.setInterval(() => {
      setDay(todayKey());
      setLeft(untilMidnight());
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);
  const { offers, occasion } = useMemo(() => shopFor(day), [day]);
  const chips = useProgress((s) => s.chips ?? 0);
  const chipCoins = useProgress((s) => s.chipCoins ?? 0);
  const cards = useProgress((s) => s.cards);
  const bought = useProgress((s) => (s.cardShop?.day === day ? s.cardShop.bought : []));
  const buy = useProgress((s) => s.buyShopCard);
  const [just, setJust] = useState<string | null>(null);

  const purchase = (id: string, price: number, big: boolean) => {
    if (!buy(id, price)) return sfx.wrong();
    sfx.coins(6);
    (big ? celebrateBig : celebrate)();
    setJust(id);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-card p-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-black tracking-wide">🃏 Daily Card Shop</h2>
          <p className="text-sm text-ink-soft">
            Paid in casino tokens only: one 🎟️ for every {CARD_SHOP.coinsPerToken} DleCoins you put into the machines, win or lose. Each card once a day; new cards in {left}.
          </p>
        </div>
        <div className="text-right">
          <TokenCount className="justify-end text-lg" />
          <p className="mt-1 text-xs text-ink-faint">
            Next token in {CARD_SHOP.coinsPerToken - chipCoins} coins
          </p>
        </div>
      </div>

      {occasion && (
        <p className="animate-pop rounded-md border-2 border-[#f0abfc]/60 bg-[#7c3aed]/15 px-4 py-2 text-center font-display font-bold">
          ✨ {occasion}: a mythic is on the shelf today!
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {offers.map(({ card, price }) => {
          const sold = bought.includes(card.id);
          const owned = cards[card.id] ?? 0;
          const short = chips < price;
          const big = card.rarity === 'mythic' || card.rarity === 'legendary';
          return (
            <li key={card.id} className={`flex flex-col gap-2 rounded-lg border bg-tile p-2 ${just === card.id ? 'animate-pop' : ''}`} style={{ borderColor: RARITY_LIGHT[card.rarity] }}>
              <div className={sold ? 'opacity-60 grayscale-[.4]' : ''}>
                <CardFace card={card} count={owned} />
              </div>
              <div className="min-w-0 text-center">
                <p className="truncate text-sm font-bold">{shownName(card.name, card.set)}</p>
                <p className="truncate text-xs text-ink-faint">
                  <span style={{ color: RARITY_LIGHT[card.rarity] }}>{RARITY_INFO[card.rarity].name}</span> · {card.franchise}
                  {owned > 0 && ` · owned ×${owned}`}
                </p>
              </div>
              <button
                type="button"
                disabled={sold || short}
                onClick={() => purchase(card.id, price, big)}
                className={`mt-auto rounded-md px-3 py-2 font-display text-sm font-bold tabular-nums transition ${sold ? 'bg-hit/20 text-hit' : short ? 'cursor-not-allowed bg-paper text-ink-faint' : 'btn-accent'}`}
                title={short && !sold ? `${(price - chips).toLocaleString('en')} more tokens needed` : undefined}
              >
                {sold ? '✓ Bought today' : `🎟️ ${price.toLocaleString('en')}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs text-ink-faint">Everyone sees the same shelf today. On special days (holidays, Omnidle's birthday, the odd lucky day) a mythic joins the legendaries.</p>
    </section>
  );
}
