import { useMemo, useRef, useState } from 'react';
import { Coins, DleCoin } from '../components/DleCoin';
import { CARD_BY_ID } from '../gacha/cards';
import { CardAvatar } from '../gacha/Perks';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CAPSULES } from './casino';
import { FrameRing } from './Frame';
import { FRAMES, FRAME_RARITIES, FRAME_RARITY_COLOR, FRAME_RARITY_NAME, type Frame } from './frames';

const SHELLS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee'];
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The player's icon (their avatar card), or a plain disc: what a frame is shown around. */
export function YourIcon({ className = 'size-16' }: { className?: string }) {
  const card = useProgress((s) => (s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined));
  return card ? <CardAvatar card={card} className={className} /> : <span className={`block rounded-full bg-gradient-to-br from-[#3b2d7a] to-[#1b1530] ${className}`} />;
}

/** A capsule: two halves of a shell, the top coloured, the bottom clear-white. */
function Capsule({ color, size, className = '', style }: { color: string; size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`capsule block rounded-full ${className.includes('absolute') ? '' : 'relative'} ${className}`} style={{ width: size, height: size, ['--shell' as string]: color, ...style }}>
      <span className="capsule-top" />
      <span className="capsule-bottom" />
    </span>
  );
}

type Stage = 'idle' | 'turning' | 'dropped' | 'cracking' | 'open';

