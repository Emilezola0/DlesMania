import { useState } from 'react';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import type { Card } from './cards';
import { gradeOf, spareValue } from './grades';

/**
 * Every spare copy of a card traded in at once (one copy always stays), for its coins — asked twice, since
 * spares are also what a card's grade-ups are made of. Nothing when there is no spare to sell.
 */
export function SellSpares({ card, className, dark = false }: { card: Card; className?: string; dark?: boolean }) {
  const count = useProgress((s) => s.cards[card.id] ?? 0);
  const grade = useProgress((s) => gradeOf(s.grades, card.id));
  const exchange = useProgress((s) => s.exchangeCards);
  const [asking, setAsking] = useState(false);
  const spares = count - 1;
  if (spares < 1) return null;
  const coins = spares * spareValue(card.rarity, grade);
  const tone = dark ? 'border-white/40 text-white hover:border-white' : 'border-rule-strong text-ink-soft hover:border-ink hover:text-ink';
  if (!asking)
    return (
      <button type="button" onClick={() => (sfx.select(), setAsking(true))} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${tone} ${className ?? ''}`} title="One copy always stays">
        ♻ Sell all {spares} spare{spares === 1 ? '' : 's'} (+{coins.toLocaleString('en')} coins)
      </button>
    );
  return (
    <span className={`inline-flex flex-wrap items-center justify-center gap-2 rounded-full border-2 border-coral px-3 py-1 text-sm font-bold ${dark ? 'text-white' : ''} ${className ?? ''}`}>
      Sell {spares} for {coins.toLocaleString('en')} coins? Its grade-ups need spares.
      <button type="button" onClick={() => (sfx.correct(), exchange({ [card.id]: spares }, coins), setAsking(false))} className="rounded-full bg-coral px-2.5 py-0.5 text-white">
        Sell
      </button>
      <button type="button" onClick={() => (sfx.click(), setAsking(false))} className="rounded-full px-2 py-0.5 underline">
        Keep
      </button>
    </span>
  );
}
