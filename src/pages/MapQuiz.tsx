import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import raw from '../data/maps.json';
import { celebrateBig } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** A place on a map: its position as a share of the picture's width and height, and how big it is. */
interface Place {
  name: string;
  x: number;
  y: number;
  /** Radius of the target, as a share of the width: a region is generous, a town tight. */
  r: number;
}

interface QuizMap {
  id: string;
  label: string;
  franchise: string;
  image: string;
  /** Width / height of the picture. */
  aspect: number;
  /** Pixel art: scaled without smoothing. */
  pixelated?: boolean;
  /** Positions placed by eye, not checked yet (fix them on the pin page). */
  estimated?: boolean;
  places: Place[];
}

const MAPS = raw as QuizMap[];
const ROUNDS = 8;
const EDITS_KEY = (id: string) => `omnidle:mapquiz:${id}`;

/** Places edited on the pin page win over the data file (kept in this browser until copied into src/data/maps.json). */
function placesOf(map: QuizMap): Place[] {
  try {
    const saved = localStorage.getItem(EDITS_KEY(map.id));
    if (saved) return JSON.parse(saved) as Place[];
  } catch {}
  return map.places;
}

/** Inside the target: 100; then down to 0 at four radii away. */
function pointsFor(dist: number, r: number) {
  if (dist <= r) return 100;
  return Math.max(0, Math.round(100 * (1 - (dist - r) / (3 * r))));
}

/** Click position on the picture, as shares of width and height. */
function clickAt(e: React.MouseEvent<HTMLElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
}

function MapPicture({ map, onClick, children }: { map: QuizMap; onClick?: (p: { x: number; y: number }) => void; children?: React.ReactNode }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-rule-strong bg-black shadow-xl ${onClick ? 'cursor-crosshair' : ''}`}
      style={{ aspectRatio: map.aspect }}
      onClick={(e) => onClick?.(clickAt(e))}
    >
      <img src={map.image} alt={`Map of ${map.label}`} draggable={false} className="pointer-events-none size-full select-none object-fill" style={map.pixelated ? { imageRendering: 'pixelated' } : undefined} />
      {children}
    </div>
  );
}

/** A circle marker in shares of the picture (the radius is a share of the width). */
function Ring({ map, x, y, r, tone }: { map: QuizMap; x: number; y: number; r: number; tone: string }) {
  return (
    <span
      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${tone}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${r * 200}%`, height: `${r * 200 * map.aspect}%` }}
    />
  );
}

