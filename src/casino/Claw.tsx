// Casino → Claw: the claw machine, paid in casino tokens. One button: press to start, press to stop the claw
// going across, press to stop it going back; it drops, grabs and carries what it holds to the chute
// (src/casino/clawMachine.ts for the rules, src/casino/plushies.ts for the plushies).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CARD_BY_ID, RARITY_INFO, RARITY_LIGHT } from '../gacha/cards';
import { todayKey } from '../lib/date';
import { celebrate, celebrateBig } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { boxFor, capsuleCard, CHUTE, CLAW, grab, prizeLook, restock, type ClawItem, type GrabOutcome } from './clawMachine';
import { PLUSH_BY_ID, PLUSH_RARITY, PLUSHIES } from './plushies';

/** The box seen from the front, a little from above (all in cqw: the box is 100 wide, 75 high). */
const floorY = (z: number) => 75 * (0.36 + 0.56 * z);
const screenX = (x: number, z: number) => 50 + (x - 0.5) * 100 * (0.8 + 0.2 * z);
const depth = (z: number) => 0.78 + 0.3 * z;
const prizeSize = (prize: string, z: number) => 12.5 * depth(z) * prizeLook(prize).size;
const CLAW_W = 12;
/** Where the claw waits: over the chute. */
const HOME = { x: CHUTE.x, z: CHUTE.z };

/** A prize as it looks in the box: a plush, or a bag, roll, pack, capsule, ticket or gift. */
export function PrizeArt({ prize, className = '', style }: { prize: string; className?: string; style?: React.CSSProperties }) {
  const look = prizeLook(prize);
  // Placed by its parent (absolute), or in the flow.
  const pos = className.split(' ').includes('absolute') ? '' : 'relative';
  if (look.kind === 'plush') {
    const p = PLUSH_BY_ID.get(prize.slice('plush:'.length));
    const [light, dark] = p?.colors ?? ['#eee', '#999'];
    return (
      <div className={`claw-plush ${pos} ${p?.rarity === 'golden' ? 'claw-plush-golden' : ''} ${className}`} style={style} title={look.name}>
        <span className="absolute left-[8%] top-[-4%] size-[30%] rounded-full" style={{ background: dark }} />
        <span className="absolute right-[8%] top-[-4%] size-[30%] rounded-full" style={{ background: dark }} />
        <span
          className="absolute inset-0 grid place-items-center rounded-[46%] border-2 border-dashed border-white/50"
          style={{ background: `radial-gradient(circle at 35% 30%, ${light}, ${dark})`, boxShadow: 'inset 0 -6px 10px rgba(0,0,0,0.18), 0 4px 6px rgba(0,0,0,0.25)' }}
        >
          <span className="text-[0.55em] leading-none drop-shadow-sm">{p?.face ?? '🧸'}</span>
        </span>
      </div>
    );
  }
  const bg: Record<string, string> = {
    coins: 'radial-gradient(circle at 35% 30%, #fef3c7, #d97706)',
    tokens: 'radial-gradient(circle at 35% 30%, #fecdd3, #e11d48)',
    pack: 'linear-gradient(160deg, #c4b5fd, #6d28d9)',
    capsule: 'linear-gradient(180deg, #f43f5e 0 50%, #f8fafc 50% 100%)',
    scratch: 'linear-gradient(160deg, #99f6e4, #0d9488)',
    cosmetic: 'linear-gradient(160deg, #fbcfe8, #db2777)',
  };
  const shape = look.kind === 'capsule' || look.kind === 'coins' ? 'rounded-full' : look.kind === 'pack' || look.kind === 'scratch' ? 'rounded-md' : 'rounded-xl';
  return (
    <div className={`${pos} ${className}`} style={style} title={look.name}>
      <span
        className={`absolute inset-0 grid place-items-center border-2 border-white/40 ${shape}`}
        style={{ background: bg[look.kind], boxShadow: 'inset 0 -6px 10px rgba(0,0,0,0.2), 0 4px 6px rgba(0,0,0,0.25)' }}
      >
        <span className="text-[0.5em] leading-none drop-shadow">{look.icon}</span>
      </span>
    </div>
  );
}

