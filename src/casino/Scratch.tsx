// Casino → Scratch: the day's scratch cards. Buy one, scratch its foil off (finger or mouse) or reveal it all at
// once; three of the same prize win it. Unlike the machines, they pay back more than they cost on average, so
// only a few a day (src/casino/scratchCards.ts, the numbers in src/data/tuning/casino.json).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DleCoin } from '../components/DleCoin';
import { todayKey } from '../lib/date';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { SCRATCH_BY_ID, SCRATCH_CARDS, topPrize, type ScratchCard, type ScratchTicket } from './scratchCards';

/** Each card's colours: the ticket, and its foil. */
const LOOKS: Record<string, { ticket: string; foil: [string, string, string]; ink: string }> = {
  clover: { ticket: 'linear-gradient(160deg, #14532d, #16a34a 55%, #4ade80)', foil: ['#9ca3af', '#f3f4f6', '#6b7280'], ink: '#dcfce7' },
  chest: { ticket: 'linear-gradient(160deg, #422006, #a16207 50%, #facc15)', foil: ['#b45309', '#fde68a', '#92400e'], ink: '#fef9c3' },
  royal: { ticket: 'linear-gradient(160deg, #2e1065, #7e22ce 50%, #f0abfc)', foil: ['#6b21a8', '#e9d5ff', '#4c1d95'], ink: '#f5d0fe' },
};
const lookOf = (id: string) => LOOKS[id] ?? LOOKS.clover;

const fmt = (n: number) => n.toLocaleString('en');
/** 15000 → 15K: short enough for a cell. */
const short = (n: number) => (n >= 10000 ? `${n / 1000}K` : fmt(n));

function useBoughtToday() {
  const scratch = useProgress((s) => s.scratch);
  return scratch?.day === todayKey() ? scratch.bought : {};
}

