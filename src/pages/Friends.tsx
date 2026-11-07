import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { COSMETIC_BY_ID } from '../casino/cosmetics';
import { AvatarFrame } from '../casino/Frame';
import { PLUSH_BY_ID, PLUSH_RARITY } from '../casino/plushies';
import { TITLE_BY_ID } from '../casino/unlocks';
import type { DayEntry, ScoreDoc } from '../cloud/friends';
import { startCloud, useCloud } from '../cloud/state';
import { RARITIES, RARITY_INFO } from '../gacha/cards';
import { GRADE_BONUS, RARITY_POINTS } from '../friends/score';
import { addDays, fromKey, todayKey } from '../lib/date';
import { sfx } from '../lib/sfx';

const friends = () => import('../cloud/friends');
const AvatarIcon = lazy(() => import('../gacha/LayoutCards').then((m) => ({ default: m.AvatarIcon })));

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const link = (code: string) => `${window.location.origin}${window.location.pathname}#/friends?code=${code}`;
/** 2026-11-07 → 7 Nov. */
const short = (key: string) => fromKey(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const long = (key: string) =>
  fromKey(key).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
/** One colour per player, you first. */
const COLORS = ['#2f7f7a', '#e0565b', '#d99a2b', '#6d5bd0', '#3b8fd9', '#c2549d', '#4f9a4a', '#a0692e', '#5b6b8a', '#d4683a'];

interface Player {
  doc: ScoreDoc;
  color: string;
  me: boolean;
}

/** A player's name in the style they bought, their title under it (when they wear one other than Newcomer). */
function PlayerName({ p, you = false, className = '' }: { p: Player; you?: boolean; className?: string }) {
  const style = COSMETIC_BY_ID.get(p.doc.nameStyle ?? '')?.className;
  const title = TITLE_BY_ID.get(p.doc.title ?? '');
  const plush = PLUSH_BY_ID.get(p.doc.plush ?? '');
  return (
    <span className={`flex min-w-0 flex-col leading-tight ${className}`}>
      <span className="flex min-w-0 items-baseline gap-1">
        <span className={`truncate font-semibold ${style ?? ''}`} style={style ? undefined : { color: p.color }}>
          {p.doc.name}
        </span>
        {plush && (
          <span className="shrink-0 text-sm leading-none" title={`Best plush: ${plush.name} (${PLUSH_RARITY[plush.rarity].name})`} aria-label={`Best plush: ${plush.name}`}>
            {plush.face}
          </span>
        )}
        {you && <span className="shrink-0 text-xs text-ink-faint">(you)</span>}
      </span>
      {title && title.id !== 'newcomer' && <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-faint">« {title.name} »</span>}
    </span>
  );
}

/** A player's icon: their icon card in their frame, else their initial. */
function Face({ p, size = 'size-7' }: { p: Player; size?: string }) {
  return (
    <AvatarFrame frame={p.doc.frame}>
      {p.doc.avatar ? (
        <Suspense fallback={<span className={`${size} block rounded-full bg-tile`} />}>
          <AvatarIcon id={p.doc.avatar} className={size} />
        </Suspense>
      ) : (
        <span className={`${size} grid place-items-center rounded-full font-display text-xs font-bold uppercase text-white`} style={{ background: p.color }}>
          {p.doc.name[0] ?? '?'}
        </span>
      )}
    </AvatarFrame>
  );
}

/** A player's entry on a day: theirs that day, or the last one before it (carried: they didn't come by). */
function entryOn(log: Record<string, DayEntry>, sorted: string[], day: string): { entry: DayEntry; from: string } | null {
  let found: string | null = null;
  for (const d of sorted) {
    if (d > day) break;
    found = d;
  }
  return found ? { entry: log[found], from: found } : null;
}

/** A round top for the score axis: 1, 2 or 5 times a power of ten. */
function niceMax(v: number) {
  if (v <= 10) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
];

/** The scores, day by day: a line per player, a dot a day (hover or tap one for its details), their icon at today. */
function ScoreChart({ players }: { players: Player[] }) {
  const [range, setRange] = useState(30);
  const [hover, setHover] = useState<{ p: number; d: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const today = todayKey();
  const sorted = useMemo(() => players.map((p) => Object.keys(p.doc.log ?? {}).sort()), [players]);
  const first = sorted.flat().sort()[0] ?? today;
  const days = useMemo(() => {
    let start = range ? addDays(today, -(range - 1)) : first;
    if (start < first && !range) start = first;
    const out: string[] = [];
    for (let d = start; d <= today && out.length < 800; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range, first, today]);
  const series = useMemo(() => players.map((p, i) => days.map((d) => entryOn(p.doc.log ?? {}, sorted[i], d))), [players, days, sorted]);
  const top = niceMax(Math.max(10, ...series.flat().map((e) => (e ? e.entry[0] : 0))) * 1.08);

  const H = width < 520 ? 240 : 320;
  const L = 46;
  const R = 34;
  const T = 14;
  const B = 26;
  const x = (i: number) => L + (days.length <= 1 ? (width - L - R) / 2 : (i / (days.length - 1)) * (width - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(top * k));
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((width - L - R) / 70))));
  const dots = days.length <= 120;

  const shown = hover ? series[hover.p]?.[hover.d] : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            onClick={() => (setRange(r.days), setHover(null))}
            className={`rounded-full border px-3 py-1 font-display text-xs font-semibold transition ${range === r.days ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-soft hover:border-ink hover:text-ink'}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div ref={box} className="relative w-full min-w-0 select-none" style={{ minHeight: H }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <>
            <svg width={width} height={H} className="block overflow-visible" role="img" aria-label="Collection scores, day by day">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={L} x2={width - R} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-rule" strokeDasharray={t ? '3 4' : undefined} />
                  <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-faint text-[10px] tabular-nums">
                    {t.toLocaleString('en-GB')}
                  </text>
                </g>
              ))}
              {days.map((d, i) =>
                i % labelEvery === 0 || i === days.length - 1 ? (
                  <text key={d} x={x(i)} y={H - 6} textAnchor={i === days.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} className="fill-ink-faint text-[10px]">
                    {i === days.length - 1 ? 'Today' : short(d)}
                  </text>
                ) : null,
              )}
              {series.map((s, pi) => {
                const pts = s.map((e, i) => (e ? `${x(i)},${y(e.entry[0])}` : null)).filter(Boolean);
                return (
                  <g key={players[pi].doc.uid} opacity={hover && hover.p !== pi ? 0.35 : 1}>
                    <polyline points={pts.join(' ')} fill="none" stroke={players[pi].color} strokeWidth={players[pi].me ? 3 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
                    {dots &&
                      s.map((e, i) =>
                        e ? (
                          <circle
                            key={i}
                            cx={x(i)}
                            cy={y(e.entry[0])}
                            r={e.from === days[i] ? 3.6 : 2.4}
                            fill={e.from === days[i] ? players[pi].color : 'var(--color-paper, #fff)'}
                            stroke={players[pi].color}
                            strokeWidth={1.5}
                          />
                        ) : null,
                      )}
                  </g>
                );
              })}
              {/* Wide, unseen targets for the pointer: the nearest dot to hover or tap. */}
              {series.map((s, pi) =>
                s.map((e, i) =>
                  e ? (
                    <circle
                      key={`${pi}-${i}`}
                      cx={x(i)}
                      cy={y(e.entry[0])}
                      r={10}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ p: pi, d: i })}
                      onClick={() => setHover({ p: pi, d: i })}
                    />
                  ) : null,
                ),
              )}
              {hover && shown && <circle cx={x(hover.d)} cy={y(shown.entry[0])} r={6} fill="none" stroke={players[hover.p].color} strokeWidth={2} pointerEvents="none" />}
            </svg>
            {/* Each player's icon where their line ends today. */}
            {series.map((s, pi) => {
              const last = s[s.length - 1];
              return last ? (
                <div
                  key={players[pi].doc.uid}
                  className="pointer-events-none absolute -translate-y-1/2"
                  style={{
                    left: x(days.length - 1) + 6,
                    top: y(last.entry[0]),
                  }}
                  title={players[pi].doc.name}
                >
                  <Face p={players[pi]} size="size-6" />
                </div>
              ) : null;
            })}
            {hover && shown && (
              <div
                className="pointer-events-none absolute z-10 w-56 rounded-md border border-rule bg-paper p-3 text-xs shadow-lg"
                style={{
                  left: Math.min(Math.max(x(hover.d) - 112, 0), width - 224),
                  top: y(shown.entry[0]) > H / 2 ? y(shown.entry[0]) - 12 : y(shown.entry[0]) + 14,
                  transform: y(shown.entry[0]) > H / 2 ? 'translateY(-100%)' : undefined,
                }}
              >
                <div className="flex items-center gap-2 font-display text-sm font-bold">
                  <Face p={players[hover.p]} size="size-5" />
                  <PlayerName p={players[hover.p]} you={players[hover.p].me} />
                </div>
                <p className="mt-0.5 text-ink-faint">{long(days[hover.d])}</p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums" style={{ color: players[hover.p].color }}>
                  {shown.entry[0].toLocaleString('en-GB')}
                </p>
                <p className="font-semibold">{shown.entry[1]} cards</p>
                <p className="mt-1 flex flex-wrap gap-x-2 text-ink-soft">
                  {RARITIES.map((r, k) => (shown.entry[2 + k] ? <span key={r}>{`${RARITY_INFO[r].gem} ${shown.entry[2 + k]}`}</span> : null))}
                </p>
                {!!shown.entry[8] && <p className="text-ink-soft">+{shown.entry[8]} grades</p>}
                {shown.from !== days[hover.d] && <p className="mt-1 italic text-ink-faint">Didn't come by: as on {short(shown.from)}.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Dev only (#/friends?demo): made-up friends with a few weeks of scores, to try the chart without an account. */
function demoDocs(): ScoreDoc[] {
  const names = ['You', 'Sora', 'Mika', 'Jules', 'Noa'];
  const looks: [string | null, string | null, string | null][] = [[null, null, 'kuma'], ['name:neon', 'high-roller', 'omni-star'], ['name:gold', 'collector', null], [null, 'lucky-star', 'kitsune'], ['name:glitch', null, 'yume']];
  const today = todayKey();
  return names.map((name, k) => {
    const log: Record<string, DayEntry> = {};
    let score = 200 + k * 90;
    for (let d = 60; d >= 0; d--) {
      score += Math.round(Math.random() * (30 + k * 12));
      if (k === 3 && d % 3) continue; // Jules skips days
      const cards = Math.round(score / 6);
      log[addDays(today, -d)] = [score, cards, Math.round(cards * 0.55), Math.round(cards * 0.25), Math.round(cards * 0.12), Math.round(cards * 0.06), k % 2, k === 1 ? 1 : 0, Math.round(d / 9)];
    }
    return {
      uid: `demo-${k}`,
      name,
      avatar: null,
      frame: null,
      nameStyle: looks[k][0],
      title: looks[k][1],
      plush: looks[k][2],
      code: 'DEMO1234',
      friends: k ? ['demo-0'] : names.slice(1).map((_, i) => `demo-${i + 1}`),
      log,
      at: Date.now(),
    };
  });
}

export default function Friends() {
  const { status, email, actions } = useCloud();
  const [params] = useSearchParams();
  const demo = import.meta.env.DEV && params.has('demo');
  const signedIn = demo || (!!email && status !== 'signedOut' && !!actions);
  const [mine, setMine] = useState<ScoreDoc | null>(null);
  const [list, setList] = useState<ScoreDoc[]>([]);
  const [code, setCode] = useState(params.get('code') ?? '');
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => void (demo || startCloud()), [demo]);

  const refresh = async () => {
    if (demo) {
      const [me, ...rest] = demoDocs();
      setMine(me);
      setList(rest);
      return;
    }
    const f = await friends();
    const me = await f.openMine();
    f.markFriendsOn(me.uid);
    setMine(me);
    setList(await f.loadFriends(me));
  };
  useEffect(() => {
    if (!signedIn) return;
    setLoading(true);
    refresh()
      .catch((e) => setNote({ text: errorOf(e) }))
      .finally(() => setLoading(false));
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

  const players: Player[] = useMemo(
    () =>
      mine
        ? [mine, ...list.filter((d) => mine.friends.includes(d.uid))].map((doc, i) => ({
            doc,
            color: COLORS[i % COLORS.length],
            me: i === 0,
          }))
        : [],
    [mine, list],
  );
  const today = todayKey();
  const ranking = useMemo(
    () =>
      players
        .map((p) => {
          const days = Object.keys(p.doc.log ?? {}).sort();
          const e = entryOn(p.doc.log ?? {}, days, today);
          return { p, score: e ? e.entry[0] : 0 };
        })
        .sort((a, b) => b.score - a.score),
    [players, today],
  );
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (!demo && (status === 'off' || status === 'loading')) {
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <Spinner /> Connecting…
      </p>
    );
  }

  const leader = ranking[0];
  const tied = ranking.length > 1 && ranking[1].score === leader?.score;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-5xl font-bold">Friends</h1>
        <p className="text-ink-soft">Your collections side by side, day by day. Swap friend codes; only the friends you add see your score, and you theirs.</p>
      </div>

      {!signedIn ? (
        <p className="page rounded-md p-5">
          Friends need an account, so each score reaches the right players.{' '}
          <Link to="/account" className="font-semibold text-accent">
            Sign in
          </Link>{' '}
          first — it takes a moment.
        </p>
      ) : loading && !mine ? (
        <p className="flex items-center gap-2 text-ink-soft">
          <Spinner /> Loading your friends…
        </p>
      ) : (
        <>
          {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

          {mine && (
            <section className="page space-y-4 rounded-md p-5">
              {/* Who leads. */}
              {players.length > 1 && leader ? (
                <p className="text-center font-display text-xl font-bold sm:text-2xl">
                  {tied ? (
                    <>🤝 It's a tie at {leader.score.toLocaleString('en-GB')}</>
                  ) : (
                    <>
                      🏆 <span style={{ color: leader.p.color }}>{leader.p.me ? 'You lead' : `${leader.p.doc.name} leads`}</span> with {leader.score.toLocaleString('en-GB')}
                      {ranking[1] && <span className="text-ink-soft"> · {(leader.score - ranking[1].score).toLocaleString('en-GB')} ahead</span>}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-center font-display text-lg font-semibold text-ink-soft">Add a friend to race them: your score is {(ranking[0]?.score ?? 0).toLocaleString('en-GB')}.</p>
              )}
              <ScoreChart players={players} />
              <p className="text-xs text-ink-faint">
                The score: each card owned is worth {RARITIES.map((r) => `${RARITY_POINTS[r]} (${RARITY_INFO[r].name})`).join(', ')}, and each grade above the first adds {GRADE_BONUS * 100}% of that.
                A score is noted each day a player comes by; a hollow dot is a day they didn't (their last score carried on).
              </p>
            </section>
          )}

          {mine && (
            <div className="grid gap-6 md:grid-cols-2">
              <section className="page space-y-3 rounded-md p-5">
                <h2 className="font-display text-lg font-bold">Your friend code</h2>
                <p className="font-display text-3xl font-bold tracking-[0.15em] tabular-nums">{showCode(mine.code)}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold" onClick={() => copy(mine.code, 'code')}>
                    {copied === 'code' ? 'Copied ✓' : 'Copy code'}
                  </button>
                  <button type="button" className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold" onClick={() => copy(link(mine.code), 'link')}>
                    {copied === 'link' ? 'Copied ✓' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const f = await friends();
                        setMine(await f.changeCode(mine));
                        setNote({
                          text: 'New code made: the old one no longer works. Your friends stay.',
                          good: true,
                        });
                      })
                    }
                  >
                    New code
                  </button>
                </div>
                <p className="text-xs text-ink-faint">Whoever types it becomes your friend, both ways. Shared it too widely? Make a new one.</p>

                <h2 className="pt-2 font-display text-lg font-bold">Add a friend</h2>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const f = await friends();
                      const next = await f.addFriend(mine, code);
                      setMine(next);
                      setList(await f.loadFriends(next));
                      setCode('');
                      sfx.correct();
                      setNote({
                        text: 'Friend added: you now see each other.',
                        good: true,
                      });
                    });
                  }}
                >
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ABCD-EFGH"
                    maxLength={9}
                    className="min-w-0 flex-1 rounded-md border border-rule bg-paper px-3 py-2 font-display uppercase tracking-widest"
                    aria-label="A friend's code"
                  />
                  <button type="submit" className="btn-accent rounded-md px-4 py-2 font-display text-sm font-bold" disabled={busy || cleanLength(code) !== 8}>
                    Add
                  </button>
                </form>
              </section>

              <section className="page space-y-3 rounded-md p-5">
                <h2 className="font-display text-lg font-bold">
                  Your friends <span className="text-sm font-semibold text-ink-faint">({mine.friends.length})</span>
                </h2>
                {ranking.length <= 1 ? (
                  <p className="text-sm text-ink-soft">No friends yet. Send them your code, or type theirs.</p>
                ) : (
                  <ol className="space-y-2">
                    {ranking.map(({ p, score }, k) => (
                      <li key={p.doc.uid} className="flex items-center gap-3">
                        <span className="w-5 text-right font-display text-sm font-bold text-ink-faint">{k + 1}</span>
                        <Face p={p} />
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} title="Their line on the chart" aria-hidden />
                        <PlayerName p={p} you={p.me} className="flex-1" />
                        <span className="font-display font-bold tabular-nums">{score.toLocaleString('en-GB')}</span>
                        {!p.me &&
                          (removing === p.doc.uid ? (
                            <span className="flex gap-1">
                              <button
                                type="button"
                                className="rounded-md bg-coral px-2 py-1 text-xs font-bold text-white"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    const f = await friends();
                                    const next = await f.removeFriend(mine, p.doc.uid);
                                    setMine(next);
                                    setList((l) => l.filter((d) => d.uid !== p.doc.uid));
                                    setRemoving(null);
                                  })
                                }
                              >
                                Remove
                              </button>
                              <button type="button" className="rounded-md px-2 py-1 text-xs font-semibold text-ink-soft hover:text-ink" onClick={() => setRemoving(null)}>
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-tile hover:text-coral"
                              title={`Remove ${p.doc.name}`}
                              aria-label={`Remove ${p.doc.name}`}
                              onClick={() => setRemoving(p.doc.uid)}
                            >
                              ✕
                            </button>
                          ))}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-xs text-ink-faint">Removing a friend takes you off each other's chart.</p>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cleanLength = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').length;
const showCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);
