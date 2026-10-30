import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import heroes from '../data/overwatch-voices.json';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const KEY = 'voice:overwatch';
/** Seconds to answer once the line has been heard: 30 at first, less with every one found, down to 10. */
const secondsFor = (streak: number) => Math.max(10, 30 - streak);
/** What a round ran out of time is recorded as (never a hero's name). */
const TIMEOUT = '__timeout__';
/** How many heroes must go by before one comes back. */
const HERO_GAP = 8;

type Round = { hero: string; line: string };

function Run({ onExit }: { onExit: () => void }) {
  const best = useProgress((s) => s.bests[KEY] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const recent = useRef<string[]>([]);
  const draw = (): Round => {
    const left = heroes.filter((h) => !recent.current.includes(h.name));
    const hero = left[Math.floor(Math.random() * left.length)];
    recent.current = [...recent.current, hero.name].slice(-HERO_GAP);
    return { hero: hero.name, line: hero.lines[Math.floor(Math.random() * hero.lines.length)] };
  };
  const [round, setRound] = useState<Round>(draw);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [heard, setHeard] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [filter, setFilter] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const right = picked === round.hero;
  const over = picked !== null && !right;

  const play = () => {
    audio.current?.pause();
    const a = new Audio(round.line);
    a.volume = Math.max(0.3, Math.min(1, useProgress.getState().sfxVolume / 100));
    a.onplaying = () => setHeard(true);
    // A recording that's gone from the wiki isn't the player's fault: another line.
    a.onerror = () => setRound(draw());
    audio.current = a;
    setBlocked(false);
    a.play().catch(() => setBlocked(true));
  };
  useEffect(() => {
    setHeard(false);
    play();
    return () => audio.current?.pause();
    // Once per line.
  }, [round.line]);

  const pick = (name: string) => {
    if (picked) return;
    setPicked(name);
    if (name === round.hero) {
      sfx.correct();
      setStreak((s) => s + 1);
    } else {
      sfx.wrong();
      recordBest(KEY, streak, { reached: streak / 2 });
      if (streak > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 400);
    }
  };
  const next = () => {
    sfx.click();
    setRound(draw());
    setPicked(null);
    setFilter('');
  };
  const again = () => {
    setStreak(0);
    next();
  };
  const shown = useMemo(() => heroes.filter((h) => h.name.toLowerCase().includes(filter.trim().toLowerCase())), [filter]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between">
        <button type="button" onClick={onExit} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Voice Line
        </button>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{streak}</span> · best {Math.max(best, over ? streak : 0)}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={play} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
          🔊 {blocked ? 'Play the line' : 'Hear it again'}
        </button>
        <p className="text-center font-serif text-lg italic text-ink-soft">Who says that?</p>
      </div>
      <TimerBar total={secondsFor(streak) * 1000} running={heard && !picked} resetKey={round.line} onExpire={() => !picked && pick(TIMEOUT)} />
      {picked && (
        <div className={`animate-pop space-y-2 rounded-md border p-4 text-center ${right ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{right ? 'Right!' : picked === TIMEOUT ? "Time's up — streak over" : 'Streak over'}</p>
          <p className="text-lg">
            That was <span className="font-bold">{round.hero}</span>.
          </p>
          {right ? (
            <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Next →
            </button>
          ) : (
            <>
              <p className="text-sm text-ink-soft">{streak > best ? '★ New best!' : `Best: ${best}`}</p>
              <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Play again
              </button>
            </>
          )}
        </div>
      )}
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter the heroes…"
        aria-label="Filter the heroes"
        className="w-full rounded-md border border-rule-strong bg-card px-3 py-2"
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {shown.map((h) => {
          const tone = !picked ? 'border-rule-strong hover:-translate-y-0.5 hover:border-ink' : h.name === round.hero ? 'border-hit ring-2 ring-hit' : h.name === picked ? 'border-miss ring-2 ring-miss' : 'border-rule opacity-50';
          return (
            <button key={h.name} type="button" disabled={!!picked} onClick={() => pick(h.name)} className={`flex flex-col overflow-hidden rounded-lg border-2 bg-card transition ${tone}`}>
              <div className="aspect-square w-full bg-tile">{h.image && <img src={h.image} alt="" draggable={false} loading="lazy" className="size-full object-cover" />}</div>
              <p className="truncate p-1 text-center text-xs font-semibold">{h.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** /voice-line */
export default function VoiceLine() {
  const best = useProgress((s) => s.bests[KEY] ?? 0);
  const [playing, setPlaying] = useState(false);
  if (playing) return <Run onExit={() => setPlaying(false)} />;
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Voice Line</h1>
        <p className="max-w-xl text-ink-soft">Overwatch: hear a hero&apos;s real voice line and find who says it. The streak goes on until the first mistake, with a little less time each round. Turn your sound on!</p>
      </div>
      <button type="button" onClick={() => (sfx.click(), setPlaying(true))} className="btn-ink rounded-md px-8 py-3 font-display font-bold tracking-wider">
        🔊 Start
      </button>
      <p className="text-sm text-ink-faint">{best > 0 ? `Best streak: ${best}` : 'Not played yet'}</p>
    </div>
  );
}
