import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CardBack, CardFace, RARITY_STYLE } from './CardView';
import { RARITIES, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from './cards';
import { PackArt } from './PackArt';
import type { Pack } from './packs';

/** Where the pack tears: this far down its height. */
const TEAR_AT = 18;
/** The share of the width a swipe has to cross to tear the pack. */
const TEAR_ENOUGH = 0.8;

type Phase = 'choose' | 'pack' | 'torn' | 'meteor' | 'reveal' | 'summary';

/** The three packs to choose from: the same pack, each tinted and tilted a little differently. */
const LINEUP = [
  { filter: 'hue-rotate(-22deg) saturate(1.1)', tilt: -7 },
  { filter: 'none', tilt: 0 },
  { filter: 'hue-rotate(22deg) saturate(1.1)', tilt: 7 },
];

/** A mythic's light is every colour at once. */
const RAINBOW = ['#ff4fd8', '#ffcd3c', '#3cff9e', '#3cc7ff', '#a855f7'];
const top = (r: Rarity) => r === 'legendary' || r === 'mythic';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Sparks flying out from a turned card, in its colour (more for rarer cards; a mythic's in every colour). */
function Burst({ color, count, rainbow }: { color: string; count: number; rainbow?: boolean }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 110 + Math.random() * 160;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 4 + Math.random() * 7, delay: Math.random() * 120, color: rainbow ? RAINBOW[i % RAINBOW.length] : color };
      }),
    [count, rainbow, color],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden>
      {sparks.map((p, i) => (
        <span
          key={i}
          className="pack-spark absolute rounded-full"
          style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 12px ${p.color}`, ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animationDelay: `${p.delay}ms` }}
        />
      ))}
    </div>
  );
}

/** Light rays turning behind a card (epic and up; a mythic's in rainbow). */
function Rays({ color, strong, rainbow }: { color: string; strong: boolean; rainbow?: boolean }) {
  return (
    <div
      className="pack-rays pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[220%] rounded-full"
      style={{
        background: rainbow
          ? `repeating-conic-gradient(from 0deg, #ff4fd877 0deg 6deg, transparent 6deg 12deg, #ffcd3c77 12deg 18deg, transparent 18deg 24deg, #3cc7ff77 24deg 30deg, transparent 30deg 36deg)`
          : `repeating-conic-gradient(from 0deg, ${color}${strong ? '66' : '33'} 0deg 8deg, transparent 8deg 24deg)`,
        maskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
        WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
      }}
      aria-hidden
    />
  );
}

/**
 * Opening a pack, in four beats: swipe across the pack to tear it (light pours out, in the colour
 * of the best card inside), a shooting star crosses the screen, the cards come one at a time from
 * the deck — rarer ones charge up before they turn, then burst — and the five are laid out together.
 */
