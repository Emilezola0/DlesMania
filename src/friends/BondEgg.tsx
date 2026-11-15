// Friends → Bond → Bond Egg (src/friends/bondGames.ts): an egg the two of you raise. Each day each does one thing for
// it; two different things the same day are teamwork (a Bond point). After EGG.days days you both tended it, it
// hatches into a creature shaped by how you raised it (more points). Then keep the pet alive together: each day it
// needs one thing from each of you, and each of you sees only what it needs from the OTHER, so tell each other. A
// happy day gives more points than the egg did; at 0 hearts it's gone, and a new egg can be laid.
import { useEffect, useId, useRef } from 'react';
import type { BondDoc } from '../cloud/bonds';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { todayKey } from '../lib/date';
import { ACTION_BY_ID, EGG, EGG_ACTIONS, eggStage, PET, PET_ACTION_BY_ID, PET_ACTIONS, petLife, petNeed, petOf, type Egg, type EggStat } from './bondGames';

const STAT_COLOR: Record<EggStat, string> = { str: '#f97316', joy: '#facc15', wit: '#818cf8', calm: '#f0abfc' };
const STAT_NAME: Record<EggStat, string> = { str: 'Strength', joy: 'Joy', wit: 'Wits', calm: 'Calm' };

type Friend = { uid: string; name: string };

