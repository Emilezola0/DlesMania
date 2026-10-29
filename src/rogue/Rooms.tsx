import { useEffect, useMemo, useRef, useState } from 'react';
import { nextItem, type HlItem } from '../arcade/higherLower';
import { oddRound } from '../arcade/oddOneOut';
import type { SortCard } from '../arcade/quickSort';
import { FinalBlow } from '../boss/FinalBlow';
import { finaleFaces } from '../boss/faces';
import { KnowledgeBlitz } from '../boss/KnowledgeBlitz';
import { TimerBar } from '../boss/TimerBar';
import { GuessInput } from '../components/GuessInput';
import { DIFFICULTIES, drawBlitz, drawFinale, matchAnswer } from '../lib/boss';
import { Spinner } from '../components/Spinner';
import { useTypeToFocus } from '../lib/focus';
import { shownName } from '../lib/french';
import { preload, useImagesReady } from '../lib/images';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { bossesFor, hlDecksFor, listsFor, sortDecksFor, themeFilter, universesFor } from './pools';
import type { Mods } from './run';

export interface RoomResult {
  won: boolean;
  /** Won without a slip: a little extra gold. */
  perfect: boolean;
  /** One line for the run's log ("Named Nami on the first try"). */
  note: string;
}

interface RoomProps {
  mods: Mods;
  onDone: (r: RoomResult) => void;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Mistakes a room tolerates before it's lost: its own allowance plus Second wind. */
const allowance = (base: number, mods: Mods) => base + mods.forgive;

function Header({ title, rule }: { title: string; rule: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{title}</p>
      <p className="font-serif text-lg italic text-ink-soft">{rule}</p>
    </div>
  );
}

/** Blurred portrait: name a character from a blurred, black-and-white picture. */
export function PortraitRoom({ mods, onDone }: RoomProps) {
  const u = useMemo(() => pick(universesFor(mods.keys)), []);
  const target = useMemo(() => pick(u.targets), [u]);
  // Deeper in the run: a try fewer every three acts, two seconds fewer each act.
  const tries = Math.max(1, (mods.hard ? 2 : 3) - Math.floor(mods.level / 3));
  const seconds = Math.max(8, (mods.hard ? 15 : 22) - Math.round(2 * mods.level)) + mods.bonusSeconds;
  const [wrong, setWrong] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  // Light at first, heavier deeper into the run (4px → 10px, +3 for an elite), and sharper with each miss.
  // The clock waits for the picture.
  const ready = useImagesReady([target.image]);
  const blur = Math.max(1, (4 + 6 * mods.depth + (mods.hard ? 3 : 0) - wrong.length * 2) / (mods.loupe ? 2 : 1));
  const end = (won: boolean, why: string) => {
    if (over) return;
    setOver(true);
    onDone({ won, perfect: won && !wrong.length, note: why });
  };
  const guess = (id: string) => {
    if (over) return;
    if (id === target.id) return sfx.correct(), end(true, `Named ${shownName(target.name)}`);
    sfx.wrong();
    const w = [...wrong, id];
    setWrong(w);
    if (w.length >= allowance(tries, mods)) end(false, `It was ${shownName(target.name)}`);
  };
  return (
    <div className="space-y-4">
      <Header title={`${u.icon} ${u.label}`} rule="Who is this?" />
      <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-xl bg-tile shadow-lg">
        {!ready && (
          <span className="absolute inset-0 grid place-items-center text-ink-faint">
            <Spinner className="size-8" />
          </span>
        )}
        <img src={target.image} alt="" draggable={false} className="size-full object-cover object-top transition-[filter] duration-700" style={{ filter: over ? 'none' : `blur(${blur}px) grayscale(1)` }} />
      </div>
      {mods.lantern && !over && <p className="text-center font-display font-bold">🏮 Starts with “{target.name[0]}”</p>}
      <TimerBar total={seconds * 1000} running={!over && ready} onExpire={() => end(false, `Time's up — ${shownName(target.name)}`)} />
      {!over && <GuessInput pool={u.pool} exclude={wrong} onGuess={guess} placeholder="Who is it?" showImages={false} />}
      <p className="text-center text-xs text-ink-faint">{allowance(tries, mods) - wrong.length} tries left</p>
    </div>
  );
}

/** Higher or Lower: three calls in a row (five for an elite). */
export function HigherLowerRoom({ mods, onDone }: RoomProps) {
  const deck = useMemo(() => pick(hlDecksFor(mods.keys)), []);
  // A call more to make each act.
  const need = Math.min(10, (mods.hard ? 5 : 3) + Math.floor(mods.level));
  const seen = useRef(new Set<string>());
  const draw = (cur?: HlItem) => {
    const x = nextItem(deck, cur, seen.current);
    seen.current.add(x.id);
    return x;
  };
  const [left, setLeft] = useState(() => draw());
  const [right, setRight] = useState(() => draw(left));
  const [got, setGot] = useState(0);
  const [slips, setSlips] = useState(0);
  const [reveal, setReveal] = useState(false);
  const call = (higher: boolean) => {
    if (reveal) return;
    const ok = right.value === left.value || (right.value > left.value) === higher;
    setReveal(true);
    ok ? sfx.correct() : sfx.wrong();
    const g = got + (ok ? 1 : 0);
    const s = slips + (ok ? 0 : 1);
    setGot(g);
    setSlips(s);
    window.setTimeout(() => {
      if (s > mods.forgive) return onDone({ won: false, perfect: false, note: `${shownName(right.name)}: ${right.shown}` });
      if (g >= need) return onDone({ won: true, perfect: s === 0, note: `${need} calls right` });
      setLeft(right);
      setRight(draw(right));
      setReveal(false);
    }, 900);
  };
  const Card = ({ x, shown }: { x: HlItem; shown: boolean }) => (
    <div className="page flex flex-col items-center gap-2 rounded-md p-3 text-center">
      <div className="aspect-square w-full max-w-[9rem] overflow-hidden rounded bg-tile">{x.image && <img src={x.image} alt="" className="size-full object-cover object-top" />}</div>
      <p className="font-display text-sm font-bold leading-tight">{shownName(x.name)}</p>
      <p className={`font-serif text-xl font-bold ${shown ? '' : 'text-ink-faint'}`}>{shown ? x.shown : '?'}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <Header title={`${deck.icon} ${deck.label}`} rule={`${deck.question} ${got}/${need}`} />
      <div className="grid grid-cols-2 gap-3">
        <Card x={left} shown />
        <Card x={right} shown={reveal} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={reveal} onClick={() => call(true)} className="btn-accent rounded-md py-2.5 font-display font-bold">
          ▲ {deck.higher}
        </button>
        <button type="button" disabled={reveal} onClick={() => call(false)} className="btn-paper rounded-md py-2.5 font-display font-bold">
          ▼ {deck.lower}
        </button>
      </div>
    </div>
  );
}

/** Odd One Out: one round (two in a row for an elite). */
export function OddRoom({ mods, onDone }: RoomProps) {
  // A round more every two acts.
  const need = Math.min(4, (mods.hard ? 2 : 1) + Math.floor(mods.level / 2));
  const [round, setRound] = useState(() => oddRound('all', Math.random, themeFilter(mods.keys)));
  const [got, setGot] = useState(0);
  const [slips, setSlips] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (label: string) => {
    if (picked) return;
    setPicked(label);
    const ok = label === round.odd;
    ok ? sfx.correct() : sfx.wrong();
    const g = got + (ok ? 1 : 0);
    const s = slips + (ok ? 0 : 1);
    setGot(g);
    setSlips(s);
    window.setTimeout(() => {
      if (s > mods.forgive) return onDone({ won: false, perfect: false, note: `${round.odd} wasn't ${round.link}` });
      if (g >= need) return onDone({ won: true, perfect: s === 0, note: `Spotted ${round.odd}` });
      setRound(oddRound('all', Math.random, themeFilter(mods.keys)));
      setPicked(null);
    }, 1300);
  };
  return (
    <div className="space-y-4">
      <Header title={`🧩 ${round.theme}`} rule={`Which one doesn't belong? ${got}/${need}`} />
      <div className="grid grid-cols-5 gap-2">
        {round.cards.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={!!picked}
            onClick={() => choose(c.label)}
            className={`overflow-hidden rounded-md border-2 bg-card ${!picked ? 'border-rule-strong hover:border-ink' : c.label === round.odd ? 'border-hit' : c.label === picked ? 'border-miss' : 'border-rule opacity-60'}`}
          >
            <div className="aspect-square bg-tile">{c.image && <img src={c.image} alt="" className="size-full object-cover object-top" />}</div>
            <p className="truncate p-1 text-[10px] font-semibold sm:text-xs">{shownName(c.label)}</p>
          </button>
        ))}
      </div>
      {picked && <p className="text-center text-sm">The others are all <span className="font-bold">{round.link}</span>.</p>}
    </div>
  );
}

