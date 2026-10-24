import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FlameIcon } from '../components/Layout';
import { Ornament } from '../components/Glyph';
import { VideoClip } from '../components/VideoClip';
import { GameHostFx } from '../games/GameHost';
import { dayNumber, formatLong, isPlayableDay, todayKey } from '../lib/date';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { RANK_DATA, RANK_ROUNDS, buildRankDaily, randomRankRound, rankGame, rankScore, type RankGame, type RankRound } from '../rank/data';
import { specialStreak, useProgress } from '../store/progress';
import { EMPTY_RECORD, type RoundRecord } from '../types';

/** Seconds of gameplay a round shows. */
const CLIP_SECONDS = 40;
/** Progress lives with the Specialist dailies, under "rank-<game>:<date>". */
const dailyKey = (game: string, date: string) => `rank-${game}:${date}`;
const MAX_SCORE = RANK_ROUNDS * 100;

/** The emblem (sized by height: CS2's are wide banners), or the rank's initials when there's no picture. */
function Emblem({ rank, className = 'h-10' }: { rank: { name: string; icon?: string }; className?: string }) {
  return rank.icon ? (
    <img src={rank.icon} alt="" draggable={false} className={`${className} w-auto max-w-[5rem] object-contain`} />
  ) : (
    <span className={`${className} grid aspect-square place-items-center rounded-full bg-tile font-display text-xs font-bold`}>{rank.name.slice(0, 2)}</span>
  );
}

