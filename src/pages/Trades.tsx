import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { startCloud, useCloud } from '../cloud/state';
import type { Trade } from '../cloud/trades';
import { CardFace } from '../gacha/CardView';
import { CARDS, CARD_BY_ID, RARITY_INFO, type Card } from '../gacha/cards';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { searchScore } from '../utils/textMatcher';

const trades = () => import('../cloud/trades');

const link = (code: string) => `${window.location.origin}${window.location.pathname}#/trades?code=${code}`;
const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A small card to pick, with how many are owned. */
function Pick({ card, count, on, onClick }: { card: Card; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg p-0.5 transition ${on ? 'ring-4 ring-accent' : 'hover:-translate-y-0.5'}`} aria-pressed={on} title={`${card.name} · ${RARITY_INFO[card.rarity].name}`}>
      <CardFace card={card} count={count} tilt={false} />
    </button>
  );
}

/** Your cards to choose from: spare copies first, a search to narrow them. */
function MyCards({ only, selected, onPick }: { only?: string | null; selected: string | null; onPick: (id: string) => void }) {
  const owned = useProgress((s) => s.cards);
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      CARDS.filter((c) => owned[c.id] && (!only || c.id === only) && (!q || searchScore(q, c.name) !== null))
        .sort((a, b) => (owned[b.id] > 1 ? 1 : 0) - (owned[a.id] > 1 ? 1 : 0) || RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank)
        .slice(0, 60),
    [owned, only, q],
  );
  return (
    <div className="space-y-2">
      {!only && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your cards…" className="w-full rounded-md border border-rule-strong bg-card px-3 py-2" />}
      {list.length ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {list.map((c) => (
            <Pick key={c.id} card={c} count={owned[c.id]} on={selected === c.id} onClick={() => (sfx.select(), onPick(c.id))} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{only ? "You don't have the card this offer asks for." : 'No card to show.'}</p>
      )}
    </div>
  );
}

/** Any card of the game, to say which one you want. */
function AnyCard({ selected, onPick }: { selected: string | null; onPick: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => (q.trim().length < 2 ? [] : CARDS.filter((c) => searchScore(q, c.name) !== null).slice(0, 12)), [q]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPick(null)} className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${selected === null ? 'border-ink bg-ink text-paper' : 'border-rule-strong'}`}>
          Any card
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="…or a specific one: type a name" className="min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 py-1.5" />
      </div>
      {list.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {list.map((c) => (
            <Pick key={c.id} card={c} on={selected === c.id} onClick={() => (sfx.select(), onPick(c.id))} />
          ))}
        </div>
      )}
      {selected && <p className="text-sm">Wanted: <b>{shownName(CARD_BY_ID.get(selected)?.name ?? '')}</b></p>}
    </div>
  );
}

const STATUS: Record<Trade['status'], string> = { open: 'Waiting for a taker', accepted: 'Taken — collecting…', cancelled: 'Cancelled', claimed: 'Done' };

