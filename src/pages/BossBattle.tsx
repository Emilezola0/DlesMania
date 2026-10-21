import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BossHeader, HeartIcon } from '../boss/BossHeader';
import { FinalBlow } from '../boss/FinalBlow';
import { KnowledgeBlitz } from '../boss/KnowledgeBlitz';
import { RadarDefense } from '../boss/RadarDefense';
import { Glyph } from '../components/Glyph';
import { domainInfo } from '../data';
import { getBoss } from '../data/bosses';
import { PHASES, PLAYER_HEARTS, battleScore, drawBlitz, drawFinale, drawRadar, formatTime } from '../lib/boss';
import { celebrateBig, flash, shake } from '../lib/fx';
import { pick } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { EMPTY_BOSS_RECORD, useProgress } from '../store/progress';
import type { Boss, PhaseResult } from '../types';

/**
 * intro → (phase card → phase) × 3 → victory, or defeat once the hearts run out.
 * Winning a phase knocks a third off the boss; losing one costs a heart and the phase is
 * retried with fresh content.
 */
type Stage = 'intro' | 'card' | 'fight' | 'won' | 'lost';

interface Line {
  text: string;
  key: number;
  mood: 'taunt' | 'hit' | 'hurt';
}

export default function BossBattlePage() {
  const { id } = useParams();
  const boss = getBoss(id);
  if (!boss) return <Navigate to="/boss" replace />;
  return <BossBattle key={boss.id} boss={boss} />;
}

