import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shortMeaning, type JlptDeck, type JlptEntry } from '../arcade/jlpt';
import { KeepButton } from '../components/JlptKeep';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** A kanji's readings as the list gives them, split: on'yomi in katakana, kun'yomi in hiragana. */
function readingsOf(reading: string) {
  const parts = reading.split(/[・、\s]+/).filter(Boolean);
  return { on: parts.filter((p) => /^[゠-ヿ]/.test(p)), kun: parts.filter((p) => !/^[゠-ヿ]/.test(p)) };
}

type Stroke = [number, number][];

/**
 * A square to draw in, with the finger, a pen or the mouse: strokes in ink over a faint cross, like the
 * squares of a writing exercise book. `ghost`, once shown, is the character drawn faintly on top.
 */
function DrawPad({ strokes, onStrokes, ghost, locked }: { strokes: Stroke[]; onStrokes: (s: Stroke[]) => void; ghost?: string; locked: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);

  // Everything drawn so far, again (at the screen's own resolution).
  const paint = (all: Stroke[]) => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.lineWidth = Math.max(6, r.width / 28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of all) {
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo(x * r.width, y * r.height) : ctx.moveTo(x * r.width, y * r.height)));
      if (s.length === 1) ctx.lineTo(s[0][0] * r.width + 0.1, s[0][1] * r.height);
      ctx.stroke();
    }
  };
  useEffect(() => paint(strokes));
  useEffect(() => {
    const onResize = () => paint(strokes);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const at = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  return (
    <div className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-md border-2 border-rule-strong bg-card">
      {/* The exercise book's cross. */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full text-rule-strong" aria-hidden>
        <path d="M50 0V100M0 50H100" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 3" fill="none" />
      </svg>
      {ghost && (
        <span lang="ja" className="animate-pop pointer-events-none absolute inset-0 grid place-items-center font-serif text-[13rem] leading-none text-accent/35 max-sm:text-[10rem]" aria-hidden>
          {ghost}
        </span>
      )}
      <canvas
        ref={canvas}
        className="absolute inset-0 size-full touch-none text-ink"
        aria-label="Draw here"
        onPointerDown={(e) => {
          if (locked) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = [at(e)];
          paint([...strokes, drawing.current]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          drawing.current.push(at(e));
          paint([...strokes, drawing.current]);
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          onStrokes([...strokes, drawing.current]);
          drawing.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = null;
          paint(strokes);
        }}
      />
    </div>
  );
}

/**
 * Write (/jlpt/n5-write…, /jlpt/kana-hiragana-write): a kanji's meaning and readings (a kana's romaji) —
 * draw it, then see it, faint over the drawing and on its own, with its reading and meaning, and say
 * whether you had it. No clock: drawing takes its time. A streak of "I had it"; a miss goes on the review list.
 */
export function WriteGame({ deck }: { deck: JlptDeck }) {
  const kana = deck.kind === 'kana';
  const key = `jlpt:${deck.id}-write`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const addReview = useProgress((s) => s.addJlptReview);
  const recent = useRef<string[]>([]);
  const draw = (): JlptEntry => {
    const fresh = deck.entries.filter((e) => !recent.current.includes(e.id));
    const pool = fresh.length ? fresh : deck.entries;
    const e = pool[Math.floor(Math.random() * pool.length)];
    recent.current = [e.id, ...recent.current].slice(0, Math.floor(deck.entries.length / 2));
    return e;
  };
  const [entry, setEntry] = useState(draw);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  /** Strokes taken back (Ctrl + Z), the last one on top: Ctrl + Y puts them back; a new stroke or a new character forgets them. */
  const [undone, setUndone] = useState<Stroke[]>([]);
  const drawn = (all: Stroke[]) => (setStrokes(all), setUndone([]));
  const undo = () => {
    if (!strokes.length) return;
    sfx.click();
    setUndone([...undone, strokes[strokes.length - 1]]);
    setStrokes(strokes.slice(0, -1));
  };
  const redo = () => {
    if (!undone.length) return;
    sfx.click();
    setStrokes([...strokes, undone[undone.length - 1]]);
    setUndone(undone.slice(0, -1));
  };
  const [shown, setShown] = useState(false);
  const [streak, setStreak] = useState(0);
  const [had, setHad] = useState(0);
  const [missed, setMissed] = useState(0);
  const r = readingsOf(entry.reading);

  const reveal = () => {
    if (shown) return;
    sfx.click();
    setShown(true);
  };
  const judge = (ok: boolean) => {
    if (ok) {
      sfx.correct();
      setHad(had + 1);
      setStreak(streak + 1);
    } else {
      sfx.wrong();
      setMissed(missed + 1);
      addReview([entry.id]);
      if (streak > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 300);
      recordBest(key, streak, { reached: streak / 2 });
      setStreak(0);
    }
    setEntry(draw());
    drawn([]);
    setShown(false);
  };
  // Enter shows it; once shown, 1 (or Enter) says you had it, 2 that you didn't. While writing, Ctrl + Z takes the last
  // stroke back and Ctrl + Y (or Ctrl + Shift + Z) puts it back; Cmd on a Mac.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k !== 'z' && k !== 'y') return;
        e.preventDefault();
        if (shown) return;
        if (k === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (!shown && e.key === 'Enter') reveal();
      else if (shown && (e.key === '1' || e.key === 'Enter')) judge(true);
      else if (shown && e.key === '2') judge(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">{kana ? 'Write this kana' : 'Write this kanji'}</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{streak}</span> · best {Math.max(best, streak)} · ✓ {had} · ✗ {missed}
        </p>
      </div>
      {/* What to write: a kanji's meaning and readings, a kana's romaji. */}
      <div className="page space-y-1 rounded-md p-4 text-center">
        {kana ? (
          <p className="font-display text-4xl font-bold">{entry.meaning}</p>
        ) : (
          <>
            <p className="font-display text-2xl font-bold">“{shortMeaning(entry.meaning, 4)}”</p>
            <p lang="ja" className="text-ink-soft">
              {r.on.length > 0 && (
                <span>
                  <span className="font-display text-xs text-ink-faint">On </span>
                  {r.on.join('・')}
                </span>
              )}
              {r.on.length > 0 && r.kun.length > 0 && <span className="text-ink-faint"> · </span>}
              {r.kun.length > 0 && (
                <span>
                  <span className="font-display text-xs text-ink-faint">Kun </span>
                  {r.kun.join('・')}
                </span>
              )}
            </p>
          </>
        )}
      </div>
      <DrawPad strokes={strokes} onStrokes={drawn} ghost={shown ? entry.text : undefined} locked={shown} />
      {!shown ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={undo} disabled={!strokes.length} title="Ctrl + Z" className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold disabled:opacity-40">
            ↶ Undo a stroke
          </button>
          <button type="button" onClick={redo} disabled={!undone.length} title="Ctrl + Y" className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold disabled:opacity-40">
            ↷ Redo
          </button>
          <button type="button" onClick={() => drawn([])} disabled={!strokes.length} className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold disabled:opacity-40">
            Clear
          </button>
          <button type="button" onClick={reveal} className="btn-ink rounded-md px-6 py-2 font-display font-bold tracking-wider">
            Show it ↵
          </button>
        </div>
      ) : (
        <div className="animate-pop space-y-3">
          {/* The answer: the character, its reading under it, its meaning. */}
          <div className="page flex flex-col items-center gap-1 rounded-md p-4 text-center">
            <p lang="ja" className="font-serif text-6xl font-bold leading-tight">
              {entry.text}
            </p>
            {kana ? (
              <p className="text-lg text-ink-soft">{entry.meaning}</p>
            ) : (
              <>
                <p lang="ja" className="text-lg text-ink-soft">
                  {entry.reading}
                </p>
                <p className="text-sm text-ink-faint">{shortMeaning(entry.meaning, 6)}</p>
              </>
            )}
            <KeepButton id={entry.id} />
          </div>
          <p className="text-center text-sm text-ink-soft">Did you have it?</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => judge(true)} className="rounded-md border border-hit bg-hit/15 px-4 py-3 font-display font-bold">
              <span className="text-xs text-ink-faint">1 </span>✓ I had it
            </button>
            <button type="button" onClick={() => judge(false)} className="rounded-md border border-miss bg-miss/10 px-4 py-3 font-display font-bold">
              <span className="text-xs text-ink-faint">2 </span>✗ Not quite
            </button>
          </div>
          <p className="text-center text-xs text-ink-faint">Not quite: it goes on your review list.</p>
        </div>
      )}
    </div>
  );
}

/** A deck's Write card on /jlpt. */
export function WriteCard({ deck, title }: { deck: JlptDeck; title: string }) {
  const best = useProgress((s) => s.bests[`jlpt:${deck.id}-write`] ?? 0);
  return (
    <li>
      <Link to={`/jlpt/${deck.id}-write`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-coral/50 transition hover:-translate-y-0.5">
        <span className="text-3xl">✍️</span>
        <span className="font-display text-xl font-bold">{title}</span>
        <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
          Draw each {deck.kind === 'kana' ? 'sign' : 'kanji'}
          {best > 0 && <span className="font-bold text-coral">best {best}</span>}
        </span>
      </Link>
    </li>
  );
}
