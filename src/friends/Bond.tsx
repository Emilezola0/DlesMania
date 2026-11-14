// The Bond tab (Friends): a Bond with a friend, its shared points (a point each day you both play the daily) and its
// packs, opened by the two of you together: both get the same five cards, and maybe the Bond card, linked to both
// (src/cloud/bonds.ts, src/gacha/bond.ts). In the demo (?demo, dev only) nothing is written: the friend "joins" by
// themselves, so the opening can be seen.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BOND_PACK, bondPackCards } from '../gacha/bond';
import { CARD_BY_ID, type Card } from '../gacha/cards';
import { PackOpening } from '../gacha/PackOpening';
import { BOND_PACK_COST, BOND_POINTS_PER_DAY, RANKS } from '../gacha/ranks';
import { shownName } from '../lib/french';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import type { BondDoc, BondPack } from '../cloud/bonds';

export interface BondPerson {
  uid: string;
  name: string;
  face: ReactNode;
}

const bonds = () => import('../cloud/bonds');
const B = RANKS.bond;
const playedOn = (days: Record<string, unknown>, day: string) => Object.keys(days ?? {}).some((k) => k.endsWith(`:${day}`));

/** A demo Bond, already active, with points to spend. */
const demoBond = (me: string, f: BondPerson, i: number): BondDoc => ({
  a: me < f.uid ? me : f.uid,
  b: me < f.uid ? f.uid : me,
  names: { [me]: 'You', [f.uid]: f.name },
  status: i === 1 ? 'invited' : 'active',
  by: f.uid,
  m: { [`${todayKey()}_${f.uid}`]: true },
  together: Object.fromEntries(Array.from({ length: 7 + i * 3 }, (_, k) => [`2026-10-${String(k + 1).padStart(2, '0')}`, true])),
  spent: 3,
  opened: 1,
  pack: null,
  prev: null,
});

type Opening = { cards: Card[]; fresh: Set<string>; bond: Card | null; friend: string };