/** /trades — making and taking card offers with other players. */
export default function Trades() {
  const { status, email, actions } = useCloud();
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [offer, setOffer] = useState<Trade | null>(null);
  const [mine, setMine] = useState<Trade[]>([]);
  const [give, setGive] = useState<string | null>(params.get('give'));
  const [want, setWant] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const signedIn = !!email && status !== 'signedOut' && !!actions;
  useEffect(() => void startCloud(), []);

  const refresh = async () => {
    const t = await trades();
    setUid(t.myUid());
    const back = await t.collectTrades();
    if (back.length) setNote({ text: `${back.length} card${back.length === 1 ? '' : 's'} came back from your offers: ${back.map((x) => shownName(CARD_BY_ID.get(x.got!)?.name ?? '')).join(', ')}.`, good: true });
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
      setAnswer(found.want);
    });
  // Opened from a shared link: look the offer up straight away.
  useEffect(() => {
    if (signedIn && params.get('code')) void lookUp(params.get('code')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  if (status === 'off' || status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <Spinner /> Connecting…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/album" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Album
        </Link>
        <h1 className="text-5xl font-bold">Trades</h1>
        <p className="text-ink-soft">Swap cards with friends. Put a card up for trade and send the code; whoever takes it gives you a card of theirs.</p>
      </div>

      {!signedIn ? (
        <p className="page rounded-md p-5">
          Trading needs an account, so each card reaches the right player.{' '}
          <Link to="/account" className="font-semibold text-accent">
            Sign in
          </Link>{' '}
          first — it takes a moment.
        </p>
      ) : (
        <>
          {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

          {/* Taking an offer. */}
          <section className="page space-y-3 rounded-md p-5">
            <h2 className="font-display text-lg font-bold">Take an offer</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void lookUp();
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code, e.g. K7QM2X" className="w-40 rounded-md border border-rule-strong bg-card px-3 py-2 font-display font-bold tracking-widest" maxLength={6} />
              <button type="submit" disabled={busy || code.length < 6} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                Look it up
              </button>
            </form>
            {offer && (
              <div className="space-y-4 border-t border-rule pt-4">
                {offer.status !== 'open' ? (
                  <p className="font-semibold text-ink-soft">This offer is {offer.status === 'cancelled' ? 'cancelled' : 'already taken'}.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="w-32">{CARD_BY_ID.get(offer.give) && <CardFace card={CARD_BY_ID.get(offer.give)!} />}</div>
                      <div className="flex-1 space-y-1">
                        <p>
                          <b>{offer.fromName}</b> offers <b>{shownName(CARD_BY_ID.get(offer.give)?.name ?? '?')}</b>
                        </p>
                        <p className="text-sm text-ink-soft">In return: {offer.want ? <b>{shownName(CARD_BY_ID.get(offer.want)?.name ?? '?')}</b> : 'any card of yours'}.</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">Pick the card you give:</p>
                    <MyCards only={offer.want} selected={answer} onPick={setAnswer} />
                    <button
                      type="button"
                      disabled={busy || !answer}
                      onClick={() =>
                        run(async () => {
                          const t = await trades();
                          const done = await t.acceptOffer(offer.code, answer!);
                          sfx.streak();
                          setNote({ text: `Traded! ${shownName(CARD_BY_ID.get(done.give)?.name ?? '')} is in your album.`, good: true });
                          setOffer(null);
                          setCode('');
                          setParams({});
                          setMine(await t.myTrades());
                        })
                      }
                      className="btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50"
                    >
                      Trade
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Making one. */}
          <section className="page space-y-3 rounded-md p-5">
            <h2 className="font-display text-lg font-bold">Make an offer</h2>
            <p className="text-sm text-ink-soft">The card leaves your album until someone takes the offer — or you cancel it. Spare copies come first.</p>
            <p className="text-sm font-semibold">1. The card you give:</p>
            <MyCards selected={give} onPick={setGive} />
            <p className="text-sm font-semibold">2. What you want for it:</p>
            <AnyCard selected={want} onPick={setWant} />
            <button
              type="button"
              disabled={busy || !give}
              onClick={() =>
                run(async () => {
                  const t = await trades();
                  const c = await t.makeOffer(give!, want);
                  sfx.correct();
                  setMade(c);
                  setGive(null);
                  setMine(await t.myTrades());
                })
              }
              className="btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-50"
            >
              Put it up for trade
            </button>
            {made && (
              <div className="animate-pop space-y-2 rounded-md border border-hit/50 bg-hit/10 p-3">
                <p>
                  Your code: <span className="font-display text-2xl font-bold tracking-[0.3em]">{made}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(link(made)).then(() => setNote({ text: 'Link copied — send it to your friend.', good: true }))} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
                    🔗 Copy the link
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button type="button" onClick={() => void navigator.share({ title: 'An Omnidle card for you', url: link(made) }).catch(() => {})} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
                      Share…
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* The player's trades. */}
          <section className="page space-y-3 rounded-md p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Your trades</h2>
              <button type="button" disabled={busy} onClick={() => run(refresh)} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
                ⟳ Refresh
              </button>
            </div>
            {mine.length ? (
              <ul className="divide-y divide-rule">
                {mine.map((t) => {
                  const name = (id: string | null | undefined) => (id ? shownName(CARD_BY_ID.get(id)?.name ?? '?') : 'any card');
                  const byMe = t.from === uid;
                  // Made by the player: what they gave and got (or asked for); taken by them: the other way round.
                  const line = byMe
                    ? t.got
                      ? `You gave ${name(t.give)} and got ${name(t.got)} from ${t.toName ?? 'a player'}`
                      : `You offer ${name(t.give)} for ${name(t.want)}`
                    : `You gave ${name(t.got)} and got ${name(t.give)} from ${t.fromName}`;
                  const gave = CARD_BY_ID.get(t.give);
                  return (
                    <li key={t.code} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <span className="font-display font-bold tracking-widest">{t.code}</span>
                      <span className="min-w-0 flex-1">{line}</span>
                      <span className="text-ink-soft">{byMe ? STATUS[t.status] : 'Done'}</span>
                      {byMe && t.status === 'open' && (
                        <>
                          <button type="button" onClick={() => void navigator.clipboard?.writeText(link(t.code)).then(() => setNote({ text: 'Link copied.', good: true }))} className="btn-paper rounded px-2 py-0.5 text-xs font-semibold">
                            🔗
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const x = await trades();
                                await x.cancelOffer(t.code);
                                setNote({ text: `${shownName(gave?.name ?? '')} is back in your album.`, good: true });
                                setMine(await x.myTrades());
                              })
                            }
                            className="btn-paper rounded px-2 py-0.5 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">No trades yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