export function PackOpening({ pack, cards, fresh, onClose, onAgain, canAgain }: { pack: Pack; cards: Card[]; fresh: Set<string>; onClose: () => void; onAgain: () => void; canAgain: boolean }) {
  const counts = useProgress((s) => s.cards);
  const best = cards.reduce<Rarity>((b, c) => (RARITIES.indexOf(c.rarity) > RARITIES.indexOf(b) ? c.rarity : b), 'common');
  const light = RARITY_LIGHT[best];
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState<number | null>(null);
  const [tear, setTear] = useState(0);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [charging, setCharging] = useState(false);
  const [flash, setFlash] = useState<{ color: string; key: number; rainbow?: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const card = cards[i];

  // ── Tearing ─────────────────────────────────────────────────────────
  const torn = () => {
    if (phase !== 'pack') return;
    sfx.tear();
    setTear(1);
    setPhase('torn');
    later(() => {
      if (reducedMotion()) return toReveal();
      setPhase('meteor');
      sfx.meteor(top(best));
      later(() => setFlash({ color: light, key: Date.now() }), best === 'mythic' ? 1700 : best === 'legendary' ? 1300 : 850);
      later(toReveal, best === 'mythic' ? 2100 : best === 'legendary' ? 1650 : 1150);
    }, 950);
  };
  /** A tap instead of a swipe: the pack tears by itself, quickly. */
  const autoTear = () => {
    let p = 0;
    const id = window.setInterval(() => {
      p += 0.12;
      setTear(Math.min(1, p));
      if (p >= 1) (window.clearInterval(id), torn());
    }, 30);
    timers.current.push(id);
  };
  const progressAt = (clientX: number) => {
    const r = packRef.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'pack') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || phase !== 'pack') return;
    if (Math.abs(e.clientX - d.x) > 8) d.moved = true;
    if (!d.moved) return;
    // The tear follows the finger, from whichever side it started.
    const p = Math.abs(progressAt(e.clientX) - progressAt(d.x));
    if (p > tear + 0.08) sfx.tick();
    setTear((t) => Math.max(t, p));
    if (p >= TEAR_ENOUGH) ((drag.current = null), torn());
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (phase !== 'pack') return;
    if (!d?.moved) autoTear();
  };

  // ── Revealing ───────────────────────────────────────────────────────
  const toReveal = () => {
    setPhase('reveal');
    setI(0);
    setFlipped(false);
    cue(cards[0]);
  };
  /** A card arriving on top of the deck: rarer ones hum. */
  const cue = (c: Card | undefined) => {
    if (!c) return;
    if (c.rarity === 'mythic') sfx.shimmer(12);
    else if (c.rarity === 'legendary') sfx.shimmer(8);
    else if (c.rarity === 'epic') sfx.shimmer(5);
    else if (c.rarity === 'rare') sfx.shimmer(3);
  };
  const turn = () => {
    const c = card;
    const go = () => {
      setCharging(false);
      setFlipped(true);
      if (reducedMotion()) return;
      setFlash({ color: RARITY_LIGHT[c.rarity], key: Date.now(), rainbow: c.rarity === 'mythic' });
      if (c.rarity === 'mythic') {
        sfx.victory();
        celebrateBig();
        later(() => (celebrateBig(), sfx.streak()), 900);
        shake(box.current, 18, 800);
      } else if (c.rarity === 'legendary') (sfx.victory(), celebrateBig(), shake(box.current, 14, 600));
      else if (c.rarity === 'epic') (sfx.streak(), celebrate(), shake(box.current, 6, 300));
      else if (c.rarity === 'rare') sfx.correct();
      else sfx.pop();
    };
    // A mythic takes a long breath, every colour running through it; a legendary a shorter one.
    if (c.rarity === 'mythic' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(16);
      later(go, 1500);
    } else if (c.rarity === 'legendary' && !reducedMotion()) {
      setCharging(true);
      sfx.shimmer(10);
      later(go, 900);
    } else if (c.rarity === 'epic' && !reducedMotion()) {
      setCharging(true);
      later(go, 380);
    } else go();
  };
  /** One of the three: the others drop away, the chosen one comes forward to be torn. */
  const choose = (k: number) => {
    if (phase !== 'choose' || chosen !== null) return;
    setChosen(k);
    sfx.select();
    sfx.shimmer(3);
    later(() => setPhase('pack'), 650);
  };

  const act = () => {
    if (phase === 'choose') return choose(1);
    if (phase === 'pack') return autoTear();
    if (phase !== 'reveal' || charging) return;
    if (!flipped) return turn();
    if (i + 1 >= cards.length) return setPhase('summary');
    sfx.whoosh();
    setI(i + 1);
    setFlipped(false);
    cue(cards[i + 1]);
  };
  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setCharging(false);
    setPhase('summary');
    if (cards.some((c) => top(c.rarity))) celebrateBig();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return phase === 'summary' ? onClose() : skip();
      if (phase === 'choose' && /^[1-3]$/.test(e.key)) return choose(Number(e.key) - 1);
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (phase === 'summary') onClose();
      else act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const style = card ? RARITY_STYLE[card.rarity] : null;
  const big = card && (card.rarity === 'epic' || top(card.rarity));
  return (
    <div ref={box} className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#07060c]/90 p-4 backdrop-blur-sm" style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${phase === 'pack' ? '#1e1b4b66' : `${light}22`}, transparent 60%)` }}>
      {phase !== 'summary' && (
        <button type="button" onClick={skip} className="absolute right-4 top-4 z-30 rounded-full border border-white/30 px-3 py-1 text-xs font-bold tracking-widest text-white/80 hover:bg-white/10">
          SKIP ⏭
        </button>
      )}
      {flash && <div key={flash.key} className="pack-flash pointer-events-none fixed inset-0 z-40" style={{ background: flash.rainbow ? `radial-gradient(circle, #fff, ${RAINBOW.join(', ')}, transparent 85%)` : `radial-gradient(circle, #fff, ${flash.color} 45%, transparent 80%)` }} />}

      {/* 0. Three packs: pick one. */}
      {phase === 'choose' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          <p className="font-display text-sm font-bold tracking-[0.35em] text-white/80">CHOOSE YOUR PACK</p>
          <div className="flex items-end justify-center gap-3 sm:gap-8">
            {LINEUP.map((l, k) => (
              <button
                key={k}
                type="button"
                onClick={() => choose(k)}
                aria-label={`Pack ${k + 1}`}
                className={`w-24 transition-all duration-500 sm:w-40 ${chosen === null ? 'hover:-translate-y-3 hover:scale-105' : chosen === k ? 'pack-pick' : 'pack-pass'}`}
                style={{ filter: l.filter, ['--tilt' as string]: `${l.tilt}deg`, animationDelay: chosen === null ? `${k * 0.4}s` : undefined }}
              >
                <div className={chosen === null ? 'pack-float' : ''} style={{ animationDelay: `${k * -1}s` }}>
                  <div style={{ transform: `rotate(${l.tilt}deg)` }}>
                    <PackArt pack={pack} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center font-display text-xs font-bold tracking-widest text-white/50">TAP ONE · OR PRESS 1, 2, 3</p>
        </div>
      )}

      {/* 1. The pack: swipe across its top to tear it. */}
      {(phase === 'pack' || phase === 'torn') && (
        <div className="flex flex-col items-center gap-6">
          <div
            ref={packRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (drag.current = null)}
            className={`relative w-56 cursor-grab touch-none select-none sm:w-64 ${phase === 'pack' ? 'pack-float' : ''}`}
            style={phase === 'pack' && tear > 0 ? { filter: `drop-shadow(0 0 ${8 + tear * 30}px ${light})` } : undefined}
            role="button"
            aria-label="Swipe across the pack, or tap it, to tear it open"
          >
            {/* The light inside, pouring out of the tear. */}
            {phase === 'torn' && (
              <div
                className="pack-beam pointer-events-none absolute left-1/2 w-[150%]"
                style={{ bottom: `${100 - TEAR_AT}%`, height: '70vh', background: `linear-gradient(to top, ${light}, ${light}55 30%, transparent 85%)`, clipPath: 'polygon(30% 100%, 70% 100%, 100% 0, 0 0)' }}
                aria-hidden
              />
            )}
            <div style={{ clipPath: `inset(${TEAR_AT}% 0 0 0)` }} className={phase === 'torn' ? 'pack-glow' : ''}>
              <PackArt pack={pack} />
            </div>
            <div className={`absolute inset-0 ${phase === 'torn' ? 'pack-flap' : ''}`} style={{ clipPath: `inset(0 0 ${100 - TEAR_AT}% 0)`, transform: phase === 'pack' ? `rotate(${-tear * 6}deg) translateY(${-tear * 6}px)` : undefined, transformOrigin: '100% 100%' }}>
              <PackArt pack={pack} />
            </div>
            {/* The tear, glowing along the cut. */}
            {phase === 'pack' && (
              <div className="pointer-events-none absolute left-0 h-[3px] rounded-full" style={{ top: `${TEAR_AT}%`, width: `${tear * 100}%`, background: '#fff', boxShadow: `0 0 10px #fff, 0 0 22px ${light}` }} />
            )}
            {phase === 'pack' && tear === 0 && (
              <div className="pack-hint pointer-events-none absolute left-[8%] font-display text-2xl text-white drop-shadow" style={{ top: `calc(${TEAR_AT}% - 1.2rem)` }}>
                ✂
              </div>
            )}
          </div>
          {phase === 'pack' && <p className="animate-pulse text-center font-display text-sm font-bold tracking-widest text-white/90">SWIPE ACROSS THE TOP TO TEAR · OR TAP</p>}
        </div>
      )}

      {/* 2. The shooting star, in the best card's colour. */}
      {phase === 'meteor' && (
        <div className="pointer-events-none fixed inset-0" aria-hidden>
          <div className="absolute left-0 top-[28%] w-full -rotate-[18deg]">
            <div
              className={`pack-meteor h-[6px] rounded-full ${best === 'mythic' ? 'pack-meteor-slower' : best === 'legendary' ? 'pack-meteor-slow' : ''}`}
              style={{
                width: '45vw',
                background: best === 'mythic' ? `linear-gradient(90deg, transparent, ${RAINBOW.join(', ')}, #fff)` : `linear-gradient(90deg, transparent, ${light}88 40%, #fff)`,
                boxShadow: best === 'mythic' ? '0 0 18px #ff4fd8, 0 0 40px #3cc7ff, 0 0 70px #ffcd3c' : `0 0 18px ${light}, 0 0 48px ${light}`,
              }}
            />
          </div>
          {top(best) && <div className={`pack-twinkle absolute inset-0 ${best === 'mythic' ? 'pack-twinkle-rainbow' : ''}`} />}
        </div>
      )}

      {/* 3. One card at a time from the deck. */}
      {phase === 'reveal' && card && style && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-5">
          <p className="font-display text-xs font-bold tracking-[0.35em] text-white/60">
            CARD {i + 1} OF {cards.length}
          </p>
          <button type="button" onClick={act} className="relative isolate w-52 outline-none sm:w-60" aria-label={flipped ? `${card.name} — next` : 'Turn the card'}>
            {/* The rest of the deck, underneath. */}
            {Array.from({ length: Math.min(3, cards.length - i - 1) }, (_, k) => (
              <div key={k} className="absolute inset-0 opacity-70" style={{ transform: `translate(${(k + 1) * 6}px, ${(k + 1) * 6}px)`, zIndex: -1 - k }}>
                <CardBack />
              </div>
            ))}
            {big && <Rays color={RARITY_LIGHT[card.rarity]} strong={top(card.rarity) && (charging || flipped)} rainbow={card.rarity === 'mythic'} />}
            <div key={i} className="pack-card-in [perspective:1100px]">
              <div className={`relative transition-transform ${flipped ? 'duration-700 [transform:rotateY(180deg)]' : 'duration-300'} [transform-style:preserve-3d] ${charging ? (card.rarity === 'mythic' ? 'pack-charge-strong pack-charge-prism' : card.rarity === 'legendary' ? 'pack-charge-strong' : 'pack-charge') : ''}`}>
                <div className="[backface-visibility:hidden]">
                  <CardBack rarity={card.rarity === 'common' ? undefined : card.rarity} />
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <CardFace card={card} count={counts[card.id]} isNew={fresh.has(card.id)} />
                </div>
              </div>
            </div>
            {flipped && !reducedMotion() && <Burst key={`b${i}`} color={RARITY_LIGHT[card.rarity]} rainbow={card.rarity === 'mythic'} count={card.rarity === 'mythic' ? 70 : card.rarity === 'legendary' ? 46 : card.rarity === 'epic' ? 32 : card.rarity === 'rare' ? 18 : 10} />}
            {flipped && fresh.has(card.id) && <span className="pack-stamp absolute -right-6 top-6 z-30 rounded-md border-4 border-coral px-2 py-0.5 font-display text-xl font-black tracking-widest text-coral">NEW!</span>}
          </button>
          <div className="min-h-14 text-center">
            {flipped ? (
              <div className="animate-pop">
                <p className={`font-display text-sm font-bold tracking-[0.35em] ${card.rarity === 'mythic' ? 'card-mythic-name text-base' : ''}`} style={card.rarity === 'mythic' ? undefined : { color: RARITY_LIGHT[card.rarity] }}>
                  {card.rarity === 'mythic' ? '✦ MYTHIC ✦' : card.rarity === 'legendary' ? '★ LEGENDARY ★' : RARITY_INFO[card.rarity].name.toUpperCase()}
                </p>
                {card.title && <p className="text-sm italic text-white/80">{card.title}</p>}
                <p className="font-serif text-2xl font-bold text-white">{shownName(card.name)}</p>
              </div>
            ) : (
              <p className="font-display text-sm font-bold tracking-widest text-white/70">{charging ? '…' : 'TAP TO TURN'}</p>
            )}
          </div>
          {/* The tray: the cards already turned. */}
          <div className="flex h-20 items-end justify-center gap-2">
            {cards.slice(0, flipped ? i + 1 : i).map((c, k) => (
              <div key={k} className="pack-tray-in w-12 sm:w-14" style={{ filter: `drop-shadow(0 0 6px ${RARITY_LIGHT[c.rarity]}88)` }}>
                <CardFace card={c} tilt={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. All five together. */}
      {phase === 'summary' && (
        <div className="w-full max-w-4xl space-y-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {cards.map((c, k) => (
              <div key={k} className="animate-card-deal" style={{ animationDelay: `${k * 90}ms`, ['--deal-rot' as string]: `${(k - 2) * 6}deg` }}>
                <CardFace card={c} count={counts[c.id]} isNew={fresh.has(c.id)} />
                <p className="mt-2 text-center font-display text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_STYLE[c.rarity].text }}>
                  {RARITY_INFO[c.rarity].name}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {canAgain && (
              <button type="button" onClick={onAgain} className="btn-accent rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Open another · <Coins n={pack.cost} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-paper rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
