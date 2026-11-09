// /trades — making and taking offers with other players: cards and DleCoins on each side (src/cloud/trades.ts).
// Only what was earned with an account signed in can go in a trade (tradeLock, src/store/progress.ts).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DleCoin } from '../components/DleCoin';
import { Spinner } from '../components/Spinner';
import { startCloud, useCloud } from '../cloud/state';
import type { Trade } from '../cloud/trades';
import { CardFace } from '../gacha/CardView';
import { CARDS, CARD_BY_ID, COLLECTIBLE, RARITY_INFO, type Card } from '../gacha/cards';
import { TRADE_LIMITS } from '../gacha/economy';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { lockedCount, tradableCoins, tradableCopies, useProgress } from '../store/progress';
import { searchScore } from '../utils/textMatcher';

const trades = () => import('../cloud/trades');
const MAX_CARDS = TRADE_LIMITS.maxCards;
const MAX_COINS = TRADE_LIMITS.maxCoins;

const link = (code: string) => `${window.location.origin}${window.location.pathname}#/trades?code=${code}`;
const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const nameOf = (id: string) => shownName(CARD_BY_ID.get(id)?.name ?? '?');
const fmt = (n: number) => n.toLocaleString('en');
const countOf = (ids: string[]) => {
  const n: Record<string, number> = {};
  for (const id of ids) n[id] = (n[id] ?? 0) + 1;
  return n;
};

/** What the player can't give out of these cards and coins (empty: all of it). */
function useMissing(cards: string[], coins: number): string[] {
  const s = useProgress((x) => x);
  return useMemo(() => {
    const out: string[] = [];
    for (const [id, n] of Object.entries(countOf(cards))) {
      if (tradableCopies(s, id) >= n) continue;
      out.push((s.cards[id] ?? 0) >= n ? `${nameOf(id)} 🔒` : `${n > 1 ? `${n}× ` : ''}${nameOf(id)}`);
    }
    if (coins > tradableCoins(s)) out.push(coins > s.coins ? `${fmt(coins - s.coins)} more DleCoins` : 'DleCoins 🔒');
    return out;
  }, [s, cards, coins]);
}

/** A card in a trade, small, with a × to take it out. */
function Slot({ card, onRemove, mark }: { card: Card; onRemove?: () => void; mark?: string }) {
  return (
    <div className="relative w-[4.5rem] shrink-0 sm:w-20" title={`${shownName(card.name)} · ${RARITY_INFO[card.rarity].name}`}>
      <CardFace card={card} tilt={false} still />
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Take ${shownName(card.name)} out`} className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-paper bg-coral text-xs font-black text-white shadow">
          ×
        </button>
      )}
      {mark && <span className="absolute inset-x-0 -bottom-1 mx-auto w-fit rounded-full bg-coral px-1.5 text-[10px] font-bold text-white">{mark}</span>}
    </div>
  );
}

/** The empty tile that opens the card picker, or the "any card" tile. */
function AddTile({ label, on, onClick, dashed = true }: { label: ReactNode; on?: boolean; onClick?: () => void; dashed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid aspect-[5/7] w-[4.5rem] shrink-0 place-items-center rounded-lg border-2 p-1 text-center text-xs font-bold transition sm:w-20 ${dashed ? 'border-dashed' : ''} ${on ? 'border-accent bg-accent/10 text-ink' : 'border-rule-strong text-ink-soft hover:border-ink hover:text-ink'}`}
    >
      {label}
    </button>
  );
}