export function Bond({ people, me, myName, demo }: { people: BondPerson[]; me: string; myName: string; demo?: boolean }) {
  const [docs, setDocs] = useState<Record<string, BondDoc | null>>({});
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [linked, setLinked] = useState<{ card: Card; friend: string } | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const days = useProgress((s) => s.days);
  const claimed = useProgress((s) => s.bondClaimed);
  const claim = useProgress((s) => s.claimBondPack);
  const today = todayKey();
  const played = playedOn(days, today);
  const friendIds = useMemo(() => people.map((p) => p.uid), [people]);
  const nameOf = (uid: string) => people.find((p) => p.uid === uid)?.name ?? 'your friend';

  // Every friend's Bond, followed live (an ask, a pack started or joined shows at once).
  useEffect(() => {
    if (demo) {
      setDocs(Object.fromEntries(people.map((p, i) => [p.uid, i < 2 ? demoBond(me, p, i) : null])));
      setLoaded(true);
      return;
    }
    let live = true;
    const stops: (() => void)[] = [];
    void bonds().then(async (m) => {
      const found = await m.bondsWith(friendIds).catch(() => ({}) as Record<string, BondDoc>);
      if (!live) return;
      setDocs(Object.fromEntries(friendIds.map((f) => [f, found[f] ?? null])));
      setLoaded(true);
      for (const f of friendIds) stops.push(m.watchBond(f, (d) => live && setDocs((x) => ({ ...x, [f]: d }))));
      // Today counts for every Bond once the daily is played.
      if (played) for (const d of Object.values(found)) if (d.status === 'active') void m.markToday(m.otherOf(d, me)).catch(() => undefined);
    });
    return () => {
      live = false;
      stops.forEach((s) => s());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, friendIds.join(',')]);

  // A pack both joined, not yet in this save: its cards come in (the one just opened with its animation; an older
  // one, missed while away, quietly).
  const shown = useRef(new Set<string>());
  useEffect(() => {
    for (const [f, d] of Object.entries(docs)) {
      if (!d) continue;
      for (const p of [d.prev, d.pack] as (BondPack | null)[]) {
        if (!p?.joined || (p.by !== me && p.joined !== me) || claimed?.includes(p.seed) || shown.current.has(p.seed)) continue;
        shown.current.add(p.seed);
        openSeed(p.seed, f, p === d.pack);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  const openSeed = (seed: string, friend: string, show: boolean) => {
    const { cards, bond } = bondPackCards(seed);
    const owned = useProgress.getState().cards;
    const fresh = new Set(cards.filter((c) => !owned[c.id]).map((c) => c.id));
    if (!claim(seed, cards.map((c) => c.id), bond ? { id: bond.id, with: nameOf(friend), uid: friend } : null)) return;
    if (show) setOpening({ cards, fresh, bond, friend });
    else if (bond) setLinked({ card: bond, friend });
  };

  const act = async (key: string, f: () => Promise<unknown>) => {
    setBusy(key);
    setNote(null);
    try {
      await f();
    } catch (e) {
      sfx.wrong();
      setNote(e instanceof Error ? e.message : 'That didn\'t work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  // The demo: the friend joins a moment later, and the pack opens.
  const demoStart = (f: string) => {
    sfx.select();
    const seed = `demo-${Date.now()}`;
    setDocs((x) => ({ ...x, [f]: { ...x[f]!, pack: { by: me, seed, at: null, joined: null }, spent: x[f]!.spent + BOND_PACK_COST } }));
    window.setTimeout(() => setDocs((x) => ({ ...x, [f]: { ...x[f]!, pack: { by: me, seed, at: null, joined: f } } })), 1500);
  };

  if (!people.length) return <p className="page rounded-md p-5 text-ink-soft">Add a friend first (the Friends tab): a Bond is between two friends.</p>;
  return (
    <section className="page space-y-4 rounded-md p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <span style={{ color: B.colors[0] }}>{B.gem}</span> Bond
        </h2>
        <p className="text-sm text-ink-soft">
          A Bond is between two friends. Each day you both play the daily, your Bond gets {BOND_POINTS_PER_DAY === 1 ? 'a point' : `${BOND_POINTS_PER_DAY} points`}; {BOND_PACK_COST} points open a <b>Bond pack</b>, the only pack with Bond cards. One of you starts it, the other joins: you both get the same five cards, and maybe the <b>Bond card</b>, with both your names on it.
        </p>
        <p className="text-xs text-ink-faint">{played ? '✓ You played today: it counts for every Bond.' : 'Play today’s daily to count today for your Bonds.'}</p>
      </div>
      {note && <p className="rounded-md border border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral">{note}</p>}
      {!loaded ? (
        <p className="text-ink-soft">Loading your Bonds…</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => {
            const d = docs[p.uid];
            const key = (k: string) => `${p.uid}:${k}`;
            const btn = 'rounded-md px-3 py-1.5 text-sm font-bold transition disabled:opacity-50';
            const main = `${btn} text-white`;
            let body: ReactNode;
            if (!d)
              body = (
                <button type="button" disabled={!!busy || demo} className={`${main}`} style={{ background: `linear-gradient(90deg, ${B.colors[0]}, ${B.colors[2]})` }} onClick={() => act(key('ask'), async () => (await bonds()).inviteBond(p.uid, myName, p.name))}>
                  {B.gem} Ask for a Bond
                </button>
              );
            else if (d.status === 'invited')
              body =
                d.by === me ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-soft">Asked: waiting for {p.name}.</span>
                    <button type="button" disabled={!!busy} className={`btn-paper ${btn}`} onClick={() => act(key('back'), async () => (await bonds()).endBond(d))}>
                      Take it back
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{p.name} asks for a Bond.</span>
                    <button type="button" disabled={!!busy || demo} className={main} style={{ background: `linear-gradient(90deg, ${B.colors[0]}, ${B.colors[2]})` }} onClick={() => act(key('yes'), async () => (await bonds()).acceptBond(d, myName))}>
                      Accept
                    </button>
                    <button type="button" disabled={!!busy || demo} className={`btn-paper ${btn}`} onClick={() => act(key('no'), async () => (await bonds()).endBond(d))}>
                      No thanks
                    </button>
                  </div>
                );
            else {
              const pts = Object.keys(d.together ?? {}).length * BOND_POINTS_PER_DAY - (d.spent ?? 0);
              const meToday = !!d.m?.[`${today}_${me}`] || (demo && played);
              const themToday = !!d.m?.[`${today}_${p.uid}`];
              const waiting = d.pack && !d.pack.joined ? d.pack : null;
              body = (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-display text-lg font-bold" style={{ color: B.colors[0] }}>
                      {pts} point{pts === 1 ? '' : 's'}
                    </span>
                    <span className="text-ink-soft">
                      {Object.keys(d.together ?? {}).length} day{Object.keys(d.together ?? {}).length === 1 ? '' : 's'} together · {d.opened ?? 0} pack{d.opened === 1 ? '' : 's'} opened
                    </span>
                    <span className="text-ink-soft">
                      Today: you {meToday ? '✓' : '·'} · {p.name} {themToday ? '✓' : '·'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!waiting ? (
                      <button
                        type="button"
                        disabled={!!busy || pts < BOND_PACK_COST}
                        className={main}
                        style={{ background: `linear-gradient(90deg, ${B.colors[0]}, ${B.colors[2]})` }}
                        onClick={() => (demo ? demoStart(p.uid) : act(key('start'), async () => (sfx.select(), (await bonds()).startPack(p.uid))))}
                        title={pts < BOND_PACK_COST ? `${BOND_PACK_COST - pts} more point${BOND_PACK_COST - pts === 1 ? '' : 's'}: play the daily on the same days` : undefined}
                      >
                        {B.gem} Open a Bond pack ({BOND_PACK_COST} points)
                      </button>
                    ) : waiting.by === me ? (
                      <>
                        <span className="animate-pulse text-sm font-semibold">Waiting for {p.name} to join…</span>
                        {!demo && (
                          <button type="button" disabled={!!busy} className={`btn-paper ${btn}`} onClick={() => act(key('cancel'), async () => (await bonds()).cancelPack(p.uid))}>
                            Cancel (points back)
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold">{p.name} is opening a Bond pack!</span>
                        <button type="button" disabled={!!busy} className={`${main} animate-pulse`} style={{ background: `linear-gradient(90deg, ${B.colors[0]}, ${B.colors[2]})` }} onClick={() => act(key('join'), async () => (await bonds()).joinPack(p.uid))}>
                          Join it
                        </button>
                      </>
                    )}
                    {!demo &&
                      (ending === p.uid ? (
                        <button type="button" disabled={!!busy} className={`${btn} ml-auto text-coral`} onClick={() => act(key('end'), async () => (setEnding(null), (await bonds()).endBond(d)))}>
                          Sure? End it (its points are lost)
                        </button>
                      ) : (
                        <button type="button" className={`${btn} ml-auto text-ink-faint hover:text-ink`} onClick={() => setEnding(p.uid)}>
                          End the Bond
                        </button>
                      ))}
                  </div>
                </div>
              );
            }
            return (
              <li key={p.uid} className="flex items-start gap-3 rounded-md border border-rule bg-tile/50 p-3">
                <span className="mt-0.5 shrink-0">{p.face}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display font-bold">{p.name}</p>
                  {body}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {linked && <BondCardNote card={linked.card} friend={nameOf(linked.friend)} onClose={() => setLinked(null)} />}
      {opening && (
        <PackOpening
          pack={BOND_PACK}
          cards={opening.cards}
          fresh={opening.fresh}
          canAgain={false}
          onAgain={() => undefined}
          onClose={() => {
            const o = opening;
            setOpening(null);
            if (o.bond) {
              setLinked({ card: o.bond, friend: o.friend });
              sfx.victory();
              celebrateBig();
            }
          }}
        />
      )}
    </section>
  );
}

/** The Bond card that came out: whose names it carries. */
function BondCardNote({ card, friend, onClose }: { card: Card; friend: string; onClose: () => void }) {
  const c = CARD_BY_ID.get(card.id) ?? card;
  return (
    <div role="status" className="flex items-center gap-3 rounded-md border-2 p-3" style={{ borderColor: B.colors[0], background: `linear-gradient(90deg, ${B.colors[0]}22, ${B.colors[2]}22)` }}>
      <span className="font-display text-3xl" style={{ color: B.colors[0] }} aria-hidden>
        {B.gem}
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <b className="font-display">The Bond card: {shownName(c.name, c.set)}!</b>
        <span className="block text-ink-soft">It carries your name and {friend}’s: you both have it now, linked to each other (Album).</span>
      </p>
      <button type="button" onClick={onClose} className="btn-paper rounded-md px-3 py-1 text-sm font-bold">
        OK
      </button>
    </div>
  );
}
