import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BossHeader, HeartIcon } from '../boss/BossHeader';
import { FinalBlow } from '../boss/FinalBlow';
import { KnowledgeBlitz } from '../boss/KnowledgeBlitz';
import { RadarDefense } from '../boss/RadarDefense';
import { NameChain, type ChainResult } from '../boss/NameChain';
import { Signature } from '../boss/Signature';
import { Glyph } from '../components/Glyph';
import { RulesButton } from '../components/RulesModal';
import { domainInfo } from '../data';
import { getBoss } from '../data/bosses';
import {
  DIFFICULTIES,
  CHAIN_PHASE,
  DIFFICULTY_IDS,
  PHASES,
  battleScore,
  drawBlitz,
  drawFinale,
  drawRadar,
  drawSecret,
  drawSignature,
  signatureKey,
  formatTime,
  paceFactor,
  paced,
  totalRounds,
  type SignaturePhase,
} from '../lib/boss';
import { shownName } from '../lib/french';
import { celebrateBig, flash, shake } from '../lib/fx';
import { pick } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { EMPTY_BOSS_RECORD, bossKey, recentlySeen, useProgress } from '../store/progress';
import { useUi } from '../store/ui';
import type { Boss, PhaseResult } from '../types';

/**
 * intro → (phase card → phase) × rounds → victory, or defeat once the hearts run out.
 * The difficulty sets how many rounds each phase needs (one boss segment each), and how hard
 * each round is. Losing a round costs a heart and that round is retried with fresh content.
 * Medium and Hard play a fourth phase, the Name Chain. On Hard, emptying the life bar then unlocks the
 * secret phase (index 4), the boss's Signature: a right answer wins, a wrong one takes every heart
 * and leaves one last chance.
 */
const SECRET = 4;
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

const DIFFICULTY_TONE = { easy: 'text-hit', medium: 'text-ochre', hard: 'text-coral' } as const;

