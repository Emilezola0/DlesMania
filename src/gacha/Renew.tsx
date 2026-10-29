// Renewal: five spare copies of one rarity for one card of the same rarity — one not in the album
// yet when there's any left. Only spares go in (the first copy of every card stays), and the new card
// turns over in front of the player.
import { useEffect, useMemo, useState } from 'react';
import { shownName } from '../lib/french';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardBack, CardFace } from './CardView';
import { CARDS, RARITIES, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from './cards';

export const RENEW_COST = 5;

/** The card a renewal gives: one of the rarity not owned yet if there's any, else any other of it. */
export function renewalCard(rarity: Rarity, owned: Record<string, number>, spent: string[], rand: () => number = Math.random): Card | undefined {
  const pool = CARDS.filter((c) => c.rarity === rarity);
  const fresh = pool.filter((c) => !owned[c.id]);
  const from = fresh.length ? fresh : pool.filter((c) => !spent.includes(c.id));
  const list = from.length ? from : pool;
  return list[Math.floor(rand() * list.length)];
}

/** How many renewals each rarity can afford now. */
export function spareByRarity(owned: Record<string, number>): Record<Rarity, number> {
  const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const c of CARDS) out[c.rarity] += Math.max(0, (owned[c.id] ?? 0) - 1);
  return out;
}

export function RenewDialog({ onClose }: { onClose: () => void }) {
  const owned = useProgress((s) => s.cards);
  const renew = useProgress((s) => s.renewCards);
  const spares = useMemo(() => spareByRarity(owned), [owned]);
  const [rarity, setRarity] = useState<Rarity>(() => RARITIES.find((r) => spares[r] >= RENEW_COST) ?? 'common');
  // The five slots: card ids, a card as many times as it has spares.
  const [slots, setSlots] = useState<string[]>([]);
  const [result, setResult] = useState<{ card: Card; fresh: boolean; turned: boolean } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = CARDS.filter((c) => c.rarity === rarity && (owned[c.id] ?? 0) > 1);
  const left = (id: string) => (owned[id] ?? 0) - 1 - slots.filter((x) => x === id).length;
  const add = (id: string) => {
    if (slots.length >= RENEW_COST || left(id) <= 0) return;
    sfx.select();
    setSlots([...slots, id]);
  };
  const pick = (r: Rarity) => (sfx.click(), setRarity(r), setSlots([]), setResult(null));
  const autoFill = () => {
    // The most-duplicated first.
    const next = [...slots];
    for (const c of [...list].sort((a, b) => owned[b.id] - owned[a.id])) {
      while (next.length < RENEW_COST && (owned[c.id] ?? 0) - 1 - next.filter((x) => x === c.id).length > 0) next.push(c.id);
    }
    sfx.select();
    setSlots(next);
  };
  const go = () => {
    if (slots.length < RENEW_COST) return;
    const card = renewalCard(rarity, owned, slots);
    if (!card) return;
    const spent: Record<string, number> = {};
    for (const id of slots) spent[id] = (spent[id] ?? 0) + 1;
    const fresh = !owned[card.id];
    renew(spent, card.id);
    setSlots([]);
    sfx.whoosh();
    setResult({ card, fresh, turned: false });
    window.setTimeout(() => {
      setResult((r) => r && { ...r, turned: true });
      if (RARITY_INFO[card.rarity].rank >= 3) (sfx.victory(), celebrateBig());
      else (sfx.correct(), celebrate());
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="page w-full max-w-2xl space-y-4 rounded-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">♻ Renewal</h2>
            <p className="text-sm text-ink-soft">
              Give {RENEW_COST} spare copies of one rarity, get one card of that rarity — one you don&apos;t have yet, while there are any left. The first copy of every
              card always stays.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pick(r)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${rarity === r ? 'border-ink bg-ink text-paper' : 'border-rule-strong'} ${spares[r] < RENEW_COST ? 'opacity-50' : ''}`}
            >
              {RARITY_INFO[r].gem} {RARITY_INFO[r].name} <span className="text-xs opacity-80">({spares[r]} spare)</span>
            </button>
          ))}
        </div>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-44 [perspective:1000px] sm:w-52">
              <div className={`relative transition-transform duration-700 [transform-style:preserve-3d] ${result.turned ? '[transform:rotateY(180deg)]' : 'animate-pulse'}`}>
                <div className="[backface-visibility:hidden]">
                  <CardBack rarity={rarity === 'common' ? undefined : rarity} />
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <CardFace card={result.card} count={owned[result.card.id]} isNew={result.fresh} />
                </div>
              </div>
            </div>
            {result.turned && (
              <p className="animate-pop text-center">
                <span className="font-display font-bold" style={{ color: RARITY_LIGHT[result.card.rarity] }}>
                  {RARITY_INFO[result.card.rarity].name}
                </span>{' '}
                · <b>{shownName(result.card.name, result.card.set)}</b> {result.fresh ? '— new to your album!' : '— another copy (you had them all).'}
              </p>
            )}
            <button type="button" onClick={() => setResult(null)} className="btn-accent rounded-md px-5 py-2 font-display font-bold">
              Renew again
            </button>
          </div>
        ) : (
          <>
            {/* The five slots. */}
            <div className="flex items-center gap-2">
              {Array.from({ length: RENEW_COST }, (_, i) => {
                const c = slots[i] ? CARDS.find((x) => x.id === slots[i]) : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => c && (sfx.select(), setSlots(slots.filter((_, j) => j !== i)))}
                    className="w-14 sm:w-16"
                    aria-label={c ? `Take back ${c.name}` : 'Empty slot'}
                  >
                    {c ? <CardFace card={c} tilt={false} /> : <span className="grid aspect-[5/7] place-items-center rounded-md border-2 border-dashed border-rule-strong text-ink-faint">{i + 1}</span>}
                  </button>
                );
              })}
              <span className="ml-auto flex flex-col gap-1.5">
                <button type="button" onClick={autoFill} disabled={!list.length || slots.length >= RENEW_COST} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
                  Fill
                </button>
                <button type="button" onClick={go} disabled={slots.length < RENEW_COST} className="btn-accent rounded-md px-4 py-2 font-display font-bold disabled:opacity-40">
                  Renew
                </button>
              </span>
            </div>

            {/* The spares to choose from. */}
            {list.length ? (
              <div className="grid max-h-[45vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                {list.map((c) => (
                  <button key={c.id} type="button" onClick={() => add(c.id)} disabled={left(c.id) <= 0 || slots.length >= RENEW_COST} className="relative disabled:opacity-40" title={c.name}>
                    <CardFace card={c} tilt={false} />
                    <span className="absolute bottom-1 right-1 rounded-full bg-ink px-1.5 text-[10px] font-bold text-paper">×{left(c.id)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No spare {RARITY_INFO[rarity].name.toLowerCase()} copies yet — open packs, and your doubles land here.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
