import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Glyph } from '../components/Glyph';
import { domainInfo } from '../data';
import { BOSS_DOMAINS, BOSSES } from '../data/bosses';
import { formatTime } from '../lib/boss';
import { normalize } from '../lib/text';
import { EMPTY_BOSS_RECORD, useProgress } from '../store/progress';
import type { Domain } from '../types';

function chip(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition ${
    active ? 'border-ink bg-ink text-paper' : 'border-rule bg-card text-ink-soft hover:border-rule-strong'
  }`;
}

/** Step 1: pick a domain. Step 2: pick a franchise (searchable). */
export default function BossSelect() {
  const [params, setParams] = useSearchParams();
  const domain = (BOSS_DOMAINS as string[]).includes(params.get('domain') ?? '') ? (params.get('domain') as Domain) : 'games';
  const [query, setQuery] = useState('');
  const records = useProgress((s) => s.bosses);

  // A search looks across every domain, so a franchise is found even from the wrong tab.
  const list = useMemo(() => {
    const q = normalize(query);
    if (!q) return BOSSES.filter((b) => b.domain === domain);
    return BOSSES.filter((b) => [b.franchise, b.boss.name, ...b.aliases].some((s) => normalize(s).includes(q)));
  }, [domain, query]);

  const totalWins = Object.values(records).filter((r) => r.wins > 0).length;

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
        <span className="rounded-full border border-rule-strong px-3 py-1 font-display text-sm font-semibold tracking-wider text-ink-soft">
          {totalWins}/{BOSSES.length} bosses defeated
        </span>
      </div>

      <div className="page space-y-4 rounded-md p-5">
        <div>
          <p className="mb-2 font-display text-xs uppercase tracking-widest text-ink-faint">I · Domain</p>
          <div className="flex flex-wrap gap-2">
            {BOSS_DOMAINS.map((id) => {
              const d = domainInfo(id);
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
            const r = records[b.id] ?? EMPTY_BOSS_RECORD;
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
                    {r.wins > 0 && (
                      <span className="absolute inset-0 grid place-items-center bg-ink/45 font-display text-xs font-bold tracking-widest text-on-strong">
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
                    <span className="mt-1 block text-xs text-ink-faint">
                      {r.plays === 0
                        ? 'Unchallenged'
                        : `${r.wins}/${r.plays} won${r.bestTime != null ? ` · best ${formatTime(r.bestTime)}` : ''} · ${r.bestScore} pts`}
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
