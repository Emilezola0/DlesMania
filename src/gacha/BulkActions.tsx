// The album's bulk actions: grade up every card that can be at once (the player ticks which ones, and
// picks one element for the cards reaching the element grade, or stops them just before it), and sell
// spare copies by choosing which cards and how many of each.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Coins } from '../components/DleCoin';
import { useCloud } from '../cloud/state';
import { shownName } from '../lib/french';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { bossKey, useProgress } from '../store/progress';
import { CARDS, RARITIES, RARITY_INFO, RARITY_LIGHT, SETS, type Card, type Rarity } from './cards';
import { GradeEmblem } from './GradeEmblem';
import { canGradeUp, ELEMENT_GRADE, ELEMENT_IDS, ELEMENTS, GRADE_COST, GRADES, gradeName, gradeOf, gradeReward, MAX_GRADE, spareValue, type ElementId } from './grades';

function Dialog({ title, intro, onClose, children }: { title: string; intro: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="page my-auto w-full max-w-2xl space-y-4 rounded-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            <p className="text-sm text-ink-soft">{intro}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A card's row: its picture, name, rarity and what's said about it. */
function Row({ card, children, right }: { card: Card; children?: ReactNode; right: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-rule bg-card px-2 py-1.5">
      <img src={card.image} alt="" loading="lazy" className="size-10 shrink-0 rounded object-cover object-top" style={{ boxShadow: `0 0 0 2px ${RARITY_LIGHT[card.rarity]}` }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{shownName(card.name, card.set)}</p>
        <p className="truncate text-xs text-ink-faint">
          {RARITY_INFO[card.rarity].name} · {card.franchise}
          {children}
        </p>
      </div>
      {right}
    </li>
  );
}

/** Narrowing the list: a rarity, a set, a search. */
function useFilter(cards: Card[]) {
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [set, setSet] = useState('all');
  const [q, setQ] = useState('');
  const sets = useMemo(() => SETS.filter((s) => cards.some((c) => c.set === s.id)), [cards]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = cards.filter((c) => (rarity === 'all' || c.rarity === rarity) && (set === 'all' || c.set === set) && words.every((w) => `${c.name} ${c.franchise}`.toLowerCase().includes(w)));
  const bar = (
    <div className="flex flex-wrap items-center gap-2">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" className="min-w-0 flex-1 basis-32 rounded-md border border-rule-strong bg-card px-3 py-1.5 text-sm" />
      <select value={set} onChange={(e) => setSet(e.target.value)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Set">
        <option value="all">Every set</option>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.franchise}
          </option>
        ))}
      </select>
      <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | 'all')} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Rarity">
        <option value="all">Every rarity</option>
        {RARITIES.filter((r) => cards.some((c) => c.rarity === r)).map((r) => (
          <option key={r} value={r}>
            {RARITY_INFO[r].gem} {RARITY_INFO[r].name}
          </option>
        ))}
      </select>
    </div>
  );
  return { shown, bar };
}

/** How far a card can go from here with its spares: its grades on the way (stopping before the element grade without an element). */
function planFor(count: number, grade: number, hellBeaten: boolean, element: ElementId | null) {
  let g = grade;
  let n = count;
  while (canGradeUp(n, g, hellBeaten) && (g + 1 !== ELEMENT_GRADE || element)) {
    n -= GRADE_COST;
    g++;
  }
  return g;
}

