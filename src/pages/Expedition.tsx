import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '../boss/BossHeader';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { ALL_MEDIA, MEDIA, challengesFor } from '../rogue/pools';
import { BossRoom, HigherLowerRoom, Name5Room, OddRoom, PortraitRoom, SortRoom, WhoAmIRoom, type RoomResult } from '../rogue/Rooms';
import {
  ACTS,
  CHALLENGE_INFO,
  NODE_INFO,
  RELICS,
  ROWS,
  goldFor,
  has,
  makeMap,
  mediaOf,
  modsFor,
  newRun,
  reachable,
  relicOffer,
  runScore,
  takeRelic,
  type ChallengeKind,
  type MapNode,
  type RelicId,
  type RunState,
} from '../rogue/run';
import { useProgress } from '../store/progress';
import type { Domain } from '../types';

const ROOMS: Record<ChallengeKind, typeof PortraitRoom> = {
  portrait: PortraitRoom,
  higherlower: HigherLowerRoom,
  odd: OddRoom,
  whoami: WhoAmIRoom,
  sort: SortRoom,
  name5: Name5Room,
};
const pickKind = (kinds: ChallengeKind[]) => kinds[Math.floor(Math.random() * kinds.length)];
const HEART_PRICE = 30;
const REST_GOLD = 20;
const MEDIA_KEY = 'omnidle:expedition:media';

/** Each mix of kinds of work keeps its own best ("mixed": all of them, as before the choice existed). */
const bestKey = (media: Domain[]) => (ALL_MEDIA.every((m) => media.includes(m)) ? 'rogue:mixed' : `rogue:${[...media].sort().join('+')}`);

const mediaLabel = (media: Domain[]) =>
  ALL_MEDIA.every((m) => media.includes(m)) ? 'Everything' : MEDIA.filter((m) => media.includes(m.id)).map((m) => `${m.icon} ${m.label}`).join(' + ');

function savedMedia(): Domain[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEDIA_KEY) ?? 'null');
    if (Array.isArray(v)) {
      const ok = ALL_MEDIA.filter((m) => v.includes(m));
      if (ok.length) return ok;
    }
  } catch {
    // No storage: everything.
  }
  return ALL_MEDIA;
}