export function Capsules() {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.capsuleTokens ?? 0);
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  const open = useProgress((s) => s.openCapsule);
  const [stage, setStage] = useState<Stage>('idle');
  const [turn, setTurn] = useState(0);
  const [got, setGot] = useState<{ frame: Frame; duplicate: boolean; coins: number; free: boolean } | null>(null);
  const [shell, setShell] = useState(SHELLS[0]);
  const machine = useRef<HTMLDivElement>(null);
  const can = stage !== 'turning' && stage !== 'cracking' && (tokens > 0 || coins >= CAPSULES.cost);
  // The capsules in the dome, where they lie.
  const pile = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: 12 + ((i * 37) % 70), y: 38 + ((i * 53) % 44), color: SHELLS[i % SHELLS.length], rot: (i * 47) % 360 })), []);

  const later = (fn: () => void, ms: number) => window.setTimeout(fn, reducedMotion() ? 0 : ms);
  const go = () => {
    if (!can) return;
    const r = open();
    if (!r) return;
    setGot(r);
    setShell(SHELLS[Math.floor(Math.random() * SHELLS.length)]);
    setStage('turning');
    setTurn((t) => t + 1);
    // The knob's clicks as it turns, then the capsule rolls out.
    for (let k = 0; k < 6; k++) later(() => sfx.wheelTick(0.7 + k * 0.05), k * 120);
    later(() => (sfx.pop(), setStage('dropped')), 900);
  };
  const crack = () => {
    if (stage !== 'dropped' || !got) return;
    setStage('cracking');
    sfx.suspense(0.7);
    later(() => {
      setStage('open');
      sfx.tear();
      const rank = FRAME_RARITIES.indexOf(got.frame.rarity);
      shake(machine.current, 4 + rank * 3, 300);
      if (rank >= 3) celebrateBig();
      else if (rank >= 2) celebrate();
      sfx.shimmer(2 + rank);
      if (got.duplicate) sfx.coins(4);
    }, 750);
  };

  const color = got ? FRAME_RARITY_COLOR[got.frame.rarity] : '#fff';
  return (
    <div ref={machine} className="mx-auto w-full max-w-sm">
      <div className="capsule-cabinet relative rounded-2xl p-3 text-white">
        {/* The dome, full of capsules (they jostle when the knob turns). */}
        <div className="capsule-dome relative mx-auto aspect-square w-[78%] overflow-hidden rounded-full">
          {pile.map((p, i) => (
            <Capsule key={`${i}:${turn}`} color={p.color} size={38} className={`absolute ${stage === 'turning' ? 'capsule-jostle' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, rotate: `${p.rot}deg`, animationDelay: `${(i % 5) * 40}ms` }} />
          ))}
          <span className="capsule-glass pointer-events-none absolute inset-0 rounded-full" aria-hidden />
        </div>
        {/* The body: the price, the knob, the chute. */}
        <div className="relative -mt-3 rounded-xl border-4 border-[#7f1d1d] bg-gradient-to-b from-[#dc2626] to-[#991b1b] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-md bg-[#1b1033] px-2 py-1 text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#fbbf24]/80">A capsule</div>
              <div className="flex items-center justify-center gap-1 font-display text-sm font-bold">
                {tokens > 0 ? (
                  <span className="text-[#a7f3d0]">FREE ×{tokens}</span>
                ) : (
                  <>
                    <DleCoin className="size-3.5" /> {CAPSULES.cost}
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={go} disabled={!can} aria-label="Turn the knob" title="Turn the knob" className="capsule-knob relative grid size-16 place-items-center rounded-full disabled:opacity-60">
              <span className="capsule-knob-bar block h-3 w-12 rounded-full" style={{ rotate: `${turn * 360}deg` }} />
            </button>
            <div className="capsule-chute relative grid size-14 place-items-center rounded-md">
              {(stage === 'dropped' || stage === 'cracking') && (
                <button type="button" onClick={crack} aria-label="Open the capsule" className={stage === 'cracking' ? 'capsule-crack' : 'capsule-drop'} style={{ ['--glow' as string]: color }}>
                  <Capsule color={shell} size={40} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 h-4 text-center text-xs font-bold tracking-widest text-white/85">
            {stage === 'idle' || stage === 'open' ? (can ? 'TURN THE KNOB' : tokens ? '' : 'NOT ENOUGH COINS') : stage === 'turning' ? '…' : stage === 'dropped' ? 'TAP THE CAPSULE TO OPEN IT' : 'IT’S OPENING…'}
          </p>
        </div>
      </div>

      {/* What was inside. */}
      {stage === 'open' && got && (
        <div className="capsule-reveal page relative mt-3 overflow-hidden rounded-md p-4 text-center" style={{ ['--glow' as string]: color }}>
          <div className="capsule-halves pointer-events-none absolute inset-x-0 top-6 flex justify-center" aria-hidden>
            <Capsule color={shell} size={56} className="capsule-open" />
          </div>
          <div className="relative mx-auto grid size-24 place-items-center">
            <FrameRing frame={got.frame}>
              <YourIcon className="size-20" />
            </FrameRing>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest" style={{ color }}>
            {FRAME_RARITY_NAME[got.frame.rarity]} frame {got.free && '· free capsule'}
          </p>
          <p className="font-display text-xl font-bold">{got.frame.name}</p>
          {got.duplicate ? (
            <p className="text-sm text-ink-soft">
              Already yours — <Coins n={got.coins} /> back.
            </p>
          ) : (
            <p className="animate-pop text-sm font-bold text-coral">NEW!</p>
          )}
          <div className="mt-3 flex justify-center gap-2">
            {worn !== got.frame.id && (
              <button type="button" onClick={() => (sfx.select(), setFrame(got.frame.id))} className="btn-ink rounded-md px-4 py-1.5 font-display font-bold">
                Wear it
              </button>
            )}
            <button type="button" onClick={go} disabled={!can} className="btn-paper rounded-md px-4 py-1.5 font-display font-bold disabled:opacity-50">
              Another
            </button>
          </div>
        </div>
      )}

      <FrameCollection />
    </div>
  );
}

/** Every frame: the ones won to wear (tap), the others still a mystery. */
function FrameCollection() {
  const owned = useProgress((s) => s.frames ?? []);
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  return (
    <section className="page mt-3 space-y-2 rounded-md p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display font-bold">Your icon frames</h3>
        <span className="text-xs text-ink-soft">
          {owned.length} / {FRAMES.length}
        </span>
      </div>
      <p className="text-xs text-ink-soft">Worn around your icon (the card you picked in the Album). Tap one to wear it.</p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-2">
        <button type="button" onClick={() => (sfx.select(), setFrame(null))} className={`flex flex-col items-center gap-1 rounded-md p-1 ${!worn ? 'bg-tile ring-2 ring-accent' : 'hover:bg-tile'}`}>
          <span className="grid size-12 place-items-center">
            <YourIcon className="size-10" />
          </span>
          <span className="text-[10px] font-semibold">None</span>
        </button>
        {FRAMES.map((f) => {
          const mine = owned.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              disabled={!mine}
              onClick={() => (sfx.select(), setFrame(f.id))}
              title={mine ? `${f.name} (${FRAME_RARITY_NAME[f.rarity]})` : `A ${FRAME_RARITY_NAME[f.rarity]} frame — still in the machine`}
              className={`flex flex-col items-center gap-1 rounded-md p-1 ${worn === f.id ? 'bg-tile ring-2 ring-accent' : mine ? 'hover:bg-tile' : 'cursor-default'}`}
            >
              <span className={`grid size-12 place-items-center ${mine ? '' : 'opacity-30 grayscale'}`}>
                <FrameRing frame={f}>
                  {mine ? <YourIcon className="size-10" /> : <span className="grid size-10 place-items-center rounded-full bg-tile font-display font-bold text-ink-faint">?</span>}
                </FrameRing>
              </span>
              <span className="truncate text-[10px] font-semibold" style={{ color: FRAME_RARITY_COLOR[f.rarity] }}>
                {mine ? f.name : '???'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
