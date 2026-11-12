// Friends → Telephone: a drawing chain played turn by turn, whenever each friend comes by (src/cloud/phones.ts). You
// start one with a character; a friend sees only that name and draws it; the next sees only the drawing and guesses
// who it is; the next draws that guess… Every turn is sealed (a wax seal): nobody sees what's inside until they break
// it, and breaking it takes the turn (TELEPHONE.claimMinutes to play it, once per chain). Once it's full
// (TELEPHONE.steps) or TELEPHONE.days have passed, everyone sees the whole chain from start to end. Each step pays its
// maker, and everyone in it gets a bonus if the last guess is the character it started with.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Stroke } from '../cloud/doodles';
import type { PhoneDoc, Step } from '../cloud/phones';
import { DleCoin } from '../components/DleCoin';
import T from '../data/tuning/friends.json';
import { addDays, now, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardPic, cardNamed, FRANCHISES, franchiseOf, INKS, namesOf, paint, Replay, WIDTHS } from './Doodle';

const P = T.telephone;
const cloud = () => import('../cloud/phones');
const doodles = () => import('../cloud/doodles');
const coin = <DleCoin className="inline size-3.5 align-[-2px]" />;
const DAY_MS = 86_400_000;

export interface PhonePerson {
  uid: string;
  face: ReactNode;
  name: string;
}

/** "Son Goku" → "son goku": names compared as the Doodle does. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** When a chain started (just started here: now). */
const startOf = (p: PhoneDoc) => (p.at ? p.at.toMillis() : now());
/** Full, or open too long: the seals are off and everyone sees it whole (as phoneDone in src/cloud/phones.ts). */
const isDone = (p: PhoneDoc) => p.kinds.length >= P.steps || now() > startOf(p) + P.days * DAY_MS;
/** Someone else holds the next turn right now (they broke its seal). */
const heldBy = (p: PhoneDoc, me: string) => (p.claim && p.claim.u !== me && (!p.claim.at || now() < p.claim.at.toMillis() + P.claimMinutes * 60_000) ? p.claim.u : null);
/** The last guess, if there was one. */
const lastGuess = (p: PhoneDoc) => [...p.steps].reverse().find((s) => s?.k === 'g');
/** Whether the chain's word made it to the end. */
const madeIt = (p: PhoneDoc) => {
  const g = lastGuess(p);
  return !!g && norm(g.t ?? '') === norm(p.steps[0]?.t ?? '');
};
/** What a finished chain pays this player: each of their steps, and the bonus if it made it. */
function payOf(p: PhoneDoc, uid: string): number {
  const mine = p.people.filter((u) => u === uid).length;
  if (!mine || p.kinds.length < 2) return 0;
  return mine * P.perStep + (madeIt(p) ? P.bonus : 0);
}
const hoursLeft = (p: PhoneDoc) => Math.max(0, Math.ceil((startOf(p) + P.days * DAY_MS - now()) / 3_600_000));

/** A wax seal: a sealed turn nobody has seen. It cracks away when broken. */
export function WaxSeal({ broken, size = 64, label = '📞' }: { broken?: boolean; size?: number; label?: string }) {
  return (
    <span
      aria-hidden
      className="relative inline-grid shrink-0 place-items-center transition-all duration-500"
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 35% 30%, #e0565b 0%, #b3262c 45%, #7a1418 100%)',
        boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.18), inset 0 0 0 6px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.35)',
        borderRadius: '48% 52% 50% 50% / 50% 47% 53% 50%',
        transform: broken ? 'scale(1.3) rotate(18deg)' : undefined,
        opacity: broken ? 0 : 1,
        fontSize: size * 0.36,
      }}
    >
      <span className="grid place-items-center rounded-full" style={{ width: size * 0.66, height: size * 0.66, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.12)' }}>
        <span style={{ filter: 'grayscale(1) brightness(0.55) sepia(1) hue-rotate(-40deg) saturate(3)' }}>{label}</span>
      </span>
    </span>
  );
}

