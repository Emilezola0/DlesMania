import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  return `rounded-xl border px-3 py-2 text-sm font-semibold transition ${
    disabled
      ? 'cursor-not-allowed border-zinc-900 text-zinc-700'
      : active
        ? 'border-indigo-500 bg-indigo-500/20 text-white'
        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
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
          <h1 className="text-3xl font-black tracking-tight">Free Play</h1>
          <p className="text-zinc-400">Pick a domain and a mini-game, then play as many rounds as you like.</p>
        </div>
        <div className="flex gap-2">
          <Pill>🎯 {freePlay.played} played</Pill>
          <Pill>✅ {freePlay.played ? Math.round((freePlay.won / freePlay.played) * 100) : 0}% won</Pill>
          <Pill>⭐ {freePlay.points} pts</Pill>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Domain</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(domain === 'all')} onClick={() => update('domain', 'all')}>
              🌐 All
            </button>
            {DOMAINS.map((x) => (
              <button key={x.id} type="button" className={chip(domain === x.id)} onClick={() => update('domain', x.id)}>
                {x.icon} {x.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Mini-game</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(type === 'random')} onClick={() => update('type', 'random')}>
              🎲 Random
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
                  {GAME_META[t].icon} {GAME_META[t].name}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={start} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 py-3 font-bold transition hover:brightness-110">
          {spec ? 'New round' : 'Start playing'}
        </button>
      </div>

      {spec && (
        <section className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Round {round}</p>
              <h2 className="text-2xl font-bold">
                {GAME_META[spec.type].icon} {GAME_META[spec.type].name}
              </h2>
              <p className="text-sm text-zinc-400">{GAME_META[spec.type].tagline}</p>
            </div>
            <Pill>{spec.domain === 'mixed' ? '🌐 All domains' : `${domainInfo(spec.domain).icon} ${domainInfo(spec.domain).label}`}</Pill>
          </div>
          <GameHost key={round} spec={spec} record={record} onChange={onChange} />
          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button type="button" onClick={start} className="rounded-xl bg-white px-6 py-3 font-bold text-zinc-900 hover:bg-zinc-200">
                Next round →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
