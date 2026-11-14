// The Account page's "taking turns" settings for the icon and the background (src/gacha/Rotation.tsx does the
// turning): the cards in the list, when the next one comes, and in what order.
import { useState } from 'react';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { rotationOf, useProgress, whensOf, type RotationPlan, type RotationSlot, type RotationWhen } from '../store/progress';
import { CARD_BY_ID, CARDS, RARITY_INFO, type Rarity } from './cards';
import { canBeBackdrop, CardAvatar } from './Perks';

/** The moments the next card can come, ticked together (a player's ask, Discord ticket "Personnalisation"). */
const WHENS: { value: Exclude<RotationWhen, 'off'>; label: string }[] = [
  { value: 'win', label: 'After wins' },
  { value: 'clip', label: "After a win's clip has played" },
  { value: 'visit', label: 'Each time I open Omnidle' },
];
const EVERY = [1, 3, 5, 10];

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
  const whens = whensOf(plan);
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
          {ready < 2 && whens.length ? ' — add at least 2' : ''}
        </p>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm" aria-label={`When the ${label.toLowerCase()} changes`}>
        {WHENS.map((w) => (
          <label key={w.value} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={whens.includes(w.value)}
              onChange={(e) => {
                sfx.select();
                const next = e.target.checked ? [...whens, w.value] : whens.filter((x) => x !== w.value);
                setRotation(slot, { whens: next, when: next[0] ?? 'off' });
              }}
              className="size-4 accent-current"
            />
            <span className="font-semibold">{w.label}</span>
            {w.value === 'win' && whens.includes('win') && (
              <select
                aria-label="How many wins between two changes"
                value={EVERY.includes(plan.every) ? plan.every : 1}
                onChange={(e) => setRotation(slot, { every: Number(e.target.value) })}
                className="rounded-md border border-rule-strong bg-card px-1.5 py-0.5 text-xs font-semibold"
              >
                {EVERY.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'every win' : `every ${n} wins`}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
        {!whens.length && <span className="text-xs text-ink-faint">None ticked: it stays as it is.</span>}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
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