export function BondEgg({ d, me, friend, busy, onLay, onTend, onCare, onTell }: { d: BondDoc; me: string; friend: Friend; busy: boolean; onLay: () => void; onTend: (action: string) => void; onCare: (action: string) => void; onTell: () => void }) {
  const e = d.egg ?? null;
  const today = todayKey();
  const pets = d.pets ?? [];
  const bond = `${d.a}_${d.b}`;
  // Hatching: a celebration, once.
  const cheered = useRef<string | null>(e?.hatched ? e.born : null);
  useEffect(() => {
    if (e?.hatched && cheered.current !== e.born) {
      cheered.current = e.born;
      sfx.victory();
      celebrateBig();
    }
  }, [e?.hatched, e?.born]);

  const mine = e?.acts[`${today}_${me}`];
  const theirs = e?.acts[`${today}_${friend.uid}`];
  const max = Math.max(6, ...Object.values(e?.stats ?? { a: 0 }));
  const life = e?.hatched ? petLife(e, bond, me, friend.uid, today) : null;
  return (
    <div className="space-y-3 rounded-md border border-rule bg-card/60 p-3">
      <p className="font-display font-bold">
        🥚 Bond Egg{' '}
        <span className="text-xs font-semibold text-ink-soft">
          · teamwork +{EGG.pair} · hatching +{EGG.hatch} · a happy pet +{PET.points} a day
        </span>
      </p>
      {!e ? (
        <>
          <p className="text-sm text-ink-soft">Raise an egg together: each day each of you does one thing for it. Do different things the same day for teamwork. After {EGG.days} days you both tended it, it hatches into a creature shaped by how you raised it, and then you keep it alive together.</p>
          <button type="button" disabled={busy} onClick={() => (sfx.select(), onLay())} className="btn-accent mx-auto block rounded-md px-4 py-1.5 text-sm font-bold disabled:opacity-50">
            🥚 Lay an egg
          </button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <EggArt egg={e} dead={!!life?.dead} />
          <div className="min-w-0 flex-1 space-y-2">
            {e.hatched && life ? (
              <PetCare egg={e} life={life} bond={bond} me={me} friend={friend} busy={busy} onCare={onCare} onTell={onTell} onLay={onLay} />
            ) : (
              <>
                <p className="text-sm">
                  <b>
                    Day {e.days} / {EGG.days}
                  </b>{' '}
                  <span className="text-ink-soft">
                    · today: you {mine ? ACTION_BY_ID.get(mine)?.icon : '·'} · {friend.name} {theirs ? ACTION_BY_ID.get(theirs)?.icon : '·'}
                  </span>
                </p>
                <div className="space-y-1">
                  {(Object.keys(STAT_NAME) as EggStat[]).map((k) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 font-semibold">{STAT_NAME[k]}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-tile">
                        <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${(e.stats[k] / max) * 100}%`, background: STAT_COLOR[k] }} />
                      </span>
                      <span className="w-6 text-right tabular-nums text-ink-soft">{e.stats[k]}</span>
                    </div>
                  ))}
                </div>
                {mine ? (
                  <p className="text-xs text-ink-soft">{theirs ? (theirs !== mine ? '🤝 Teamwork today: +1 point!' : 'You both did the same today: no teamwork point, but it grew.') : `Done for today. When ${friend.name} tends it too, the day counts.`}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tend the egg">
                    {EGG_ACTIONS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        disabled={busy}
                        onClick={() => (sfx.select(), onTend(a.id))}
                        title={theirs && theirs !== a.id ? 'Teamwork: +1 point' : undefined}
                        className={`rounded-md border px-2.5 py-1 text-sm font-semibold transition hover:bg-tile disabled:opacity-50 ${theirs && theirs !== a.id ? 'border-accent' : 'border-rule'}`}
                      >
                        {a.icon} {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {pets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-ink-faint">Past pets</span>
          {pets.map((p, k) => {
            const pet = petOf(p);
            const l = p.hatched ? petLife(p, bond, me, friend.uid, today) : null;
            return (
              <span
                key={k}
                title={`${pet.name}, hatched from the egg of ${p.born}${l ? `: lived ${l.lived} day${l.lived === 1 ? '' : 's'}, ${l.happy} happy` : ''}`}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5"
                style={{ borderColor: pet.color }}
              >
                <span className="text-base leading-none">{pet.icon}</span> {pet.name}
                {!!l?.lived && <span className="text-ink-faint">· {l.lived}d</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** The pet, once hatched: its hearts, what it needs from your friend today (only you see it: tell them), what they told
 *  you it needs from you, and your care for today. At 0 hearts it's gone: lay a new egg. */
function PetCare({ egg, life, bond, me, friend, busy, onCare, onTell, onLay }: { egg: Egg; life: ReturnType<typeof petLife>; bond: string; me: string; friend: Friend; busy: boolean; onCare: (a: string) => void; onTell: () => void; onLay: () => void }) {
  const today = todayKey();
  const pet = petOf(egg);
  const care = egg.care ?? {};
  const told = egg.told ?? {};
  const mine = care[`${today}_${me}`];
  const theirs = care[`${today}_${friend.uid}`];
  const theirNeed = PET_ACTION_BY_ID.get(petNeed(bond, egg.born, today, friend.uid))!;
  const toldMe = PET_ACTION_BY_ID.get(told[`${today}_${friend.uid}`] ?? '');
  const iTold = !!told[`${today}_${me}`];
  if (life.dead)
    return (
      <div className="space-y-2">
        <p className="font-display text-lg font-bold text-ink-soft">🪦 {pet.name} is gone…</p>
        <p className="text-sm text-ink-soft">
          It lived {plural(life.lived, 'day')} ({life.happy} happy). Each day it needed one thing from each of you, and only the other could see it: talk to each other next time!
        </p>
        <button type="button" disabled={busy} onClick={() => (sfx.select(), onLay())} className="btn-accent rounded-md px-4 py-1.5 text-sm font-bold disabled:opacity-50">
          🥚 Lay a new egg
        </button>
      </div>
    );
  const happyToday = mine && theirs ? mine === petNeed(bond, egg.born, today, me) && theirs === theirNeed.id : null;
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-2 font-display text-lg font-bold" style={{ color: pet.color }}>
        {pet.name}
        <span className="text-base tracking-tight" role="img" aria-label={`${life.hearts} of ${PET.max} hearts`}>
          {Array.from({ length: PET.max }, (_, k) => (k < life.hearts ? '❤️' : '🤍')).join('')}
        </span>
      </p>
      <p className="text-xs text-ink-soft">
        {pet.blurb} Lived {plural(life.lived, 'day')}, {life.happy} happy.
        {life.last && life.last.day !== today && (
          <>
            {' '}
            Last time: you {life.last.mine ? '✓' : '✗'} · {friend.name} {life.last.theirs ? '✓' : '✗'}.
          </>
        )}
      </p>
      {/* What it needs from your friend today: only you can see it. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-accent/60 bg-accent/5 px-2.5 py-1.5 text-sm">
        <span>
          👁️ It needs from <b>{friend.name}</b> today: <b>{theirNeed.icon} {theirNeed.label}</b>
        </span>
        {theirs ? (
          <span className="text-xs text-ink-soft">({friend.name} has done something.)</span>
        ) : iTold ? (
          <span className="text-xs font-semibold text-ink-soft">📣 Told ✓</span>
        ) : (
          <button type="button" disabled={busy} onClick={() => (sfx.select(), onTell())} className="btn-accent ml-auto rounded-md px-2.5 py-0.5 text-xs font-bold disabled:opacity-50">
            📣 Tell {friend.name}
          </button>
        )}
      </div>
      <p className="text-sm">
        {toldMe ? (
          <>
            📣 {friend.name} says it needs from you:{' '}
            <b>
              {toldMe.icon} {toldMe.label}
            </b>
          </>
        ) : (
          <span className="text-ink-soft">Only {friend.name} can see what it needs from you today: ask them!</span>
        )}
      </p>
      {happyToday !== null ? (
        <p className={`text-sm font-bold ${happyToday ? 'text-hit' : 'text-coral'}`}>{happyToday ? `😊 A happy day: +1 heart, +${PET.points} points!` : '😢 Not what it needed today: it lost a heart.'}</p>
      ) : mine ? (
        <p className="text-xs text-ink-soft">
          You did: {PET_ACTION_BY_ID.get(mine)?.icon} {PET_ACTION_BY_ID.get(mine)?.label}. Waiting for {friend.name}: you'll see how it went once you've both done something today.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Take care of your pet">
          {PET_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy}
              onClick={() => (sfx.select(), onCare(a.id))}
              className={`rounded-md border px-2.5 py-1 text-sm font-semibold transition hover:bg-tile disabled:opacity-50 ${toldMe?.id === a.id ? 'border-accent' : 'border-rule'}`}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-ink-faint">
        Both do what it needs: +1 heart (up to {PET.max}) and +{PET.points} points. Each wrong or missed day: −1 heart. At 0 it's gone.
      </p>
    </div>
  );
}

/** The egg: its shell tinted by how it's being raised, wobbling, cracking as it nears hatching; hatched, the creature. */
function EggArt({ egg, dead = false }: { egg: Egg; dead?: boolean }) {
  const stage = eggStage(egg);
  const shell = 'egg' + useId().replace(/:/g, '');
  const ranked = (Object.keys(egg.stats) as EggStat[]).sort((a, b) => egg.stats[b] - egg.stats[a]);
  const total = Object.values(egg.stats).reduce((a, b) => a + b, 0);
  const c1 = total ? STAT_COLOR[ranked[0]] : '#fde68a';
  const c2 = total ? STAT_COLOR[ranked[1]] : '#fef3c7';
  if (stage === 3) {
    const pet = petOf(egg);
    if (dead)
      return (
        <div className="relative grid size-28 shrink-0 place-items-center">
          <span className="text-6xl leading-none opacity-40 grayscale">{pet.icon}</span>
          <span className="absolute bottom-1 right-2 text-3xl">🪦</span>
        </div>
      );
    return (
      <div className="bond-pet relative grid size-28 shrink-0 place-items-center" style={{ ['--pet' as string]: pet.color }}>
        <span className="bond-pet-glow absolute inset-0 rounded-full" aria-hidden />
        <span className="bond-pet-pop relative text-6xl leading-none">{pet.icon}</span>
        <svg viewBox="0 0 100 40" className="absolute -bottom-1 w-24" aria-hidden>
          <path d="M8 10 L20 2 L28 12 L38 4 L46 14 L50 30 Q30 40 10 30 Z" fill="#fef3c7" stroke="#d6c08a" />
          <path d="M92 10 L80 2 L72 12 L62 4 L54 14 L50 30 Q70 40 90 30 Z" fill="#fef3c7" stroke="#d6c08a" />
        </svg>
      </div>
    );
  }
  return (
    <svg viewBox="0 0 100 120" className={`bond-egg size-28 shrink-0 overflow-visible ${stage >= 2 ? 'bond-egg-near' : ''}`} aria-label={`An egg, ${egg.days} of ${EGG.days} days`}>
      <defs>
        <radialGradient id={shell} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fffdf5" />
          <stop offset="0.55" stopColor="#fef3c7" />
          <stop offset="1" stopColor={c1} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      {stage >= 2 && <ellipse cx="50" cy="66" rx="48" ry="54" fill={c1} opacity="0.35" className="bond-egg-aura" />}
      <path d="M50 6 C78 6 94 48 94 74 C94 100 74 116 50 116 C26 116 6 100 6 74 C6 48 22 6 50 6 Z" fill={`url(#${shell})`} stroke="#d6c08a" strokeWidth="1.5" />
      {/* Spots in the colours of what it's raised on. */}
      {[
        [32, 44, 7, c1],
        [64, 36, 5, c2],
        [70, 72, 8, c1],
        [36, 86, 6, c2],
        [54, 58, 4, c2],
      ].map(([x, y, r, c], k) => (
        <circle key={k} cx={x} cy={y} r={r} fill={c as string} opacity={total ? 0.75 : 0.35} />
      ))}
      {stage >= 1 && <path d="M28 52 L38 60 L33 68 L44 74" fill="none" stroke="#7c5e2a" strokeWidth="1.6" strokeLinecap="round" />}
      {stage >= 2 && <path d="M70 46 L60 56 L68 62 L58 72 L64 80" fill="none" stroke="#7c5e2a" strokeWidth="1.6" strokeLinecap="round" />}
      <ellipse cx="36" cy="30" rx="8" ry="12" fill="#fff" opacity="0.6" transform="rotate(-20 36 30)" />
    </svg>
  );
}
