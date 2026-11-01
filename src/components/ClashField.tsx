import { GUNNER, H, LEVELS, W, type Level, type LogLine, type World } from '../arcade/curveClash';
import { sfx } from '../lib/sfx';

const PX = 20;
const sx = (x: number) => (x + W) * PX;
const sy = (y: number) => (H - y) * PX;
const SKY = '#0f172a';
export const CLASH_PLAYERS = [
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Red', color: '#ef4444' },
];

/**
 * Curve Clash's field: the grid, the islands with the holes shots blew in them, the shots drawn out along
 * their curves (`shotsKey` changes: they're drawn again), and the gunners — one's own picked by a tap.
 */
export function ClashField({ world, shots, shotsKey, mine, picked, onPick }: { world: World; shots: { path: [number, number][]; player: 0 | 1 }[]; shotsKey: number; mine: 0 | 1 | null; picked?: string; onPick: (id: string) => void }) {
  return (
    <svg viewBox={`0 0 ${2 * W * PX} ${2 * H * PX}`} className="block h-auto w-full" style={{ background: SKY }}>
      {Array.from({ length: 2 * W + 1 }, (_, k) => k - W).filter((v) => v % 5 === 0).map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={2 * H * PX} stroke="#1e293b" strokeWidth={v === 0 ? 2 : 1} />)}
      {Array.from({ length: 2 * H + 1 }, (_, k) => k - H).filter((v) => v % 5 === 0).map((v) => <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={0} x2={2 * W * PX} stroke="#1e293b" strokeWidth={v === 0 ? 2 : 1} />)}
      {/* The islands, their holes cut out of them. */}
      <defs>
        <mask id="clash-holes">
          <rect width={2 * W * PX} height={2 * H * PX} fill="white" />
          {world.craters.map((c, k) => (
            <circle key={k} cx={sx(c.x)} cy={sy(c.y)} r={c.r * PX} fill="black" />
          ))}
        </mask>
      </defs>
      <g mask="url(#clash-holes)">
        {world.islands.map((o, k) => (
          <circle key={k} cx={sx(o.x)} cy={sy(o.y)} r={o.r * PX} fill="#3f6212" stroke="#65a30d" strokeWidth={3} />
        ))}
      </g>
      {/* A scorched rim round each hole. */}
      {world.craters.map((c, k) => (
        <circle key={k} cx={sx(c.x)} cy={sy(c.y)} r={c.r * PX} fill="none" stroke="#713f12" strokeWidth={2} strokeDasharray="3 3" opacity={world.islands.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r) ? 0.8 : 0} />
      ))}
      {shots.map((s, k) => (
        <polyline key={`${shotsKey}-${k}`} pathLength={1} points={s.path.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} fill="none" stroke={CLASH_PLAYERS[s.player].color} strokeWidth={3} strokeLinecap="round" className="clash-shot" />
      ))}
      {world.gunners.map((g) => {
        const own = g.player === mine && g.alive;
        return (
          <g key={g.id} opacity={g.alive ? 1 : 0.25} onClick={() => own && (sfx.select(), onPick(g.id))} className={own ? 'cursor-pointer' : ''}>
            {own && g.id === picked && <circle cx={sx(g.x)} cy={sy(g.y)} r={GUNNER * PX + 8} fill="none" stroke="#fde68a" strokeWidth={3} strokeDasharray="6 4" />}
            <circle cx={sx(g.x)} cy={sy(g.y)} r={GUNNER * PX} fill={CLASH_PLAYERS[g.player].color} stroke="#f8fafc" strokeWidth={2} />
            {!g.alive && (
              <text x={sx(g.x)} y={sy(g.y) + 7} textAnchor="middle" fontSize={22} fill="#f8fafc">
                ✕
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The game's history, each line in its player's colour. */
export function ClashLog({ lines }: { lines: LogLine[] }) {
  if (!lines.length) return null;
  return (
    <ul className="space-y-1 rounded-md bg-[#0f172a] p-3 font-mono text-xs">
      {lines.map((l, k) => (
        <li key={k} style={{ color: CLASH_PLAYERS[l.player].color }}>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

/** Easy, medium or hard: how many islands, and how big. */
export function LevelPicker({ level, onChange }: { level: Level; onChange: (l: Level) => void }) {
  return (
    <div className="flex gap-1.5">
      {(Object.keys(LEVELS) as Level[]).map((l) => (
        <button key={l} type="button" aria-pressed={level === l} onClick={() => (sfx.click(), onChange(l))} className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${level === l ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`}>
          {LEVELS[l].label}
        </button>
      ))}
    </div>
  );
}