/** The kinds of work to set out with: any mix of them, never none. */
function MediaPicker({ media, onChange }: { media: Domain[]; onChange: (m: Domain[]) => void }) {
  const toggle = (id: Domain) => {
    const next = media.includes(id) ? media.filter((m) => m !== id) : ALL_MEDIA.filter((m) => m === id || media.includes(m));
    if (!next.length) return;
    sfx.click();
    onChange(next);
    try {
      localStorage.setItem(MEDIA_KEY, JSON.stringify(next));
    } catch {
      // Not remembered, that's all.
    }
  };
  return (
    <div className="space-y-2">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Made of</p>
      <div className="flex flex-wrap gap-2">
        {MEDIA.map((m) => {
          const on = media.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(m.id)}
              className={`rounded-full border-2 px-4 py-2 font-display font-bold transition ${on ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`}
            >
              {m.icon} {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What's on screen besides the map. */
type Screen =
  | { kind: 'map' }
  | { kind: 'room'; node: MapNode; challenge: ChallengeKind | 'boss'; elite: boolean; gamble?: boolean }
  | { kind: 'reward'; offer: RelicId[]; text: string }
  | { kind: 'shop'; offer: RelicId[] }
  | { kind: 'rest' }
  | { kind: 'event'; node: MapNode };

function Hud({ run }: { run: RunState }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule-strong bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: run.maxHearts }, (_, i) => (
          <HeartIcon key={i} full={i < run.hearts} className="size-5" />
        ))}
      </div>
      <p className="font-display text-sm font-bold">🪙 {run.gold}</p>
      <p className="font-display text-sm text-ink-soft">
        Act {run.act}/{ACTS} · {run.cleared} won
      </p>
      <div className="flex gap-1">
        {run.relics.map((r) => (
          <span key={r} title={`${RELICS[r].name}: ${RELICS[r].blurb}`} className="cursor-help text-xl">
            {RELICS[r].icon}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The act's map, first row at the top and the boss at the bottom; the rooms within reach glow. */
function RunMap({ run, onEnter }: { run: RunState; onEnter: (n: MapNode) => void }) {
  const open = new Set(reachable(run).map((n) => n.id));
  const rowH = 74;
  const height = (ROWS + 1) * rowH;
  const width = (row: number) => run.map.filter((n) => n.row === row).length;
  const pos = (n: MapNode) => ({ x: ((n.col + 0.5) / width(n.row)) * 100, y: n.row * rowH + rowH / 2 });
  const byId = new Map(run.map.map((n) => [n.id, n]));
  return (
    <div className="relative mx-auto w-full max-w-md" style={{ height }}>
      <svg className="absolute inset-0 size-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        {run.map.flatMap((n) =>
          n.next.map((id) => {
            const a = pos(n);
            const b = pos(byId.get(id)!);
            return <line key={`${n.id}-${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.6} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />;
          }),
        )}
      </svg>
      {run.map.map((n) => {
        const { x, y } = pos(n);
        const isOpen = open.has(n.id);
        const here = run.at === n.id;
        const icon = n.challenge ? CHALLENGE_INFO[n.challenge].icon : NODE_INFO[n.kind].icon;
        const name = n.kind === 'fight' ? CHALLENGE_INFO[n.challenge!].name : n.kind === 'elite' ? `Elite · ${CHALLENGE_INFO[n.challenge!].name}` : NODE_INFO[n.kind].name;
        return (
          <button
            key={n.id}
            type="button"
            disabled={!isOpen}
            onClick={() => onEnter(n)}
            title={name}
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition ${n.kind === 'boss' ? 'size-16 text-3xl' : 'size-12 text-xl'} ${
              here ? 'border-ink bg-ink text-paper' : isOpen ? 'animate-pulse border-accent bg-card shadow-lg hover:scale-110' : 'border-rule bg-card/70 opacity-60'
            } ${n.kind === 'elite' ? 'ring-2 ring-coral/60' : ''}`}
            style={{ left: `${x}%`, top: y }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

/** /expedition */
export default function Expedition() {
  const run = useProgress((s) => s.rogueRun);
  const setRun = useProgress((s) => s.setRogueRun);
  const [media, setMedia] = useState<Domain[]>(savedMedia);
  const bests = useProgress((s) => s.bests);
  const best = bests[bestKey(run ? mediaOf(run) : media)] ?? 0;
  const recordBest = useProgress((s) => s.recordBest);
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });
  const save = (r: RunState) => setRun({ ...r, log: r.log.slice(-6) });

  const finish = (r: RunState, won: boolean) => {
    const done = { ...r, over: true, won };
    save(done);
    recordBest(bestKey(mediaOf(done)), runScore(done));
    if (won) window.setTimeout(() => (sfx.streak(), celebrateBig()), 300);
    setScreen({ kind: 'map' });
  };

  const enter = (n: MapNode) => {
    if (!run) return;
    sfx.click();
    // Standing on the room from the moment it's entered: leaving the page doesn't skip it for free.
    const r = { ...run, at: n.id };
    save(r);
    if (n.kind === 'fight' || n.kind === 'elite') setScreen({ kind: 'room', node: n, challenge: n.challenge!, elite: n.kind === 'elite' });
    else if (n.kind === 'boss') setScreen({ kind: 'room', node: n, challenge: 'boss', elite: false });
    else if (n.kind === 'shop') setScreen({ kind: 'shop', offer: relicOffer(r) });
    else if (n.kind === 'rest') setScreen({ kind: 'rest' });
    else setScreen({ kind: 'event', node: n });
  };

  const roomDone = (res: RoomResult) => {
    if (!run || screen.kind !== 'room') return;
    const { node, elite, gamble } = screen;
    let r: RunState = { ...run };
    if (res.won) {
      sfx.hit();
      const gold = goldFor(r, node.kind === 'boss' ? 'boss' : elite ? 'elite' : 'fight', res.perfect);
      r = { ...r, gold: r.gold + gold, cleared: r.cleared + 1, log: [...r.log, `✓ ${res.note} (+${gold} 🪙)`] };
      if (node.kind === 'boss') {
        if (has(r, 'bandage')) r.hearts = Math.min(r.maxHearts, r.hearts + 1);
        if (r.act >= ACTS) return finish(r, true);
        r = { ...r, act: r.act + 1, map: makeMap(r.act + 1, r.seed, mediaOf(r)), at: null };
        save(r);
        return setScreen({ kind: 'reward', offer: relicOffer(r), text: `Act ${r.act - 1} cleared! Take a relic for the road.` });
      }
      save(r);
      if (elite || gamble) return setScreen({ kind: 'reward', offer: relicOffer(r), text: gamble ? 'The gamble paid off.' : 'Elite beaten: a relic of your choice.' });
      return setScreen({ kind: 'map' });
    }
    sfx.hurt();
    shake(document.querySelector('main'), 10, 400);
    const cost = node.kind === 'boss' ? 2 : 1;
    r = { ...r, hearts: r.hearts - cost, log: [...r.log, `✗ ${res.note} (−${cost} ❤)`] };
    if (r.hearts <= 0) return finish(r, false);
    save(r);
    // A boss has to be beaten: the act's last room comes back.
    if (node.kind === 'boss') return setScreen({ kind: 'room', node, challenge: 'boss', elite: false });
    setScreen({ kind: 'map' });
  };

  const takeReward = (relic: RelicId | null) => {
    if (!run) return;
    if (relic) sfx.correct();
    save(relic ? takeRelic(run, relic) : run);
    setScreen({ kind: 'map' });
  };

  // ── Start ─────────────────────────────────────────────────────────────
  if (!run) {
    return (
      <div className="space-y-8">
        <div>
          <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Games
          </Link>
          <h1 className="text-5xl font-bold">Expedition</h1>
          <p className="max-w-2xl text-ink-soft">
            A run through {ACTS} acts of rooms, each a short challenge from the other games: blurred portraits, Higher or Lower, Odd One Out, Who Am
            I?, Quick Sort, lists to name — and a guardian at the end of each act. Choose your path; win rooms for gold, beat elites for relics,
            spend it all at shops. A lost room costs a heart; lose them all and the expedition ends.
          </p>
        </div>
        <MediaPicker media={media} onChange={setMedia} />
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => (sfx.click(), setRun(newRun(media)), setScreen({ kind: 'map' }))} className="btn-ink rounded-md px-8 py-3.5 font-display text-lg font-bold tracking-widest">
            Set out
          </button>
          {best > 0 && <p className="text-ink-soft">Best expedition ({mediaLabel(media)}): {best} points</p>}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(RELICS) as RelicId[]).map((r) => (
            <li key={r} className="flex items-center gap-3 rounded-md border border-rule bg-card p-2.5 text-sm">
              <span className="text-2xl">{RELICS[r].icon}</span>
              <span>
                <span className="font-semibold">{RELICS[r].name}</span> — {RELICS[r].blurb}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── The end ───────────────────────────────────────────────────────────
  if (run.over) {
    const score = runScore(run);
    return (
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">{run.won ? 'Expedition complete' : 'The expedition ends here'}</p>
        <p className="font-serif text-7xl font-bold">{score}</p>
        <p className="text-ink-soft">
          {mediaLabel(mediaOf(run))} · {run.cleared} rooms won · {run.gold} gold · act {run.act} · {score >= best ? '★ Best expedition' : `best ${best}`}
        </p>
        <div className="flex justify-center gap-1 text-2xl">{run.relics.map((r) => RELICS[r].icon)}</div>
        <ul className="space-y-1 text-sm text-ink-soft">
          {run.log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => (sfx.click(), setRun(newRun(mediaOf(run))), setScreen({ kind: 'map' }))} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            New expedition
          </button>
          <button type="button" onClick={() => setRun(null)} className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── In a run ─────────────────────────────────────────────────────────
  const Room = screen.kind === 'room' && screen.challenge !== 'boss' ? ROOMS[screen.challenge] : null;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Expedition</p>
        {screen.kind === 'map' && (
          <button type="button" onClick={() => window.confirm('Abandon this expedition?') && finish(run, false)} className="text-xs font-semibold text-ink-faint hover:text-coral">
            Abandon
          </button>
        )}
      </div>
      <Hud run={run} />

      {screen.kind === 'map' && (
        <>
          <p className="text-center font-serif text-lg italic text-ink-soft">{run.at ? 'Choose the next room.' : `Act ${run.act}: choose where to begin.`}</p>
          {run.log.length > 0 && <p className="text-center text-sm text-ink-soft">{run.log.at(-1)}</p>}
          <RunMap run={run} onEnter={enter} />
        </>
      )}

      {screen.kind === 'room' && (
        <section key={screen.node.id + run.hearts} className="page animate-round-in rounded-md p-4 sm:p-6">
          <p className="mb-3 text-center font-display text-sm font-bold uppercase tracking-widest text-coral">
            {screen.challenge === 'boss' ? '👑 Boss' : screen.gamble ? '❓ Gamble' : screen.elite ? '💀 Elite' : '⚔️ Challenge'}
          </p>
          {Room ? <Room mods={modsFor(run, screen.elite)} onDone={roomDone} /> : <BossRoom act={run.act} media={mediaOf(run)} onDone={roomDone} />}
        </section>
      )}

      {screen.kind === 'reward' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">{screen.text}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {screen.offer.map((r) => (
              <button key={r} type="button" onClick={() => takeReward(r)} className="flex flex-col items-center gap-1 rounded-md border border-rule-strong bg-card p-3 transition hover:-translate-y-0.5 hover:border-ink">
                <span className="text-3xl">{RELICS[r].icon}</span>
                <span className="font-display font-bold">{RELICS[r].name}</span>
                <span className="text-xs text-ink-soft">{RELICS[r].blurb}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => takeReward(null)} className="text-sm font-semibold text-ink-soft hover:text-ink">
            Skip
          </button>
        </section>
      )}

      {screen.kind === 'shop' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">🛒 A travelling merchant</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {screen.offer.map((r) => {
              const owned = has(run, r);
              const afford = run.gold >= RELICS[r].price;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={owned || !afford}
                  onClick={() => (sfx.correct(), save(takeRelic({ ...run, gold: run.gold - RELICS[r].price }, r)))}
                  className="flex flex-col items-center gap-1 rounded-md border border-rule-strong bg-card p-3 transition enabled:hover:-translate-y-0.5 enabled:hover:border-ink disabled:opacity-45"
                >
                  <span className="text-3xl">{RELICS[r].icon}</span>
                  <span className="font-display font-bold">{RELICS[r].name}</span>
                  <span className="text-xs text-ink-soft">{RELICS[r].blurb}</span>
                  <span className="font-display text-sm font-bold">{owned ? 'Bought' : `🪙 ${RELICS[r].price}`}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={run.gold < HEART_PRICE || run.hearts >= run.maxHearts}
            onClick={() => (sfx.correct(), save({ ...run, gold: run.gold - HEART_PRICE, hearts: run.hearts + 1 }))}
            className="btn-paper rounded-md px-4 py-2 font-display text-sm font-semibold disabled:opacity-45"
          >
            ❤ A heart back — 🪙 {HEART_PRICE}
          </button>
          <div>
            <button type="button" onClick={() => setScreen({ kind: 'map' })} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Move on
            </button>
          </div>
        </section>
      )}

      {screen.kind === 'rest' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">🔥 A campfire</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={run.hearts >= run.maxHearts}
              onClick={() => (sfx.correct(), save({ ...run, hearts: run.hearts + 1 }), setScreen({ kind: 'map' }))}
              className="btn-ink rounded-md px-5 py-3 font-display font-bold disabled:opacity-45"
            >
              Rest: ❤ +1
            </button>
            <button type="button" onClick={() => (sfx.correct(), save({ ...run, gold: run.gold + REST_GOLD }), setScreen({ kind: 'map' }))} className="btn-paper rounded-md px-5 py-3 font-display font-bold">
              Search the camp: 🪙 +{REST_GOLD}
            </button>
          </div>
        </section>
      )}

      {screen.kind === 'event' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">❓ A stranger&apos;s wager</p>
          <p className="text-ink-soft">“Beat an elite challenge of my choosing and a relic is yours. Fail, and it costs you a heart.”</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setScreen({ kind: 'room', node: screen.node, challenge: pickKind(challengesFor(mediaOf(run))), elite: true, gamble: true })}
              className="btn-ink rounded-md px-5 py-3 font-display font-bold"
            >
              Accept
            </button>
            <button type="button" onClick={() => setScreen({ kind: 'map' })} className="btn-paper rounded-md px-5 py-3 font-display font-bold">
              Walk away
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
