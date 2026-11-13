// The Account page's "taking turns" settings for the icon and the background (src/gacha/Rotation.tsx does the
// turning): the cards in the list, when the next one comes, and in what order.
import { useState } from 'react';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { rotationOf, useProgress, type RotationPlan, type RotationSlot } from '../store/progress';
import { CARD_BY_ID, CARDS, RARITY_INFO, type Rarity } from './cards';
import { canBeBackdrop, CardAvatar } from './Perks';

/** "When" and "every" as one choice. */
const WHEN: { value: string; label: string; plan: Pick<RotationPlan, 'when'> & Partial<Pick<RotationPlan, 'every'>> }[] = [
  { value: 'off', label: 'Never: stays as it is', plan: { when: 'off' } },
  { value: 'clip', label: "After a win's clip has played", plan: { when: 'clip' } },
  { value: 'win:1', label: 'After every win', plan: { when: 'win', every: 1 } },
  { value: 'win:3', label: 'Every 3 wins', plan: { when: 'win', every: 3 } },
  { value: 'win:5', label: 'Every 5 wins', plan: { when: 'win', every: 5 } },
  { value: 'win:10', label: 'Every 10 wins', plan: { when: 'win', every: 10 } },
  { value: 'visit', label: 'Each time I open Omnidle', plan: { when: 'visit' } },
];
const whenValue = (p: RotationPlan) => (p.when === 'win' ? `win:${[1, 3, 5, 10].includes(p.every) ? p.every : 1}` : p.when);

const QUICK: { rarity: Rarity; label: string }[] = [
  { rarity: 'omni', label: 'Omnis' },
  { rarity: 'mythic', label: 'Mythics' },
  { rarity: 'legendary', label: 'Legendaries' },
];