/** A drawing pad against the clock (the Doodle's pens), its strokes handed over when time's up. */
function DrawPad({ word, set, onDone, busy }: { word: string; set: string; onDone: (strokes: Stroke[]) => void; busy: boolean }) {
  const [step, setStep] = useState<'ready' | 'count' | 'drawing' | 'done'>('ready');
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(P.seconds);
  const [ink, setInk] = useState(0);
  const [width, setWidth] = useState(1);
  const strokes = useRef<{ c: number; w: number; pts: [number, number][] }[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const card = cardNamed(set, word);

  useEffect(() => {
    if (step !== 'count') return;
    if (count <= 0) {
      strokes.current = [];
      if (canvas.current) paint(canvas.current, []);
      setStep('drawing');
      sfx.whoosh();
      return;
    }
    sfx.tick();
    const t = window.setTimeout(() => setCount((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [step, count]);
  useEffect(() => {
    if (step !== 'drawing') return;
    const end = Date.now() + P.seconds * 1000;
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
  const send = async () => {
    const c = await doodles();
    onDone(strokes.current.map((s) => ({ c: s.c, w: s.w, p: c.pack(s.pts) })));
  };

  if (step === 'ready')
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-md bg-tile p-2">
          <CardPic card={card} className="h-20 w-16" />
          <p className="text-sm">
            Draw <b>{word}</b> ({franchiseOf(set)}). You&apos;ll have <b>{P.seconds} seconds</b>; the next friend sees only your drawing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCount(3);
            setStep('count');
          }}
          className="btn-accent w-full rounded-md px-4 py-2.5 font-display font-bold"
        >
          🎨 Draw!
        </button>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-display font-bold">{word}</p>
        <div className="h-2 flex-[2] overflow-hidden rounded-full bg-tile">
          <div className={`h-full rounded-full ${left < 3 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${(step === 'drawing' ? left / P.seconds : step === 'count' ? 1 : 0) * 100}%`, transition: 'width 0.1s linear' }} />
        </div>
        <span className="w-10 text-right font-display text-2xl font-black tabular-nums">{step === 'count' ? count : Math.ceil(left)}</span>
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
        <button type="button" disabled={busy} onClick={() => void send()} className="btn-accent w-full rounded-md px-3 py-2 font-display font-bold disabled:opacity-40">
          {busy ? 'Passing it on…' : '⏰ Time’s up! Pass it on'}
        </button>
      )}
    </div>
  );
}

/** A guess at the drawing before: a name of the franchise. */
function GuessPad({ step, set, onGuess, busy }: { step: Step; set: string; onGuess: (name: string) => void; busy: boolean }) {
  const names = useMemo(() => namesOf(set), [set]);
  const [text, setText] = useState('');
  const name = names.find((n) => n.toLowerCase() === text.trim().toLowerCase());
  return (
    <div className="space-y-2">
      <Replay strokes={step.s ?? []} className="mx-auto max-w-xs" />
      <p className="text-center text-xs text-ink-faint">
        Drawn by {step.n} · a {franchiseOf(set)} character
      </p>
      <div className="flex gap-1.5">
        <input list={`phone-names-${set}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && onGuess(name)} placeholder="Who is it?" className="min-w-0 flex-1 rounded-md border border-rule-strong bg-paper px-3 py-1.5" />
        <datalist id={`phone-names-${set}`}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button type="button" disabled={busy || !name} onClick={() => name && onGuess(name)} className="btn-accent rounded-md px-3 py-1.5 font-semibold disabled:opacity-40">
          Pass it on
        </button>
      </div>
      <p className="text-xs text-ink-soft">One guess: the next friend will draw what you say.</p>
    </div>
  );
}

/** A finished chain, from its word to its last step. */
function WholeChain({ p, me, people }: { p: PhoneDoc; me: string; people: Map<string, PhonePerson> }) {
  const ok = madeIt(p);
  const pays = payOf(p, me);
  return (
    <div className="space-y-3 rounded-md border border-rule bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display font-bold">
          {p.uid === me ? 'Your chain' : `${people.get(p.uid)?.name ?? p.name}'s chain`} <span className="text-xs font-semibold uppercase tracking-wider text-accent">{franchiseOf(p.set)}</span>
        </p>
        <p className={`text-sm font-bold ${ok ? 'text-hit' : 'text-ink-soft'}`}>
          {p.kinds.length < 2 ? 'Nobody took it 😢' : ok ? '✅ It made it through!' : '🌀 Lost along the way'}
          {pays > 0 && (
            <span className="ml-2 font-semibold text-ink-soft">
              you: +{pays.toLocaleString('en')} {coin}
            </span>
          )}
        </p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {p.kinds.map((kind, k) => {
          const s = p.steps[k];
          const u = p.people[k];
          return (
            <li key={k} className="space-y-1 rounded-md bg-tile p-2">
              <p className="text-xs text-ink-faint">
                {k + 1}. {people.get(u)?.face} <b>{u === me ? 'You' : (people.get(u)?.name ?? s?.n ?? 'A friend')}</b> {kind === 'w' ? 'started with' : kind === 'd' ? 'drew' : 'guessed'}
              </p>
              {!s ? (
                <p className="text-sm text-ink-soft">Couldn&apos;t load this step.</p>
              ) : s.k === 'd' ? (
                <Replay strokes={s.s ?? []} />
              ) : (
                <div className="flex items-center gap-2">
                  <CardPic card={cardNamed(p.set, s.t ?? '')} className="h-12 w-9" />
                  <p className="font-display text-lg font-bold">{s.t}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A friend's chain waiting for this player's turn: sealed until they break the seal, which takes the turn. */
function Turn({ p, me, people, onTaken, onOpened, demo }: { p: PhoneDoc; me: string; people: Map<string, PhonePerson>; onTaken: (p: PhoneDoc, note: string) => void; onOpened: (p: PhoneDoc) => void; demo: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cracking, setCracking] = useState(false);
  const last = p.kinds.length - 1;
  const before = p.steps[last];
  const kind = p.kinds[last] === 'd' ? 'g' : 'd';
  const open = p.claim?.u === me;
  const holder = heldBy(p, me);

  const breakSeal = async () => {
    setBusy(true);
    setError(null);
    sfx.whoosh();
    setCracking(true);
    try {
      const pause = new Promise((r) => window.setTimeout(r, 450));
      if (demo) {
        await pause;
        onOpened({ ...p, claim: { u: me, at: null }, seen: [...p.seen, me] });
        return;
      }
      const [{ result, doc }] = await Promise.all([(await cloud()).breakSeal(p), pause]);
      if (result === 'refused') {
        setCracking(false);
        setError("This seal can't be broken: Telephone's rules need publishing, the chain has closed, or you already broke it once.");
        return;
      }
      if (result !== 'fresh') setCracking(false);
      if (doc) onOpened(doc);
    } catch {
      setCracking(false);
      setError('No connection: try again once you are online.');
    } finally {
      setBusy(false);
    }
  };

  const take = async (step: Omit<Step, 'u' | 'n'>) => {
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        onTaken({ ...p, kinds: [...p.kinds, step.k], steps: [...p.steps, { u: me, n: 'You', ...step }], people: [...p.people, me], claim: null }, 'Passed on and sealed (demo).');
        return;
      }
      const { result, doc } = await (await cloud()).takeStep(p, step);
      if (result === 'refused') return setError("Telephone isn't switched on in the database yet (its rules need publishing), or this chain has closed.");
      if (result === 'taken') {
        sfx.wrong();
        if (doc) onTaken(doc, `Your ${P.claimMinutes} minutes ran out and another friend took that turn.`);
        return;
      }
      sfx.correct();
      if (doc) onTaken(doc, 'Passed on and sealed! You will see the whole chain once it is finished.');
    } catch {
      setError('No connection: try again once you are online.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-rule bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display font-bold">
          {people.get(p.uid)?.name ?? p.name}&apos;s chain <span className="text-xs font-semibold uppercase tracking-wider text-accent">{franchiseOf(p.set)}</span>
        </p>
        <p className="text-xs text-ink-faint">
          Step {p.kinds.length + 1} of {P.steps} · {hoursLeft(p)} h left
        </p>
      </div>
      {error && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">{error}</p>}
      {open && before ? (
        kind === 'd' ? (
          <DrawPad word={before.t ?? ''} set={p.set} busy={busy} onDone={(s) => void take({ k: 'd', s })} />
        ) : (
          <GuessPad step={before} set={p.set} busy={busy} onGuess={(t) => void take({ k: 'g', t })} />
        )
      ) : open ? (
        <p className="text-sm text-ink-soft">Couldn&apos;t open the seal: reload the page to try again.</p>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-rule-strong bg-tile/60 px-3 py-4 text-center">
          <WaxSeal broken={cracking} />
          <p className="text-sm">
            Sealed: {kind === 'd' ? <>a <b>name to draw</b> in {P.seconds} seconds</> : <>a <b>drawing to guess</b></>}.
          </p>
          {holder ? (
            <p className="text-xs font-semibold text-ink-soft">{people.get(holder)?.name ?? 'A friend'} broke the seal and is playing this turn…</p>
          ) : (
            <>
              <p className="text-xs text-ink-faint">Breaking it gives you the turn for {P.claimMinutes} minutes: only you see what&apos;s inside, and you can&apos;t hand it back.</p>
              <button type="button" disabled={busy} onClick={() => void breakSeal()} className="btn-accent rounded-md px-4 py-2 font-display font-bold disabled:opacity-40">
                Break the seal
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Starting the day's chain: a franchise and one of its characters. */
function Start({ onStart, busy }: { onStart: (set: string, word: string) => void; busy: boolean }) {
  const [set, setSet] = useState(FRANCHISES[0]?.id ?? '');
  const names = useMemo(() => namesOf(set), [set]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [who, setWho] = useState('');
  const shuffle = () => setIdeas([...names].sort(() => Math.random() - 0.5).slice(0, 4));
  useEffect(() => {
    shuffle();
    setWho('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);
  return (
    <div className="space-y-3">
      <select value={set} onChange={(e) => setSet(e.target.value)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold" aria-label="A franchise">
        {FRANCHISES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.franchise}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {ideas.map((n) => (
          <button key={n} type="button" onClick={() => (sfx.select(), setWho(n))} aria-pressed={who === n} className={`rounded-full border px-3 py-1 font-semibold ${who === n ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
            {n}
          </button>
        ))}
        <button type="button" onClick={() => (sfx.select(), shuffle())} className="text-accent">
          ↻ Other ideas
        </button>
      </div>
      <input list="phone-start" value={who} onChange={(e) => setWho(e.target.value)} placeholder="…or type any of them" className="w-full rounded-md border border-rule-strong bg-card px-3 py-2" />
      <datalist id="phone-start">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button type="button" disabled={busy || !names.includes(who)} onClick={() => onStart(set, who)} className="btn-accent w-full rounded-md px-4 py-2.5 font-display font-bold disabled:opacity-40">
        📞 Start the chain
      </button>
    </div>
  );
}

/** Dev only (#/friends?demo): a friend's chain to draw for, one to guess, and a finished one. */
async function demoPhones(people: PhonePerson[]): Promise<PhoneDoc[]> {
  const c = await doodles();
  const scribble = (): Stroke[] =>
    Array.from({ length: 5 }, (_, i) => {
      let x = 0.3 + Math.random() * 0.4;
      let y = 0.3 + Math.random() * 0.4;
      const pts: [number, number][] = Array.from({ length: 20 }, () => [(x = Math.min(0.95, Math.max(0.05, x + (Math.random() - 0.5) * 0.1))), (y = Math.min(0.95, Math.max(0.05, y + (Math.random() - 0.5) * 0.1)))]);
      return { c: i % INKS.length, w: i % 3, p: c.pack(pts) };
    });
  const [a, b, d] = [people[1], people[2] ?? people[1], people[3] ?? people[1]];
  const set = FRANCHISES[0].id;
  const [n1, n2] = namesOf(set);
  const day = todayKey();
  return [
    { uid: a.uid, name: a.name, day, set, at: null, kinds: ['w'], seen: [], claim: null, steps: [{ u: a.uid, n: a.name, k: 'w', t: n1 }], people: [a.uid] },
    { uid: b.uid, name: b.name, day, set, at: null, kinds: ['w', 'd'], seen: [d.uid], claim: null, steps: [{ u: b.uid, n: b.name, k: 'w', t: n2 }, { u: d.uid, n: d.name, k: 'd', s: scribble() }], people: [b.uid, d.uid] },
    { uid: d.uid, name: d.name, day, set, at: null, kinds: ['w'], seen: [a.uid], claim: { u: a.uid, at: null }, steps: [{ u: d.uid, n: d.name, k: 'w', t: n2 }], people: [d.uid] },
    {
      uid: d.uid,
      name: d.name,
      day: addDays(day, -1),
      set,
      at: null,
      kinds: ['w', 'd', 'g', 'd', 'g', 'd', 'g'],
      seen: [],
      claim: null,
      steps: [
        { u: d.uid, n: d.name, k: 'w', t: n1 },
        { u: 'demo-0', n: 'You', k: 'd', s: scribble() },
        { u: a.uid, n: a.name, k: 'g', t: n1 },
        { u: b.uid, n: b.name, k: 'd', s: scribble() },
        { u: 'demo-4', n: 'Noa', k: 'g', t: n2 },
        { u: d.uid === a.uid ? 'demo-9' : a.uid, n: 'Sora', k: 'd', s: scribble() },
        { u: 'demo-8', n: 'Mika', k: 'g', t: n1 },
      ],
      people: [d.uid, 'demo-0', a.uid, b.uid, 'demo-4', 'demo-9', 'demo-8'],
    },
  ];
}

export function Telephone({ people, me, demo }: { people: PhonePerson[]; me: string; demo: boolean }) {
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: P.days + 1 }, (_, k) => addDays(today, -k)), [today]);
  const [chains, setChains] = useState<PhoneDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: ReactNode; good?: boolean } | null>(null);
  const pay = useProgress((s) => s.payFriendGame);
  const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);
  const uids = people.map((p) => p.uid).join(',');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = demo ? await demoPhones(people) : await (await cloud()).phonesOf(uids ? uids.split(',') : [], days);
        if (!live) return;
        setChains(list);
        if (demo) return;
        // Finished chains this player was in: paid once each.
        let got = 0;
        for (const p of list) if (isDone(p)) got += pay(`phone:${p.uid}_${p.day}`, payOf(p, me));
        if (got) {
          sfx.victory();
          celebrate();
          setNote({ text: <>📞 Your finished chains paid +{got.toLocaleString('en')} {coin}</>, good: true });
        }
      } catch (e) {
        if (live) setNote({ text: (e as { code?: string })?.code === 'permission-denied' ? "Telephone isn't switched on in the database yet: its rules need the phones section (firestore.rules) published." : e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids, today, demo, me]);

  const put = (p: PhoneDoc) => setChains((cs) => (cs ?? []).map((c) => (c.uid === p.uid && c.day === p.day ? p : c)));
  const replace = async (p: PhoneDoc, text: string) => {
    put(p);
    setNote({ text, good: true });
    if (isDone(p) && !demo) {
      // The last step: the seals come off, the whole chain is read.
      const whole = await (await cloud()).revealPhone(p).catch(() => p);
      put(whole);
      const got = pay(`phone:${p.uid}_${p.day}`, payOf(whole, me));
      if (got) {
        celebrate();
        setNote({ text: <>{text} It was the last step: +{got.toLocaleString('en')} {coin}</>, good: true });
      }
    }
  };

  const start = async (set: string, word: string) => {
    setBusy(true);
    setNote(null);
    try {
      const p: PhoneDoc = demo ? { uid: me, name: 'You', day: today, set, at: null, kinds: ['w'], seen: [], claim: null, steps: [{ u: me, n: 'You', k: 'w', t: word }], people: [me] } : await (await cloud()).startPhone(today, set, word);
      sfx.correct();
      setChains((cs) => [...(cs ?? []), p]);
      setNote({ text: 'Your chain is out: your friends take it from here.', good: true });
    } catch (e) {
      sfx.wrong();
      setNote({ text: (e as { code?: string })?.code === 'permission-denied' ? "Telephone isn't switched on in the database yet: its rules need the phones section (firestore.rules) published." : 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const all = chains ?? [];
  const mineToday = all.find((p) => p.uid === me && p.day === today);
  // Turns to play: not played yet, and either still sealed or broken by this player and still theirs.
  const toPlay = all.filter((p) => !isDone(p) && !p.people.includes(me) && (!p.seen.includes(me) || p.claim?.u === me)).sort((a, b) => a.kinds.length - b.kinds.length);
  const missed = all.filter((p) => !isDone(p) && !p.people.includes(me) && p.seen.includes(me) && p.claim?.u !== me);
  const waiting = all.filter((p) => !isDone(p) && p.people.includes(me));
  const finished = all.filter((p) => isDone(p) && (p.people.includes(me) || p.steps.length >= 2)).sort((a, b) => startOf(b) - startOf(a));

  return (
    <section className="page space-y-5 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">📞 Telephone</h2>
        <p className="text-sm text-ink-soft">
          Start a chain with a character. A friend sees only the name and draws it in {P.seconds} seconds; the next sees only the drawing and guesses who it is; the next draws that guess… Every turn is sealed: break the seal to see it and take the turn ({P.claimMinutes} minutes to play it). Everyone plays once per chain, whenever they come by. After {P.steps} steps or {P.days} days, the seals come off and the whole chain is revealed. Each step pays {P.perStep} {coin}, and if the
          last guess is the character it started with, {P.bonus.toLocaleString('en')} more for everyone in it.
        </p>
      </div>
      {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

      {chains === null ? (
        <p className="text-sm text-ink-soft">Loading the chains…</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Your turn{toPlay.length ? ` · ${toPlay.length}` : ''}</p>
            {toPlay.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {toPlay.map((p) => (
                  <Turn key={`${p.uid}-${p.day}-${p.kinds.length}`} p={p} me={me} people={byUid} onTaken={(q, t) => void replace(q, t)} onOpened={put} demo={demo} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">{people.length > 1 ? 'No chain waiting for you right now. Start one, and tell your friends!' : 'Add friends to pass chains around.'}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Your chain today</p>
            {mineToday ? (
              <p className="rounded-md bg-tile p-3 text-sm">
                You started with <b>{mineToday.steps[0]?.t}</b> ({franchiseOf(mineToday.set)}): {mineToday.kinds.length - 1} friend{mineToday.kinds.length === 2 ? '' : 's'} played it so far, each step sealed until the end. Come back tomorrow to start another.
              </p>
            ) : (
              <div className="mx-auto max-w-md">
                <Start busy={busy} onStart={(set, word) => void start(set, word)} />
              </div>
            )}
          </div>

          {(waiting.filter((p) => p !== mineToday).length > 0 || missed.length > 0) && (
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Sealed, waiting for the end</p>
              {waiting
                .filter((p) => p !== mineToday)
                .map((p) => (
                  <p key={`${p.uid}-${p.day}`} className="flex items-center gap-2 text-sm text-ink-soft">
                    <WaxSeal size={20} label="" />
                    {p.uid === me ? 'Your chain' : `${byUid.get(p.uid)?.name ?? p.name}'s chain`} ({franchiseOf(p.set)}): step {p.kinds.length} of {P.steps}, {hoursLeft(p)} h left.
                  </p>
                ))}
              {missed.map((p) => (
                <p key={`${p.uid}-${p.day}`} className="flex items-center gap-2 text-sm text-ink-soft">
                  <WaxSeal size={20} label="" />
                  {byUid.get(p.uid)?.name ?? p.name}&apos;s chain ({franchiseOf(p.set)}): your {P.claimMinutes} minutes ran out and the turn went on without you.
                </p>
              ))}
            </div>
          )}

          {finished.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Finished chains</p>
              {finished.map((p) => (
                <WholeChain key={`${p.uid}-${p.day}`} p={p} me={me} people={byUid} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
