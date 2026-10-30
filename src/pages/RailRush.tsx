import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RAIL_DIFFICULTY, RailRun, type RailDifficulty } from '../rail/RailRun';
import { RAIL_LINES, type RailLine } from '../rail/rosters';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { Customise, useCustomPicks } from '../components/Customise';

const RAIL_OPTIONS = RAIL_LINES.map((l) => ({ key: l.id, label: `${l.icon} ${l.label}` }));

/** "Your mix" (Customise): one line made of the picked lines' characters and stations, in the first one's colours. */
function mixLine(picks: string[]): RailLine {
  const lines = RAIL_LINES.filter((l) => picks.includes(l.id));
  return { id: 'custom', label: 'Your mix', icon: '🎛', palette: lines[0].palette, stations: lines.flatMap((l) => l.stations), characters: lines.flatMap((l) => l.characters) };
}

/** /rail-rush: pick a line (a game), a difficulty, and ride as far as you can. */
export default function RailRush() {
  const bests = useProgress((s) => s.bests);
  const [line, setLine] = useState<RailLine | null>(null);
  const [difficulty, setDifficulty] = useState<RailDifficulty>('normal');
  const [riding, setRiding] = useState(false);
  const { picks, setPicks } = useCustomPicks('omnidle-custom-rail', RAIL_OPTIONS);

  if (line && riding) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-end justify-between">
          <button type="button" onClick={() => setRiding(false)} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Rail Rush
          </button>
          <p className="font-display text-sm text-ink-soft">
            {line.icon} {line.label} · {RAIL_DIFFICULTY[difficulty].label}
          </p>
        </div>
        <RailRun key={`${line.id}-${difficulty}`} line={line} difficulty={difficulty} onExit={() => setRiding(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Rail Rush</h1>
        <p className="max-w-2xl text-ink-soft">
          Your train runs on three tracks, faster and faster. Barricades block some of them, and above each track hangs a character&apos;s sign:
          type the name of a character on a <span className="font-semibold text-hit">free</span> track to switch to it. A crash costs a wagon;
          lose them all and it&apos;s the end of the line.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">1 · Pick a line</h2>
        <Customise options={RAIL_OPTIONS} picks={picks} onChange={setPicks} noun="line" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {picks.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => (sfx.click(), setLine(mixLine(picks)))}
                className={`flex h-full w-full flex-col items-start gap-1 rounded-md border-2 bg-card p-4 text-left ring-2 ring-coral/60 transition hover:-translate-y-0.5 ${line?.id === 'custom' ? 'border-ink' : 'border-transparent'}`}
              >
                <span className="text-3xl">🎛</span>
                <span className="font-display text-lg font-bold">Your mix</span>
                <span className="text-xs text-ink-faint">
                  {picks.length} line{picks.length === 1 ? '' : 's'}
                  {Math.max(0, ...Object.keys(RAIL_DIFFICULTY).map((k) => bests[`rail:custom:${k}`] ?? 0)) ? ` · best ${Math.max(0, ...Object.keys(RAIL_DIFFICULTY).map((k) => bests[`rail:custom:${k}`] ?? 0))} gates` : ''}
                </span>
              </button>
            </li>
          )}
          {RAIL_LINES.map((l) => {
            const best = Math.max(0, ...Object.keys(RAIL_DIFFICULTY).map((k) => bests[`rail:${l.id}:${k}`] ?? 0));
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => (sfx.click(), setLine(l))}
                  className={`flex h-full w-full flex-col items-start gap-1 overflow-hidden rounded-md border-2 p-4 text-left transition hover:-translate-y-0.5 ${line?.id === l.id ? 'border-ink' : 'border-transparent'}`}
                  style={{ background: `linear-gradient(160deg, ${l.palette[0]}, ${l.palette[1]})` }}
                >
                  <span className="text-3xl">{l.icon}</span>
                  <span className="font-display text-lg font-bold text-white drop-shadow">{l.label}</span>
                  <span className="text-xs text-white/80 drop-shadow">
                    {l.characters.length} characters{best ? ` · best ${best} gates` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">2 · Difficulty</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(RAIL_DIFFICULTY) as RailDifficulty[]).map((k) => {
            const d = RAIL_DIFFICULTY[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => (sfx.click(), setDifficulty(k))}
                className={`rounded-md border p-4 text-left transition ${difficulty === k ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card hover:bg-tile'}`}
              >
                <p className="font-display text-lg font-bold">
                  {d.label} <span className="ml-1 text-sm">{'🚃'.repeat(d.wagons)}</span>
                </p>
                <p className={`text-sm ${difficulty === k ? 'text-paper/80' : 'text-ink-soft'}`}>{d.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          disabled={!line}
          onClick={() => (sfx.click(), setRiding(true))}
          className="btn-ink rounded-md px-8 py-3.5 font-display text-lg font-bold tracking-widest disabled:opacity-40"
        >
          {line ? `All aboard — ${line.label}` : 'Pick a line first'}
        </button>
      </div>
    </div>
  );
}
