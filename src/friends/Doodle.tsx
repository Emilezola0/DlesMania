// Friends → Daily Doodle: pick a franchise and one of its characters, draw them in 10, 20 or 30 seconds (the less time, the more it pays); friends see the
// drawing (played back stroke by stroke) and guess who it is, 3 tries each. A right guess pays the guesser, and
// the artist more for every friend who got it (src/cloud/doodles.ts, the numbers in economy.json `doodle`).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DoodleDoc, GuessDoc, Stroke } from '../cloud/doodles';
import type { ScoreDoc } from '../cloud/friends';
import { DleCoin } from '../components/DleCoin';
import T from '../data/tuning/economy.json';
import { COLLECTIBLE, SETS, type Card } from '../gacha/cards';
import { addDays, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const D = T.doodle;
type DoodleTime = (typeof D.times)[number];
/** A drawing's time and what it pays (a drawing from before there was a choice: the first, 10 seconds). */
const timeOf = (secs?: number): DoodleTime => D.times.find((t) => t.seconds === secs) ?? D.times[0];
const cloud = () => import('../cloud/doodles');

/** The pens: colours and widths (a share of the drawing's width). */
export const INKS = ['#111827', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#92400e', '#fcd5b5'];
export const WIDTHS = [0.012, 0.028, 0.06];

/** The characters a franchise can be drawn as: its cards that are someone (not places or techniques), by name. */
const BY_SET = new Map<string, Card[]>();
for (const c of COLLECTIBLE) if (!c.place && !c.technique) BY_SET.set(c.set, [...(BY_SET.get(c.set) ?? []), c]);
export const namesOf = (set: string) => [...new Set((BY_SET.get(set) ?? []).map((c) => c.name))].sort((a, b) => a.localeCompare(b));
export const cardNamed = (set: string, name: string) => (BY_SET.get(set) ?? []).find((c) => c.name === name);
/** The franchises to draw from: ones with characters (not the Japanese words). */
export const FRANCHISES = SETS.filter((s) => s.id !== 'jlpt' && namesOf(s.id).length >= 8).sort((a, b) => a.franchise.localeCompare(b.franchise));
export const franchiseOf = (set: string) => SETS.find((s) => s.id === set)?.franchise ?? set;

/** Paints strokes on a canvas, up to `upTo` points in all (Infinity: the whole drawing). */
export function paint(canvas: HTMLCanvasElement, strokes: { c: number; w: number; pts: [number, number][] }[], upTo = Infinity) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  g.fillStyle = '#fffdf7';
  g.fillRect(0, 0, W, W);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let left = upTo;
  for (const s of strokes) {
    if (left <= 0) break;
    const pts = s.pts.slice(0, Math.max(1, Math.min(s.pts.length, left)));
    left -= s.pts.length;
    g.strokeStyle = INKS[s.c] ?? INKS[0];
    g.fillStyle = g.strokeStyle;
    g.lineWidth = (WIDTHS[s.w] ?? WIDTHS[1]) * W;
    if (pts.length === 1) {
      g.beginPath();
      g.arc(pts[0][0] * W, pts[0][1] * W, g.lineWidth / 2, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    g.beginPath();
    g.moveTo(pts[0][0] * W, pts[0][1] * W);
    for (const [x, y] of pts.slice(1)) g.lineTo(x * W, y * W);
    g.stroke();
  }
}

/** A drawing played back stroke by stroke, as it was drawn (again on a tap). */
export function Replay({ strokes, className = '' }: { strokes: Stroke[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [unpacked, setUnpacked] = useState<{ c: number; w: number; pts: [number, number][] }[]>([]);
  useEffect(() => {
    void cloud().then((c) => setUnpacked(strokes.map((s) => ({ c: s.c, w: s.w, pts: c.unpack(s.p) }))));
  }, [strokes]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !unpacked.length) return;
    const total = unpacked.reduce((t, s) => t + s.pts.length, 0);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const n = Math.ceil((total * (now - t0)) / 2600);
      paint(c, unpacked, n);
      if (n < total) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Shown whole at once if animation frames don't come (a hidden tab).
    const fallback = window.setTimeout(() => paint(c, unpacked), 3000);
    return () => (cancelAnimationFrame(raf), window.clearTimeout(fallback));
  }, [unpacked, run]);
  return (
    <button type="button" onClick={() => setRun((r) => r + 1)} title="Play it again" className={`block overflow-hidden rounded-md border border-rule-strong ${className}`}>
      <canvas ref={ref} width={480} height={480} className="block aspect-square w-full" />
    </button>
  );
}

/** A small picture of a card, to draw from (or to see who it was). */
export function CardPic({ card, className = '' }: { card?: Card; className?: string }) {
  if (!card?.image) return null;
  return <img src={card.image} alt={card.name} loading="lazy" className={`rounded-md border border-rule object-cover ${className}`} />;
}

type DrawStep = 'pick' | 'count' | 'drawing' | 'done' | 'posted';

/** Your drawing of the day: pick, draw against the clock, post. */
function DrawPanel({ demo, posted, onPosted }: { demo: boolean; posted: DoodleDoc | null; onPosted: (d: DoodleDoc) => void }) {
  const [set, setSet] = useState(FRANCHISES[0]?.id ?? '');
  const names = useMemo(() => namesOf(set), [set]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [who, setWho] = useState('');
  const [step, setStep] = useState<DrawStep>(posted ? 'posted' : 'pick');
  const [count, setCount] = useState(3);
  const [secs, setSecs] = useState(D.times[0].seconds);
  const [left, setLeft] = useState(secs);
  const [ink, setInk] = useState(0);
  const [width, setWidth] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strokes = useRef<{ c: number; w: number; pts: [number, number][] }[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (posted) setStep('posted');
  }, [posted]);
  // Four characters to pick from, again with each franchise (or a shuffle).
  const shuffle = () => setIdeas([...names].sort(() => Math.random() - 0.5).slice(0, 4));
  useEffect(() => {
    shuffle();
    setWho('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  // 3, 2, 1… then the clock.
  useEffect(() => {
    if (step !== 'count') return;
    if (count <= 0) {
      strokes.current = [];
      if (canvas.current) paint(canvas.current, []);
      setLeft(secs);
      setStep('drawing');
      sfx.whoosh();
      return;
    }
    sfx.tick();
    const t = window.setTimeout(() => setCount((c) => c - 1), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, count]);
  useEffect(() => {
    if (step !== 'drawing') return;
    const end = Date.now() + secs * 1000;
    const t = window.setInterval(() => {
      const s = Math.max(0, (end - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        window.clearInterval(t);
        drawing.current = false;
        sfx.wrong();
        setStep('done');
      }
    }, 100);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if ((step === 'drawing' || step === 'done') && canvas.current) paint(canvas.current, strokes.current);
  }, [step]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (step !== 'drawing' || strokes.current.length >= 380) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push({ c: ink, w: width, pts: [at(e)] });
    paint(e.currentTarget, strokes.current);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || step !== 'drawing') return;
    const s = strokes.current[strokes.current.length - 1];
    const p = at(e);
    const last = s.pts[s.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
    s.pts.push(p);
    paint(e.currentTarget, strokes.current);
  };
  const up = () => (drawing.current = false);

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await cloud();
      const packed: Stroke[] = strokes.current.map((s) => ({ c: s.c, w: s.w, p: c.pack(s.pts) }));
      const d = demo
        ? { uid: 'demo-0', name: 'You', day: todayKey(), set, secs, answer: await c.answerHash(`demo-0_${todayKey()}`, who), strokes: packed, solvers: [], at: Date.now() }
        : await c.postDoodle(todayKey(), set, who, packed, secs);
      sfx.victory();
      celebrate();
      onPosted(d);
    } catch (e) {
      sfx.wrong();
      setError((e as { code?: string })?.code === 'permission-denied' ? "The Daily Doodle isn't switched on in the database yet: its rules need the doodles section (firestore.rules) published." : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'posted' && posted) return <MyDrawing d={posted} />;

  const card = who ? cardNamed(set, who) : undefined;
  if (step === 'pick')
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">1 · A franchise</span>
          <select value={set} onChange={(e) => setSet(e.target.value)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold">
            {FRANCHISES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.franchise}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-widest text-ink-faint">
            2 · Who to draw
            <button type="button" onClick={() => (sfx.select(), shuffle())} className="normal-case tracking-normal text-accent">
              ↻ Other ideas
            </button>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((n) => (
              <button key={n} type="button" onClick={() => (sfx.select(), setWho(n))} aria-pressed={who === n} className={`rounded-full border px-3 py-1 font-semibold ${who === n ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
                {n}
              </button>
            ))}
          </div>
          <input list="doodle-names" value={who} onChange={(e) => setWho(e.target.value)} placeholder="…or type any of them" className="mt-2 w-full rounded-md border border-rule-strong bg-card px-3 py-2" />
          <datalist id="doodle-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        {card && (
          <div className="flex items-center gap-3 rounded-md bg-tile p-2">
            <CardPic card={card} className="h-20 w-16" />
            <p className="text-sm">
              <b>{card.name}</b>: you&apos;ll have <b>{secs} seconds</b> to draw them. Your friends see only the drawing and the franchise.
            </p>
          </div>
        )}
        <div className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">3 · Your time: the less, the more it pays</span>
          <div className="grid grid-cols-3 gap-1.5">
            {D.times.map((t) => (
              <button key={t.seconds} type="button" onClick={() => (sfx.select(), setSecs(t.seconds))} aria-pressed={secs === t.seconds} className={`rounded-md border px-2 py-1.5 text-center ${secs === t.seconds ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
                <span className="block font-display text-lg font-black">{t.seconds} s</span>
                <span className={`block text-[11px] leading-tight ${secs === t.seconds ? 'text-white/85' : 'text-ink-soft'}`}>
                  you {t.artist} a friend · them up to {t.guess[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!names.includes(who)}
          onClick={() => {
            setCount(3);
            setStep('count');
          }}
          className="btn-accent w-full rounded-md px-4 py-2.5 font-display font-bold disabled:opacity-40"
        >
          🎨 Draw!
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CardPic card={card} className="h-14 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">{who}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-tile">
            <div className={`h-full rounded-full ${left < 3 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${(step === 'drawing' ? left / secs : step === 'count' ? 1 : 0) * 100}%`, transition: 'width 0.1s linear' }} />
          </div>
        </div>
        <span className="w-12 text-right font-display text-2xl font-black tabular-nums">{step === 'count' ? count : Math.ceil(left)}</span>
      </div>
      <div className="relative">
        <canvas ref={canvas} width={480} height={480} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="block aspect-square w-full touch-none rounded-md border-2 border-rule-strong bg-[#fffdf7]" />
        {step === 'count' && <div className="absolute inset-0 grid place-items-center rounded-md bg-black/40 font-display text-7xl font-black text-white">{count}</div>}
      </div>
      {step === 'drawing' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {INKS.map((c, k) => (
            <button key={c} type="button" onClick={() => setInk(k)} aria-label={`Colour ${k + 1}`} aria-pressed={ink === k} className={`size-7 rounded-full border-2 ${ink === k ? 'scale-110 border-accent' : 'border-rule-strong'}`} style={{ background: c }} />
          ))}
          <span className="mx-1 h-6 w-px bg-rule" />
          {WIDTHS.map((w, k) => (
            <button key={w} type="button" onClick={() => setWidth(k)} aria-label={['Thin', 'Medium', 'Thick'][k]} aria-pressed={width === k} className={`grid size-8 place-items-center rounded-md border ${width === k ? 'border-accent bg-tile' : 'border-rule-strong'}`}>
              <span className="rounded-full bg-ink" style={{ width: 4 + k * 5, height: 4 + k * 5 }} />
            </button>
          ))}
        </div>
      )}
      {step === 'done' && (
        <div className="space-y-2">
          <p className="text-center font-display text-lg font-bold">⏰ Time&apos;s up!</p>
          {error && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('pick')} className="btn-paper flex-1 rounded-md px-3 py-2 font-semibold">
              Start again
            </button>
            <button type="button" disabled={busy || !strokes.current.length} onClick={() => void post()} className="btn-accent flex-1 rounded-md px-3 py-2 font-display font-bold disabled:opacity-40">
              {busy ? 'Posting…' : 'Show my friends'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Your posted drawing: who got it, what it earned. */
function MyDrawing({ d }: { d: DoodleDoc }) {
  return (
    <div className="space-y-2">
      <Replay strokes={d.strokes} className="mx-auto max-w-xs" />
      <p className="text-center text-sm">
        Today&apos;s drawing is up ({franchiseOf(d.set)}).{' '}
        {d.solvers.length ? (
          <>
            <b>{d.solvers.length}</b> {d.solvers.length === 1 ? 'friend has' : 'friends have'} guessed it: +{(d.solvers.length * timeOf(d.secs).artist).toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" />
          </>
        ) : (
          'Nobody has guessed it yet.'
        )}
      </p>
      <p className="text-center text-xs text-ink-faint">
        Drawn in {timeOf(d.secs).seconds} seconds: you get {timeOf(d.secs).artist} DleCoins for every friend who guesses it right. Come back tomorrow to draw another.
      </p>
    </div>
  );
}

/** A friend's drawing to guess: 3 tries, then who it was. */
function GuessCard({ d, artist, demo }: { d: DoodleDoc; artist?: ScoreDoc; demo: boolean }) {
  const names = useMemo(() => namesOf(d.set), [d.set]);
  const [guess, setGuess] = useState<GuessDoc | null>(null);
  const [loaded, setLoaded] = useState(demo);
  const [text, setText] = useState('');
  const [wrong, setWrong] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(0);
  const reward = useProgress((s) => s.rewardDoodleGuess);
  const pays = timeOf(d.secs);
  const done = !!guess && (guess.right || guess.tries >= D.tries);

  useEffect(() => {
    if (demo) return;
    void cloud()
      .then((c) => c.myGuess(d))
      .then((g) => setGuess(g))
      .finally(() => setLoaded(true));
  }, [d, demo]);
  // Once it's over: who it was.
  useEffect(() => {
    if (done && !answer) void cloud().then((c) => c.findAnswer(d, names).then(setAnswer));
  }, [done, answer, d, names]);

  const send = async () => {
    const name = names.find((n) => n.toLowerCase() === text.trim().toLowerCase());
    if (!name || done) return;
    setBusy(true);
    try {
      const c = await cloud();
      let next: GuessDoc;
      if (demo) next = { tries: (guess?.tries ?? 0) + 1, right: (await c.answerHash(c.doodleId(d.uid, d.day), name)) === d.answer, at: Date.now() };
      else next = await c.guessDoodle(d, guess, name);
      setGuess(next);
      setText('');
      if (next.right) {
        const coins = pays.guess[Math.min(next.tries, pays.guess.length) - 1] ?? 0;
        if (!demo) setPaid(reward(c.doodleId(d.uid, d.day), coins));
        else setPaid(coins);
        setAnswer(name);
        sfx.victory();
        celebrate();
      } else {
        setWrong((w) => [...w, name]);
        sfx.wrong();
      }
    } catch {
      sfx.wrong();
    } finally {
      setBusy(false);
    }
  };

  const triesLeft = D.tries - (guess?.tries ?? 0);
  const card = answer ? cardNamed(d.set, answer) : undefined;
  return (
    <div className="space-y-2 rounded-md border border-rule bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-display font-bold">{artist?.name ?? d.name}</p>
        <p className="shrink-0 text-xs text-ink-faint">{d.day === todayKey() ? 'Today' : 'Yesterday'}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {franchiseOf(d.set)} <span className="text-ink-faint">· drawn in {pays.seconds} s</span>
      </p>
      <Replay strokes={d.strokes} />
      <p className="text-xs text-ink-faint">Guessed by {d.solvers.length} so far</p>
      {!loaded ? null : done ? (
        <div className="flex items-center gap-2 rounded-md bg-tile p-2">
          <CardPic card={card} className="h-14 w-11" />
          <div className="min-w-0 text-sm">
            <p className="font-display font-bold">{guess?.right ? `✅ ${answer ?? ''}` : `It was ${answer ?? '…'}`}</p>
            {guess?.right ? (
              <p className="text-ink-soft">
                {paid ? (
                  <>
                    +{paid} <DleCoin className="inline size-3.5 align-[-2px]" />, and {pays.artist} for {artist?.name ?? d.name}
                  </>
                ) : (
                  'Got it.'
                )}
              </p>
            ) : (
              <p className="text-ink-soft">No more guesses on this one.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              list={`doodle-guess-${d.uid}-${d.day}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              placeholder="Who is it?"
              className="min-w-0 flex-1 rounded-md border border-rule-strong bg-paper px-3 py-1.5"
            />
            <datalist id={`doodle-guess-${d.uid}-${d.day}`}>
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="button" disabled={busy || !names.some((n) => n.toLowerCase() === text.trim().toLowerCase())} onClick={() => void send()} className="btn-accent rounded-md px-3 py-1.5 font-semibold disabled:opacity-40">
              Guess
            </button>
          </div>
          <p className="text-xs text-ink-soft">
            {triesLeft} {triesLeft === 1 ? 'guess' : 'guesses'} left · right on the {['first', 'second', 'third'][(guess?.tries ?? 0)] ?? 'next'} try: +{pays.guess[guess?.tries ?? 0] ?? 0} DleCoins
            {wrong.length > 0 && <span className="text-coral"> · not {wrong.join(', not ')}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/** Dev only (#/friends?demo): two friends' scribbles to guess (random lines, no real drawing), their answers among the real names. */
async function demoDoodles(friends: ScoreDoc[]): Promise<DoodleDoc[]> {
  const c = await cloud();
  const out: DoodleDoc[] = [];
  for (const [k, f] of friends.slice(0, 2).entries()) {
    const set = FRANCHISES[(k * 7) % FRANCHISES.length].id;
    const day = k ? addDays(todayKey(), -1) : todayKey();
    const strokes: Stroke[] = Array.from({ length: 6 }, (_, i) => {
      let x = 0.2 + Math.random() * 0.6;
      let y = 0.2 + Math.random() * 0.6;
      const pts: [number, number][] = Array.from({ length: 25 }, () => [(x = Math.min(0.95, Math.max(0.05, x + (Math.random() - 0.5) * 0.08))), (y = Math.min(0.95, Math.max(0.05, y + (Math.random() - 0.5) * 0.08)))]);
      return { c: i % INKS.length, w: i % 3, p: c.pack(pts) };
    });
    const answer = namesOf(set)[3];
    out.push({ uid: f.uid, name: f.name, day, set, secs: k ? 30 : 10, answer: await c.answerHash(c.doodleId(f.uid, day), answer), strokes, solvers: k ? ['demo-3'] : [], at: Date.now() - k * 1000 });
  }
  return out;
}

/** The Daily Doodle on the Friends page: draw, or guess the friends' drawings of today and yesterday. */
export function DailyDoodle({ me, friends, demo }: { me: ScoreDoc; friends: ScoreDoc[]; demo: boolean }) {
  const [tab, setTab] = useState<'guess' | 'draw'>('guess');
  const [mine, setMine] = useState<DoodleDoc | null>(null);
  const [theirs, setTheirs] = useState<DoodleDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [earned, setEarned] = useState(0);
  const rewardArt = useProgress((s) => s.rewardDoodleArt);
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: D.days }, (_, k) => addDays(today, -k)), [today]);
  const friendIds = me.friends.join(',');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (demo) {
          const docs = await demoDoodles(friends);
          if (live) setTheirs(docs);
          return;
        }
        const c = await cloud();
        // My drawings of the last days: what friends who guessed them have earned me.
        const own = await Promise.all(days.map((d) => getMine(c, d)));
        let got = 0;
        for (const d of own) if (d) got += rewardArt(c.doodleId(d.uid, d.day), d.solvers.length, timeOf(d.secs).artist);
        if (!live) return;
        setMine(own[0]);
        setEarned(got);
        if (!own[0]) setTab('draw');
        const docs = await c.friendDoodles(me.friends, days);
        if (live) setTheirs(docs);
      } catch (e) {
        if (live) setError((e as { code?: string })?.code === 'permission-denied' ? "The Daily Doodle isn't switched on in the database yet: its rules need the doodles section (firestore.rules) published." : e instanceof Error ? e.message : String(e));
      }
    })();
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, friendIds, today]);

  const byUid = new Map(friends.map((f) => [f.uid, f]));
  return (
    <section className="page space-y-4 rounded-md p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">🎨 Daily Doodle</h2>
          <p className="text-sm text-ink-soft">
            Draw a character in {D.times.map((t) => t.seconds).join(', ').replace(/, (?=[^,]*$)/, ' or ')} seconds; your friends guess who it is ({D.tries} tries). The quicker the drawing, the more a right guess pays: them up to {D.times[0].guess[0]}, and you up to {D.times[0].artist} for each friend who got it.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-rule bg-tile p-1">
          {(['guess', 'draw'] as const).map((t) => (
            <button key={t} type="button" onClick={() => (sfx.select(), setTab(t))} aria-pressed={tab === t} className={`rounded-md px-3 py-1 font-display text-sm font-bold ${tab === t ? 'bg-paper shadow' : 'text-ink-soft'}`}>
              {t === 'guess' ? `Guess${theirs?.length ? ` (${theirs.length})` : ''}` : mine ? 'Your drawing' : 'Draw'}
            </button>
          ))}
        </div>
      </div>
      {earned > 0 && (
        <p className="rounded-md border border-hit/50 bg-hit/10 p-2 text-sm font-semibold">
          🎉 Friends guessed your drawings: +{earned.toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" />
        </p>
      )}
      {error && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">{error}</p>}
      {tab === 'draw' ? (
        <div className="mx-auto max-w-md">
          <DrawPanel demo={demo} posted={mine} onPosted={setMine} />
        </div>
      ) : theirs === null ? (
        <p className="text-sm text-ink-soft">Loading your friends&apos; drawings…</p>
      ) : theirs.length === 0 ? (
        <p className="text-sm text-ink-soft">{me.friends.length ? 'None of your friends has drawn today yet. Draw yours, and tell them!' : 'Add friends to guess their drawings.'}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {theirs.map((d) => (
            <GuessCard key={`${d.uid}-${d.day}`} d={d} artist={byUid.get(d.uid)} demo={demo} />
          ))}
        </div>
      )}
    </section>
  );
}

async function getMine(c: Awaited<ReturnType<typeof cloud>>, day: string): Promise<DoodleDoc | null> {
  try {
    return await c.myDoodle(day);
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') throw e;
    return null;
  }
}
