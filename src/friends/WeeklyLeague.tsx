// Friends → Weekly League: this week's dailies points, you and your friends, Monday to today (src/friends/league.ts);
// and last week's final standings, whose best is paid once.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DayEntry } from '../cloud/friends';
import { DleCoin } from '../components/DleCoin';
import { fromKey, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { champions, LEAGUE, lastMonday, standings, thisMonday, weekDays, type LeagueRow } from './league';

export interface LeaguePlayer {
  uid: string;
  log: Record<string, DayEntry>;
  /** Their icon and name, drawn by the Friends page. */
  who: ReactNode;
  color: string;
  me: boolean;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayMonth = (key: string) => fromKey(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const MEDALS = ['🥇', '🥈', '🥉'];

function Table({ rows, people, days, top, crown }: { rows: LeagueRow[]; people: Map<string, LeaguePlayer>; days: number; top: number; crown: string[] }) {
  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const p = people.get(r.uid);
        if (!p) return null;
        // Rank: tied totals share one.
        const rank = rows.findIndex((x) => x.total === r.total);
        return (
          <li key={r.uid} className={`flex items-center gap-3 rounded-md p-2 ${p.me ? 'bg-accent/10' : ''}`}>
            <span className="w-7 text-center font-display text-sm font-bold text-ink-faint">{r.total > 0 && rank < 3 ? MEDALS[rank] : rank + 1}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {p.who}
              {crown.includes(r.uid) && <span title="Last week's champion">👑</span>}
            </span>
            {/* The week's days as small bars. */}
            <span className="hidden items-end gap-0.5 sm:flex" aria-hidden>
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} className="flex w-3 flex-col items-center gap-0.5">
                  <span className="flex h-6 w-2 items-end overflow-hidden rounded-sm bg-tile">
                    <span className="w-full rounded-sm" style={{ height: `${top ? ((r.byDay[d] ?? 0) / top) * 100 : 0}%`, background: p.color }} />
                  </span>
                  <span className={`text-[9px] leading-none ${d < days ? 'text-ink-faint' : 'text-rule'}`}>{DAY_LETTERS[d]}</span>
                </span>
              ))}
            </span>
            <span className="w-16 text-right font-display font-bold tabular-nums">{r.total.toLocaleString('en-GB')}</span>
          </li>
        );
      })}
      {rows.length > 0 && rows[0].total === 0 && <li className="text-sm text-ink-soft">No points yet: play a daily to open the scoring.</li>}
      {rows.length === 0 && <li className="text-sm text-ink-soft">Nobody yet.</li>}
    </ol>
  );
}

export function WeeklyLeague({ players, demo }: { players: LeaguePlayer[]; demo: boolean }) {
  const today = todayKey();
  const monday = thisMonday(today);
  const prev = lastMonday(today);
  const days = weekDays(monday, today).length;
  const people = useMemo(() => new Map(players.map((p) => [p.uid, p])), [players]);
  const now = useMemo(() => standings(players, monday, today), [players, monday, today]);
  const before = useMemo(() => standings(players, prev, '9999-12-31'), [players, prev]);
  const crown = useMemo(() => champions(before), [before]);
  const me = players.find((p) => p.me)?.uid;
  const pay = useProgress((s) => s.payFriendGame);
  const [paid, setPaid] = useState(0);
  const top = Math.max(1, ...now.flatMap((r) => r.byDay));
  const topBefore = Math.max(1, ...before.flatMap((r) => r.byDay));

  // Last week's champion is paid once (on any device: the reward is kept in the save).
  useEffect(() => {
    if (demo || !me || !crown.includes(me)) return;
    const got = pay(`league:${prev}`, LEAGUE.coins);
    if (got) {
      setPaid(got);
      sfx.victory();
      celebrate();
    }
  }, [demo, me, crown, prev, pay]);

  const daysLeft = 7 - days;
  return (
    <section className="page space-y-5 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">🏅 Weekly League</h2>
        <p className="text-sm text-ink-soft">
          The points you make in the dailies, added up from Monday to Sunday, against your friends. A daily counts on its own day (not replayed from the Archive later). Each Monday it starts again, and last week&apos;s best wins{' '}
          {LEAGUE.coins.toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" /> (with at least {LEAGUE.minPlayers} players who scored).
        </p>
      </div>
      {paid > 0 && (
        <p className="rounded-md border border-hit/50 bg-hit/10 p-3 text-sm font-semibold">
          👑 You won last week&apos;s league: +{paid.toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" />
        </p>
      )}

      <div className="space-y-2">
        <p className="flex flex-wrap justify-between gap-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
          <span>This week · from {dayMonth(monday)}</span>
          <span>{daysLeft ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left after today` : 'last day!'}</span>
        </p>
        <Table rows={now} people={people} days={days} top={top} crown={crown} />
      </div>

      <details className="rounded-md border border-rule p-3">
        <summary className="cursor-pointer font-display text-sm font-bold">
          Last week · from {dayMonth(prev)}
          {crown.length > 0 && <span className="font-normal text-ink-soft"> · 👑 {me && crown.includes(me) ? (crown.length > 1 ? 'you tied for first' : 'you won it') : crown.length > 1 ? 'a tie at the top' : 'see who won'}</span>}
        </summary>
        <div className="pt-3">
          <Table rows={before} people={people} days={7} top={topBefore} crown={crown} />
        </div>
      </details>
      <p className="text-xs text-ink-faint">A day&apos;s points reach your friends when your save syncs (signed in, online). Friends who haven&apos;t updated the site since the league came count 0 until they do.</p>
    </section>
  );
}