function BossBattle({ boss }: { boss: Boss }) {
  const recordBoss = useProgress((s) => s.recordBoss);
  const difficulty = useProgress((s) => s.bossDifficulty);
  const setDifficulty = useProgress((s) => s.setBossDifficulty);
  const records = useProgress((s) => s.bosses);
  const base = DIFFICULTIES[difficulty];
  const record = records[bossKey(boss.id, difficulty)] ?? EMPTY_BOSS_RECORD;

  const [run, setRun] = useState(0); // bumped on rematch
  const [stage, setStage] = useState<Stage>('intro');
  const [phase, setPhase] = useState(0);
  /** Rounds already won in the current phase. */
  const [round, setRound] = useState(0);
  /** Rounds won in total — each one breaks a segment of the boss's life. */
  const [cleared, setCleared] = useState(0);
  // The clocks shrink with every round won, and a little more with every earlier win over this guardian.
  const pace = paceFactor(base, cleared, record.wins);
  const d = useMemo(() => paced(base, pace), [base, pace]);
  const [attempt, setAttempt] = useState(0);
  const [hearts, setHearts] = useState(d.hearts);
  const [line, setLine] = useState<Line>({ text: boss.lines.intro, key: 0, mood: 'taunt' });
  const [last, setLast] = useState<{ won: boolean; missed?: string[]; reason?: string } | null>(null);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });
  const [result, setResult] = useState<{ score: number; timeMs: number; best: boolean } | null>(null);
  /** Hard's secret phase, set up when the main life bar empties. */
  const [signature, setSignature] = useState<SignaturePhase | null>(null);
  const [secretResult, setSecretResult] = useState<ChainResult | null>(null);
  const startedAt = useRef(0);
  const arena = useRef<HTMLDivElement>(null);
  const flashLayer = useRef<HTMLDivElement>(null);
  // What earlier rounds, retries and fights showed (saved), so each draw brings something new.
  const markSeen = useProgress((s) => s.markSeen);
  const scope = (kind: 'prompts' | 'faces' | 'signature' | 'radar') => `boss:${boss.id}:${kind}`;
  const seenOf = (kind: 'prompts' | 'faces' | 'signature' | 'radar') => useProgress.getState().seen[scope(kind)];
  /** Signature clues shown so far this fight. */
  const sigShown = useRef(0);

  const say = (text: string, mood: Line['mood']) => setLine((l) => ({ text, key: l.key + 1, mood }));
  const total = totalRounds(d);

  // Fresh content for every round and attempt.
  const content = useMemo(() => {
    const rand = Math.random;
    const blitz = drawBlitz(boss, d, rand, recentlySeen(seenOf('prompts'), boss.blitz.length), round);
    const finale = drawFinale(boss, d, rand, recentlySeen(seenOf('faces'), boss.finale.length, d.finaleTargets), round);
    const seen = new Set<string>();
    const pool = [...boss.finale, ...boss.radar.members]
      .filter((c) => !seen.has(c.label) && seen.add(c.label))
      .sort((a, b) => a.label.localeCompare(b.label));
    // Phase IV: a fresh Name Chain for every attempt.
    const chain = phase === CHAIN_PHASE ? drawSecret(boss, d) : null;
    const radar = drawRadar(boss, d, rand, round, recentlySeen(seenOf('radar'), boss.radar.members.length, d.radarCards));
    return { blitz, radar, finale, pool, chain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, difficulty, phase, round, attempt, run]);

  // Small feedback inside a phase: a jolt on mistakes.
  const onEvent = (good: boolean) => {
    if (!good) shake(arena.current, 5, 300);
  };

  const onPhaseDone = (r: PhaseResult) => {
    const t = { correct: tally.correct + r.correct, wrong: tally.wrong + r.wrong };
    setTally(t);
    setLast({ won: r.won, missed: r.missed, reason: r.reason });
    if (phase === 0) markSeen(scope('prompts'), [content.blitz.prompt]);
    if (phase === 1) markSeen(scope('radar'), content.radar.filter((c) => c.belongs).map((c) => c.label));
    if (phase === 2) markSeen(scope('faces'), content.finale.map((c) => c.label));
    if (r.won) {
      sfx.hit();
      shake(arena.current, 14, 520);
      flash(flashLayer.current, 'white');
      const won = cleared + 1;
      setCleared(won);
      if (won >= total) {
        // Hard: the guardian isn't done yet.
        const clues = boss.signature?.clues.length ?? 0;
        const sig = drawSignature(boss, d, Math.random, recentlySeen(seenOf('signature'), clues, d.signature?.chances ?? 1));
        if (sig) {
          setSignature(sig);
          sigShown.current = 1;
          markSeen(scope('signature'), [signatureKey(sig.clues[0])]);
          setPhase(SECRET);
          setRound(0);
          setAttempt(0);
          window.setTimeout(() => say('You think it is over? One last test…', 'taunt'), 1200);
          setStage('card');
          return;
        }
        say(boss.lines.win, 'hit');
        finish(true, won, hearts, t);
        return;
      }
      say(pick(boss.lines.hit, Math.random), 'hit');
      setAttempt(0);
      if (round + 1 < d.rounds[phase]) setRound(round + 1);
      else {
        // The next phase this difficulty plays.
        let next = phase + 1;
        while (next < PHASES.length && !d.rounds[next]) next++;
        setPhase(next);
        setRound(0);
        const intro = next === 1 ? boss.lines.phase2 : next === 2 ? boss.lines.phase3 : (boss.lines.secret ?? 'One more game: I name something, you name another of the same kind.');
        window.setTimeout(() => say(intro, 'taunt'), 1400);
      }
    } else {
      sfx.hurt();
      shake(arena.current, 18, 560);
      flash(flashLayer.current, 'rgb(220 60 60)');
      const left = hearts - 1;
      setHearts(left);
      if (left <= 0) {
        say(boss.lines.lose, 'hurt');
        finish(false, cleared, 0, t);
        return;
      }
      say(pick(boss.lines.hurt, Math.random), 'hurt');
      setAttempt((a) => a + 1);
    }
    setStage('card');
  };

  /** The Signature's first wrong answer: every heart is gone, and the next clue is the last chance. */
  const onLastChance = () => {
    const next = signature?.clues[sigShown.current++];
    if (next) markSeen(scope('signature'), [signatureKey(next)]);
    sfx.hurt();
    shake(arena.current, 18, 560);
    flash(flashLayer.current, 'rgb(220 60 60)');
    setHearts(0);
    say(boss.lines.secretLost ?? 'Wrong! One last chance…', 'hurt');
  };

  const onSecretDone = (r: ChainResult) => {
    setSecretResult(r);
    if (r.won) {
      sfx.hit();
      shake(arena.current, 14, 520);
      flash(flashLayer.current, 'white');
      say(boss.lines.win, 'hit');
      finish(true, total, hearts, tally, signature?.bonus ?? 0);
    } else {
      // The last chance missed: the fight is lost.
      shake(arena.current, 24, 700);
      flash(flashLayer.current, 'rgb(220 60 60)');
      setHearts(0);
      say(boss.lines.secretLost ?? 'Wrong. You lose.', 'hurt');
      finish(false, total, 0, tally, -1);
    }
  };

  /** `bonus`: the secret phase's points when won, -1 when lost (no victory bonuses). */
  const finish = (won: boolean, roundsWon: number, heartsLeft: number, t: { correct: number; wrong: number }, bonus = 0) => {
    const timeMs = performance.now() - startedAt.current;
    const score = battleScore({ roundsWon, hearts: heartsLeft, ...t, timeMs, bonus }, d);
    const best = score > record.bestScore;
    recordBoss(bossKey(boss.id, difficulty), { won, score, time: timeMs });
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
    if (stage === 'intro') {
      startedAt.current = performance.now();
      setHearts(d.hearts);
    }
    setStage('fight');
  };

  const rematch = () => {
    setRun((r) => r + 1);
    setPhase(0);
    setRound(0);
    setCleared(0);
    setAttempt(0);
    setHearts(d.hearts);
    setTally({ correct: 0, wrong: 0 });
    setLast(null);
    setResult(null);
    setSignature(null);
    setSecretResult(null);
    say(boss.lines.intro, 'taunt');
    setStage('intro');
  };

  // Enter starts the next phase from the intro / phase card.
  useEffect(() => {
    if (stage !== 'intro' && stage !== 'card') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && !useUi.getState().rules && begin();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const secretPhase = phase === SECRET;
  const info = PHASES[Math.min(phase, PHASES.length - 1)];
  const rounds = secretPhase ? 1 : d.rounds[phase];
  const accuracy = tally.correct + tally.wrong ? Math.round((tally.correct / (tally.correct + tally.wrong)) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/boss?domain=${boss.domain}`} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← All bosses
        </Link>
        <span className="flex items-center gap-1.5 font-display text-xs uppercase tracking-widest text-ink-faint">
          <Glyph seed={boss.domain} size={14} className={domainInfo(boss.domain).tone} /> {boss.franchise}
          {stage !== 'intro' && <span className={`ml-1 font-bold ${DIFFICULTY_TONE[difficulty]}`}>· {d.label}</span>}
        </span>
      </div>

      <div ref={arena} className={`page relative space-y-6 rounded-md p-4 sm:p-6 ${phase >= 2 && stage === 'fight' ? 'boss-arena-final' : ''}`}>
        <div ref={flashLayer} className="pointer-events-none absolute inset-0 z-30 rounded-md opacity-0" aria-hidden />
        <BossHeader
          boss={boss}
          hp={total - cleared}
          rounds={d.rounds}
          hearts={hearts}
          maxHearts={d.hearts}
          secret={signature ? (secretResult?.won ? 'broken' : 'active') : undefined}
          line={line}
        />

        {/* Phase stepper; phases that take several rounds show their progress underneath. */}
        <ol className="flex items-start justify-center gap-2">
          {PHASES.map((p, i) => {
            if (!d.rounds[i]) return null;
            const done = i < phase || stage === 'won';
            const won = done ? d.rounds[i] : i === phase ? round : 0;
            return (
              <li key={p.name} className="flex items-start gap-2">
                {i > 0 && <span className="mt-4 h-px w-6 bg-rule-strong sm:w-10" />}
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={`grid size-8 place-items-center rounded-full border-2 font-display text-xs font-bold ${
                      done ? 'border-hit bg-hit text-on-strong' : i === phase ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-faint'
                    }`}
                    title={p.name}
                  >
                    {done ? '✓' : p.roman}
                  </span>
                  {d.rounds[i] > 1 && (
                    <span className="flex gap-0.5" aria-label={`${won} of ${d.rounds[i]} rounds`}>
                      {Array.from({ length: d.rounds[i] }, (_, k) => (
                        <span key={k} className={`size-1.5 rounded-full ${k < won ? 'bg-hit' : 'bg-rule-strong'}`} />
                      ))}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {signature && (
            <li className="animate-pop flex items-start gap-2">
              <span className="mt-4 h-px w-6 bg-coral sm:w-10" />
              <span
                title="Secret phase"
                className={`boss-secret-title grid size-8 place-items-center rounded-full border-2 font-display text-xs font-bold ${
                  secretResult?.won ? 'border-hit bg-hit text-on-strong' : 'border-coral bg-coral text-on-strong'
                }`}
              >
                {secretResult?.won ? '✓' : '?'}
              </span>
            </li>
          )}
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

            {/* Difficulty */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
                {DIFFICULTY_IDS.map((id) => {
                  const spec = DIFFICULTIES[id];
                  const r = records[bossKey(boss.id, id)];
                  const active = id === difficulty;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        sfx.select();
                        setDifficulty(id);
                      }}
                      className={`rounded-md border-2 px-2 py-2.5 transition ${active ? 'border-ink bg-ink text-paper' : 'border-rule bg-card text-ink-soft hover:border-rule-strong'}`}
                    >
                      <span className={`block font-display text-base font-bold tracking-widest ${active ? '' : DIFFICULTY_TONE[id]}`}>{spec.label.toUpperCase()}</span>
                      <span className="block text-[11px] opacity-80">
                        {totalRounds(spec)} rounds · ×{spec.scoreMultiplier} pts{r?.wins ? ' · ✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mx-auto max-w-md text-sm text-ink-soft">{d.blurb}</p>
            </div>

            <ul className="mx-auto max-w-md space-y-1.5 text-left text-sm text-ink-soft">
              {PHASES.map((p, i) => d.rounds[i] > 0 && (
                <li key={p.name} className="flex gap-2">
                  <span className="w-6 shrink-0 font-display font-bold text-ink">{p.roman}</span>
                  <span>
                    <b className="text-ink">
                      {p.name}
                      {d.rounds[i] > 1 ? ` ×${d.rounds[i]}` : ''}.
                    </b>{' '}
                    {p.how}
                  </span>
                </li>
              ))}
            </ul>
            {record.plays > 0 && (
              <p className="text-xs text-ink-faint">
                {d.label} record: {record.wins}/{record.plays} won · best {record.bestScore} pts
                {record.bestTime != null && ` · fastest ${formatTime(record.bestTime)}`}
              </p>
            )}
            <button type="button" onClick={begin} className="btn-accent w-full rounded-md py-3.5 font-display text-lg font-bold tracking-[0.2em]">
              FIGHT
            </button>
            <RulesButton tab="boss" label="See the rules, with demos" />
          </div>
        )}

        {stage === 'card' && secretPhase && signature && (
          <div key="signature" className="boss-phase-card space-y-4 py-4 text-center">
            <p className="font-display text-sm font-bold uppercase tracking-widest text-hit">The guardian's life bar is empty…</p>
            <p className="font-display text-xs uppercase tracking-[0.4em] text-coral">…but it has one last trick</p>
            <h2 className="boss-phase-title boss-secret-title font-display text-5xl font-bold tracking-[0.12em] text-coral sm:text-6xl">SECRET PHASE</h2>
            <p className="font-display text-xl font-semibold tracking-wider">Signature — {signature.label}</p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">
              {signature.prompt} <b className="text-ink">{signature.toWin === 1 ? 'Name it right and the guardian falls' : `Answer ${signature.toWin} clues to win`}</b>
              {signature.seconds > 0 && ` — ${signature.seconds} seconds per clue`}, and type the name: there are no suggestions.{' '}
              {signature.chances > 1 && <b className="text-coral">A wrong answer takes all your hearts — but you get one last chance on a new clue.</b>}
            </p>
            <button type="button" onClick={begin} className="btn-accent rounded-md px-8 py-3 font-display font-bold tracking-widest">
              I'm ready
            </button>
          </div>
        )}

        {stage === 'card' && !secretPhase && (
          <div key={`${phase}-${round}-${attempt}`} className="boss-phase-card space-y-4 py-4 text-center">
            {last && !last.won && (
              <div className="space-y-1">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-coral">You took a hit — {hearts} heart{hearts === 1 ? '' : 's'} left</p>
                {last.reason ? <p className="text-sm text-ink-soft">{last.reason}.</p> : null}
                {last.missed?.length ? <p className="text-sm text-ink-soft">You could have named: {last.missed.map(shownName).join(', ')}</p> : null}
              </div>
            )}
            {last?.won && (
              <p className="font-display text-sm font-bold uppercase tracking-widest text-hit">
                {round > 0 ? 'A blow lands — again!' : 'Phase broken — the guardian staggers!'}
              </p>
            )}
            <p className="font-display text-xs uppercase tracking-[0.4em] text-ink-faint">{attempt > 0 ? 'Again —' : 'Now entering'}</p>
            <h2 className="boss-phase-title font-display text-6xl font-bold tracking-[0.15em] sm:text-7xl">PHASE {info.roman}</h2>
            <p className="font-display text-xl font-semibold tracking-wider">
              {info.name}
              {rounds > 1 && <span className="text-ink-faint"> · round {round + 1} of {rounds}</span>}
            </p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">{info.how}</p>
            {pace < 1 && (
              <p className="font-display text-sm font-bold text-coral" title="Every round won, and every earlier win over this guardian, shortens the clocks">
                ⏱ Clocks at {Math.round(pace * 100)}% — the guardian is speeding up
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={begin} className="btn-ink rounded-md px-8 py-3 font-display font-bold tracking-widest">
                Ready
              </button>
              <RulesButton tab="boss" />
            </div>
          </div>
        )}

        {stage === 'fight' && (
          <div key={`${run}-${phase}-${round}-${attempt}`} className="animate-round-in">
            {phase === 0 && <KnowledgeBlitz prompt={content.blitz} difficulty={d} loop={round} onEvent={onEvent} onDone={onPhaseDone} />}
            {phase === 1 && <RadarDefense cards={content.radar} franchise={boss.franchise} difficulty={d} loop={round} onEvent={onEvent} onDone={onPhaseDone} />}
            {phase === 2 && <FinalBlow targets={content.finale} pool={content.pool} difficulty={d} loop={round} onEvent={onEvent} onDone={onPhaseDone} />}
            {phase === CHAIN_PHASE && content.chain && (
              <NameChain
                secret={content.chain}
                bossName={boss.boss.name}
                cards={[...boss.radar.members, ...boss.finale, ...boss.radar.impostors]}
                okLines={boss.lines.secretOk ?? []}
                onSay={say}
                onDone={(r) => onPhaseDone({ won: r.won, correct: r.score, wrong: r.won ? 0 : 1, reason: r.won ? undefined : r.reason })}
              />
            )}
            {secretPhase && signature && (
              <Signature
                signature={signature}
                bossName={boss.boss.name}
                okLines={boss.lines.secretOk ?? []}
                onSay={say}
                onLastChance={onLastChance}
                onDone={onSecretDone}
              />
            )}
          </div>
        )}

        {(stage === 'won' || stage === 'lost') && result && (
          <div className="animate-round-in space-y-5 text-center">
            <div>
              <p className={`font-display text-xs uppercase tracking-[0.4em] ${stage === 'won' ? 'text-hit' : 'text-coral'}`}>
                {stage === 'won' ? `Guardian defeated · ${d.label}` : `You have fallen · ${d.label}`}
              </p>
              <h2 className="boss-phase-title font-display text-5xl font-bold tracking-[0.12em] sm:text-6xl">{stage === 'won' ? 'VICTORY' : 'DEFEAT'}</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Score', `${result.score}`],
                ['Time', formatTime(result.timeMs)],
                ['Rounds', `${cleared}/${total}`],
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
              {Array.from({ length: d.hearts }, (_, i) => (
                <HeartIcon key={i} full={i < hearts} className="size-5" />
              ))}
              {result.best && <span className="ml-2 font-display font-bold tracking-wider text-ochre">★ New best score</span>}
            </p>
            {signature && secretResult && (
              <p className={`font-display text-sm font-bold tracking-wider ${secretResult.won ? 'text-hit' : 'text-coral'}`}>
                {secretResult.won
                  ? `Signature won — ${secretResult.reason} (+${Math.round(signature.bonus * d.scoreMultiplier)} pts)`
                  : `Signature failed: ${secretResult.reason}`}
              </p>
            )}
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