/** DleCoins on one side of a trade: typed, or a few quick steps. */
function CoinField({ value, onChange, max, note }: { value: number; onChange: (n: number) => void; max: number; note?: string }) {
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Math.floor(n) || 0)));
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 rounded-md border border-rule-strong bg-card px-2 py-1.5 focus-within:border-ink">
        <DleCoin className="size-5" />
        <input type="number" inputMode="numeric" min={0} max={max} step={100} value={value || ''} placeholder="0" onChange={(e) => set(Number(e.target.value))} className="w-full min-w-0 bg-transparent font-bold tabular-nums outline-none" aria-label="DleCoins" />
        {value > 0 && (
          <button type="button" onClick={() => set(0)} className="text-xs font-semibold text-ink-soft hover:text-ink">
            Clear
          </button>
        )}
      </label>
      <div className="flex flex-wrap items-center gap-1">
        {[1000, 10000, 100000].map((n) => (
          <button key={n} type="button" disabled={value >= max} onClick={() => set(value + n)} className="btn-paper rounded-full px-2 py-0.5 text-xs font-semibold disabled:opacity-40">
            +{n >= 1000 ? `${n / 1000}k` : n}
          </button>
        ))}
        <button type="button" disabled={!max || value >= max} onClick={() => set(max)} className="btn-paper rounded-full px-2 py-0.5 text-xs font-semibold disabled:opacity-40">
          Max
        </button>
        {note && <span className="ml-auto text-xs text-ink-soft">{note}</span>}
      </div>
    </div>
  );
}

/** One side of a trade, as a panel. */
function Side({ title, tone, children, foot }: { title: ReactNode; tone: 'give' | 'get'; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className={`page min-w-0 space-y-3 rounded-xl border-2 p-4 ${tone === 'give' ? 'border-coral/40' : 'border-hit/50'}`}>
      <h3 className="flex items-center gap-2 font-display text-sm font-bold tracking-wider uppercase">
        <span className={`size-2.5 rounded-full ${tone === 'give' ? 'bg-coral' : 'bg-hit'}`} />
        {title}
      </h3>
      {children}
      {foot}
    </section>
  );
}