export function GradeAllDialog({ onClose }: { onClose: () => void }) {
  const owned = useProgress((s) => s.cards);
  const grades = useProgress((s) => s.grades);
  const paid = useProgress((s) => s.gradesPaid);
  const bosses = useProgress((s) => s.bosses);
  const gradeUp = useProgress((s) => s.gradeUp);
  const signedIn = useCloud((s) => s.name ?? s.email?.split('@')[0] ?? undefined);
  const [element, setElement] = useState<ElementId | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ cards: number; grades: number; coins: number } | null>(null);

  const hell = (c: Card) => (bosses[bossKey(c.set, 'hell')]?.wins ?? 0) > 0;
  const ready = useMemo(
    () =>
      CARDS.flatMap((c) => {
        const n = owned[c.id] ?? 0;
        const from = gradeOf(grades, c.id);
        const to = n > 1 ? planFor(n, from, hell(c), element) : from;
        if (to <= from) return [];
        let coins = 0;
        for (let g = from + 1; g <= to; g++) if (g > (paid?.[c.id] ?? 1)) coins += gradeReward(c.rarity, g);
        return [{ card: c, from, to, coins }];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owned, grades, paid, bosses, element],
  );
  // Cards that stop before the element grade only because no element is picked.
  const waiting = useMemo(() => (element ? 0 : CARDS.filter((c) => (owned[c.id] ?? 0) > 1 && planFor(owned[c.id], gradeOf(grades, c.id), hell(c), 'fire') >= ELEMENT_GRADE).length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owned, grades, bosses, element]);
  const { shown, bar } = useFilter(ready.map((r) => r.card));
  const picked = ready.filter((r) => !skip.has(r.card.id));
  const total = picked.reduce((a, r) => ({ grades: a.grades + r.to - r.from, coins: a.coins + r.coins }), { grades: 0, coins: 0 });

  const go = () => {
    let gradesUp = 0;
    let cards = 0;
    const before = useProgress.getState().coins;
    for (const r of picked) {
      let any = false;
      while (gradeOf(useProgress.getState().grades, r.card.id) < r.to && gradeUp(r.card.id, r.card.rarity, signedIn, element ?? undefined)) (gradesUp++, (any = true));
      if (any) cards++;
    }
    if (!gradesUp) return sfx.wrong();
    setDone({ cards, grades: gradesUp, coins: useProgress.getState().coins - before });
    setSkip(new Set());
    if (picked.some((r) => r.to >= 4)) (sfx.victory(), celebrateBig());
    else (sfx.streak(), celebrate());
  };

  return (
    <Dialog title="⬆ Grade up all" intro={<>Every card with enough spares goes up as many grades as it can: {GRADE_COST} spares a grade, the card itself always stays. Untick a card to leave it as it is.</>} onClose={onClose}>
      {done && (
        <p className="animate-pop rounded-md border border-hit/50 bg-hit/15 px-4 py-2 text-sm font-semibold">
          {done.grades} grade{done.grades === 1 ? '' : 's'} up on {done.cards} card{done.cards === 1 ? '' : 's'} · <Coins n={done.coins} />
        </p>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">
          Cards reaching {GRADES[ELEMENT_GRADE].name} take an element:{' '}
          {waiting > 0 && !element && <span className="font-normal text-ink-soft">({waiting} wait just before it until you pick one)</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => (sfx.click(), setElement(null))} className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${!element ? 'border-ink bg-ink text-paper' : 'border-rule-strong'}`}>
            Stop before
          </button>
          {ELEMENT_IDS.map((id) => (
            <button key={id} type="button" onClick={() => (sfx.click(), setElement(id))} className={`flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-semibold ${element === id ? 'border-ink bg-ink text-paper' : 'border-rule-strong'}`}>
              <GradeEmblem grade={ELEMENT_GRADE} element={id} className="size-5" /> {ELEMENTS[id].name}
            </button>
          ))}
        </div>
      </div>
      {ready.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">No card has enough spares for its next grade right now.</p>
      ) : (
        <>
          {bar}
          <div className="flex gap-2 text-xs">
            <button type="button" className="underline" onClick={() => setSkip(new Set())}>
              Tick all
            </button>
            <button type="button" className="underline" onClick={() => setSkip(new Set(ready.map((r) => r.card.id)))}>
              Untick all
            </button>
          </div>
          <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
            {shown.map((c) => {
              const r = ready.find((x) => x.card.id === c.id)!;
              const on = !skip.has(c.id);
              return (
                <Row
                  key={c.id}
                  card={c}
                  right={
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                      <GradeEmblem grade={r.from} className="size-5" />→<GradeEmblem grade={r.to} element={r.to >= ELEMENT_GRADE ? (element ?? undefined) : undefined} className="size-5" />
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSkip((s) => {
                          const next = new Set(s);
                          if (on) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })}
                        className="size-4 accent-[var(--accent)]"
                        aria-label={`Grade up ${c.name}`}
                      />
                    </label>
                  }
                >
                  {' '}· {gradeName(r.from)} → {gradeName(r.to, r.to >= ELEMENT_GRADE ? (element ?? undefined) : undefined)}
                  {r.coins > 0 && <> · +{r.coins.toLocaleString('en')}</>}
                </Row>
              );
            })}
          </ul>
          <button type="button" disabled={!total.grades} onClick={go} className="btn-accent w-full rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50">
            ⬆ {total.grades} grade{total.grades === 1 ? '' : 's'} up on {picked.length} card{picked.length === 1 ? '' : 's'} · <Coins n={total.coins} />
          </button>
        </>
      )}
    </Dialog>
  );
}

/** Spares no grade can use any more: past the last grade, or the few left over once every grade-up is taken. */
const leftovers = (spares: number, grade: number) => spares - Math.floor(Math.min(spares, Math.max(0, MAX_GRADE - grade) * GRADE_COST) / GRADE_COST) * GRADE_COST;

/** Rarities worth asking twice about before they go. */
const PRECIOUS: Rarity[] = ['legendary', 'mythic', 'omni'];

type SortBy = 'value' | 'spares' | 'rarity' | 'name';
const SORTS: { id: SortBy; label: string }[] = [
  { id: 'value', label: 'Most coins' },
  { id: 'spares', label: 'Most spares' },
  { id: 'rarity', label: 'Rarest' },
  { id: 'name', label: 'Name' },
];

export function SellDialog({ onClose }: { onClose: () => void }) {
  const owned = useProgress((s) => s.cards);
  const grades = useProgress((s) => s.grades);
  const exchange = useProgress((s) => s.exchangeCards);
  const spares = useMemo(() => CARDS.filter((c) => (owned[c.id] ?? 0) > 1), [owned]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sold, setSold] = useState<{ copies: number; coins: number } | null>(null);
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [setId, setSetId] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortBy>('value');
  const [sure, setSure] = useState(false);
  // Only the cards at the last grade (their spares have no grade-up left), and how many spares of each to keep.
  const [maxedOnly, setMaxedOnly] = useState(false);
  const [keep, setKeep] = useState(0);

  const max = (c: Card) => Math.max(0, (owned[c.id] ?? 0) - 1);
  const maxed = (c: Card) => gradeOf(grades, c.id) >= MAX_GRADE;
  const maxedCards = spares.filter(maxed);
  const value = (c: Card) => spareValue(c.rarity, gradeOf(grades, c.id));
  const left = (c: Card) => leftovers(max(c), gradeOf(grades, c.id));
  const sets = useMemo(() => SETS.filter((st) => spares.some((c) => c.set === st.id)), [spares]);

  // Everything there is to sell, by rarity: the chips on top (a tap shows only that rarity).
  const byRarity = RARITIES.map((r) => {
    const of = spares.filter((c) => c.rarity === r);
    return { r, copies: of.reduce((a, c) => a + max(c), 0), coins: of.reduce((a, c) => a + max(c) * value(c), 0) };
  }).filter((x) => x.copies > 0);
  const all = byRarity.reduce((a, x) => ({ copies: a.copies + x.copies, coins: a.coins + x.coins }), { copies: 0, coins: 0 });

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = spares
    .filter((c) => (!rarities.size || rarities.has(c.rarity)) && (!maxedOnly || maxed(c)) && (setId === 'all' || c.set === setId) && words.every((w) => `${c.name} ${c.franchise}`.toLowerCase().includes(w)))
    .sort((a, b) =>
      sort === 'value'
        ? max(b) * value(b) - max(a) * value(a)
        : sort === 'spares'
          ? max(b) - max(a)
          : sort === 'rarity'
            ? RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)
            : a.name.localeCompare(b.name),
    );

  const set = (c: Card, n: number) => {
    setSure(false);
    setQty((cur) => ({ ...cur, [c.id]: Math.max(0, Math.min(max(c), Math.floor(n) || 0)) }));
  };
  /** Fills the sale for these cards: how many of each (from its spares). Nothing is sold until the button. */
  const fill = (of: Card[], take: (c: Card) => number) => {
    sfx.click();
    setSure(false);
    setQty((cur) => {
      const next = { ...cur };
      for (const c of of) next[c.id] = Math.max(0, Math.min(max(c), take(c)));
      return next;
    });
  };
  const toggleRarity = (r: Rarity) => {
    sfx.click();
    setRarities((cur) => {
      const next = new Set(cur);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const chosen = spares.filter((c) => (qty[c.id] ?? 0) > 0);
  const copies = chosen.reduce((a, c) => a + Math.min(qty[c.id], max(c)), 0);
  const coins = chosen.reduce((a, c) => a + Math.min(qty[c.id], max(c)) * value(c), 0);
  const precious = chosen.filter((c) => PRECIOUS.includes(c.rarity)).reduce((a, c) => a + Math.min(qty[c.id], max(c)), 0);
  const go = () => {
    if (!copies) return;
    // Legendary and up: a second tap to be sure.
    if (precious && !sure) {
      sfx.click();
      setSure(true);
      return;
    }
    const byId = Object.fromEntries(chosen.map((c) => [c.id, Math.min(qty[c.id], max(c))]));
    exchange(byId, coins);
    sfx.streak();
    setSold({ copies, coins });
    setQty({});
    setSure(false);
  };

  const quick = [
    { label: 'Commons & Rares', of: spares.filter((c) => c.rarity === 'common' || c.rarity === 'rare'), take: max },
    { label: 'Leftovers only', of: spares, take: left },
    { label: 'Every spare', of: spares, take: max },
  ].map((x) => ({ ...x, copies: x.of.reduce((a, c) => a + x.take(c), 0), coins: x.of.reduce((a, c) => a + x.take(c) * value(c), 0) }));

  return (
    <Dialog title="♻ Sell spares" intro="Spare copies become DleCoins. The first copy of every card always stays in your album." onClose={onClose}>
      {sold && (
        <p className="animate-pop rounded-md border border-hit/50 bg-hit/15 px-4 py-2 text-sm font-semibold">
          Sold {sold.copies} cop{sold.copies === 1 ? 'y' : 'ies'} · <Coins n={sold.coins} />
        </p>
      )}
      {spares.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">You have no spare copies to sell.</p>
      ) : (
        <>
          {/* What there is, by rarity: a tap shows only those. */}
          <div className="space-y-2">
            <p className="text-sm">
              <b>{all.copies.toLocaleString('en')}</b> spare{all.copies === 1 ? '' : 's'} on <b>{spares.length}</b> card{spares.length === 1 ? '' : 's'}, worth <Coins n={all.coins} /> in all.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {byRarity.map(({ r, copies: n }) => {
                const on = rarities.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRarity(r)}
                    aria-pressed={on}
                    className="rounded-full border-2 px-3 py-1 text-sm font-semibold transition hover:brightness-110"
                    style={on ? { background: RARITY_LIGHT[r], borderColor: RARITY_LIGHT[r], color: '#14121a' } : { borderColor: RARITY_LIGHT[r] }}
                    title={on ? `Show every rarity again` : `Show only ${RARITY_INFO[r].name} cards`}
                  >
                    {RARITY_INFO[r].gem} {RARITY_INFO[r].name} · {n}
                  </button>
                );
              })}
              {maxedCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => (sfx.click(), setMaxedOnly((v) => !v))}
                  aria-pressed={maxedOnly}
                  className={`flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${maxedOnly ? 'border-ink bg-ink text-paper' : 'border-rule-strong hover:border-ink'}`}
                  title={maxedOnly ? 'Show every card again' : `Show only the cards graded to ${gradeName(MAX_GRADE)}: no grade-up can use their spares`}
                >
                  <GradeEmblem grade={MAX_GRADE} className="size-5" /> Maxed only · {maxedCards.reduce((a, c) => a + max(c), 0)}
                </button>
              )}
            </div>
          </div>

          {/* A tap fills the sale; nothing is sold until the button at the bottom. */}
          <div className="grid gap-2 sm:grid-cols-3">
            {quick.map((x) => (
              <button
                key={x.label}
                type="button"
                disabled={!x.copies}
                onClick={() => fill(x.of, x.take)}
                className="rounded-md border-2 border-rule-strong bg-card px-3 py-2 text-left transition hover:border-ink disabled:opacity-40"
              >
                <span className="block font-display text-sm font-bold">{x.label}</span>
                <span className="block text-xs text-ink-soft">
                  {x.copies} cop{x.copies === 1 ? 'y' : 'ies'} · <Coins n={x.coins} />
                </span>
              </button>
            ))}
          </div>
          <p className="-mt-2 text-xs text-ink-faint">
            A tap fills the sale below; nothing is sold until you confirm. <b>Leftovers</b>: spares no grade-up can use ({GRADE_COST} spares make a grade).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" className="min-w-0 flex-1 basis-32 rounded-md border border-rule-strong bg-card px-3 py-1.5 text-sm" />
            <select value={setId} onChange={(e) => setSetId(e.target.value)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Set">
              <option value="all">Every set</option>
              {sets.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.franchise}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortBy)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Sort by">
              {SORTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-ink-faint">
              The {shown.length} card{shown.length === 1 ? '' : 's'} shown:
            </span>
            <button type="button" className="font-semibold underline" onClick={() => fill(shown, max)}>
              every spare
            </button>
            <button type="button" className="font-semibold underline" onClick={() => fill(shown, left)}>
              leftovers
            </button>
            <span className="flex items-center gap-1">
              keep
              <input
                type="number"
                min={0}
                value={keep}
                onChange={(e) => setKeep(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                className="w-12 rounded-md border border-rule-strong bg-paper px-1 py-0.5 text-center tabular-nums"
                aria-label="Spares to keep of each card"
              />
              each,
              <button type="button" className="font-semibold underline" onClick={() => fill(shown, (c) => max(c) - keep)} title={`Sell every spare of the cards shown but ${keep} of each`}>
                sell the rest
              </button>
            </span>
            <button type="button" className="font-semibold underline" onClick={() => fill(shown, () => 0)}>
              none
            </button>
            {chosen.length > 0 && (
              <button
                type="button"
                className="ml-auto font-semibold text-coral underline"
                onClick={() => {
                  sfx.click();
                  setQty({});
                  setSure(false);
                }}
              >
                Clear the whole sale
              </button>
            )}
          </div>

          <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
            {shown.length === 0 && <li className="py-4 text-center text-sm text-ink-soft">No card matches.</li>}
            {shown.map((c) => {
              const n = Math.min(qty[c.id] ?? 0, max(c));
              const btn = 'grid size-7 place-items-center rounded-md border border-rule-strong font-bold hover:border-ink disabled:opacity-40';
              const lo = left(c);
              return (
                <li
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-2 py-1.5 transition ${n ? 'border-accent bg-accent/10' : 'border-rule bg-card hover:border-rule-strong'}`}
                  onClick={() => set(c, n ? 0 : max(c))}
                  title={n ? 'Tap to sell none of it' : 'Tap to sell all its spares'}
                >
                  <img src={c.image} alt="" loading="lazy" className="size-10 shrink-0 rounded object-cover object-top" style={{ boxShadow: `0 0 0 2px ${RARITY_LIGHT[c.rarity]}` }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{shownName(c.name, c.set)}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {RARITY_INFO[c.rarity].gem} {c.franchise} · {max(c)} spare{max(c) === 1 ? '' : 's'}
                      {lo > 0 && lo < max(c) && <> ({lo} leftover)</>} · {value(c)} each
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={btn} disabled={n <= 0} onClick={() => set(c, n - 1)} aria-label={`One fewer ${c.name}`}>
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={max(c)}
                      value={n}
                      onChange={(e) => set(c, Number(e.target.value))}
                      className="w-11 rounded-md border border-rule-strong bg-paper px-1 py-1 text-center text-sm tabular-nums"
                      aria-label={`Copies of ${c.name} to sell`}
                    />
                    <button type="button" className={btn} disabled={n >= max(c)} onClick={() => set(c, n + 1)} aria-label={`One more ${c.name}`}>
                      +
                    </button>
                    <span className="hidden w-14 text-right text-xs font-semibold tabular-nums text-ink-soft sm:block">{n ? `+${(n * value(c)).toLocaleString('en')}` : ''}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" disabled={!copies} onClick={go} className={`w-full rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50 ${sure ? 'btn-ink' : 'btn-accent'}`}>
            {sure ? (
              <>Sure? It sells {precious} Legendary-or-rarer cop{precious === 1 ? 'y' : 'ies'}: tap again</>
            ) : (
              <>
                ♻ Sell {copies} cop{copies === 1 ? 'y' : 'ies'}
                {chosen.length > 0 && <> from {chosen.length} card{chosen.length === 1 ? '' : 's'}</>} · <Coins n={coins} />
              </>
            )}
          </button>
        </>
      )}
    </Dialog>
  );
}
