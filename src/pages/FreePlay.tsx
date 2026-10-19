import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Glyph } from '../components/Glyph';
import { Pill } from '../components/Pill';
import { DOMAINS, domainInfo } from '../data';
import { GameHost } from '../games/GameHost';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { pick } from '../lib/rng';
import { buildRound, isAvailable } from '../lib/rounds';
import { useProgress } from '../store/progress';
import { EMPTY_RECORD, type Domain, type GameType, type RoundRecord, type RoundSpec } from '../types';

type DomainChoice = Domain | 'all';
type TypeChoice = GameType | 'random';

function chip(active: boolean, disabled = false) {
  return `inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition ${
    disabled
      ? 'cursor-not-allowed border-rule text-ink-faint/50'
      : active
        ? 'border-ink bg-ink text-paper'
        : 'border-rule bg-card text-ink-soft hover:border-rule-strong'
  }`;
}

export default function FreePlay() {
  const [params, setParams] = useSearchParams();
  const domain = (params.get('domain') as DomainChoice) || 'all';
  const type = (params.get('type') as TypeChoice) || 'random';
  const { freePlay, recordFreePlay } = useProgress();

  const [spec, setSpec] = useState<RoundSpec | null>(null);
  const [record, setRecord] = useState<RoundRecord>(EMPTY_RECORD);
  const [round, setRound] = useState(0);
  const recent = useRef<string[]>([]);

  const d = domain === 'all' ? undefined : domain;
  const playable = GAME_TYPES.filter((t) => isAvailable(t, d));

  const update = (key: 'domain' | 'type', value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
    setSpec(null);
  };

  const start = () => {
    const t = type === 'random' || !playable.includes(type) ? pick(playable, Math.random) : type;
    const s = buildRound(t, d, Math.random, new Set(recent.current));
    if (!s) return;
    if (s.targetId) recent.current = [s.targetId, ...recent.current].slice(0, 12);
    setSpec(s);
    setRecord(EMPTY_RECORD);
    setRound((r) => r + 1);
  };

  const onChange = (r: RoundRecord) => {
    setRecord(r);
    if (r.status !== 'playing') recordFreePlay(r);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl font-bold">Free Play</h1>
          <p className="text-ink-soft">Pick a domain and a mini-game, then play as many rounds as you like.</p>
        </div>
        <div className="flex gap-2">
          <Pill>{freePlay.played} played</Pill>
          <Pill>{freePlay.played ? Math.round((freePlay.won / freePlay.played) * 100) : 0}% won</Pill>
          <Pill>{freePlay.points} pts</Pill>
        </div>
      </div>

      <div className="page space-y-4 rounded-md p-5">
        <div>
          <p className="mb-2 text-xs font-display uppercase tracking-widest text-ink-faint">Domain</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(domain === 'all')} onClick={() => update('domain', 'all')}>
              <Glyph seed="all" size={16} /> All
            </button>
            {DOMAINS.map((x) => (
              <button key={x.id} type="button" className={chip(domain === x.id)} onClick={() => update('domain', x.id)}>
                <Glyph seed={x.id} size={16} className={domain === x.id ? '' : x.tone} /> {x.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-display uppercase tracking-widest text-ink-faint">Mini-game</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(type === 'random')} onClick={() => update('type', 'random')}>
              <Glyph seed="random" size={16} /> Random
            </button>
            {GAME_TYPES.map((t) => {
              const ok = playable.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!ok}
                  title={ok ? GAME_META[t].tagline : 'No content for this domain yet'}
                  className={chip(type === t, !ok)}
                  onClick={() => update('type', t)}
                >
                  <Glyph seed={t} size={16} /> {GAME_META[t].name}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={start} className="btn-accent w-full rounded-md py-3 font-display font-bold tracking-widest">
          {spec ? 'New round' : 'Start playing'}
        </button>
      </div>

      {spec && (
        <section className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-display uppercase tracking-widest text-ink-faint">Round {round}</p>
              <h2 className="flex items-center gap-2 text-3xl font-bold">
                <Glyph seed={spec.type} size={28} className="text-accent" /> {GAME_META[spec.type].name}
              </h2>
              <p className="text-sm text-ink-soft">{GAME_META[spec.type].tagline}</p>
            </div>
            <Pill>{spec.domain === 'mixed' ? 'All domains' : domainInfo(spec.domain).label}</Pill>
          </div>
          <GameHost key={round} spec={spec} record={record} onChange={onChange} />
          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button type="button" onClick={start} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
                Next round →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