function SlotTurns({ slot }: { slot: RotationSlot }) {
  const plan = useProgress((s) => rotationOf(s)[slot]);
  const owned = useProgress((s) => s.cards);
  const current = useProgress((s) => s[slot]);
  const setRotation = useProgress((s) => s.setRotation);
  const setAvatar = useProgress((s) => s.setAvatar);
  const setBackdrop = useProgress((s) => s.setBackdrop);
  const fits = (id: string) => {
    const c = CARD_BY_ID.get(id);
    return !!c && (slot === 'avatar' || canBeBackdrop(c));
  };
  const addAll = (rarity: Rarity) => {
    sfx.select();
    const more = CARDS.filter((c) => c.rarity === rarity && (owned[c.id] ?? 0) > 0 && fits(c.id)).map((c) => c.id);
    setRotation(slot, { cards: [...new Set([...plan.cards, ...more])] });
  };
  const ready = plan.cards.filter((id) => (owned[id] ?? 0) > 0 && fits(id)).length;
  const label = slot === 'avatar' ? 'Icon' : 'Background';
  // A card found by its name or its franchise (a player's ask, Discord ticket "Personalisation"): the owned ones that fit, not in yet.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const found = q
    ? CARDS.filter(
        (c) =>
          (owned[c.id] ?? 0) > 0 &&
          fits(c.id) &&
          !plan.cards.includes(c.id) &&
          [c.name, shownName(c.name, c.set), c.franchise].some((t) => t.toLowerCase().includes(q)),
      ).slice(0, 12)
    : [];
  return (
    <div className="space-y-2 rounded-md border border-rule p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">🔄 {label} takes turns</p>
        <p className="text-xs text-ink-faint">
          {ready} card{ready === 1 ? '' : 's'}
          {ready < 2 && plan.when !== 'off' ? ' — add at least 2' : ''}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label={`When the ${label.toLowerCase()} changes`}
          value={whenValue(plan)}
          onChange={(e) => setRotation(slot, WHEN.find((w) => w.value === e.target.value)!.plan)}
          className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-sm font-semibold"
        >
          {WHEN.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`The ${label.toLowerCase()}'s order`}
          value={plan.order}
          onChange={(e) => setRotation(slot, { order: e.target.value as RotationPlan['order'] })}
          className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-sm font-semibold"
        >
          <option value="order">In this order</option>
          <option value="random">At random</option>
        </select>
      </div>
      {plan.cards.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {plan.cards.map((id, i) => {
            const card = CARD_BY_ID.get(id);
            if (!card) return null;
            const usable = (owned[id] ?? 0) > 0 && fits(id);
            const on = current === id;
            return (
              <li key={id} className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-1 text-xs ${on ? 'border-accent bg-accent/10' : 'border-rule'} ${usable ? '' : 'opacity-45'}`}>
                <button
                  type="button"
                  onClick={() => usable && (sfx.select(), slot === 'avatar' ? setAvatar(id) : setBackdrop(id))}
                  title={usable ? `${shownName(card.name, card.set)} · ${RARITY_INFO[card.rarity].name} — show it now` : 'Not in your album any more: skipped'}
                  className="flex items-center gap-1"
                >
                  <CardAvatar card={card} className="size-7" />
                  <span className="max-w-[7rem] truncate font-semibold">
                    {plan.order === 'order' ? `${i + 1}. ` : ''}
                    {shownName(card.name, card.set)}
                  </span>
                </button>
                {plan.order === 'order' && i > 0 && (
                  <button
                    type="button"
                    aria-label="Earlier in the turns"
                    onClick={() => {
                      const cards = [...plan.cards];
                      [cards[i - 1], cards[i]] = [cards[i], cards[i - 1]];
                      setRotation(slot, { cards });
                    }}
                    className="px-0.5 text-ink-faint hover:text-ink"
                  >
                    ◀
                  </button>
                )}
                <button type="button" aria-label="Take it out of the turns" onClick={() => setRotation(slot, { cards: plan.cards.filter((c) => c !== id) })} className="px-0.5 text-ink-faint hover:text-coral">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No cards yet. Open a card in the album and press “🔄 {label} turns”, or add a whole rarity:</p>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your cards to add one…"
        aria-label={`Search a card for the ${label.toLowerCase()}'s turns`}
        className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-sm"
      />
      {q && (
        <ul className="flex flex-wrap gap-1.5">
          {found.length ? (
            found.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => (sfx.select(), setRotation(slot, { cards: [...plan.cards, card.id] }))}
                  title={`${shownName(card.name, card.set)} · ${RARITY_INFO[card.rarity].name} — add it to the turns`}
                  className="flex items-center gap-1 rounded-full border border-rule py-0.5 pl-0.5 pr-2 text-xs hover:border-accent"
                >
                  <CardAvatar card={card} className="size-7" />
                  <span className="max-w-[8rem] truncate font-semibold">+ {shownName(card.name, card.set)}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-xs text-ink-faint">No card of yours matches{slot === 'backdrop' ? ' (a Common can’t be a background)' : ''}.</li>
          )}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q.rarity} type="button" onClick={() => addAll(q.rarity)} className="btn-paper rounded-md px-2.5 py-1 text-xs font-semibold">
            + My {q.label}
          </button>
        ))}
        {plan.cards.length > 0 && (
          <button type="button" onClick={() => setRotation(slot, { cards: [] })} className="btn-paper rounded-md px-2.5 py-1 text-xs font-semibold">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/** The icon and the background changing together, to the same card, when both take turns at random. */
function SyncSwitch() {
  const rotation = rotationOf({ rotation: useProgress((s) => s.rotation) });
  const bothRandom = rotation.avatar.order === 'random' && rotation.backdrop.order === 'random';
  const on = !!rotation.sync;
  return (
    <label className={`flex items-center gap-2 rounded-md border border-rule p-3 text-sm ${bothRandom ? '' : 'opacity-60'}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => (sfx.select(), useProgress.setState((s) => ({ rotation: { ...rotationOf(s), sync: e.target.checked } })))}
        className="size-4 accent-current"
      />
      <span>
        <span className="font-semibold">🔗 Same card for both</span>{' '}
        <span className="text-ink-soft">
          {bothRandom ? '— the icon and the background change together, to one card both lists have.' : '— works when both take turns “At random”.'}
        </span>
      </span>
    </label>
  );
}

export function RotationSettings() {
  return (
    <div className="space-y-2">
      <SlotTurns slot="avatar" />
      <SlotTurns slot="backdrop" />
      <SyncSwitch />
      <p className="text-xs text-ink-faint">A card changes once the page is calm again, never in the middle of its own clip. Cards you no longer own are skipped.</p>
    </div>
  );
}
