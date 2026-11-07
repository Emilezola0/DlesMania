import { useMemo } from 'react';
import { DleCoin } from '../components/DleCoin';
import { PackArt } from '../gacha/PackArt';
import { SETS } from '../gacha/cards';
import { packsFor } from '../gacha/packs';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { NAME_STYLES, WRAPPERS, type Cosmetic } from './cosmetics';
import { useShownName } from './ProfileTag';
export { useShownName };

/** One cosmetic: its look, and buy / use / take off. */
function Item({ c, children, worn, onWear }: { c: Cosmetic; children: React.ReactNode; worn: boolean; onWear: (on: boolean) => void }) {
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => (s.cosmetics ?? []).includes(c.id));
  const buy = useProgress((s) => s.buyCosmetic);
  return (
    <div className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center ${worn ? 'border-accent bg-tile' : 'border-rule'}`}>
      <div className="grid min-h-16 w-full place-items-center">{children}</div>
      <p className="font-display font-bold">{c.name}</p>
      <p className="text-xs text-ink-soft">{c.blurb}</p>
      {owned ? (
        <button type="button" onClick={() => (sfx.select(), onWear(!worn))} className={`${worn ? 'btn-paper' : 'btn-accent'} mt-auto w-full rounded-md px-3 py-1.5 text-sm font-semibold`}>
          {worn ? 'Take off' : 'Use'}
        </button>
      ) : (
        <button
          type="button"
          disabled={coins < c.price}
          onClick={() => {
            if (buy(c.id, c.price)) (sfx.coins(3), celebrate());
          }}
          className="btn-ink mt-auto flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          title={coins < c.price ? 'Not enough DleCoins' : undefined}
        >
          Buy · {c.price.toLocaleString()} <DleCoin className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Casino → Boutique: name styles and pack wrappers, bought outright (looks only, nothing to win). */
export function Boutique() {
  const name = useShownName();
  const nameStyle = useProgress((s) => s.nameStyle);
  const setNameStyle = useProgress((s) => s.setNameStyle);
  const wrapper = useProgress((s) => s.wrapper);
  const setWrapper = useProgress((s) => s.setWrapper);
  // A pack to show the wrappers on.
  const sample = useMemo(() => packsFor(SETS)[0], []);
  return (
    <div className="space-y-4">
      <section className="page space-y-3 rounded-md p-4">
        <div>
          <h3 className="font-display text-lg font-bold">Name styles</h3>
          <p className="text-sm text-ink-soft">Your name on your profile (Account), in a style of your own.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NAME_STYLES.map((c) => (
            <Item key={c.id} c={c} worn={nameStyle === c.id} onWear={(on) => setNameStyle(on ? c.id : null)}>
              <span className={`max-w-full truncate font-display text-xl font-bold ${c.className}`}>{name}</span>
            </Item>
          ))}
        </div>
      </section>
      <section className="page space-y-3 rounded-md p-4">
        <div>
          <h3 className="font-display text-lg font-bold">Pack wrappers</h3>
          <p className="text-sm text-ink-soft">Every pack you open, wrapped your way. Looks only: the cards inside are the same, and a golden pack stays gold.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WRAPPERS.map((c) => (
            <Item key={c.id} c={c} worn={wrapper === c.id} onWear={(on) => setWrapper(on ? c.id : null)}>
              {sample && <PackArt pack={sample} wrapper={c.id} className="w-20" />}
            </Item>
          ))}
        </div>
      </section>
    </div>
  );
}
