// The Black Market (Casino → Black Market): two Mythic (or Omni) cards of a franchise handed over for one other card
// of that franchise and rarity, picked by the player. The cards handed over go on the player's stall, where their
// friends can buy them for DleCoins (dear) for a week (src/cloud/blackmarket.ts). The numbers: casino.json blackMarket.
import { useEffect, useMemo, useState } from 'react';
import { DleCoin } from '../components/DleCoin';
import { CardFace } from '../gacha/CardView';
import { CARD_BY_ID, COLLECTIBLE, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from '../gacha/cards';
import T from '../data/tuning/casino.json';
import { startCloud, useCloud } from '../cloud/state';
import type { Stall } from '../cloud/blackmarket';
import { celebrate, celebrateBig } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const BM = T.blackMarket as { give: number; rarities: Rarity[]; price: Record<string, number> };
const cloud = () => import('../cloud/blackmarket');
const DAY = 86_400_000;

/** A franchise's cards of one rarity: the player's, and every one there is. */
interface Group {
  key: string;
  franchise: string;
  rarity: Rarity;
  all: Card[];
  mine: Card[];
  copies: number;
}

function Mini({ card, count, onClick, picked, dim, note }: { card: Card; count?: number; onClick?: () => void; picked?: number; dim?: boolean; note?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`relative w-24 shrink-0 text-left transition sm:w-28 ${dim ? 'opacity-40' : ''} ${picked ? '-translate-y-1' : ''}`}>
      <div className="rounded-[7%]" style={picked ? { boxShadow: `0 0 0 3px ${RARITY_LIGHT[card.rarity]}, 0 0 16px ${RARITY_LIGHT[card.rarity]}` } : undefined}>
        <CardFace card={card} count={count} tilt={false} still />
      </div>
      {!!picked && <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-coral font-display text-xs font-black text-white shadow">×{picked}</span>}
      <p className="mt-1 truncate text-center text-[11px] font-semibold">{shownName(card.name, card.set)}</p>
      {note && <p className="truncate text-center text-[10px] text-ink-faint">{note}</p>}
    </button>
  );
}

export function BlackMarket() {
  const owned = useProgress((s) => s.cards);
  const coins = useProgress((s) => s.coins);
  const moveCards = useProgress((s) => s.moveCards);
  const buyStallCard = useProgress((s) => s.buyStallCard);
  const { status, email, actions } = useCloud();
  const signedIn = !!email && status !== 'signedOut' && !!actions;
  useEffect(() => void startCloud(), []);

  // Every franchise's Mythics and Omnis, and those the player holds two or more copies of between them.
  const groups = useMemo(() => {
    const by = new Map<string, Group>();
    for (const c of COLLECTIBLE) {
      if (!BM.rarities.includes(c.rarity)) continue;
      const key = `${c.franchise}|${c.rarity}`;
      const g = by.get(key) ?? { key, franchise: c.franchise, rarity: c.rarity, all: [], mine: [], copies: 0 };
      g.all.push(c);
      if ((owned[c.id] ?? 0) > 0) (g.mine.push(c), (g.copies += owned[c.id]));
      by.set(key, g);
    }
    // Enough to hand over, and something else to get for them.
    return [...by.values()].filter((g) => g.copies >= BM.give && g.all.length >= 2).sort((a, b) => b.copies - a.copies || a.franchise.localeCompare(b.franchise));
  }, [owned]);

  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [done, setDone] = useState<{ got: Card; gave: Card[]; posted: boolean | null } | null>(null);
  const group = picked.length ? groups.find((g) => g.mine.some((c) => c.id === picked[0])) : undefined;
  const times = (id: string) => picked.filter((p) => p === id).length;
  const offers = group ? group.all.filter((c) => !picked.includes(c.id)) : [];

  const pick = (c: Card, g: Group) => {
    sfx.select();
    setDone(null);
    setTarget(null);
    // Another franchise or rarity: start again with this card.
    if (!group || group.key !== g.key) return setPicked([c.id]);
    if (picked.length >= BM.give) return setPicked([...picked.slice(1), c.id]);
    if (times(c.id) >= (owned[c.id] ?? 0)) return setPicked(picked.filter((p) => p !== c.id));
    setPicked([...picked, c.id]);
  };
  const lastCopies = [...new Set(picked)].filter((id) => (owned[id] ?? 0) - times(id) <= 0).map((id) => CARD_BY_ID.get(id)!);

  const trade = async () => {
    if (!group || picked.length !== BM.give || !target) return;
    const got = CARD_BY_ID.get(target)!;
    const gave = picked.map((id) => CARD_BY_ID.get(id)!);
    const delta: Record<string, number> = {};
    for (const id of picked) delta[id] = (delta[id] ?? 0) - 1;
    delta[target] = (delta[target] ?? 0) + 1;
    moveCards(delta);
    sfx.victory();
    if (got.rarity === 'omni') celebrateBig();
    else celebrate();
    setPicked([]);
    setTarget(null);
    setDone({ got, gave, posted: null });
    // The cards handed over go on the player's stall, for their friends.
    if (!signedIn) return setDone({ got, gave, posted: false });
    try {
      const c = await cloud();
      await c.putUp(gave.map((g) => ({ id: g.id, rarity: g.rarity as 'mythic' | 'omni' })));
      setDone({ got, gave, posted: true });
      void loadStalls();
    } catch {
      setDone({ got, gave, posted: false });
    }
  };

  // ── The stalls ──
  const [theirs, setTheirs] = useState<Stall[] | null>(null);
  const [mine, setMine] = useState<Stall[] | null>(null);
  const [stallError, setStallError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const loadStalls = async () => {
    try {
      const c = await cloud();
      const uid = c.signedInUid();
      if (!uid) return;
      const friends = await c.myFriends();
      const [a, b] = await Promise.all([c.stallsOf(friends), c.stallsOf([uid])]);
      setTheirs(a);
      setMine(b);
      setStallError(null);
    } catch (e) {
      setStallError((e as { code?: string })?.code === 'permission-denied' ? "The stalls aren't switched on in the database yet: its rules need the blackmarket section (firestore.rules) published." : e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    if (signedIn) void loadStalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const buy = async (s: Stall) => {
    const card = CARD_BY_ID.get(s.card);
    const price = BM.price[s.rarity];
    if (!card || coins < price) return;
    setBuying(s.id);
    setNote(null);
    try {
      const c = await cloud();
      if (!(await c.buyStall(s))) {
        sfx.wrong();
        setNote('Too late: someone was quicker, or its week is over.');
      } else if (buyStallCard(card.id, price)) {
        sfx.victory();
        celebrateBig();
        setNote(`${shownName(card.name, card.set)} is yours.`);
      }
      void loadStalls();
    } catch (e) {
      sfx.wrong();
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBuying(null);
    }
  };
  const left = (s: Stall) => Math.max(0, Math.ceil((s.at + 7 * DAY - Date.now()) / DAY));

  return (
    <div className="space-y-6">
      <section className="space-y-1 rounded-xl border border-black/40 bg-gradient-to-br from-[#14111c] to-[#2a1f33] p-4 text-white shadow-lg">
        <h2 className="font-display text-xl font-black tracking-wider">🕶️ The Black Market</h2>
        <p className="text-sm text-white/75">
          Hand over {BM.give} {BM.rarities.map((r) => RARITY_INFO[r].name).join(' or ')} cards of the same franchise for another card of that franchise and rarity, your pick. What you hand over goes on your stall: your friends can buy it for a week.
        </p>
      </section>

      {/* 1. What to hand over. */}
      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold">1 · Pick {BM.give} cards to hand over</h3>
        {groups.length === 0 ? (
          <p className="page rounded-md p-4 text-sm text-ink-soft">
            You need {BM.give} {BM.rarities.map((r) => RARITY_INFO[r].name).join(' or ')} cards (copies count) of the same franchise. Keep opening packs: duplicates of a franchise&apos;s Mythics will do.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className={`page space-y-2 rounded-md p-3 ${group && group.key !== g.key ? 'opacity-60' : ''}`}>
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <b className="truncate">{g.franchise}</b>
                <span className="shrink-0 text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_LIGHT[g.rarity] }}>
                  {RARITY_INFO[g.rarity].name} · {g.copies} cop{g.copies === 1 ? 'y' : 'ies'}
                </span>
              </p>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-2 pb-2 pt-4">
                {g.mine.map((c) => (
                  <Mini key={c.id} card={c} count={owned[c.id]} picked={group?.key === g.key ? times(c.id) : 0} onClick={() => pick(c, g)} />
                ))}
              </div>
            </div>
          ))
        )}
        {lastCopies.length > 0 && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">⚠️ Your last {lastCopies.map((c) => shownName(c.name, c.set)).join(' and ')}: it leaves your album, its grade with it.</p>}
      </section>

      {/* 2. What to get. */}
      {group && picked.length === BM.give && (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-bold">2 · Pick the {RARITY_INFO[group.rarity].name} you get</h3>
          {offers.length === 0 ? (
            <p className="page rounded-md p-4 text-sm text-ink-soft">{group.franchise} has no other {RARITY_INFO[group.rarity].name} card to give you for these.</p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-2 pb-2 pt-4">
              {offers.map((c) => (
                <Mini key={c.id} card={c} picked={target === c.id ? 1 : 0} note={(owned[c.id] ?? 0) > 0 ? `you have ${owned[c.id]}` : 'new for you'} onClick={() => (sfx.select(), setTarget(c.id))} />
              ))}
            </div>
          )}
          <button type="button" disabled={!target} onClick={() => void trade()} className="btn-accent w-full rounded-md px-4 py-2.5 font-display font-bold disabled:opacity-40 sm:w-auto">
            🤝 Hand over {picked.length} for {target ? shownName(CARD_BY_ID.get(target)!.name, CARD_BY_ID.get(target)!.set) : '…'}
          </button>
        </section>
      )}

      {done && (
        <section className="page flex items-center gap-4 rounded-md p-4">
          <div className="w-24 shrink-0">
            <CardFace card={done.got} tilt={false} still />
          </div>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-display text-lg font-bold">🤝 Deal: {shownName(done.got.name, done.got.set)} is yours.</p>
            <p className="text-ink-soft">
              You handed over {done.gave.map((c) => shownName(c.name, c.set)).join(' and ')}.{' '}
              {done.posted === null ? 'Putting them on your stall…' : done.posted ? 'They are on your stall: your friends can buy them for a week.' : 'Sign in (and add friends) to put the cards you hand over on a stall for your friends.'}
            </p>
          </div>
        </section>
      )}

      {/* 3. The friends' stalls, and the player's own. */}
      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold">Your friends&apos; stalls</h3>
        <p className="text-sm text-ink-soft">
          The cards your friends handed over this week. Dear: <DleCoin className="inline size-4 align-[-3px]" /> {BM.price.mythic.toLocaleString('en')} a Mythic, {BM.price.omni.toLocaleString('en')} an Omni. The first to buy one gets it.
        </p>
        {!signedIn ? (
          <p className="page rounded-md p-4 text-sm text-ink-soft">Sign in (Account) and add friends (Friends) to see their stalls.</p>
        ) : stallError ? (
          <p className="rounded-md border border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral">{stallError}</p>
        ) : theirs === null ? (
          <p className="text-sm text-ink-faint">Looking round the stalls…</p>
        ) : theirs.filter((s) => !s.buyer).length === 0 ? (
          <p className="page rounded-md p-4 text-sm text-ink-soft">Nothing on your friends&apos; stalls this week.</p>
        ) : (
          <div className="flex flex-wrap gap-3 pt-3">
            {theirs
              .filter((s) => !s.buyer && CARD_BY_ID.has(s.card))
              .map((s) => {
                const card = CARD_BY_ID.get(s.card)!;
                const price = BM.price[s.rarity];
                return (
                  <div key={`${s.uid}/${s.id}`} className="w-28 space-y-1 sm:w-32">
                    <Mini card={card} count={owned[card.id]} note={`${s.seller} · ${left(s)} day${left(s) === 1 ? '' : 's'} left`} />
                    <button type="button" disabled={coins < price || buying !== null} onClick={() => void buy(s)} className="btn-accent flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold disabled:opacity-40">
                      {buying === s.id ? '…' : <>Buy · <DleCoin className="size-3.5" /> {price.toLocaleString('en')}</>}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
        {note && <p className="text-sm font-semibold">{note}</p>}
        {signedIn && mine && mine.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-display font-bold">Your stall</h4>
            <div className="flex flex-wrap gap-3 pt-3">
              {mine
                .filter((s) => CARD_BY_ID.has(s.card))
                .map((s) => (
                  <Mini key={s.id} card={CARD_BY_ID.get(s.card)!} dim={!!s.buyer} note={s.buyer ? `bought by ${s.buyerName ?? 'a friend'}` : `${left(s)} day${left(s) === 1 ? '' : 's'} left`} />
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