function BossBattle({ boss }: { boss: Boss }) {
  const recordBoss = useProgress((s) => s.recordBoss);
  const record = useProgress((s) => s.bosses[boss.id] ?? EMPTY_BOSS_RECORD);

  const [run, setRun] = useState(0); // bumped on rematch
  const [stage, setStage] = useState<Stage>('intro');
  const [phase, setPhase] = useState(0);
  /** Phases won — each one breaks a third of the boss's life. */
  const [cleared, setCleared] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [hearts, setHearts] = useState(PLAYER_HEARTS);
  const [line, setLine] = useState<Line>({ text: boss.lines.intro, key: 0, mood: 'taunt' });
  const [last, setLast] = useState<{ won: boolean; missed?: string[] } | null>(null);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });
  const [result, setResult] = useState<{ score: number; timeMs: number; best: boolean } | null>(null);
  const startedAt = useRef(0);
  const arena = useRef<HTMLDivElement>(null);
  const flashLayer = useRef<HTMLDivElement>(null);
  const prevPrompt = useRef<string>();

  const say = (text: string, mood: Line['mood']) => setLine((l) => ({ text, key: l.key + 1, mood }));

  // Fresh content for every attempt (a retried phase never repeats the same Blitz prompt if it can help it).
  const content = useMemo(() => {
    const rand = Math.random;
    const blitz = drawBlitz(boss, rand, prevPrompt.current);
    prevPrompt.current = blitz.prompt;
    const finale = drawFinale(boss, rand);
    const pool = [...new Set([...boss.finale, ...boss.radar.members].map((c) => c.label))].sort((a, b) => a.localeCompare(b));
    return { blitz, radar: drawRadar(boss, rand), finale, pool };
  }, [boss, phase, attempt, run]);

  // Small feedback inside a phase: a jolt on mistakes.
  const onEvent = (good: boolean) => {
    if (!good) shake(arena.current, 5, 300);
  };

  const onPhaseDone = (r: PhaseResult) => {
    const t = { correct: tally.correct + r.correct, wrong: tally.wrong + r.wrong };
    setTally(t);
    setLast({ won: r.won, missed: r.missed });
    if (r.won) {
      sfx.hit();
      shake(arena.current, 14, 520);
      flash(flashLayer.current, 'white');
      const next = phase + 1;
      setCleared(next);
      if (next >= PHASES.length) {
        say(boss.lines.win, 'hit');
        finish(true, next, hearts, t);
        return;
      }
      say(pick(boss.lines.hit, Math.random), 'hit');
      setPhase(next);
      setAttempt(0);
      window.setTimeout(() => say(next === 1 ? boss.lines.phase2 : boss.lines.phase3, 'taunt'), 1400);
    } else {
      sfx.hurt();
      shake(arena.current, 18, 560);
      flash(flashLayer.current, 'rgb(220 60 60)');
      const left = hearts - 1;
      setHearts(left);
      if (left <= 0) {
        say(boss.lines.lose, 'hurt');
        finish(false, phase, 0, t);
        return;
      }
      say(pick(boss.lines.hurt, Math.random), 'hurt');
      setAttempt((a) => a + 1);
    }
    setStage('card');
  };

  const finish = (won: boolean, phasesCleared: number, heartsLeft: number, t: { correct: number; wrong: number }) => {
    const timeMs = performance.now() - startedAt.current;
    const score = battleScore({ phasesCleared, hearts: heartsLeft, ...t, timeMs });
    const best = score > record.bestScore;
    recordBoss(boss.id, { won, score, time: timeMs });
    setResult({ score, timeMs, best });
    window.setTimeout(() => {
      setStage(won ? 'won' : 'lost');
      if (won) {
        sfx.victory();
        celebrateBig();
      } else sfx.lose();
    }, 1100);
  };

  const begin = () => {
    sfx.click();
    if (stage === 'intro') startedAt.current = performance.now();
    setStage('fight');
  };

  const rematch = () => {
    setRun((r) => r + 1);
    setPhase(0);
    setCleared(0);
    setAttempt(0);
    setHearts(PLAYER_HEARTS);
    setTally({ correct: 0, wrong: 0 });
    setLast(null);
    setResult(null);
    say(boss.lines.intro, 'taunt');
    setStage('intro');
  };

  // Enter starts the next phase from the intro / phase card.
  useEffect(() => {
    if (stage !== 'intro' && stage !== 'card') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && begin();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const info = PHASES[phase];
  const accuracy = tally.correct + tally.wrong ? Math.round((tally.correct / (tally.correct + tally.wrong)) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/boss?domain=${boss.domain}`} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← All bosses
        </Link>
        <span className="flex items-center gap-1.5 font-display text-xs uppercase tracking-widest text-ink-faint">
          <Glyph seed={boss.domain} size={14} className={domainInfo(boss.domain).tone} /> {boss.franchise}
        </span>
      </div>

      <div ref={arena} className={`page relative space-y-6 rounded-md p-4 sm:p-6 ${phase === 2 && stage === 'fight' ? 'boss-arena-final' : ''}`}>
        <div ref={flashLayer} className="pointer-events-none absolute inset-0 z-30 rounded-md opacity-0" aria-hidden />
        <BossHeader boss={boss} hp={PHASES.length - cleared} hearts={hearts} line={line} />

        {/* Phase stepper */}
        <ol className="flex items-center justify-center gap-2">
          {PHASES.map((p, i) => {
            const done = i < cleared;
            return (
              <li key={p.name} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-rule-strong sm:w-10" />}
                <span
                  className={`grid size-8 place-items-center rounded-full border-2 font-display text-xs font-bold ${
                    done ? 'border-hit bg-hit text-on-strong' : i === phase ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-faint'
                  }`}
                  title={p.name}
                >
                  {done ? '✓' : p.roman}
                </span>
              </li>
            );
          })}
        </ol>

        {stage === 'intro' && (
          <div className="animate-round-in space-y-5 text-center">
            <div className="mx-auto size-40 overflow-hidden rounded-full border-4 shadow-xl sm:size-48" style={{ borderColor: boss.boss.color, boxShadow: `0 0 48px ${boss.boss.color}66` }}>
              {boss.boss.image && <img src={boss.boss.image} alt={boss.boss.name} className="boss-breathe size-full object-cover object-top" />}
            </div>
            <div>
              <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">A guardian blocks the way</p>
              <h1 className="text-4xl font-bold">{boss.boss.name}</h1>
            </div>
            <ul className="mx-auto max-w-md space-y-1.5 text-left text-sm text-ink-soft">
              {PHASES.map((p) => (
                <li key={p.name} className="flex gap-2">
                  <span className="w-6 shrink-0 font-display font-bold text-ink">{p.roman}</span>
                  <span>
                    <b className="text-ink">{p.name}.</b> {p.how}
                  </span>
                </li>
              ))}
            </ul>
            {record.plays > 0 && (
              <p className="text-xs text-ink-faint">
                Record: {record.wins}/{record.plays} won · best {record.bestScore} pts{record.bestTime != null && ` · fastest ${formatTime(record.bestTime)}`}
              </p>
            )}
            <button type="button" onClick={begin} className="btn-accent w-full rounded-md py-3.5 font-display text-lg font-bold tracking-[0.2em]">
              FIGHT
            </button>
          </div>
        )}

        {stage === 'card' && (
          <div key={`${phase}-${attempt}`} className="boss-phase-card space-y-4 py-4 text-center">
            {last && !last.won && (
              <div className="space-y-1">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-coral">You took a hit — {hearts} heart{hearts === 1 ? '' : 's'} left</p>
                {last.missed?.length ? <p className="text-sm text-ink-soft">You could have named: {last.missed.join(', ')}</p> : null}
              </div>
            )}
            {last?.won && <p className="font-display text-sm font-bold uppercase tracking-widest text-hit">Phase broken — the guardian staggers!</p>}
            <p className="font-display text-xs uppercase tracking-[0.4em] text-ink-faint">{attempt > 0 ? 'Again —' : 'Now entering'}</p>
            <h2 className="boss-phase-title font-display text-6xl font-bold tracking-[0.15em] sm:text-7xl">PHASE {info.roman}</h2>
            <p className="font-display text-xl font-semibold tracking-wider">{info.name}</p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">{info.how}</p>
            <button type="button" onClick={begin} className="btn-ink rounded-md px-8 py-3 font-display font-bold tracking-widest">
              Ready
            </button>
          </div>
        )}

        {stage === 'fight' && (
          <div key={`${run}-${phase}-${attempt}`} className="animate-round-in">
            {phase === 0 && <KnowledgeBlitz prompt={content.blitz} onEvent={onEvent} onDone={onPhaseDone} />}
            {phase === 1 && <RadarDefense cards={content.radar} franchise={boss.franchise} onEvent={onEvent} onDone={onPhaseDone} />}
            {phase === 2 && <FinalBlow targets={content.finale} pool={content.pool} onEvent={onEvent} onDone={onPhaseDone} />}
          </div>
        )}

        {(stage === 'won' || stage === 'lost') && result && (
          <div className="animate-round-in space-y-5 text-center">
            <div>
              <p className={`font-display text-xs uppercase tracking-[0.4em] ${stage === 'won' ? 'text-hit' : 'text-coral'}`}>
                {stage === 'won' ? 'Guardian defeated' : 'You have fallen'}
              </p>
              <h2 className="boss-phase-title font-display text-5xl font-bold tracking-[0.12em] sm:text-6xl">{stage === 'won' ? 'VICTORY' : 'DEFEAT'}</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Score', `${result.score}`],
                ['Time', formatTime(result.timeMs)],
                ['Phases', `${cleared}/${PHASES.length}`],
                ['Accuracy', `${accuracy}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-rule bg-card/70 px-3 py-2.5">
                  <dt className="font-display text-[11px] uppercase tracking-widest text-ink-faint">{k}</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center justify-center gap-1 text-sm text-ink-soft">
              Hearts left:
              {Array.from({ length: PLAYER_HEARTS }, (_, i) => (
                <HeartIcon key={i} full={i < hearts} className="size-5" />
              ))}
              {result.best && <span className="ml-2 font-display font-bold tracking-wider text-ochre">★ New best score</span>}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={rematch} className="btn-accent flex-1 rounded-md py-3 font-display font-bold tracking-widest">
                {stage === 'won' ? 'Fight again' : 'Rematch'}
              </button>
              <Link to={`/boss?domain=${boss.domain}`} className="btn-paper flex-1 rounded-md py-3 text-center font-display font-bold tracking-widest">
                Choose another boss
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