/** One card on the shelf: its look, price, top prize, how many are left today, and its odds. */
function Shelf({ c, onBuy, busy }: { c: ScratchCard; onBuy: () => void; busy: boolean }) {
  const coins = useProgress((s) => s.coins);
  const bought = useBoughtToday()[c.id] ?? 0;
  const left = Math.max(0, c.perDay - bought);
  const look = lookOf(c.id);
  const total = c.prizes.reduce((t, [, w]) => t + w, 0);
  const atLeastBack = c.prizes.filter(([p]) => p >= c.cost).reduce((t, [, w]) => t + w, 0) / total;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-rule bg-tile p-3">
      <div className="relative overflow-hidden rounded-md p-4 text-center shadow-lg" style={{ background: look.ticket, color: look.ink }}>
        <div className="scratch-shine pointer-events-none absolute inset-0" aria-hidden />
        <p className="text-4xl drop-shadow" aria-hidden>
          {c.icon}
        </p>
        <p className="mt-1 font-display text-lg font-black uppercase tracking-wider drop-shadow">{c.name}</p>
        <p className="text-xs font-semibold opacity-90">Win up to</p>
        <p className="font-display text-2xl font-black tabular-nums drop-shadow">{fmt(topPrize(c))}</p>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex gap-1" aria-label={`${left} of ${c.perDay} left today`}>
          {Array.from({ length: c.perDay }, (_, k) => (
            <span key={k} className={`size-2.5 rounded-full ${k < left ? 'bg-accent' : 'bg-rule-strong'}`} />
          ))}
        </span>
        <span className="text-ink-soft">{left ? `${left} left today` : 'Back tomorrow'}</span>
      </div>
      <p className="text-xs text-ink-soft">{Math.round(atLeastBack * 100)}% of these win their price back or more.</p>
      <button
        type="button"
        disabled={busy || !left || coins < c.cost}
        onClick={onBuy}
        className="btn-accent flex w-full items-center justify-center gap-1 rounded-md px-3 py-2 font-semibold tabular-nums disabled:opacity-50"
      >
        Buy · {fmt(c.cost)} <DleCoin className="size-4" />
      </button>
      <details className="text-xs text-ink-soft">
        <summary className="cursor-pointer font-semibold">Prizes and odds</summary>
        <ul className="mt-1 space-y-0.5 tabular-nums">
          {[...c.prizes].reverse().map(([p, w]) => (
            <li key={p} className="flex justify-between">
              <span>{p ? fmt(p) : 'Nothing'}</span>
              <span>{(w / total) * 100 >= 1 ? `${Math.round((w / total) * 100)}%` : `1 in ${Math.round(total / w)}`}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** The foil: painted on a canvas over the grid, scratched away under the pointer. */
function Foil({ look, onScratch, onDone, gone }: { look: (typeof LOOKS)[string]; onScratch: () => void; onDone: () => void; gone: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moves = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const lastSound = useRef(0);
  const done = useRef(false);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, look.foil[0]);
    grad.addColorStop(0.45, look.foil[1]);
    grad.addColorStop(0.55, look.foil[1]);
    grad.addColorStop(1, look.foil[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Fine brushed lines and a pattern of stars, like a real foil.
    g.globalAlpha = 0.12;
    g.strokeStyle = '#fff';
    for (let y = 0; y < h; y += 3) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + 6);
      g.stroke();
    }
    g.globalAlpha = 0.28;
    g.fillStyle = '#ffffff';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    for (let y = 18, row = 0; y < h + 10; y += 30, row++) for (let x = row % 2 ? 22 : 52; x < w + 20; x += 60) g.fillText('★', x, y);
    g.globalAlpha = 0.85;
    g.font = '900 15px sans-serif';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillText('SCRATCH HERE', w / 2, h / 2 + 5);
    g.globalAlpha = 1;
  }, [look]);

  /** How much of the foil is gone, sampled. */
  const cleared = () => {
    const c = ref.current!;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 37) {
      n++;
      if (data[i] < 40) clear++;
    }
    return clear / n;
  };

  const scratchAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done.current) return;
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const g = c.getContext('2d')!;
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 34;
    g.beginPath();
    const from = last.current ?? { x, y };
    g.moveTo(from.x, from.y);
    g.lineTo(x + 0.01, y);
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    last.current = { x, y };
    const now = performance.now();
    if (now - lastSound.current > 70) {
      lastSound.current = now;
      sfx.tick();
    }
    onScratch();
    if (++moves.current % 10 === 0 && cleared() > 0.62) {
      done.current = true;
      onDone();
    }
  };

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`absolute inset-0 size-full cursor-crosshair touch-none rounded-md transition-opacity duration-500 ${gone ? 'pointer-events-none opacity-0' : ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = null;
        scratchAt(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === 'touch') scratchAt(e);
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

/** The card being scratched: its grid under the foil; once revealed, the win (or not) and the coins paid. */
function Board({ ticket, onNext }: { ticket: ScratchTicket; onNext: () => void }) {
  const claim = useProgress((s) => s.claimScratch);
  const card = SCRATCH_BY_ID.get(ticket.card)!;
  const look = lookOf(card.id);
  const [revealed, setRevealed] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    const got = claim();
    setWon(got ?? ticket.prize);
    window.setTimeout(() => {
      if (!ticket.prize) sfx.wahWah();
      else if (ticket.prize >= card.cost * 5) (sfx.victory(), sfx.coins(14), celebrateBig());
      else if (ticket.prize >= card.cost) (sfx.coins(8), celebrate());
      else sfx.coins(3);
    }, 350);
  };
  // Leaving mid-scratch keeps the card: it is still waiting next time (the save holds it).
  const big = won !== null && won >= card.cost * 5;
  const counts = new Map<number, number>();
  for (const v of ticket.cells) counts.set(v, (counts.get(v) ?? 0) + 1);
  const nearMiss = !ticket.prize || ticket.prize < card.cost ? [...counts.entries()].filter(([v, n]) => n === 2 && v > Math.max(ticket.prize, card.cost)).map(([v]) => v).sort((a, b) => b - a)[0] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
      <div className={`relative w-full overflow-hidden rounded-xl p-4 shadow-2xl ${big ? 'scratch-big' : ''}`} style={{ background: look.ticket, color: look.ink }}>
        <div className="scratch-shine pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-black uppercase tracking-wider drop-shadow">
            <span aria-hidden>{card.icon} </span>
            {card.name}
          </p>
          <p className="text-xs font-semibold opacity-90">Match 3 to win</p>
        </div>
        <div className="relative rounded-md bg-black/25 p-1.5">
          <div className="grid grid-cols-3 gap-1.5" aria-label={revealed ? `The nine prizes: ${ticket.cells.map(fmt).join(', ')}` : 'Covered by the foil'}>
            {ticket.cells.map((v, k) => {
              const hit = revealed && ticket.prize > 0 && v === ticket.prize;
              return (
                <div
                  key={k}
                  className={`grid aspect-square place-items-center rounded-md bg-paper text-ink shadow-inner transition ${hit ? 'scratch-hit' : revealed && ticket.prize > 0 ? 'opacity-50' : ''}`}
                >
                  <span className="flex flex-col items-center leading-none">
                    <DleCoin className="mb-1 size-5" />
                    <span className="font-display text-lg font-black tabular-nums sm:text-xl">{short(v)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <Foil look={look} gone={revealed} onScratch={() => setStarted(true)} onDone={reveal} />
        </div>
        <p className="relative mt-3 text-center text-xs font-semibold opacity-90">Find three of the same amount and it&apos;s yours.</p>
      </div>

      <div className="min-h-20 w-full text-center" aria-live="polite">
        {!revealed ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">{started ? 'Keep going…' : 'Scratch the foil with your finger or mouse.'}</p>
            <button type="button" onClick={reveal} className="btn-paper rounded-md px-4 py-1.5 text-sm font-semibold">
              Reveal all
            </button>
          </div>
        ) : (
          <div className="animate-pop space-y-2">
            {won ? (
              <p className={`font-display font-black ${big ? 'text-3xl text-ochre' : 'text-2xl'}`}>
                {big ? '🎉 ' : ''}You won {fmt(won)} <DleCoin className="inline size-6 align-[-4px]" />
                {won < card.cost && <span className="block text-sm font-semibold text-ink-soft">A little back, at least.</span>}
              </p>
            ) : (
              <p className="font-display text-2xl font-black">No match this time</p>
            )}
            {nearMiss && <p className="text-sm text-ink-soft">So close: two {fmt(nearMiss)}s!</p>}
            <button type="button" onClick={onNext} className="btn-accent rounded-md px-5 py-2 font-semibold">
              Back to the cards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Scratch() {
  const pending = useProgress((s) => s.scratch?.pending ?? null);
  const best = useProgress((s) => s.scratch?.best ?? 0);
  const buy = useProgress((s) => s.buyScratch);
  // The ticket on the board: the one being scratched (kept after it's cashed in, until "Back to the cards").
  const [shown, setShown] = useState<ScratchTicket | null>(pending);
  useEffect(() => {
    if (pending && !shown) setShown(pending);
  }, [pending, shown]);

  if (shown) return <Board key={shown.cells.join(',') + shown.card} ticket={shown} onNext={() => (sfx.select(), setShown(null))} />;
  return (
    <div className="space-y-4">
      <section className="page space-y-1 rounded-md p-4">
        <h3 className="font-display text-lg font-bold">🎫 Scratch cards</h3>
        <p className="text-sm text-ink-soft">
          The one game here that pays back more than it costs, on average: worth it if you have the DleCoins. Only a few a day, though. Most cards win something, some win nothing, and now and then
          one wins big.
          {best > 0 && (
            <>
              {' '}
              Your best win: <b className="text-ink tabular-nums">{fmt(best)}</b>.
            </>
          )}
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {SCRATCH_CARDS.map((c) => (
          <Shelf
            key={c.id}
            c={c}
            busy={!!pending}
            onBuy={() => {
              const t = buy(c.id);
              if (t) (sfx.crinkle(), setShown(t));
            }}
          />
        ))}
      </div>
    </div>
  );
}