/** One clip and one guess: exact is 100, one rank off is 50. */
function RankRoundView({ game, round, record, onChange }: { game: RankGame; round: RankRound; record: RoundRecord; onChange: (r: RoundRecord) => void }) {
  // When a video is gone, the next clip of the same rank stands in.
  const [clip, setClip] = useState(0);
  const done = record.status !== 'playing';
  const guess = record.guesses[0];
  const answer = game.ranks.find((r) => r.id === round.rank)!;
  const videoId = round.clips[clip];
  const score = guess ? rankScore(game, guess, round.rank) : 0;

  const choose = (id: string) => {
    if (done) return;
    const points = rankScore(game, id, round.rank);
    onChange({ status: points === 100 ? 'won' : 'lost', guesses: [id], score: points });
  };

  if (!videoId) {
    return <p className="rounded-md border border-miss/50 bg-miss/10 p-5 text-center text-sm">None of this round&apos;s videos can be played any more.</p>;
  }

  return (
    <div className="space-y-6">
      <VideoClip key={videoId} videoId={videoId} at={round.at} seconds={CLIP_SECONDS} revealed={done} onUnavailable={() => setClip((c) => c + 1)} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {game.ranks.map((r) => {
          const isAnswer = done && r.id === round.rank;
          const isGuess = done && r.id === guess && !isAnswer;
          const tone = isAnswer ? 'border-hit bg-hit/15' : isGuess ? (score ? 'border-near bg-near/15' : 'border-miss bg-miss/10') : 'border-rule-strong bg-card hover:-translate-y-0.5 hover:border-ink';
          return (
            <button
              key={r.id}
              type="button"
              disabled={done}
              onClick={() => choose(r.id)}
              className={`flex flex-col items-center gap-1 rounded-md border p-2 text-center transition ${tone} ${done && !isAnswer && !isGuess ? 'opacity-50' : ''}`}
            >
              <Emblem rank={r} />
              <span className="font-display text-xs font-semibold leading-tight">{r.name}</span>
            </button>
          );
        })}
      </div>

      {done && (
        <div className={`animate-pop flex items-center gap-4 rounded-lg border p-4 ${score === 100 ? 'border-hit/50 bg-hit/10' : score ? 'border-near/50 bg-near/10' : 'border-miss/50 bg-miss/10'}`}>
          <Emblem rank={answer} className="h-16" />
          <div className="min-w-0">
            <p className="font-display text-sm uppercase tracking-widest text-ink-soft">
              {score === 100 ? 'Spot on' : score ? 'One rank off' : 'Not quite'} · +{score}
            </p>
            <p className="text-2xl font-bold">{answer.name}</p>
            <p className="truncate text-xs text-ink-faint">
              From “{game.clips.find((c) => c.youtubeId === videoId)?.title}” — the rank comes from the video&apos;s title.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function shareText(game: RankGame, date: string, records: Record<number, RoundRecord>, streak: number) {
  const score = Object.values(records).reduce((n, r) => n + r.score, 0);
  const marks = Array.from({ length: RANK_ROUNDS }, (_, i) => (records[i]?.score === 100 ? '🟩' : records[i]?.score ? '🟨' : '🟥')).join('');
  return [
    `Omnidle Guess the Rank · ${game.label} ${date} — ${score}/${MAX_SCORE}${streak > 1 ? ` 🔥${streak}` : ''}`,
    marks,
    `${window.location.origin}${window.location.pathname}#/rank/${game.id}/${date}`,
  ].join('\n');
}

function DailyView({ game, date }: { game: RankGame; date: string }) {
  const key = dailyKey(game.id, date);
  const rounds = useMemo(() => buildRankDaily(game, date), [game, date]);
  const records = useProgress((s) => s.special[key]) ?? {};
  const special = useProgress((s) => s.special);
  const setRound = useProgress((s) => s.setSpecialRound);
  const isOpen = (i: number) => (records[i]?.status ?? 'playing') === 'playing';
  const [index, setIndex] = useState(() => rounds.findIndex((_, i) => isOpen(i)));
  const [copied, setCopied] = useState(false);
  const round = index >= 0 ? rounds[index] : undefined;
  const record = round ? records[index] ?? EMPTY_RECORD : undefined;
  const nextOpen = rounds.findIndex((_, i) => i !== index && isOpen(i));
  const score = rounds.reduce((n, _, i) => n + (records[i]?.score ?? 0), 0);
  const streak = specialStreak(special, `rank-${game.id}`, rounds.length);

  const onChange = (r: RoundRecord) => {
    setRound(key, index, r);
    if (r.status !== 'playing' && record?.status === 'playing' && nextOpen < 0) window.setTimeout(() => (sfx.streak(), celebrateBig()), 600);
  };
  const goTo = (i: number) => {
    sfx.click();
    setIndex(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const share = async () => {
    const text = shareText(game, date, records, streak);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-display text-xs tracking-[0.25em] text-ink-faint">
          {formatLong(date).toUpperCase()} · №{dayNumber(date)}
          {date !== todayKey() && <span className="ml-2 rounded-sm border border-coral/60 px-1.5 text-coral">ARCHIVE</span>}
        </p>
        <p className="font-serif text-2xl font-bold tabular-nums">
          {score}
          <span className="text-base text-ink-faint"> / {MAX_SCORE}</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rounds.map((_, i) => {
          const rec = records[i];
          const tone = !rec || rec.status === 'playing' ? 'border-rule bg-card' : rec.score === 100 ? 'border-hit/70 bg-hit/15' : rec.score ? 'border-near/70 bg-near/15' : 'border-miss/60 bg-miss/10';
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-md border p-2 font-display text-sm font-semibold transition hover:-translate-y-0.5 ${tone} ${i === index ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
            >
              Clip {i + 1}
            </button>
          );
        })}
      </div>

      {round && record ? (
        <section key={`${key}-${index}`} className="space-y-6">
          <GameHostFx record={record} onChange={onChange}>
            {(change) => <RankRoundView game={game} round={round} record={record} onChange={change} />}
          </GameHostFx>
          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button type="button" onClick={() => goTo(nextOpen)} className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider">
                {nextOpen >= 0 ? 'Next clip →' : 'See results →'}
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="animate-round-in mx-auto max-w-xl space-y-5 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">Daily complete</p>
          <p className="font-serif text-7xl font-bold leading-none">{score}</p>
          <p className="text-ink-soft">
            out of {MAX_SCORE}
            {streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-coral">
                <FlameIcon /> {streak}-day streak
              </span>
            )}
          </p>
          <Ornament />
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={share} className="btn-accent rounded-md px-5 py-2.5 font-semibold">
              {copied ? '✓ Copied!' : 'Share result'}
            </button>
            <button type="button" onClick={() => goTo(0)} className="btn-paper rounded-md px-5 py-2.5 font-semibold">
              Review clips
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Endless random clips; only the seen-history is saved, so new ones come first. */
function PracticeView({ game }: { game: RankGame }) {
  const scope = `rank:${game.id}`;
  const [n, setN] = useState(0);
  const round = useMemo(() => randomRankRound(game, useProgress.getState().seen[scope]), [game, n]);
  useEffect(() => useProgress.getState().markSeen(scope, [round.clips[0]]), [round]);
  const [record, setRecord] = useState<RoundRecord>(EMPTY_RECORD);
  const [total, setTotal] = useState({ points: 0, played: 0 });
  const next = () => {
    sfx.click();
    setN((x) => x + 1);
    setRecord(EMPTY_RECORD);
  };
  const onChange = (r: RoundRecord) => {
    setRecord(r);
    if (r.status !== 'playing') setTotal((t) => ({ points: t.points + r.score, played: t.played + 1 }));
  };
  return (
    <section key={n} className="space-y-6">
      {total.played > 0 && (
        <p className="text-center font-display text-sm text-ink-soft">
          This session: {total.points} points in {total.played} clip{total.played === 1 ? '' : 's'}
        </p>
      )}
      <GameHostFx record={record} onChange={onChange}>
        {(change) => <RankRoundView game={game} round={round} record={record} onChange={change} />}
      </GameHostFx>
      {record.status !== 'playing' && (
        <div className="flex justify-center">
          <button type="button" onClick={next} className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Another clip →
          </button>
        </div>
      )}
    </section>
  );
}

/** /rank */
export function GuessRankHub() {
  const special = useProgress((s) => s.special);
  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Watch, then judge</p>
        <h1 className="text-5xl font-bold">Guess the Rank</h1>
        <p className="max-w-xl text-ink-soft">
          Watch {CLIP_SECONDS} seconds of a ranked game and say what rank the player is. The exact rank scores 100, one rank off scores 50. Three clips a
          day per game, and practice whenever you like. The ranks come from the videos&apos; titles on YouTube.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {RANK_DATA.games.map((g) => {
          const records = Object.values(special[dailyKey(g.id, todayKey())] ?? {}).filter((r) => r.status !== 'playing');
          const streak = specialStreak(special, `rank-${g.id}`, RANK_ROUNDS);
          return (
            <li key={g.id}>
              <Link to={`/rank/${g.id}`} className="page flex h-full flex-col gap-3 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
                <span className="font-display text-xl font-bold">{g.label}</span>
                <span className="flex flex-wrap gap-1">
                  {g.ranks.map((r) => (
                    <Emblem key={r.id} rank={r} className="h-7" />
                  ))}
                </span>
                <span className="text-sm text-ink-soft">
                  {g.ranks.length} ranks · {g.clips.length} clips
                </span>
                <span className="mt-auto flex items-center justify-between text-xs text-ink-faint">
                  {records.length >= RANK_ROUNDS ? 'Today: done' : records.length ? `Today: ${records.length}/${RANK_ROUNDS}` : 'Today: not started'}
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-coral">
                      <FlameIcon /> {streak}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** /rank/:game[/:date] */
export default function GuessRankGame() {
  const { game: id, date = todayKey() } = useParams();
  const [tab, setTab] = useState<'daily' | 'practice'>('daily');
  const game = rankGame(id);
  if (!game) return <Navigate to="/rank" replace />;
  if (!isPlayableDay(date)) return <Navigate to={`/rank/${game.id}`} replace />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/rank" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Guess the Rank
          </Link>
          <h1 className="text-4xl font-bold">{game.label}</h1>
          <p className="text-xs text-ink-faint">
            {game.clips.length} clips across {game.ranks.length} ranks — found on YouTube {RANK_DATA.generated}
          </p>
        </div>
        <div className="flex rounded-md border border-rule-strong p-0.5">
          {(['daily', 'practice'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-4 py-1.5 font-display text-sm font-semibold capitalize ${tab === t ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'daily' ? <DailyView key={`${game.id}-${date}`} game={game} date={date} /> : <PracticeView key={game.id} game={game} />}
    </div>
  );
}
