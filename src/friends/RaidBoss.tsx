// Friends → Raid Boss: the week's boss (src/friends/raid.ts), its health worn down by you and your friends together,
// one attack a day each (src/cloud/raids.ts). Beaten before Sunday is over, it pays everyone in the raid, and its
// top hitter more.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HitsDoc } from '../cloud/raids';
import { DleCoin } from '../components/DleCoin';
import { CardAvatar } from '../gacha/Perks';
import { RARITY_INFO } from '../gacha/cards';
import { addDays, now, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { lastMonday, thisMonday } from './league';
import { bossOf, healthFor, hitFor, ownedBonus, questionsFor, RAID, type RaidBoss as Boss, type RaidQuestion } from './raid';

const cloud = () => import('../cloud/raids');

export interface RaidPerson {
  uid: string;
  face: ReactNode;
  name: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const coin = <DleCoin className="inline size-3.5 align-[-2px]" />;

/** Damage dealt by each player, and in all. */
function tally(docs: HitsDoc[]) {
  const by = new Map<string, number>();
  for (const d of docs) by.set(d.uid, Object.values(d.hits ?? {}).reduce((n, h) => n + (h?.d ?? 0), 0));
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  const top = Math.max(0, ...by.values());
  return { by, total, top, mvp: [...by].filter(([, n]) => n > 0 && n === top).map(([u]) => u) };
}

/** What beating a week's boss pays this player, if they hit it that week: the win, and the top hitter's share if they were it (with company). */
function payBeaten(pay: (key: string, coins: number) => number, monday: string, me: string, docs: HitsDoc[]): number {
  const t = tally(docs);
  if (!t.by.get(me)) return 0;
  let got = pay(`raid:${monday}`, RAID.win);
  if (t.mvp.includes(me) && t.by.size > 1) got += pay(`raidmvp:${monday}`, RAID.mvp);
  return got;
}

const ago = (ms: number) => {
  const m = Math.max(0, Math.round((now() - ms) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/** Where an attack cut short (a closed tab) stands: its damage so far is sent instead of a fresh try. */
const keyOf = (uid: string, day: string) => `omnidle:raid:${uid}:${day}`;
function readCut(uid: string, day: string): number | null {
  try {
    const v = localStorage.getItem(keyOf(uid, day));
    return v === null ? null : Number(JSON.parse(v).dmg) || 0;
  } catch {
    return null;
  }
}
function writeCut(uid: string, day: string, dmg: number | null) {
  try {
    if (dmg === null) localStorage.removeItem(keyOf(uid, day));
    else localStorage.setItem(keyOf(uid, day), JSON.stringify({ dmg }));
  } catch {
    // No storage: a closed tab loses the attack's progress.
  }
}

type Phase = 'count' | 'ask' | 'shown' | 'end';

/** The day's attack: RAID.questions faces, a name to find for each before the clock runs out. */
function Attack({ boss, bonus, onProgress, onDone }: { boss: Boss; bonus: number; onProgress: (raw: number) => void; onDone: (raw: number) => void }) {
  const qs = useMemo<RaidQuestion[]>(() => questionsFor(boss.set), [boss.set]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('count');
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(RAID.seconds);
  const [chosen, setChosen] = useState<string | null>(null);
  const [raw, setRaw] = useState(0);
  const [last, setLast] = useState(0);
  const end = useRef(0);
  const q = qs[i];

  useEffect(() => {
    if (phase !== 'count') return;
    if (count <= 0) {
      setPhase('ask');
      sfx.whoosh();
      return;
    }
    sfx.tick();
    const t = window.setTimeout(() => setCount((c) => c - 1), 650);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  const answer = (name: string | null) => {
    if (phase !== 'ask') return;
    const secs = Math.max(0, (end.current - Date.now()) / 1000);
    const right = name === q.card.name;
    const dmg = right ? hitFor(secs) : 0;
    setChosen(name);
    setLast(dmg);
    setRaw((r) => r + dmg);
    if (right) sfx.correct();
    else sfx.wrong();
    setPhase('shown');
  };

  // The clock of a question.
  useEffect(() => {
    if (phase !== 'ask') return;
    end.current = Date.now() + RAID.seconds * 1000;
    setLeft(RAID.seconds);
    const t = window.setInterval(() => {
      const s = Math.max(0, (end.current - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) answer(null);
    }, 100);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, i]);

  // The answer shown a moment, then the next face.
  useEffect(() => {
    if (phase !== 'shown') return;
    onProgress(raw);
    const t = window.setTimeout(() => {
      if (i + 1 >= qs.length) {
        setPhase('end');
        onDone(raw);
      } else {
        setI(i + 1);
        setChosen(null);
        setPhase('ask');
      }
    }, 1100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!q) return <p className="text-sm text-ink-soft">This franchise has too few faces for a round.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-display text-sm font-bold text-ink-faint">
          {Math.min(i + 1, qs.length)} / {qs.length}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-tile">
          <div className={`h-full rounded-full ${left < 2 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${(phase === 'ask' ? left / RAID.seconds : phase === 'count' ? 1 : 0) * 100}%`, transition: 'width 0.1s linear' }} />
        </div>
        <span className="font-display text-sm font-bold tabular-nums">⚔️ {fmt(raw * (1 + bonus))}</span>
      </div>
      <div className="relative mx-auto aspect-[5/7] w-full max-w-[14rem] overflow-hidden rounded-lg border-2 border-rule-strong bg-tile">
        {phase === 'count' ? (
          <div className="grid h-full place-items-center font-display text-7xl font-black">{count}</div>
        ) : (
          <img key={q.card.id} src={q.card.image} alt="Who is it?" className="h-full w-full object-contain" draggable={false} />
        )}
        {phase === 'shown' && (
          <div className={`absolute inset-x-0 bottom-0 p-2 text-center font-display text-lg font-black text-white ${last ? 'bg-hit/90' : 'bg-coral/90'}`}>
            {last ? `💥 ${fmt(last * (1 + bonus))}` : chosen ? 'Missed!' : "Time's up!"}
          </div>
        )}
      </div>
      {phase !== 'count' && (
        <div className="grid grid-cols-2 gap-2">
          {q.options.map((n) => {
            const isRight = n === q.card.name;
            const tone = phase === 'shown' ? (isRight ? 'border-hit bg-hit/15' : n === chosen ? 'border-coral bg-coral/15' : 'border-rule opacity-50') : 'border-rule-strong hover:bg-tile';
            return (
              <button key={n} type="button" disabled={phase !== 'ask'} onClick={() => answer(n)} className={`rounded-md border-2 px-2 py-2 text-sm font-semibold transition ${tone}`}>
                {shownName(n, q.card.set)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dev only (#/friends?demo): made-up hits from the made-up friends. */
function demoHits(people: RaidPerson[], monday: string, today: string): HitsDoc[] {
  return people.slice(1).map((p, k) => {
    const hits: HitsDoc['hits'] = {};
    for (let d = monday; d < today; d = addDays(d, 1)) if ((k + d.charCodeAt(9)) % 3) hits[d] = { d: 600 + ((k * 337 + d.charCodeAt(9) * 71) % 1300), at: null };
    return { uid: p.uid, week: monday, last: today, hits };
  });
}

export function RaidBoss({ people, me, demo }: { people: RaidPerson[]; me: string; demo: boolean }) {
  const today = todayKey();
  const monday = thisMonday(today);
  const prev = lastMonday(today);
  const boss = useMemo(() => bossOf(monday), [monday]);
  const prevBoss = useMemo(() => bossOf(prev), [prev]);
  const health = healthFor(people.length);
  const cards = useProgress((s) => s.cards);
  const pay = useProgress((s) => s.payFriendGame);
  const bonus = useMemo(() => ownedBonus(cards, boss.set), [cards, boss.set]);
  const [docs, setDocs] = useState<HitsDoc[] | null>(null);
  const [before, setBefore] = useState<HitsDoc[]>([]);
  const [attacking, setAttacking] = useState(false);
  const [cut, setCut] = useState<number | null>(() => readCut(me, today));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: ReactNode; good?: boolean } | null>(null);
  const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);
  const uids = people.map((p) => p.uid).join(',');

  useEffect(() => {
    let live = true;
    if (demo) {
      setDocs(demoHits(people, monday, today));
      return;
    }
    void cloud().then(async (c) => {
      const list = uids ? uids.split(',') : [];
      const [cur, last] = await Promise.all([c.hitsOf(list, monday), c.hitsOf(list, prev)]);
      if (!live) return;
      setDocs(cur);
      setBefore(last);
      // Rewards of a boss beaten (this week's, or last week's if this player didn't come by since).
      let got = 0;
      if (tally(cur).total >= health) got += payBeaten(pay, monday, me, cur);
      if (tally(last).total >= health) got += payBeaten(pay, prev, me, last);
      if (got) {
        sfx.victory();
        celebrate();
        setNote({ text: <>🏆 Boss defeated: +{fmt(got)} {coin}</>, good: true });
      }
    });
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids, monday, prev, demo, me]);

  const t = tally(docs ?? []);
  const mineToday = docs?.find((d) => d.uid === me)?.hits?.[today];
  const beaten = t.total >= health;
  const hp = Math.max(0, health - t.total);
  const daysLeft = 7 - Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${monday}T12:00:00Z`)) / 86_400_000);

  /** Sends an attack's damage (its raw points, the franchise bonus added here). */
  const send = async (raw: number) => {
    const dmg = Math.min(RAID.maxHit, Math.round(raw * (1 + bonus)));
    setAttacking(false);
    setBusy(true);
    setNote(null);
    try {
      let result: 'fresh' | 'done' | 'refused' = 'fresh';
      let doc: HitsDoc | null = null;
      if (demo) doc = { uid: me, week: monday, last: today, hits: { ...(docs?.find((d) => d.uid === me)?.hits ?? {}), [today]: { d: dmg, at: null } } };
      else ({ result, doc } = await (await cloud()).strike(monday, today, dmg));
      if (result === 'refused') return setNote({ text: "The Raid Boss isn't switched on in the database yet (its rules need publishing), or your device's date is off." });
      writeCut(me, today, null);
      setCut(null);
      const next = [...(docs ?? []).filter((d) => d.uid !== me), ...(doc ? [doc] : [])];
      setDocs(next);
      if (result === 'done') return setNote({ text: 'You already attacked today (on another device).' });
      const coins = demo ? Math.floor(dmg * RAID.coinsPerDamage) : pay(`raidhit:${today}`, Math.floor(dmg * RAID.coinsPerDamage));
      let won = 0;
      if (!demo && tally(next).total >= health) won = payBeaten(pay, monday, me, next);
      if (won || tally(next).total >= health) {
        sfx.victory();
        celebrate();
      }
      setNote({
        text: (
          <>
            💥 You hit {boss.card.name} for {fmt(dmg)}! +{fmt(coins + won)} {coin}
            {won ? ' — and the boss is down!' : ''}
          </>
        ),
        good: true,
      });
    } catch {
      setNote({ text: 'No connection: your damage is kept, send it again once you are online.' });
      setCut(raw);
    } finally {
      setBusy(false);
    }
  };

  const log = (docs ?? [])
    .flatMap((d) => Object.entries(d.hits ?? {}).map(([day, h]) => ({ uid: d.uid, day, d: h.d, at: h.at ? h.at.toMillis() : null })))
    .sort((a, b) => (b.at ?? Date.parse(`${b.day}T12:00:00Z`)) - (a.at ?? Date.parse(`${a.day}T12:00:00Z`)));
  const prevT = tally(before);

  return (
    <section className="page space-y-4 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">⚔️ Raid Boss</h2>
        <p className="text-sm text-ink-soft">
          A new boss every Monday, its health shared by you and your friends: each of you attacks once a day, whenever you like. An attack: {RAID.questions} faces from its franchise to name, {RAID.seconds} seconds each; the quicker, the harder you hit, and every card of that franchise you own adds 1% (up to {RAID.ownedBonusMax * 100}%). Beat it by
          Sunday: {fmt(RAID.win)} {coin} for everyone in the raid, {fmt(RAID.mvp)} more for the top hitter.
        </p>
      </div>
      {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

      {/* The boss. */}
      <div className="flex flex-col items-center gap-4 rounded-lg border border-rule p-4 sm:flex-row">
        <div className={`relative shrink-0 ${beaten ? 'opacity-50 grayscale' : ''}`}>
          <CardAvatar card={boss.card} className="size-28" />
          {beaten && <span className="absolute inset-0 grid place-items-center text-5xl">💀</span>}
        </div>
        <div className="w-full min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              This week&apos;s boss · {boss.franchise} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
            </p>
            <p className="font-display text-2xl font-bold">
              {shownName(boss.card.name, boss.card.set)} <span className="text-sm font-semibold text-ink-faint">{RARITY_INFO[boss.card.rarity].gem}</span>
            </p>
          </div>
          <div className="h-4 overflow-hidden rounded-full border border-rule bg-tile">
            <div className="h-full rounded-full bg-gradient-to-r from-coral to-ochre transition-all duration-700" style={{ width: `${(hp / health) * 100}%` }} />
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-display font-bold tabular-nums">
              {docs === null ? '…' : beaten ? '🏆 Defeated!' : `❤️ ${fmt(hp)} / ${fmt(health)}`}
            </span>
            <span className="text-ink-soft">
              {people.length} in the raid{people.length > RAID.maxPlayers ? ` (health as for ${RAID.maxPlayers})` : ''}
            </span>
          </p>
        </div>
      </div>

      {/* Today's attack. */}
      {docs === null ? (
        <p className="text-sm text-ink-soft">Loading the raid…</p>
      ) : attacking ? (
        <div className="mx-auto max-w-sm">
          {/* Its damage kept as it goes: a closed tab sends what was dealt, no fresh try. */}
          <Attack boss={boss} bonus={bonus} onProgress={(raw) => writeCut(me, today, raw)} onDone={(raw) => void send(raw)} />
        </div>
      ) : mineToday ? (
        <p className="rounded-md bg-tile p-3 text-center text-sm">
          ✅ Today you hit for <b>{fmt(mineToday.d)}</b>. Come back tomorrow for another attack.
        </p>
      ) : cut !== null ? (
        <div className="space-y-2 rounded-md border border-ochre/50 bg-ochre/10 p-3 text-center text-sm">
          <p>Your attack today was cut short: what it dealt still counts ({fmt(Math.min(RAID.maxHit, cut * (1 + bonus)))} damage).</p>
          <button type="button" disabled={busy} onClick={() => void send(cut)} className="btn-accent rounded-md px-4 py-2 font-display font-bold disabled:opacity-40">
            {busy ? 'Sending…' : 'Send it'}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sfx.select();
              writeCut(me, today, 0);
              setAttacking(true);
            }}
            className="btn-accent rounded-md px-6 py-3 font-display text-lg font-bold disabled:opacity-40"
          >
            ⚔️ Attack{beaten ? " (it's down: for the glory)" : ''}
          </button>
          <p className="text-xs text-ink-faint">
            One attack a day: once it starts, it counts. Your {boss.franchise} cards add +{Math.round(bonus * 100)}%.
          </p>
        </div>
      )}

      {/* Who hit, and how hard. */}
      {docs !== null && t.by.size > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Damage this week</p>
            {[...t.by].sort((a, b) => b[1] - a[1]).map(([uid, n]) => (
              <div key={uid} className="flex items-center gap-2 text-sm">
                {byUid.get(uid)?.face}
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {byUid.get(uid)?.name ?? 'A friend'} {t.mvp.includes(uid) && t.by.size > 1 ? '⭐' : ''}
                </span>
                <span className="font-display font-bold tabular-nums">{fmt(n)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Latest hits</p>
            {log.slice(0, 8).map((h) => (
              <p key={`${h.uid}-${h.day}`} className="text-sm">
                <b>{byUid.get(h.uid)?.name ?? 'A friend'}</b> hit for <b className="tabular-nums">{fmt(h.d)}</b>{' '}
                <span className="text-xs text-ink-faint">· {h.at ? ago(h.at) : h.day === today ? 'today' : new Date(`${h.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              </p>
            ))}
          </div>
        </div>
      )}
      {docs !== null && t.by.size === 0 && <p className="text-sm text-ink-soft">Nobody has attacked yet this week: strike first!</p>}

      {prevT.by.size > 0 && (
        <p className="text-xs text-ink-faint">
          Last week: {shownName(prevBoss.card.name, prevBoss.card.set)} ({prevBoss.franchise}) took {fmt(prevT.total)} damage, {prevT.total >= health ? 'and fell 🏆' : 'and got away'}.
        </p>
      )}
    </section>
  );
}
