import { useEffect, useMemo, useState } from 'react';
import { DleCoin } from '../components/DleCoin';
import { PackArt } from '../gacha/PackArt';
import { SETS } from '../gacha/cards';
import { packsFor, type Pack } from '../gacha/packs';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CARD_SHOP } from './casino';
import { OpeningAround, OpeningInside, flapClass, wholeClass } from '../gacha/WrapOpening';
import { myStage } from './ascended';
import { isClawOnly, NAME_STYLES, STAGE_NAMES, TITLE_ITEMS, WRAPPERS, type Cosmetic, type LockFacts } from './cosmetics';
import { useFeats } from './unlocks';
import { useShownName } from './ProfileTag';
export { useShownName };

/** One cosmetic: its look, and buy (in DleCoins or casino tokens) / use / take off. */
function Item({ c, children, worn, onWear }: { c: Cosmetic; children: React.ReactNode; worn: boolean; onWear: (on: boolean) => void }) {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.chips ?? 0);
  const owned = useProgress((s) => (s.cosmetics ?? []).includes(c.id));
  const buy = useProgress((s) => s.buyCosmetic);
  const pay = (inTokens: boolean) => {
    if (buy(c.id, inTokens ? c.tokens : c.price, inTokens, !!c.evolve)) (sfx.coins(3), celebrate());
  };
  const tokensOnly = !c.price && c.tokens > 0;
  const claw = isClawOnly(c);
  const lock = useLock(c);
  const stage = useProgress((s) => myStage(s, c.id));
  return (
    <div className={`relative flex flex-col items-center gap-2 rounded-md border p-3 text-center ${c.ascended ? 'boutique-ascended' : worn ? 'border-accent bg-tile' : c.prestige ? 'boutique-prestige' : tokensOnly ? 'border-coral/60 bg-coral/5' : 'border-rule'}`}>
      {claw && !owned && <span className="absolute -top-2 right-2 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">🕹️ Claw prize</span>}
      {c.ascended && <span className="boutique-ascended-badge absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow">{worn ? '✓ Worn' : '✴ Ascended'}</span>}
      {c.prestige && !owned && <span className="boutique-prestige-badge absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow">💎 Prestige</span>}
      {tokensOnly && !c.prestige && !c.ascended && !owned && <span className="absolute -top-2 right-2 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">🎟️ Tokens only</span>}
      <div className="grid min-h-16 w-full place-items-center">{children}</div>
      <p className="font-display font-bold">{c.name}</p>
      <p className="text-xs text-ink-soft">{c.blurb}</p>
      {c.evolve && owned && <StageBar c={c} stage={stage.stage} since={stage.since} />}
      {c.evolve && !owned && (
        <p className="text-[11px] font-semibold text-ink-soft">
          Evolves with the dailies you play after buying it: {c.evolve.map((at, k) => `${STAGE_NAMES[k]}${at ? ` (${at})` : ''}`).join(' → ')}.
        </p>
      )}
      {owned ? (
        <button type="button" onClick={() => (sfx.select(), onWear(!worn))} className={`${worn ? 'btn-paper' : 'btn-accent'} mt-auto w-full rounded-md px-3 py-1.5 text-sm font-semibold`}>
          {worn ? 'Take off' : 'Use'}
        </button>
      ) : claw ? (
        <p className="mt-auto w-full rounded-md border border-dashed border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink-soft">Not sold: win it at the claw machine</p>
      ) : lock && lock.have < lock.want ? (
        <div className="mt-auto w-full space-y-1 rounded-md border border-dashed border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink-soft">
          <p>
            🔒 {lock.text} · {lock.have.toLocaleString('en')} / {lock.want.toLocaleString('en')}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-tile">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300" style={{ width: `${(lock.have / lock.want) * 100}%` }} />
          </div>
          <p className="tabular-nums">Then {c.tokens.toLocaleString('en')} 🎟️</p>
        </div>
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

/** What an Ascended piece's lock asks, and how far along the player is (none for a piece without a lock). */
function useLock(c: Cosmetic): { text: string; have: number; want: number } | null {
  const feats = useFeats();
  const owned = useProgress((s) => s.cosmetics ?? []);
  if (!c.lock) return null;
  const facts: LockFacts = { packs: feats.packs, owned, omni: feats.omni, bestStreak: feats.bestStreak };
  const [have, want] = c.lock.need(facts);
  return { text: c.lock.text, have: Math.min(have, want), want };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** An evolving piece the player owns: its stage, and the dailies to the next. */
function StageBar({ c, stage, since }: { c: Cosmetic; stage: number; since: number }) {
  const at = c.evolve ?? [0];
  const next = at[stage];
  const from = at[stage - 1] ?? 0;
  return (
    <div className="w-full space-y-1 text-[11px] font-semibold">
      <p className="boutique-ascended-title font-display text-xs font-bold uppercase tracking-widest">
        Stage {ROMAN[stage - 1]} · {STAGE_NAMES[stage - 1]}
      </p>
      {next !== undefined ? (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-tile">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300" style={{ width: `${((since - from) / (next - from)) * 100}%` }} />
          </div>
          <p className="tabular-nums text-ink-soft">
            {since} / {next} dailies to {STAGE_NAMES[stage]}
          </p>
        </>
      ) : (
        <p className="text-ink-soft">Fully ascended.</p>
      )}
    </div>
  );
}

/**
 * An evolving piece's preview: one stage at a time (the player's own, or the last for one not bought yet), and
 * buttons to see the others.
 */
function StagePreview({ c, children }: { c: Cosmetic; children: (stageClass: string) => React.ReactNode }) {
  const owned = useProgress((s) => (s.cosmetics ?? []).includes(c.id));
  const mine = useProgress((s) => myStage(s, c.id).stage);
  const stages = c.evolve?.length ?? 1;
  const [shown, setShown] = useState<number | null>(null);
  const stage = shown ?? (owned ? mine : stages);
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {children(stage > 1 ? ` ascend-${stage}` : '')}
      <div className="flex gap-1" role="group" aria-label="See each stage">
        {Array.from({ length: stages }, (_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => (sfx.select(), setShown(k + 1))}
            title={STAGE_NAMES[k]}
            aria-pressed={stage === k + 1}
            className={`size-6 rounded-full border text-[10px] font-bold transition ${stage === k + 1 ? 'border-violet-400 bg-violet-500/20 text-ink' : 'border-rule text-ink-faint hover:border-violet-300'} ${owned && k + 1 > mine ? 'opacity-50' : ''}`}
          >
            {ROMAN[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An Ascended wrapper's preview: the pack, and a button that opens it its own way (then it's back, wrapped). */
function OpeningPreview({ c, sample }: { c: Cosmetic; sample: Pack }) {
  const [run, setRun] = useState(0);
  const playing = run > 0;
  useEffect(() => {
    if (!run) return;
    const t = window.setTimeout(() => setRun(0), 1900);
    return () => window.clearTimeout(t);
  }, [run]);
  const o = c.opening!;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20">
        <div key={run} className={`relative ${playing ? wholeClass(o) : ''}`}>
          <div className={playing ? flapClass(o) : ''}>
            <PackArt pack={sample} wrapper={c.id} className="w-20" />
          </div>
          {playing && <OpeningInside kind={o} />}
        </div>
        {playing && <OpeningAround key={`fx${run}`} kind={o} />}
      </div>
      <button
        type="button"
        disabled={playing}
        onClick={() => (sfx.tear(), setRun(Date.now()))}
        className="rounded-full border border-violet-400/60 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft transition hover:bg-violet-500/10 disabled:opacity-50"
      >
        ▶ Watch it open
      </button>
    </div>
  );
}

/** A shelf of the Boutique: its pieces, its Prestige row (tokens only, the finest effects), its Ascended row (a lock, then tokens). */
function Shelf<T extends Cosmetic>({ title, text, items, show }: { title: string; text: string; items: T[]; show: (c: T) => React.ReactNode }) {
  const grid = 'grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-5';
  const prestige = items.filter((c) => c.prestige);
  const ascended = items.filter((c) => c.ascended);
  return (
    <section className="page space-y-3 rounded-md p-4">
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="text-sm text-ink-soft">{text}</p>
      </div>
      <div className={grid}>{items.filter((c) => !c.prestige && !c.ascended).map(show)}</div>
      {prestige.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <span className="h-px flex-1 bg-[#d4a017]/50" />
            <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[#d4a017]">💎 Prestige · tokens only</span>
            <span className="h-px flex-1 bg-[#d4a017]/50" />
          </div>
          <div className={grid}>{prestige.map(show)}</div>
        </>
      )}
      {ascended.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-400/70 to-amber-300/70" />
            <span className="boutique-ascended-title text-center font-display text-sm font-bold uppercase tracking-[0.25em]">✴ Ascended · earn it, then buy it</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-400/70 to-amber-300/70" />
          </div>
          <div className={grid}>{ascended.map(show)}</div>
        </>
      )}
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
      <Shelf
        title="Name styles"
        text="Your name on your profile, in the top bar and in your friends' lists, in a style of your own."
        items={NAME_STYLES}
        show={(c) => (
          <Item key={c.id} c={c} worn={nameStyle === c.id} onWear={(on) => setNameStyle(on ? c.id : null)}>
            {c.evolve ? (
              <StagePreview c={c}>{(st) => <span className={`max-w-full truncate px-1 py-0.5 font-display text-xl font-bold ${c.className}${st}`}>{name}</span>}</StagePreview>
            ) : (
              <span className={`max-w-full truncate px-1 py-0.5 font-display text-xl font-bold ${c.className}`}>{name}</span>
            )}
          </Item>
        )}
      />
      <Shelf
        title="Pack wrappers"
        text="Every pack you open, wrapped your way. Looks only: the cards inside are the same, and a golden pack stays gold."
        items={WRAPPERS}
        show={(c) => (
          <Item key={c.id} c={c} worn={wrapper === c.id} onWear={(on) => setWrapper(on ? c.id : null)}>
            {sample && (c.opening ? <OpeningPreview c={c} sample={sample} /> : <PackArt pack={sample} wrapper={c.id} className="w-20" />)}
          </Item>
        )}
      />
      <Shelf
        title="Titles"
        text="Worn under your name, in their own colours, and your friends see them too. The other titles are earned by playing (pick any of them on your Account page)."
        items={TITLE_ITEMS}
        show={(c) => {
          const id = c.id.slice('title:'.length);
          return (
            <Item key={c.id} c={c} worn={title === id} onWear={(on) => setTitle(on ? id : null)}>
              {c.evolve ? (
                <StagePreview c={c}>
                  {(st) => (
                    <span className="flex max-w-full flex-col leading-tight">
                      <span className="max-w-full truncate font-display text-sm font-bold">{name}</span>
                      <span className={`px-1 text-[11px] font-bold uppercase tracking-wider ${c.className}${st}`}>« {c.name} »</span>
                    </span>
                  )}
                </StagePreview>
              ) : (
                <span className="flex max-w-full flex-col leading-tight">
                  <span className="max-w-full truncate font-display text-sm font-bold">{name}</span>
                  <span className={`px-1 text-[11px] font-bold uppercase tracking-wider ${c.className || 'text-ink-soft'}`}>« {c.name} »</span>
                </span>
              )}
            </Item>
          );
        }}
      />
    </div>
  );
}