/** Cards to add to a side: the player's own (tradable copies; locked ones shown, greyed) or any card of the game. */
function Picker({ mine, used, onAdd, onClose, full }: { mine: boolean; used: string[]; onAdd: (id: string) => void; onClose: () => void; full: boolean }) {
  const s = useProgress((x) => x);
  const [q, setQ] = useState('');
  const n = countOf(used);
  const list = useMemo(() => {
    if (!mine) return q.trim().length < 2 ? [] : COLLECTIBLE.filter((c) => searchScore(q, c.name) !== null).slice(0, 18);
    return CARDS.filter((c) => s.cards[c.id] && (!q || searchScore(q, c.name) !== null))
      .sort((a, b) => (tradableCopies(s, b.id) > 0 ? 1 : 0) - (tradableCopies(s, a.id) > 0 ? 1 : 0) || RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank)
      .slice(0, 60);
  }, [mine, q, s]);
  return (
    <div className="animate-pop space-y-2 rounded-xl border border-rule-strong bg-tile p-3">
      <div className="flex items-center gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={mine ? 'Search your cards…' : 'Type a card name…'} className="min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 py-1.5" />
        <button type="button" onClick={onClose} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
          Done
        </button>
      </div>
      {full && <p className="text-xs font-semibold text-coral">{MAX_CARDS} cards a side at most.</p>}
      {list.length ? (
        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
          {list.map((c) => {
            const free = mine ? tradableCopies(s, c.id) - (n[c.id] ?? 0) : 1;
            const locked = mine && tradableCopies(s, c.id) < (s.cards[c.id] ?? 0);
            return (
              <button
                key={c.id}
                type="button"
                disabled={full || free <= 0}
                onClick={() => (sfx.select(), onAdd(c.id))}
                className="relative rounded-lg p-0.5 transition enabled:hover:-translate-y-0.5 disabled:opacity-40"
                title={`${shownName(c.name)} · ${RARITY_INFO[c.rarity].name}${locked ? ' · some copies were earned before your account was linked' : ''}`}
              >
                <CardFace card={c} tilt={false} still />
                {mine && (
                  <span className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-full bg-ink/80 px-1.5 text-[10px] font-bold text-paper">
                    {Math.max(0, free)} to trade{locked ? ' · 🔒' : ''}
                  </span>
                )}
                {!!n[c.id] && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-black text-white">{n[c.id]}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{mine ? 'No card to show.' : 'Type at least two letters.'}</p>
      )}
    </div>
  );
}

/** A side of a finished or open trade, read-only and small. */
function Mini({ cards, coins, any }: { cards: string[]; coins: number; any?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {cards.map((id, i) => {
        const c = CARD_BY_ID.get(id);
        return c ? (
          <div key={`${id}${i}`} className="w-9" title={shownName(c.name)}>
            <CardFace card={c} tilt={false} still />
          </div>
        ) : null;
      })}
      {any && <span className="rounded-md border border-dashed border-rule-strong px-1.5 py-2 text-[10px] font-bold text-ink-soft">any card</span>}
      {coins > 0 && (
        <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
          <DleCoin className="size-4" /> {fmt(coins)}
        </span>
      )}
      {!cards.length && !coins && !any && <span className="text-ink-soft">—</span>}
    </div>
  );
}

const STATUS: Record<Trade['status'], { label: string; cls: string }> = {
  open: { label: 'Waiting', cls: 'bg-ochre/20 text-ink' },
  accepted: { label: 'Taken', cls: 'bg-hit/20 text-ink' },
  cancelled: { label: 'Cancelled', cls: 'bg-rule text-ink-soft' },
  claimed: { label: 'Done', cls: 'bg-hit/20 text-ink' },
};

type Tab = 'make' | 'take' | 'mine';

export default function Trades() {
  const { status, email, actions } = useCloud();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('code') ? 'take' : 'make');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [offer, setOffer] = useState<Trade | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [picking, setPicking] = useState<'give' | 'want' | 'pick' | null>(null);
  const [mine, setMine] = useState<Trade[]>([]);
  // The offer being made.
  const [give, setGive] = useState<string[]>(() => (params.get('give') ? [params.get('give')!] : []));
  const [giveCoins, setGiveCoins] = useState(0);
  const [want, setWant] = useState<string[]>([]);
  const [wantAny, setWantAny] = useState(false);
  const [wantCoins, setWantCoins] = useState(0);
  const [made, setMade] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const save = useProgress((x) => x);
  const locked = lockedCount(save);
  const spareCoins = tradableCoins(save);
  const signedIn = !!email && status !== 'signedOut' && !!actions;
  useEffect(() => void startCloud(), []);

  const giveMissing = useMissing(give, giveCoins);
  const takeCards = offer ? [...offer.want, ...(offer.wantAny && pick ? [pick] : [])] : [];
  const takeMissing = useMissing(takeCards, offer?.wantCoins ?? 0);

  const refresh = async () => {
    const t = await trades();
    setUid(t.myUid());
    const back = await t.collectTrades();
    if (back.length) {
      const cards = back.flatMap((x) => x.got ?? []);
      const coins = back.reduce((n, x) => n + x.wantCoins, 0);
      setNote({ text: `${back.length} of your offers were taken: ${[cards.length ? cards.map(nameOf).join(', ') : '', coins ? `${fmt(coins)} DleCoins` : ''].filter(Boolean).join(' and ')} came in.`, good: true });
    }
    setMine(await t.myTrades());
  };
  useEffect(() => {
    if (signedIn) refresh().catch((e) => setNote({ text: errorOf(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await f();
    } catch (e) {
      sfx.wrong();
      setNote({ text: errorOf(e) });
    } finally {
      setBusy(false);
    }
  };

  const lookUp = (c = code) =>
    run(async () => {
      const t = await trades();
      const found = await t.loadOffer(c);
      if (!found) throw new Error('No offer with that code.');
      setOffer(found);
      setPick(null);
      setPicking(null);
    });
  // Opened from a shared link: look the offer up straight away.
  useEffect(() => {
    if (signedIn && params.get('code')) void lookUp(params.get('code')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const switchTab = (t: Tab) => {
    sfx.select();
    setTab(t);
    setPicking(null);
    setNote(null);
  };

  if (status === 'off' || status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <Spinner /> Connecting…
      </p>
    );
  }

  const openCount = mine.filter((t) => t.from === uid && t.status === 'open').length;
  const canMake = (give.length > 0 || giveCoins > 0) && (want.length > 0 || wantAny || wantCoins > 0) && !giveMissing.length;
  const wantSlots = want.length + (wantAny ? 1 : 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link to="/album" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Album
        </Link>
        <h1 className="text-5xl font-bold">Trades</h1>
        <p className="text-ink-soft">Swap cards and DleCoins with friends: build an offer, send the code, and whoever takes it gives you what you asked for.</p>
      </div>

      {!signedIn ? (
        <p className="page rounded-md p-5">
          Trading needs an account, so each card reaches the right player.{' '}
          <Link to="/account" className="font-semibold text-accent">
            Sign in
          </Link>{' '}
          first — it takes a moment. What you earned before linking your account stays yours, but can't be traded.
        </p>
      ) : (
        <>
          <nav className="grid grid-cols-3 gap-1 rounded-lg border border-rule bg-tile p-1" aria-label="Trades">
            {(
              [
                ['make', '✍️', 'New offer', 'New'],
                ['take', '🔑', 'Take an offer', 'Take'],
                ['mine', '📜', 'Your trades', 'Yours'],
              ] as const
            ).map(([id, icon, label, short]) => (
              <button key={id} type="button" onClick={() => switchTab(id)} aria-pressed={tab === id} className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1 py-2 font-display text-xs font-bold transition sm:text-sm ${tab === id ? 'bg-paper text-ink shadow' : 'text-ink-soft hover:text-ink'}`}>
                <span aria-hidden>{icon}</span>
                <span className="truncate sm:hidden">{short}</span>
                <span className="truncate max-sm:hidden">{label}</span>
                {id === 'mine' && openCount > 0 && <span className="rounded-full bg-ochre px-1.5 text-[10px] text-ink">{openCount}</span>}
              </button>
            ))}
          </nav>

          {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

          {(locked.cards > 0 || locked.coins > 0) && tab !== 'mine' && (
            <p className="rounded-md border border-rule-strong bg-tile p-3 text-sm text-ink-soft">
              🔒 {[locked.cards ? `${fmt(locked.cards)} card${locked.cards === 1 ? '' : 's'}` : '', locked.coins ? `${fmt(locked.coins)} DleCoins` : ''].filter(Boolean).join(' and ')} were earned before this save was linked to your account: they're still yours, but they can't be traded. Everything you earn signed in can.
            </p>
          )}

          {tab === 'make' && (
            <div className="space-y-4">
              <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
                <Side title="You give" tone="give">
                  <div className="flex flex-wrap gap-2">
                    {give.map((id, i) => (
                      <Slot key={`${id}${i}`} card={CARD_BY_ID.get(id)!} onRemove={() => setGive(give.filter((_, j) => j !== i))} mark={giveMissing.some((m) => m.startsWith(nameOf(id))) ? '🔒' : undefined} />
                    ))}
                    {give.length < MAX_CARDS && <AddTile label={<>＋<br />Add a card</>} on={picking === 'give'} onClick={() => setPicking(picking === 'give' ? null : 'give')} />}
                  </div>
                  <CoinField value={giveCoins} onChange={setGiveCoins} max={Math.min(MAX_COINS, spareCoins)} note={`${fmt(spareCoins)} to trade`} />
                </Side>
                <div className="grid place-items-center text-3xl text-ink-soft max-md:rotate-90" aria-hidden>
                  ⇄
                </div>
                <Side title="You ask for" tone="get">
                  <div className="flex flex-wrap gap-2">
                    {want.map((id, i) => (
                      <Slot key={`${id}${i}`} card={CARD_BY_ID.get(id)!} onRemove={() => setWant(want.filter((_, j) => j !== i))} />
                    ))}
                    {wantAny && <AddTile dashed={false} on label={<span>Any card<br />of theirs<br /><span className="text-coral">×</span></span>} onClick={() => setWantAny(false)} />}
                    {wantSlots < MAX_CARDS && <AddTile label={<>＋<br />A card</>} on={picking === 'want'} onClick={() => setPicking(picking === 'want' ? null : 'want')} />}
                    {!wantAny && wantSlots < MAX_CARDS && <AddTile label={<>＋<br />Any card</>} onClick={() => (sfx.select(), setWantAny(true))} />}
                  </div>
                  <CoinField value={wantCoins} onChange={setWantCoins} max={MAX_COINS} />
                </Side>
              </div>

              {picking === 'give' && <Picker mine used={give} full={give.length >= MAX_CARDS} onAdd={(id) => setGive([...give, id])} onClose={() => setPicking(null)} />}
              {picking === 'want' && <Picker mine={false} used={want} full={wantSlots >= MAX_CARDS} onAdd={(id) => setWant([...want, id])} onClose={() => setPicking(null)} />}

              <div className="page flex flex-wrap items-center gap-3 rounded-xl p-4">
                <p className="min-w-0 flex-1 text-sm text-ink-soft">
                  {giveMissing.length ? (
                    <span className="font-semibold text-coral">Can't give: {giveMissing.join(', ')}.</span>
                  ) : canMake ? (
                    'What you give leaves your save until someone takes the offer — or you cancel it.'
                  ) : (
                    `Put something on each side: up to ${MAX_CARDS} cards and ${fmt(MAX_COINS)} DleCoins.`
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy || !canMake}
                  onClick={() =>
                    run(async () => {
                      const t = await trades();
                      const c = await t.makeOffer({ give, giveCoins, want, wantAny, wantCoins });
                      sfx.correct();
                      setMade(c);
                      setGive([]);
                      setGiveCoins(0);
                      setWant([]);
                      setWantAny(false);
                      setWantCoins(0);
                      setPicking(null);
                      setMine(await t.myTrades());
                    })
                  }
                  className="btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50"
                >
                  Put it up for trade
                </button>
              </div>

              {made && (
                <div className="animate-pop space-y-2 rounded-xl border border-hit/50 bg-hit/10 p-4">
                  <p>
                    Your code: <span className="font-display text-2xl font-bold tracking-[0.3em]">{made}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(link(made)).then(() => setNote({ text: 'Link copied — send it to your friend.', good: true }))} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
                      🔗 Copy the link
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button type="button" onClick={() => void navigator.share({ title: 'An Omnidle trade for you', url: link(made) }).catch(() => {})} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
                        Share…
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'take' && (
            <div className="space-y-4">
              <form
                className="page flex flex-wrap items-center gap-2 rounded-xl p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void lookUp();
                }}
              >
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7QM2X" aria-label="Offer code" className="w-40 rounded-md border border-rule-strong bg-card px-3 py-2 text-center font-display text-lg font-bold tracking-[0.3em]" maxLength={6} />
                <button type="submit" disabled={busy || code.length < 6} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                  Look it up
                </button>
                <span className="text-sm text-ink-soft">The code your friend sent you (or open their link).</span>
              </form>

              {offer &&
                (offer.status !== 'open' ? (
                  <p className="page rounded-xl p-4 font-semibold text-ink-soft">This offer is {offer.status === 'cancelled' ? 'cancelled' : 'already taken'}.</p>
                ) : offer.from === uid ? (
                  <p className="page rounded-xl p-4 font-semibold text-ink-soft">That's your own offer — send its code to a friend.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
                      <Side title={<>{offer.fromName} gives</>} tone="get">
                        <div className="flex flex-wrap gap-2">
                          {offer.give.map((id, i) => CARD_BY_ID.get(id) && <Slot key={`${id}${i}`} card={CARD_BY_ID.get(id)!} />)}
                        </div>
                        {offer.giveCoins > 0 && (
                          <p className="flex items-center gap-2 text-lg font-bold tabular-nums">
                            <DleCoin /> {fmt(offer.giveCoins)}
                          </p>
                        )}
                      </Side>
                      <div className="grid place-items-center text-3xl text-ink-soft max-md:rotate-90" aria-hidden>
                        ⇄
                      </div>
                      <Side title="You give" tone="give">
                        <div className="flex flex-wrap gap-2">
                          {offer.want.map((id, i) => CARD_BY_ID.get(id) && <Slot key={`${id}${i}`} card={CARD_BY_ID.get(id)!} mark={takeMissing.some((m) => m.includes(nameOf(id))) ? 'missing' : undefined} />)}
                          {offer.wantAny &&
                            (pick && CARD_BY_ID.get(pick) ? (
                              <Slot card={CARD_BY_ID.get(pick)!} onRemove={() => setPick(null)} />
                            ) : (
                              <AddTile label={<>＋<br />A card<br />of yours</>} on={picking === 'pick'} onClick={() => setPicking(picking === 'pick' ? null : 'pick')} />
                            ))}
                        </div>
                        {offer.wantCoins > 0 && (
                          <p className="flex items-center gap-2 text-lg font-bold tabular-nums">
                            <DleCoin /> {fmt(offer.wantCoins)} <span className="text-xs font-semibold text-ink-soft">({fmt(spareCoins)} to trade)</span>
                          </p>
                        )}
                      </Side>
                    </div>
                    {picking === 'pick' && (
                      <Picker
                        mine
                        used={offer.want}
                        full={false}
                        onAdd={(id) => {
                          setPick(id);
                          setPicking(null);
                        }}
                        onClose={() => setPicking(null)}
                      />
                    )}
                    <div className="page flex flex-wrap items-center gap-3 rounded-xl p-4">
                      <p className="min-w-0 flex-1 text-sm">
                        {takeMissing.length ? <span className="font-semibold text-coral">You can't give: {takeMissing.join(', ')}.</span> : offer.wantAny && !pick ? <span className="text-ink-soft">Pick the card you give.</span> : <span className="text-ink-soft">Ready: what you give leaves your save, theirs comes in.</span>}
                      </p>
                      <button
                        type="button"
                        disabled={busy || !!takeMissing.length || (offer.wantAny && !pick)}
                        onClick={() =>
                          run(async () => {
                            const t = await trades();
                            const done = await t.acceptOffer(offer.code, pick);
                            sfx.streak();
                            setNote({ text: `Traded! ${[done.give.map(nameOf).join(', '), done.giveCoins ? `${fmt(done.giveCoins)} DleCoins` : ''].filter(Boolean).join(' and ')} — now yours.`, good: true });
                            setOffer(null);
                            setPick(null);
                            setCode('');
                            setParams({});
                            setMine(await t.myTrades());
                          })
                        }
                        className="btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === 'mine' && (
            <section className="page space-y-3 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Your trades</h2>
                <button type="button" disabled={busy} onClick={() => run(refresh)} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
                  ⟳ Refresh
                </button>
              </div>
              {mine.length ? (
                <ul className="space-y-2">
                  {mine.map((t) => {
                    const byMe = t.from === uid;
                    // From the player's side: what they gave, what they got (or asked for).
                    const gave = byMe ? { cards: t.give, coins: t.giveCoins } : { cards: t.got ?? [], coins: t.wantCoins };
                    const got = byMe ? (t.got ? { cards: t.got, coins: t.wantCoins } : { cards: t.want, coins: t.wantCoins, any: t.wantAny }) : { cards: t.give, coins: t.giveCoins };
                    const st = STATUS[byMe ? t.status : 'claimed'];
                    return (
                      <li key={t.code} className="space-y-2 rounded-lg border border-rule p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-display font-bold tracking-widest">{t.code}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                          <span className="text-ink-soft">{byMe ? (t.toName ? `with ${t.toName}` : 'your offer') : `from ${t.fromName}`}</span>
                          {byMe && t.status === 'open' && (
                            <span className="ml-auto flex gap-1.5">
                              <button type="button" onClick={() => void navigator.clipboard?.writeText(link(t.code)).then(() => setNote({ text: 'Link copied.', good: true }))} className="btn-paper rounded px-2 py-0.5 text-xs font-semibold">
                                🔗 Link
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    const x = await trades();
                                    await x.cancelOffer(t.code);
                                    setNote({ text: 'Offer cancelled: what you put in is back.', good: true });
                                    setMine(await x.myTrades());
                                  })
                                }
                                className="btn-paper rounded px-2 py-0.5 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </div>
                        <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold tracking-wider text-coral uppercase">You give{byMe && t.status !== 'cancelled' ? '' : t.status === 'cancelled' ? ' (back)' : ''}</p>
                            <Mini {...gave} />
                          </div>
                          <span className="text-ink-soft max-sm:hidden" aria-hidden>
                            ⇄
                          </span>
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold tracking-wider text-hit uppercase">{byMe && !t.got ? 'You ask for' : 'You get'}</p>
                            <Mini {...got} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">No trades yet.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