function Play({ map }: { map: QuizMap }) {
  const key = `map:${map.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const places = useMemo(() => placesOf(map), [map]);
  const [run, setRun] = useState(0);
  const order = useMemo(() => shuffle(places, Math.random).slice(0, Math.min(ROUNDS, places.length)), [places, run]);
  const [index, setIndex] = useState(0);
  const [click, setClick] = useState<{ x: number; y: number } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const place = order[index];
  const total = scores.reduce((a, b) => a + b, 0);
  const over = scores.length === order.length;

  const guess = (p: { x: number; y: number }) => {
    if (click) return;
    // Distances in widths: the height share is scaled by the picture's proportions.
    const dist = Math.hypot(p.x - place.x, (p.y - place.y) / map.aspect);
    const pts = pointsFor(dist, place.r);
    pts === 100 ? sfx.streak() : pts ? sfx.correct() : sfx.wrong();
    setClick(p);
    const all = [...scores, pts];
    setScores(all);
    if (all.length === order.length) {
      const sum = all.reduce((a, b) => a + b, 0);
      recordBest(key, sum);
      if (sum > best) window.setTimeout(() => celebrateBig(), 400);
    }
  };
  const next = () => {
    sfx.click();
    setClick(null);
    setIndex((i) => i + 1);
  };
  const again = () => {
    setRun((r) => r + 1);
    setIndex(0);
    setScores([]);
    setClick(null);
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-2xl items-end justify-between">
        <p className="font-serif text-2xl font-bold">
          Where is <span className="text-accent">{place.name}</span>?
        </p>
        <p className="font-display text-sm text-ink-soft">
          {index + 1}/{order.length} · <span className="font-serif text-2xl font-bold text-ink">{total}</span> / {order.length * 100}
        </p>
      </div>
      <MapPicture map={map} onClick={guess}>
        {click && (
          <>
            <Ring map={map} x={place.x} y={place.y} r={place.r} tone="border-hit bg-hit/25" />
            <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-coral" style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }} />
            <span className="pointer-events-none absolute -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white" style={{ left: `${place.x * 100}%`, top: `calc(${place.y * 100}% + ${place.r * 100 * map.aspect}% + 4px)` }}>
              {place.name}
            </span>
          </>
        )}
      </MapPicture>
      <div className="mx-auto max-w-2xl text-center">
        {click && !over && (
          <div className="animate-pop space-y-2">
            <p className="font-display font-bold">{scores[index] === 100 ? 'Spot on! +100' : scores[index] ? `Close: +${scores[index]}` : 'Too far: +0'}</p>
            <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Next →
            </button>
          </div>
        )}
        {over && (
          <div className="animate-pop space-y-2 rounded-md border border-rule-strong bg-card p-4">
            <p className="font-serif text-4xl font-bold">
              {total} / {order.length * 100}
            </p>
            <p className="text-sm text-ink-soft">{total > best ? '★ New best' : `Best ${best}`}</p>
            <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Play again
            </button>
          </div>
        )}
        {!click && <p className="text-sm text-ink-faint">Click on the map. Inside the circle is 100 points; the further away, the fewer.</p>}
      </div>
    </div>
  );
}

/** The pin page: pick a place, click where it is, size its circle — then copy the result into src/data/maps.json. */
function Edit({ map }: { map: QuizMap }) {
  const [places, setPlaces] = useState<Place[]>(() => placesOf(map));
  const [sel, setSel] = useState(0);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);
  const save = (next: Place[]) => {
    setPlaces(next);
    setCopied(false);
    try {
      localStorage.setItem(EDITS_KEY(map.id), JSON.stringify(next));
    } catch {}
  };
  const update = (i: number, patch: Partial<Place>) => save(places.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const json = JSON.stringify(places.map((p) => ({ name: p.name, x: round3(p.x), y: round3(p.y), r: round3(p.r) })), null, 2);
  const current = places[sel];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">
          Selected: <span className="font-bold text-ink">{current?.name ?? '—'}</span> — click the map where it is.
        </p>
        <MapPicture map={map} onClick={(p) => current && update(sel, { x: p.x, y: p.y })}>
          {places.map((p, i) => (
            <Ring key={p.name} map={map} x={p.x} y={p.y} r={p.r} tone={i === sel ? 'border-accent bg-accent/30' : 'border-white/70 bg-white/10'} />
          ))}
          {places.map((p) => (
            <span key={`${p.name}-l`} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-1 text-[10px] font-bold text-white" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              {p.name}
            </span>
          ))}
        </MapPicture>
      </div>
      <div className="space-y-3">
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {places.map((p, i) => (
            <li key={p.name}>
              <button type="button" onClick={() => setSel(i)} className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${i === sel ? 'bg-ink text-paper' : 'hover:bg-tile'}`}>
                {p.name}
                <span className="text-xs opacity-70">
                  {p.x.toFixed(2)}, {p.y.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <label className="block text-sm">
            Circle size: {current.r.toFixed(3)}
            <input type="range" min={0.01} max={0.15} step={0.005} value={current.r} onChange={(e) => update(sel, { r: Number(e.target.value) })} className="w-full" />
          </label>
        )}
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New place…" className="min-w-0 flex-1 rounded border border-rule-strong bg-card px-2 py-1 text-sm" />
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={() => (save([...places, { name: newName.trim(), x: 0.5, y: 0.5, r: 0.04 }]), setSel(places.length), setNewName(''))}
            className="btn-paper rounded px-2 text-sm font-semibold"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigator.clipboard.writeText(json).then(() => setCopied(true))} className="btn-ink rounded-md px-3 py-1.5 text-sm font-semibold">
            {copied ? '✓ Copied' : 'Copy places JSON'}
          </button>
          <button type="button" onClick={() => current && save(places.filter((_, i) => i !== sel))} className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold">
            Remove
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(EDITS_KEY(map.id));
              } catch {}
              setPlaces(map.places);
            }}
            className="btn-paper rounded-md px-3 py-1.5 text-sm font-semibold"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-ink-faint">
          Edits are kept in this browser and used by the quiz right away. To ship them, paste the copied list over this map&apos;s <code>places</code> in{' '}
          <code>src/data/maps.json</code> (and drop <code>estimated</code>).
        </p>
      </div>
    </div>
  );
}

/** /map-quiz, /map-quiz/:map and /map-quiz/:map/edit */
export default function MapQuiz({ edit = false }: { edit?: boolean }) {
  const { map: id } = useParams();
  const bests = useProgress((s) => s.bests);
  if (id) {
    const map = MAPS.find((m) => m.id === id);
    if (!map) return <Navigate to="/map-quiz" replace />;
    return (
      <div className="space-y-5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-end justify-between gap-2">
          <div>
            <Link to="/map-quiz" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
              ← Map Quiz
            </Link>
            <h1 className="text-4xl font-bold">
              {map.label} {edit && <span className="text-xl text-ink-soft">· pin page</span>}
            </h1>
          </div>
          <Link to={edit ? `/map-quiz/${map.id}` : `/map-quiz/${map.id}/edit`} className="text-sm font-semibold text-ink-soft hover:text-ink">
            {edit ? '▶ Play' : '📍 Fix the pins'}
          </Link>
        </div>
        {map.estimated && !edit && <p className="mx-auto max-w-2xl text-xs text-ink-faint">Test map: places were positioned by eye — if one is off, fix it on the pin page.</p>}
        {edit ? <Edit map={map} /> : <Play key={map.id} map={map} />}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Map Quiz</h1>
        <p className="max-w-xl text-ink-soft">A place name, a world map: click where it is. Inside its circle is 100 points, and the further away, the fewer. {ROUNDS} places a round.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {MAPS.map((m) => (
          <li key={m.id}>
            <Link to={`/map-quiz/${m.id}`} className="page flex h-full gap-4 rounded-md p-4 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <img src={m.image} alt="" className="size-24 shrink-0 rounded object-cover" style={m.pixelated ? { imageRendering: 'pixelated' } : undefined} />
              <span className="flex flex-col gap-1">
                <span className="font-display text-xl font-bold">{m.label}</span>
                <span className="text-sm text-ink-soft">{m.franchise} · {m.places.length} places</span>
                <span className="text-xs text-ink-faint">{(bests[`map:${m.id}`] ?? 0) > 0 ? `Best ${bests[`map:${m.id}`]}` : m.estimated ? 'Test map' : 'Not played yet'}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
