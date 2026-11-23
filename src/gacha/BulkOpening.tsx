// A bulk opening (over MAX_OPEN packs at once, typed by hand in the Shop: up to 100,000, the owner's call): no show —
// with hundreds of thousands of cards, thousands of top cards and cosmic events, PackOpening's stars and scenes can't
// keep up. The haul straight away: how many of each rarity, the new cards, and every Legendary card or better once,
// with how many times it came. The cards (cosmic events' too) were the player's at the pull, as with any opening;
// only the shows' extras (a black hole's anomalies, an eclipse) don't happen here.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins } from '../components/DleCoin';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { RARITIES, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from './cards';
import type { Pack } from './packs';
import { CardAvatar } from './Perks';

const TOP: Rarity[] = ['legendary', 'mythic', 'omni'];
/** The top cards drawn so many at a time, more on a tap (a few hundred faces at once is plenty). */
const CHUNK = 120;

export function BulkOpening({ pack, times, cards, fresh, onClose, onAgain, canAgain }: { pack: Pack; times: number; cards: Card[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean }) {
  const { perRarity, top } = useMemo(() => {
    const perRarity = new Map<Rarity, number>();
    const by = new Map<string, { card: Card; n: number }>();
    for (const c of cards) {
      perRarity.set(c.rarity, (perRarity.get(c.rarity) ?? 0) + 1);
      if (!TOP.includes(c.rarity)) continue;
      const g = by.get(c.id);
      if (g) g.n++;
      else by.set(c.id, { card: c, n: 1 });
    }
    const rank = (r: Rarity) => RARITIES.indexOf(r);
    return { perRarity, top: [...by.values()].sort((a, b) => rank(b.card.rarity) - rank(a.card.rarity) || b.n - a.n || a.card.name.localeCompare(b.card.name)) };
  }, [cards]);
  const [shown, setShown] = useState(CHUNK);
  const best = top[0]?.card.rarity;
  // One sound for it all; a little confetti for an Omni.
  useEffect(() => {
    sfx.pop();
    if (best) sfx.shimmer(1 + RARITIES.indexOf(best));
    if (best === 'omni') celebrate();
  }, [best]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-[#07060c]/[0.97] p-4 text-white">
      <div className="m-auto w-full max-w-3xl space-y-4 text-center">
        <p className="font-display text-sm font-bold tracking-[0.3em] text-white/90">
          {pack.name.toUpperCase()} · {times.toLocaleString()} PACKS · {cards.length.toLocaleString()} CARDS
        </p>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-bold">
          {RARITIES.filter((r) => perRarity.get(r)).map((r) => (
            <span key={r} style={{ color: RARITY_LIGHT[r] }}>
              {RARITY_INFO[r].name} ×{(perRarity.get(r) ?? 0).toLocaleString()}
            </span>
          ))}
        </p>
        <p className="text-sm text-white/75">{fresh.size ? `${fresh.size.toLocaleString()} new card${fresh.size > 1 ? 's' : ''} for your album` : 'Nothing new for your album this time'}</p>
        {top.length > 0 && (
          <>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-white/60">Legendary and better · {top.length.toLocaleString()} different</p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8">
              {top.slice(0, shown).map(({ card, n }) => (
                <div key={card.id} className="relative flex min-w-0 flex-col items-center gap-1" title={`${card.name} (${RARITY_INFO[card.rarity].name}) ×${n}`}>
                  <CardAvatar card={card} className="size-14" />
                  <span className="max-w-full truncate text-[10px] font-bold" style={{ color: RARITY_LIGHT[card.rarity] }}>
                    {card.name}
                  </span>
                  <span className="text-[10px] text-white/60">×{n.toLocaleString()}</span>
                  {fresh.has(card.id) && <span className="absolute -right-1 -top-2 rounded border border-coral bg-[#1b1530] px-1 font-display text-[9px] font-black text-coral">NEW</span>}
                </div>
              ))}
            </div>
            {shown < top.length && (
              <button type="button" onClick={() => setShown((s) => s + CHUNK)} className="rounded-md border border-white/40 px-4 py-1.5 text-xs font-semibold">
                Show more ({(top.length - shown).toLocaleString()} left)
              </button>
            )}
          </>
        )}
        {/* Room for the buttons below, which stay put. */}
        <div className="h-20" aria-hidden />
      </div>
      {/* Again and Close: always in the same place at the bottom of the screen, whatever came out (to open again and
          again without looking for them); Again greyed out when the coins aren't there, never gone. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center gap-2 bg-gradient-to-t from-[#07060c] via-[#07060c]/90 to-transparent px-4 pb-5 pt-8">
        <button type="button" disabled={!canAgain} onClick={() => canAgain && onAgain()} className="min-w-52 rounded-md bg-white px-5 py-2 font-display font-bold text-[#1b1530] disabled:opacity-40">
          Again · <Coins n={pack.cost * times} />
        </button>
        <button type="button" onClick={onClose} className="w-32 rounded-md border-2 border-white/60 bg-[#07060c] px-5 py-2 font-display font-bold">
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