/** The claw: a hub and two arms, open (1) to shut (0). */
function ClawHead({ open }: { open: number }) {
  const a = 8 + open * 26;
  return (
    <svg viewBox="0 0 60 54" className="block w-full overflow-visible drop-shadow-md" aria-hidden>
      <defs>
        <linearGradient id="claw-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#9ca3af" />
          <stop offset="0.5" stopColor="#f3f4f6" />
          <stop offset="1" stopColor="#6b7280" />
        </linearGradient>
      </defs>
      <rect x="20" y="0" width="20" height="14" rx="4" fill="url(#claw-metal)" stroke="#4b5563" />
      <circle cx="30" cy="16" r="5" fill="#f59e0b" stroke="#92400e" />
      <g transform={`rotate(${a} 26 16)`}>
        <path d="M26 16 L12 34 Q8 44 16 50" fill="none" stroke="url(#claw-metal)" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${-a} 34 16)`}>
        <path d="M34 16 L48 34 Q52 44 44 50" fill="none" stroke="url(#claw-metal)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

type Phase = 'idle' | 'across' | 'back' | 'busy';
interface View {
  cx: number;
  cz: number;
  /** 0: up by the rail, 1: down in the box. */
  h: number;
  open: number;
  /** The prize in the claw, if any. */
  held: string | null;
  /** A prize falling (out of the claw), from where to where. */
  fall: { uid: string; prize: string; fromX: number; fromY: number; toX: number; toY: number; p: number; chute: boolean } | null;
}

/** Plays a step of the animation: `frame(p)` from 0 to 1 over `ms`. */
function tween(ms: number, frame: (p: number) => void, alive: () => boolean): Promise<void> {
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (!alive()) return done();
      const p = Math.min(1, (now - t0) / ms);
      frame(p);
      if (p < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

interface Result {
  outcome: GrabOutcome;
  prize?: string;
  cardId?: string;
  duplicate?: number;
}

export function Claw() {
  const claw = useProgress((s) => s.claw);
  const chips = useProgress((s) => s.chips ?? 0);
  const clawDay = useProgress((s) => s.clawDay);
  const buyClaw = useProgress((s) => s.buyClaw);
  const startClaw = useProgress((s) => s.startClaw);
  const endClaw = useProgress((s) => s.endClaw);
  const today = todayKey();

  // A new box (and the day's tries) the first time the machine is opened each day.
  useEffect(() => {
    if (claw?.day !== today) clawDay(today, boxFor(today, useProgress.getState().cosmetics ?? []));
  }, [claw?.day, today, clawDay]);

  const box = useMemo(() => (claw?.day === today ? claw.box : []), [claw, today]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [view, setView] = useState<View>({ cx: HOME.x, cz: HOME.z, h: 0, open: 0.4, held: null, fall: null });
  const [result, setResult] = useState<Result | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);
  const isAlive = () => alive.current;
  /** The prize being carried or falling, hidden from its spot in the box. */
  const [lifted, setLifted] = useState<string | null>(null);

  const credits = claw?.credits ?? 0;
  const triesLeft = Math.max(0, CLAW.dailyTries - (claw?.tries ?? 0) - credits);
  const meter = claw?.meter ?? 0;
  const sure = meter >= CLAW.meter;

  // The claw going across, then back, on its own until the button is pressed.
  useEffect(() => {
    if (phase !== 'across' && phase !== 'back') return;
    let raf = 0;
    const t0 = performance.now();
    const v0 = viewRef.current;
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      if (phase === 'across') {
        // From the chute to the far side and back, again and again.
        const span = 0.95 - HOME.x;
        const d = (t * 0.42) % (2 * span);
        const cx = HOME.x + (d < span ? d : 2 * span - d);
        setView((v) => ({ ...v, cx }));
      } else {
        const span = v0.cz - 0.08;
        const d = (t * 0.38) % (2 * span);
        const cz = v0.cz - (d < span ? d : 2 * span - d);
        setView((v) => ({ ...v, cz }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /** The drop, the grab and the carry, once the claw is stopped. */
  const play = async () => {
    setPhase('busy');
    const { cx, cz } = viewRef.current;
    const set = (p: Partial<View>) => setView((v) => ({ ...v, ...p }));
    sfx.whoosh();
    await tween(500, (p) => set({ open: lerp(0.4, 1, p) }), isAlive);
    await tween(900, (p) => set({ h: ease(p) }), isAlive);
    const state = useProgress.getState();
    const current = state.claw?.box ?? [];
    const outcome = grab(current, cx, cz, (state.claw?.meter ?? 0) >= CLAW.meter);
    sfx.click();
    await tween(380, (p) => set({ open: lerp(1, 0, p) }), isAlive);
    const item = outcome.kind === 'miss' ? undefined : current.find((i) => i.uid === outcome.uid);
    if (item) {
      setLifted(item.uid);
      set({ held: item.prize });
    }
    // Up: a prize that doesn't hold falls back partway.
    if (outcome.kind === 'lost' && item) {
      await tween(350, (p) => set({ h: 1 - 0.35 * ease(p) }), isAlive);
      sfx.near();
      set({ held: null, open: 0.3 });
      await fallTo(item, outcome.x, outcome.z, false);
      await tween(600, (p) => set({ h: 0.65 * (1 - ease(p)) }), isAlive);
    } else {
      await tween(900, (p) => set({ h: 1 - ease(p) }), isAlive);
    }
    // Across to the chute (a prize that slips falls on the way).
    if (outcome.kind !== 'lost') {
      const stopAt = outcome.kind === 'slip' || (outcome.kind === 'win' && outcome.lucky) ? (outcome.at ?? 1) : 1;
      await tween(1300 * stopAt, (p) => set({ cx: lerp(cx, HOME.x, stopAt * ease(p)), cz: lerp(cz, HOME.z, stopAt * ease(p)) }), isAlive);
      if (item && (outcome.kind === 'slip' || (outcome.kind === 'win' && outcome.lucky))) {
        sfx.near();
        set({ held: null, open: 0.5 });
        if (outcome.kind === 'slip') await fallTo(item, outcome.x, outcome.z, false);
        else await fallTo(item, CHUTE.x, CHUTE.z, true);
        const here = viewRef.current;
        await tween(1300 * (1 - stopAt), (p) => set({ cx: lerp(here.cx, HOME.x, ease(p)), cz: lerp(here.cz, HOME.z, ease(p)) }), isAlive);
      } else if (item && outcome.kind === 'win') {
        await tween(300, (p) => set({ open: lerp(0, 0.8, p) }), isAlive);
        set({ held: null });
        await fallTo(item, CHUTE.x, CHUTE.z, true);
      }
    } else {
      await tween(1100, (p) => set({ cx: lerp(cx, HOME.x, ease(p)), cz: lerp(cz, HOME.z, ease(p)) }), isAlive);
    }
    if (!alive.current) return;
    finish(outcome, current);
  };

  /** A prize dropping from the claw to a spot (or into the chute). */
  const fallTo = async (item: ClawItem, x: number, z: number, chute: boolean) => {
    const v = viewRef.current;
    const fromX = screenX(v.cx, v.cz);
    const fromY = clawTop(v) + CLAW_W * depth(v.cz) * 0.55;
    const toX = screenX(x, z);
    const toY = chute ? 75 : floorY(z) - prizeSize(item.prize, z);
    setView((w) => ({ ...w, fall: { uid: item.uid, prize: item.prize, fromX, fromY, toX, toY, p: 0, chute } }));
    await tween(chute ? 520 : 420, (p) => setView((w) => (w.fall ? { ...w, fall: { ...w.fall, p: p * p } } : w)), isAlive);
    sfx.pop();
  };

  const finish = (outcome: GrabOutcome, current: ClawItem[]) => {
    const cos = useProgress.getState().cosmetics ?? [];
    let next = current;
    let prize: string | undefined;
    let cardId: string | undefined;
    if (outcome.kind === 'lost' || outcome.kind === 'slip') next = current.map((i) => (i.uid === outcome.uid ? { ...i, x: outcome.x, z: outcome.z } : i));
    if (outcome.kind === 'win') {
      prize = outcome.prize;
      next = restock(
        current.filter((i) => i.uid !== outcome.uid),
        cos,
      );
      if (prize === 'capsule') cardId = capsuleCard().id;
    }
    const { duplicate } = endClaw(next, prize ?? null, cardId);
    setLifted(null);
    setView((v) => ({ ...v, fall: null, held: null, open: 0.4, h: 0, cx: HOME.x, cz: HOME.z }));
    setResult({ outcome, prize, cardId, duplicate });
    setPhase('idle');
    if (prize) {
      const rare = prize === 'capsule' || prize.startsWith('cosmetic:') || /plush:(dlecoin|cardback|yume|omni-star)/.test(prize) || prize === 'coins:2000';
      if (rare) (sfx.victory(), celebrateBig());
      else (sfx.coins(6), celebrate());
    } else if (outcome.kind === 'miss') sfx.wrong();
  };

  const press = () => {
    if (phase === 'idle') {
      if (!startClaw()) return sfx.wrong();
      sfx.select();
      setResult(null);
      setView((v) => ({ ...v, cx: HOME.x, cz: HOME.z, h: 0, open: 0.4 }));
      setPhase('across');
    } else if (phase === 'across') {
      sfx.click();
      setPhase('back');
    } else if (phase === 'back') {
      sfx.click();
      void play();
    }
  };

  const clawTop = (v: View) => lerp(2, floorY(v.cz) - CLAW_W * depth(v.cz) * 0.9 - 1.5, v.h);
  const cw = CLAW_W * depth(view.cz);
  const top = clawTop(view);
  const X = screenX(view.cx, view.cz);
  const sorted = [...box].sort((a, b) => a.z - b.z);
  const label = phase === 'idle' ? (credits ? 'Start' : 'Insert tokens') : phase === 'across' ? 'Stop ➜' : phase === 'back' ? 'Stop ⬆' : '…';
  const plushOwned = PLUSHIES.filter((p) => claw?.plush?.[p.id]).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* The machine. */}
      <div className="claw-cabinet mx-auto w-full max-w-xl rounded-2xl p-3 shadow-2xl">
        <div className="claw-marquee mb-2 rounded-lg py-1.5 text-center font-display text-xl font-black uppercase tracking-[0.3em] text-white">🕹️ Claw</div>
        <div className="relative overflow-hidden rounded-lg border-4 border-white/20 [container-type:inline-size]" style={{ aspectRatio: '4 / 3' }}>
          <div className="claw-glass absolute inset-0" aria-hidden />
          {/* The rail the claw hangs from. */}
          <div className="absolute inset-x-[3cqw] top-[1cqw] h-[1.2cqw] rounded-full bg-gradient-to-b from-zinc-300 to-zinc-500 shadow" aria-hidden />
          {/* The chute. */}
          <div className="claw-chute absolute bottom-0 left-0 grid place-items-end rounded-tr-lg" style={{ width: '21cqw', height: '19cqw' }} aria-hidden>
            <span className="w-full pb-[1cqw] text-center font-display text-[2.4cqw] font-black uppercase tracking-widest text-amber-200">Prize ⬇</span>
          </div>
          {/* The aim: where the claw would drop. */}
          {(phase === 'across' || phase === 'back') && (
            <div className="absolute rounded-[50%] bg-black/35 blur-[1px]" style={{ left: `${X - 4 * depth(view.cz)}cqw`, top: `${floorY(view.cz) - 1.4}cqw`, width: `${8 * depth(view.cz)}cqw`, height: `${2.8 * depth(view.cz)}cqw` }} aria-hidden />
          )}
          {/* The prizes, back ones first. */}
          {sorted.map((it) =>
            it.uid === lifted ? null : (
              <PrizeArt
                key={it.uid}
                prize={it.prize}
                className="absolute transition-[left,top] duration-300"
                style={{ left: `${screenX(it.x, it.z) - prizeSize(it.prize, it.z) / 2}cqw`, top: `${floorY(it.z) - prizeSize(it.prize, it.z)}cqw`, width: `${prizeSize(it.prize, it.z)}cqw`, height: `${prizeSize(it.prize, it.z)}cqw`, fontSize: `${prizeSize(it.prize, it.z)}cqw` }}
              />
            ),
          )}
          {/* A prize falling. */}
          {view.fall && (
            <PrizeArt
              prize={view.fall.prize}
              className="absolute"
              style={(() => {
                const f = view.fall!;
                const S = prizeSize(f.prize, 0.6);
                return {
                  left: `${lerp(f.fromX, f.toX, f.p) - S / 2}cqw`,
                  top: `${lerp(f.fromY, f.toY, f.p)}cqw`,
                  width: `${S}cqw`,
                  height: `${S}cqw`,
                  fontSize: `${S}cqw`,
                  opacity: f.chute ? 1 - f.p * 0.9 : 1,
                };
              })()}
            />
          )}
          {/* The cable and the claw. */}
          <div className="absolute w-[0.5cqw] -translate-x-1/2 bg-zinc-400" style={{ left: `${X}cqw`, top: '1.5cqw', height: `${Math.max(0, top - 1)}cqw` }} aria-hidden />
          {view.held && (
            <PrizeArt
              prize={view.held}
              className="absolute"
              style={{ left: `${X - prizeSize(view.held, view.cz) / 2}cqw`, top: `${top + cw * 0.45}cqw`, width: `${prizeSize(view.held, view.cz)}cqw`, height: `${prizeSize(view.held, view.cz)}cqw`, fontSize: `${prizeSize(view.held, view.cz)}cqw` }}
            />
          )}
          <div className="absolute -translate-x-1/2" style={{ left: `${X}cqw`, top: `${top}cqw`, width: `${cw}cqw` }}>
            <ClawHead open={view.open} />
          </div>
        </div>

        {/* The controls. */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-black/30 p-3">
          <div className="text-sm text-white/90">
            <p className="font-display text-lg font-black tabular-nums">
              {credits} {credits === 1 ? 'try' : 'tries'}
            </p>
            <p className="text-xs text-white/70">{triesLeft} more today</p>
          </div>
          <button
            type="button"
            onClick={press}
            disabled={phase === 'busy' || (phase === 'idle' && !credits)}
            className={`claw-button grid size-20 shrink-0 place-items-center rounded-full font-display text-sm font-black uppercase text-white disabled:opacity-50 ${phase === 'across' || phase === 'back' ? 'claw-button-live' : ''}`}
          >
            {label}
          </button>
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => (buyClaw(false) ? sfx.coins(2) : sfx.wrong())} disabled={phase !== 'idle' || chips < CLAW.cost || triesLeft < 1} className="rounded-md border border-coral/60 bg-coral/20 px-2.5 py-1 text-xs font-bold text-white tabular-nums disabled:opacity-40">
              1 try · {CLAW.cost} 🎟️
            </button>
            <button
              type="button"
              onClick={() => (buyClaw(true) ? sfx.coins(4) : sfx.wrong())}
              disabled={phase !== 'idle' || chips < CLAW.bundle.cost || triesLeft < CLAW.bundle.tries}
              className="rounded-md border border-coral/60 bg-coral/30 px-2.5 py-1 text-xs font-bold text-white tabular-nums disabled:opacity-40"
            >
              {CLAW.bundle.tries} tries · {CLAW.bundle.cost} 🎟️
            </button>
          </div>
        </div>
      </div>

      {/* The side: what happened, the meter, the box's prizes, the plushies. */}
      <aside className="space-y-3">
        <section className="page min-h-24 rounded-md p-4 text-center" aria-live="polite">
          {result ? <ResultText r={result} /> : <p className="text-sm text-ink-soft">{phase === 'idle' ? (credits ? 'Press Start, then stop the claw twice: across, then back.' : 'Buy a try with casino tokens 🎟️ (the machines give them as you play).') : phase === 'across' ? 'Stop it above a prize…' : phase === 'back' ? '…now how far back?' : 'Here it goes…'}</p>}
        </section>
        <section className="page space-y-1.5 rounded-md p-4">
          <p className="flex items-center justify-between text-sm font-semibold">
            <span>Lucky grip</span>
            <span className="tabular-nums text-ink-soft">
              {meter}/{CLAW.meter}
            </span>
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-tile">
            <div className={`h-full rounded-full transition-all ${sure ? 'claw-meter-full bg-ochre' : 'bg-accent'}`} style={{ width: `${(meter / CLAW.meter) * 100}%` }} />
          </div>
          <p className="text-xs text-ink-soft">{sure ? 'Full: the next grab holds tight and can’t slip.' : 'Every try that wins nothing fills it; full, the next grab can’t slip.'}</p>
        </section>
        <section className="page space-y-2 rounded-md p-4">
          <p className="text-sm font-semibold">In the box</p>
          <ul className="space-y-1 text-xs">
            {[...box]
              .sort((a, b) => prizeRank(b.prize) - prizeRank(a.prize))
              .map((it) => (
                <li key={it.uid} className="flex items-center gap-2">
                  <PrizeArt prize={it.prize} className="size-6 shrink-0" style={{ fontSize: '1.5rem' }} />
                  <span className="truncate">{prizeLook(it.prize).name}</span>
                </li>
              ))}
          </ul>
          <p className="text-xs text-ink-faint">A new mix every day; filled up again when it runs low.</p>
        </section>
        <Link to="/account" className="page flex items-center justify-between rounded-md p-4 text-sm font-semibold hover:bg-tile">
          <span>🧸 Your plushies</span>
          <span className="tabular-nums text-ink-soft">
            {plushOwned}/{PLUSHIES.length} →
          </span>
        </Link>
      </aside>
    </div>
  );
}

/** Rarer prizes first in the list. */
function prizeRank(prize: string) {
  if (prize.startsWith('plush:')) return PLUSH_RARITY[PLUSH_BY_ID.get(prize.slice(6))?.rarity ?? 'common'].rank * 2 + 1;
  if (prize.startsWith('cosmetic:')) return 7;
  if (prize === 'capsule') return 6;
  if (prize === 'coins:2000') return 5.5;
  return 2;
}

function ResultText({ r }: { r: Result }) {
  const o = r.outcome;
  if (o.kind === 'win' && r.prize) {
    const look = prizeLook(r.prize);
    const card = r.cardId ? CARD_BY_ID.get(r.cardId) : undefined;
    return (
      <div className="animate-pop space-y-1.5">
        <PrizeArt prize={r.prize} className="mx-auto size-14" style={{ fontSize: '3.5rem' }} />
        <p className="font-display text-lg font-black">{o.lucky ? 'It slipped… right into the chute!' : 'Got it!'}</p>
        <p className="font-semibold">{look.name}</p>
        {card && (
          <p className="text-sm">
            Inside: <b style={{ color: RARITY_LIGHT[card.rarity] }}>{shownName(card.name, card.set)}</b> ({RARITY_INFO[card.rarity].name})
          </p>
        )}
        {r.prize === 'pack' && (
          <Link to="/shop" className="text-sm font-semibold text-accent">
            Open it in the Shop →
          </Link>
        )}
        {r.prize === 'scratch' && <p className="text-sm text-ink-soft">It waits in the Scratch tab.</p>}
        {!!r.duplicate && <p className="text-sm text-ink-soft">You had it already: +{r.duplicate} DleCoins.</p>}
      </div>
    );
  }
  const text = o.kind === 'lost' ? ['So close!', 'It fell as the claw lifted: a little nearer the chute now.'] : o.kind === 'slip' ? ['It slipped!', 'It landed nearer the chute: easier next time.'] : ['Nothing under the claw', 'Aim for the middle of a prize.'];
  return (
    <div className="animate-pop space-y-1">
      <p className="font-display text-lg font-black">{text[0]}</p>
      <p className="text-sm text-ink-soft">{text[1]}</p>
    </div>
  );
}
