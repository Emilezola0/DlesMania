/**
 * Tiny looping previews for the rules: pure CSS keyframes (see "Rules demos" in index.css),
 * no images or timers. They freeze on their final frame when the player prefers reduced motion.
 */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative h-36 overflow-hidden rounded-md border border-rule bg-tile/60">
      {children}
    </div>
  );
}

/** Phase I: a name typed letter by letter is accepted on its own and fills a pip. */
export function TypingDemo() {
  return (
    <Frame label="Typing a name fills one of the answer slots">
      <div className="absolute inset-x-6 top-6 flex justify-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`size-5 rounded-full border-2 border-rule-strong ${i === 2 ? 'demo-pip' : i < 2 ? 'border-hit bg-hit' : ''}`} />
        ))}
      </div>
      <div className="absolute inset-x-6 top-16 rounded-lg border border-rule-strong bg-card px-3 py-2 text-center font-mono text-base">
        <span className="demo-type inline-block overflow-hidden whitespace-nowrap align-bottom">teemo</span>
        <span className="demo-caret ml-px inline-block h-4 w-0.5 bg-ink align-middle" />
      </div>
      <p className="demo-accept absolute inset-x-0 bottom-3 text-center text-xs font-bold text-hit">✓ Teemo — accepted as you type</p>
    </Frame>
  );
}

/** Phase II: one card swipes right (belongs), the next is reflected left (impostor). */
export function SwipeDemo() {
  return (
    <Frame label="Swipe right when a card belongs, left to reflect an impostor">
      <div className="demo-zone-left absolute inset-y-3 left-3 flex w-14 items-center justify-center rounded border-2 border-dashed border-rule text-[9px] font-bold uppercase tracking-widest text-ink-faint">
        ◀ Reflect
      </div>
      <div className="demo-zone-right absolute inset-y-3 right-3 flex w-14 items-center justify-center rounded border-2 border-dashed border-rule text-[9px] font-bold uppercase tracking-widest text-ink-faint">
        Belongs ▶
      </div>
      <div className="demo-card-a absolute left-1/2 top-4 grid h-28 w-20 -ml-10 place-items-center rounded-md border border-rule-strong bg-card shadow-md">
        <span className="size-10 rounded-full bg-accent/70" />
        <span className="absolute bottom-1.5 text-[10px] font-bold text-hit">✓ member</span>
      </div>
      <div className="demo-card-b absolute left-1/2 top-4 grid h-28 w-20 -ml-10 place-items-center rounded-md border border-rule-strong bg-card shadow-md">
        <span className="size-10 rotate-45 rounded-sm bg-coral/70" />
        <span className="absolute bottom-1.5 text-[10px] font-bold text-coral">✗ impostor</span>
      </div>
    </Frame>
  );
}

/** Phase III: a spotlight roams a blurred picture while the timer burns; the name is typed in time. */
export function FinalDemo() {
  return (
    <Frame label="Name the flickering picture before the timer runs out">
      <div className="absolute left-3 top-1/2 size-24 -translate-y-1/2 overflow-hidden rounded border-2 border-coral/70 bg-[#141018]">
        <div className="demo-spotlight absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#e9c27a_0_18%,#b05a3c_19%_34%,#3a5f8a_35%_60%,#1d2a40_61%)] blur-[2px]" />
      </div>
      <div className="absolute left-[116px] right-3 top-1/2 -translate-y-1/2 space-y-2">
        <div className="h-2.5 overflow-hidden rounded-full border border-rule-strong bg-tile">
          <div className="demo-burn h-full rounded-full bg-ochre" />
        </div>
        <div className="rounded-lg border border-coral/60 bg-card px-2 py-1 font-mono text-[13px]">
          <span className="demo-type-late inline-block overflow-hidden whitespace-nowrap align-bottom">ziglean</span>
        </div>
        <p className="demo-accept-late text-[11px] font-bold leading-tight text-hit">✓ Zilean — typo forgiven</p>
      </div>
    </Frame>
  );
}

/** Classic: each attribute of a guess flips to green (match), amber (partly) or red (no match). */
export function ClassicDemo() {
  const cells = [
    { label: 'Genre', tone: 'bg-near text-on-pastel' },
    { label: 'Studio', tone: 'bg-hit text-on-strong' },
    { label: 'Year', tone: 'bg-miss text-on-strong' },
    { label: 'Origin', tone: 'bg-hit text-on-strong' },
    { label: 'Format', tone: 'bg-miss text-on-strong' },
  ];
  return (
    <Frame label="Each attribute of your guess turns green, amber or red">
      <div className="absolute inset-x-4 top-1/2 grid -translate-y-1/2 grid-cols-5 gap-1.5 [perspective:400px]">
        {cells.map((c, i) => (
          <div key={c.label} className="demo-flip relative h-16" style={{ animationDelay: `${i * 0.25}s` }}>
            <div className="absolute inset-0 grid place-items-center rounded border border-rule-strong bg-card text-[10px] font-bold text-ink-faint [backface-visibility:hidden]">?</div>
            <div className={`absolute inset-0 grid place-items-center rounded text-[10px] font-bold [backface-visibility:hidden] [transform:rotateX(180deg)] ${c.tone}`}>{c.label}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Cover Puzzle: tap two tiles to swap them, tap one twice to rotate it. */
export function TilesDemo() {
  const piece = (i: number) => ({
    backgroundImage: 'linear-gradient(135deg, var(--color-accent), var(--color-rose) 55%, var(--color-ochre))',
    backgroundSize: '300% 300%',
    backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`,
  });
  return (
    <Frame label="Swap two tiles, or tap one twice to rotate it">
      <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 grid-cols-3 gap-0.5">
        {[...Array(9).keys()].map((i) => (
          <div
            key={i}
            style={piece(i)}
            className={`relative rounded-sm ${i === 0 ? 'demo-swap-a z-10' : i === 4 ? 'demo-swap-b z-10' : i === 8 ? 'demo-rotate' : ''}`}
          >
            <span className="absolute inset-0 grid place-items-center font-display text-[10px] font-bold text-white/80">{i + 1}</span>
          </div>
        ))}
      </div>
      <span className="demo-tap absolute size-5 rounded-full border-2 border-ink/60 bg-ink/10" />
    </Frame>
  );
}
