import { useMemo } from 'react';
import { DleCoin } from '../components/DleCoin';
import { PackArt } from '../gacha/PackArt';
import { SETS } from '../gacha/cards';
import { packsFor } from '../gacha/packs';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CARD_SHOP } from './casino';
import { isClawOnly, NAME_STYLES, TITLE_ITEMS, WRAPPERS, type Cosmetic } from './cosmetics';
import { useShownName } from './ProfileTag';
export { useShownName };

/** One cosmetic: its look, and buy (in DleCoins or casino tokens) / use / take off. */
function Item({ c, children, worn, onWear }: { c: Cosmetic; children: React.ReactNode; worn: boolean; onWear: (on: boolean) => void }) {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.chips ?? 0);
  const owned = useProgress((s) => (s.cosmetics ?? []).includes(c.id));
  const buy = useProgress((s) => s.buyCosmetic);
  const pay = (inTokens: boolean) => {
    if (buy(c.id, inTokens ? c.tokens : c.price, inTokens)) (sfx.coins(3), celebrate());
  };
  const tokensOnly = !c.price && c.tokens > 0;
  const claw = isClawOnly(c);
  return (
    <div className={`relative flex flex-col items-center gap-2 rounded-md border p-3 text-center ${worn ? 'border-accent bg-tile' : tokensOnly ? 'border-coral/60 bg-coral/5' : 'border-rule'}`}>
      {claw && !owned && <span className="absolute -top-2 right-2 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">🕹️ Claw prize</span>}
      {tokensOnly && !owned && <span className="absolute -top-2 right-2 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">🎟️ Tokens only</span>}
      <div className="grid min-h-16 w-full place-items-center">{children}</div>
      <p className="font-display font-bold">{c.name}</p>
      <p className="text-xs text-ink-soft">{c.blurb}</p>
      {owned ? (
        <button type="button" onClick={() => (sfx.select(), onWear(!worn))} className={`${worn ? 'btn-paper' : 'btn-accent'} mt-auto w-full rounded-md px-3 py-1.5 text-sm font-semibold`}>
          {worn ? 'Take off' : 'Use'}
        </button>
      ) : claw ? (
        <p className="mt-auto w-full rounded-md border border-dashed border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink-soft">Not sold: win it at the claw machine</p>
      ) : (
        <div className="mt-auto flex w-full flex-col gap-1.5">
          {c.price > 0 && (
            <button
              type="button"
              disabled={coins < c.price}
              onClick={() => pay(false)}
              aria-label={`Buy ${c.name} for ${c.price} DleCoins`}
              className="btn-ink flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums disabled:opacity-50"
            >
              {c.price.toLocaleString('en')} <DleCoin className="size-3.5" />
            </button>
          )}
          {c.tokens > 0 && (
            <button
              type="button"
              disabled={tokens < c.tokens}
              onClick={() => pay(true)}
              aria-label={`Buy ${c.name} for ${c.tokens} casino tokens`}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-coral/60 bg-coral/15 px-3 py-1.5 text-sm font-semibold tabular-nums transition hover:bg-coral/25 disabled:opacity-50"
            >
              {c.tokens.toLocaleString('en')} <span aria-hidden>🎟️</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Shelf({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="page space-y-3 rounded-md p-4">
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="text-sm text-ink-soft">{text}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

/** Casino → Boutique: name styles, pack wrappers and titles, bought outright in DleCoins or casino tokens (looks only, nothing to win). */
export function Boutique() {
  const name = useShownName();
  const nameStyle = useProgress((s) => s.nameStyle);
  const setNameStyle = useProgress((s) => s.setNameStyle);
  const wrapper = useProgress((s) => s.wrapper);
  const setWrapper = useProgress((s) => s.setWrapper);
  const title = useProgress((s) => s.title);
  const setTitle = useProgress((s) => s.setTitle);
  const owned = useProgress((s) => s.cosmetics ?? []);
  const all = NAME_STYLES.length + WRAPPERS.length + TITLE_ITEMS.length;
  const mine = [...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].filter((c) => owned.includes(c.id)).length;
  // A pack to show the wrappers on.
  const sample = useMemo(() => packsFor(SETS)[0], []);
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-coral/40 bg-coral/5 px-4 py-2.5 text-sm text-ink-soft">
        Pay in DleCoins <DleCoin className="inline size-3.5 align-[-2px]" /> or in casino tokens 🎟️ (one for every {CARD_SHOP.coinsPerToken} coins you put into the machines, win or lose). A few pieces are sold for tokens only, and a few are won only at the claw machine. You own{' '}
        <b className="text-ink">
          {mine} of {all}
        </b>
        .
      </p>
      <Shelf title="Name styles" text="Your name on your profile and in the top bar, in a style of your own.">
        {NAME_STYLES.map((c) => (
          <Item key={c.id} c={c} worn={nameStyle === c.id} onWear={(on) => setNameStyle(on ? c.id : null)}>
            <span className={`max-w-full truncate font-display text-xl font-bold ${c.className}`}>{name}</span>
          </Item>
        ))}
      </Shelf>
      <Shelf title="Pack wrappers" text="Every pack you open, wrapped your way. Looks only: the cards inside are the same, and a golden pack stays gold.">
        {WRAPPERS.map((c) => (
          <Item key={c.id} c={c} worn={wrapper === c.id} onWear={(on) => setWrapper(on ? c.id : null)}>
            {sample && <PackArt pack={sample} wrapper={c.id} className="w-20" />}
          </Item>
        ))}
      </Shelf>
      <Shelf title="Titles" text="Worn under your name. The other titles are earned by playing (pick any of them on your Account page).">
        {TITLE_ITEMS.map((c) => {
          const id = c.id.slice('title:'.length);
          return (
            <Item key={c.id} c={c} worn={title === id} onWear={(on) => setTitle(on ? id : null)}>
              <span className="flex flex-col leading-tight">
                <span className="max-w-full truncate font-display text-sm font-bold">{name}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">« {c.name} »</span>
              </span>
            </Item>
          );
        })}
      </Shelf>
    </div>
  );
}
