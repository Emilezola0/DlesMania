import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Glyph } from '../components/Glyph';
import { RulesButton } from '../components/RulesModal';
import { domainInfo } from '../data';
import { BOSS_TABS, BOSSES, inTab, type BossTab } from '../data/bosses';
import { formatTime } from '../lib/boss';
import { bestSearchScore } from '../utils/textMatcher';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../lib/boss';
import { EMPTY_BOSS_RECORD, bossKey, useProgress } from '../store/progress';

function chip(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition ${
    active ? 'border-ink bg-ink text-paper' : 'border-rule bg-card text-ink-soft hover:border-rule-strong'
  }`;
}

/** Step 1: pick a domain. Step 2: pick a franchise (searchable). */
export default function BossSelect() {
  const [params, setParams] = useSearchParams();
  const domain = (BOSS_TABS as string[]).includes(params.get('domain') ?? '') ? (params.get('domain') as BossTab) : 'games';
  const [query, setQuery] = useState('');
  const records = useProgress((s) => s.bosses);

  // A search looks across every domain, so a franchise is found even from the wrong tab.
  const list = useMemo(() => {
    if (!query.trim()) return BOSSES.filter((b) => inTab(b, domain));
    return BOSSES.filter((b) => bestSearchScore(query, [b.franchise, b.boss.name, ...b.aliases]) !== null);
  }, [domain, query]);

  // A boss counts as defeated once beaten on any difficulty.
  const beaten = (id: string) => DIFFICULTY_IDS.some((d) => (records[bossKey(id, d)]?.wins ?? 0) > 0);
  const totalWins = BOSSES.filter((b) => beaten(b.id)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">A trial in three phases</p>
          <h1 className="text-5xl font-bold">Boss Battle</h1>
          <p className="max-w-xl text-ink-soft">
            Choose a franchise and face its guardian. Each phase you win breaks a third of its life — each one you lose costs you a heart.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RulesButton tab="boss" label="Rules" />
          <span className="rounded-full border border-rule-strong px-3 py-1 font-display text-sm font-semibold tracking-wider text-ink-soft">
            {totalWins}/{BOSSES.length} bosses defeated
          </span>
        </div>
      </div>

      <div className="page space-y-4 rounded-md p-5">
        <div>
          <p className="mb-2 font-display text-xs uppercase tracking-widest text-ink-faint">I · Domain</p>
          <div className="flex flex-wrap gap-2">
            {BOSS_TABS.map((id) => {
              const d = id === 'other' ? { label: 'Other', tone: 'text-ink-soft' } : domainInfo(id);
              const active = domain === id && !query;
              return (
                <button
                  key={id}
                  type="button"
                  className={chip(active)}
                  onClick={() => {
                    setQuery('');
                    setParams({ domain: id }, { replace: true });
                  }}
                >
                  <Glyph seed={id} size={16} className={active ? '' : d.tone} /> {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 font-display text-xs uppercase tracking-widest text-ink-faint">II · Franchise</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a franchise or boss…"
            className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-base outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-center font-serif text-lg italic text-ink-soft">No guardian answers to that name… yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => {
            const per = DIFFICULTY_IDS.map((d) => ({ d, r: records[bossKey(b.id, d)] ?? EMPTY_BOSS_RECORD }));
            const plays = per.reduce((n, x) => n + x.r.plays, 0);
            const bestScore = Math.max(...per.map((x) => x.r.bestScore));
            return (
              <li key={b.id}>
                <Link
                  to={`/boss/${b.id}`}
                  className="page group relative flex h-full items-center gap-4 rounded-md p-4 transition hover:-translate-y-0.5"
                >
                  <span
                    className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 bg-tile shadow-md transition group-hover:scale-105"
                    style={{ borderColor: b.boss.color }}
                  >
                    {b.boss.image && <img src={b.boss.image} alt="" loading="lazy" className="size-full object-cover object-top" />}
                    {beaten(b.id) && (
                      <span className="absolute inset-0 grid place-items-center bg-black/45 font-display text-xs font-bold tracking-widest text-white">
                        SLAIN
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[11px] uppercase tracking-widest text-ink-faint">{domainInfo(b.domain).label}</span>
                    <span className="block truncate font-display text-lg font-bold leading-tight">{b.franchise}</span>
                    <span className="block truncate font-serif text-base italic text-ink-soft">
                      {b.boss.name}, {b.boss.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                      {/* One mark per difficulty, filled once that difficulty is beaten. */}
                      {per.map(({ d, r }) => (
                        <span
                          key={d}
                          title={`${DIFFICULTIES[d].label}: ${r.plays ? `${r.wins}/${r.plays} won${r.bestTime != null ? `, best ${formatTime(r.bestTime)}` : ''}` : 'not played'}`}
                          className={`grid size-5 place-items-center rounded-sm border font-display text-[10px] font-bold ${
                            r.wins ? 'border-hit bg-hit text-on-strong' : 'border-rule-strong text-ink-faint'
                          }`}
                        >
                          {DIFFICULTIES[d].label[0]}
                        </span>
                      ))}
                      <span className="ml-1">{plays === 0 ? 'Unchallenged' : `best ${bestScore} pts`}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