/** Who Am I?: name them before the clues run out (four, three for an elite). */
export function WhoAmIRoom({ mods, onDone }: RoomProps) {
  const u = useMemo(() => pick(universesFor(mods.keys)), []);
  const target = useMemo(() => pick(u.targets), [u]);
  // A clue fewer every two acts.
  const max = Math.max(2, (mods.hard ? 3 : 4) - Math.floor(mods.level / 2));
  // The clues used here skip the very last one (the name's first letter), unless the Lantern shows it.
  const clues = target.clues.slice(0, -1);
  const [shown, setShown] = useState(mods.lantern ? 2 : 1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const guess = (id: string) => {
    if (over) return;
    if (id === target.id) {
      sfx.correct();
      setOver(true);
      return onDone({ won: true, perfect: shown <= 2 && !wrong.length, note: `${shownName(target.name)} in ${shown} clue${shown === 1 ? '' : 's'}` });
    }
    sfx.wrong();
    const w = [...wrong, id];
    setWrong(w);
    const forgiven = w.length <= mods.forgive;
    if (!forgiven && shown >= max) {
      setOver(true);
      return onDone({ won: false, perfect: false, note: `It was ${shownName(target.name)}` });
    }
    if (!forgiven) setShown((s) => Math.min(max, s + 1));
  };
  return (
    <div className="space-y-4">
      <Header title={`${u.icon} ${u.label}`} rule={`Who am I? Clue ${shown} of ${max}`} />
      <ol className="page space-y-1 rounded-md p-4">
        {clues.slice(0, shown).map((c, i) => (
          <li key={i} className="animate-pop">
            <span className="font-display font-bold text-accent">{i + 1}.</span> {c}
          </li>
        ))}
        {mods.lantern && <li className="font-display font-bold">🏮 Starts with “{target.name[0]}”</li>}
      </ol>
      {!over && (
        <>
          <GuessInput pool={u.pool} exclude={wrong} onGuess={guess} placeholder="Who is it?" />
          {shown < max && (
            <button type="button" onClick={() => setShown((s) => s + 1)} className="btn-paper mx-auto block rounded-md px-4 py-1.5 text-sm font-semibold">
              Next clue
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Quick Sort: ten cards (fifteen for an elite), one slip allowed with Second wind. */
export function SortRoom({ mods, onDone }: RoomProps) {
  const deck = useMemo(() => pick(sortDecksFor(mods.keys)), []);
  // Two cards more and a little less time for each, every act.
  const cards = useMemo(() => shuffle(deck.cards, Math.random).slice(0, Math.min(25, (mods.hard ? 15 : 10) + 2 * Math.floor(mods.level))), [deck]);
  const seconds = Math.max(1.2, (mods.hard ? 2 : 3) - 0.3 * mods.level) + mods.bonusSeconds / 2;
  const [i, setI] = useState(0);
  const [slips, setSlips] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; card: SortCard } | null>(null);
  const card = cards[i];
  // Every card loads from the start; each one's clock waits for its own picture.
  useEffect(() => cards.forEach((c) => void preload(c.image)), [cards]);
  const ready = useImagesReady([card?.image]);
  const sort = (side: 'left' | 'right' | null) => {
    if (!card || flash) return;
    const ok = side === card.side;
    ok ? sfx.correct() : sfx.wrong();
    const s = slips + (ok ? 0 : 1);
    setSlips(s);
    setFlash({ ok, card });
    window.setTimeout(() => {
      setFlash(null);
      if (s > mods.forgive) return onDone({ won: false, perfect: false, note: `${shownName(card.name)}: ${card.fact}` });
      if (i + 1 >= cards.length) return onDone({ won: true, perfect: s === 0, note: `${cards.length} cards sorted` });
      setI(i + 1);
    }, 350);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'ArrowLeft' ? sort('left') : e.key === 'ArrowRight' ? sort('right') : null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="space-y-4">
      <Header title={`${deck.icon} ${deck.label}`} rule={`${i}/${cards.length} sorted · ← →`} />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button type="button" onClick={() => sort('left')} className="btn-paper min-h-32 rounded-lg font-display font-bold">
          ← {deck.left}
        </button>
        {card && (
          <div key={i} className={`page animate-round-in w-36 overflow-hidden rounded-lg ${flash ? (flash.ok ? 'ring-2 ring-hit' : 'ring-2 ring-miss') : ''}`}>
            <div className="aspect-square bg-tile">{card.image && <img src={card.image} alt="" className="size-full object-cover object-top" />}</div>
            <p className="truncate p-1.5 text-center text-sm font-bold">{shownName(card.name)}</p>
            {!flash && <TimerBar key={i} total={seconds * 1000} running={!flash && ready} onExpire={() => sort(null)} hideSeconds />}
          </div>
        )}
        <button type="button" onClick={() => sort('right')} className="btn-paper min-h-32 rounded-lg font-display font-bold">
          {deck.right} →
        </button>
      </div>
    </div>
  );
}

/** Name them: five of a list (seven for an elite) against the clock. */
export function Name5Room({ mods, onDone }: RoomProps) {
  const list = useMemo(() => pick(listsFor(mods.keys)), []);
  // A name more and three seconds fewer each act (never more names than the list has).
  const need = Math.min(list.answers.length, 12, (mods.hard ? 7 : 5) + Math.floor(mods.level));
  const seconds = Math.max(25, (mods.hard ? 45 : 50) - 3 * Math.floor(mods.level)) + mods.bonusSeconds;
  const [found, setFound] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useTypeToFocus(input, !over);
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  const prompt = { prompt: list.title, count: need, answers: list.answers };
  const accept = (name: string) => {
    const next = [...found, name];
    setFound(next);
    setText('');
    sfx.correct();
    if (next.length >= need) {
      setOver(true);
      onDone({ won: true, perfect: true, note: `${need} ${list.title.toLowerCase()} named` });
    }
  };
  const onType = (v: string) => {
    setText(v);
    const m = matchAnswer(prompt, v, new Set(found));
    if (m && m.exact && !m.already) accept(m.name);
  };
  const onEnter = () => {
    const m = matchAnswer(prompt, text, new Set(found), true);
    if (m && !m.already) accept(m.name);
    else (sfx.wrong(), setText(''));
  };
  return (
    <div className="space-y-4">
      <Header title={`📝 ${list.franchise}`} rule={`Name ${need}: ${list.title} — ${found.length}/${need}`} />
      <TimerBar total={seconds * 1000} running={!over} onExpire={() => !over && (setOver(true), onDone({ won: false, perfect: false, note: `${found.length}/${need} ${list.title.toLowerCase()}` }))} />
      <input
        ref={input}
        value={text}
        disabled={over}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && text.trim() && onEnter()}
        placeholder="Type a name…"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-lg outline-none ring-accent/30 focus:border-accent focus:ring-4"
      />
      <ul className="flex flex-wrap justify-center gap-1.5">
        {found.map((n) => (
          <li key={n} className="animate-pop rounded-md border border-hit/50 bg-hit/10 px-2 py-1 text-sm font-semibold">
            {shownName(n)}
          </li>
        ))}
        {mods.lantern &&
          list.answers
            .filter((a) => !found.includes(a.name))
            .slice(0, need - found.length)
            .map((a) => (
              <li key={a.name} className="rounded-md border border-dashed border-rule-strong px-2 py-1 text-sm text-ink-faint">
                {shownName(a.name)[0]}…
              </li>
            ))}
      </ul>
    </div>
  );
}

/** A boss room: one phase of a guardian's Boss Battle, at Medium. Act 1 is a Knowledge Blitz, act 2 a Final Blow. */
export function BossRoom({ act, keys, onDone }: { act: number; keys: string[]; onDone: (r: RoomResult) => void }) {
  const boss = useMemo(() => pick(bossesFor(keys)), []);
  // The guardians fight harder from the third act on, and at Hell from the fifth.
  const d = act >= 5 ? DIFFICULTIES.hell : act >= 3 ? DIFFICULTIES.hard : DIFFICULTIES.medium;
  const blitz = useMemo(() => drawBlitz(boss, d, Math.random), [boss]);
  const finale = useMemo(() => drawFinale(boss, d, Math.random, [], 0, finaleFaces(boss)), [boss]);
  const pool = useMemo(() => {
    const seen = new Set<string>();
    return [...finaleFaces(boss), ...boss.radar.members].filter((c) => !seen.has(c.label) && seen.add(c.label)).sort((a, b) => a.label.localeCompare(b.label));
  }, [boss]);
  const done = (won: boolean, correct: number) => onDone({ won, perfect: won, note: `${boss.boss.name} ${won ? 'defeated' : 'stood firm'} (${correct} right)` });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        {boss.boss.image && <img src={boss.boss.image} alt="" className="size-14 rounded-full border-2 object-cover object-top" style={{ borderColor: boss.boss.color }} />}
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Act {act} boss · {boss.franchise}</p>
          <p className="font-serif text-2xl font-bold">{boss.boss.name}</p>
        </div>
      </div>
      {act % 2 === 1 ? (
        <KnowledgeBlitz prompt={blitz} difficulty={d} loop={0} onEvent={() => {}} onDone={(r) => done(r.won, r.correct)} />
      ) : (
        <FinalBlow targets={finale} pool={pool} difficulty={d} loop={0} onEvent={() => {}} onDone={(r) => done(r.won, r.correct)} />
      )}
    </div>
  );
}
