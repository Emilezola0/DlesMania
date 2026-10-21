import { PHASES, PLAYER_HEARTS } from '../lib/boss';
import type { Boss } from '../types';

interface Props {
  boss: Boss;
  /** Boss life left, in thirds (3 = full). */
  hp: number;
  hearts: number;
  line: { text: string; key: number; mood: 'taunt' | 'hit' | 'hurt' };
}

export function HeartIcon({ full, className = '' }: { full: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-6 ${className}`} aria-hidden>
      <path
        d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"
        className={full ? 'fill-coral stroke-coral' : 'fill-transparent stroke-rule-strong'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The boss portrait, its three-segment life bar, the player's hearts and the boss's latest line. */
export function BossHeader({ boss, hp, hearts, line }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          key={`${line.key}-${line.mood}`}
          className={`relative size-16 shrink-0 overflow-hidden rounded-full border-[3px] bg-tile shadow-lg sm:size-20 ${line.mood === 'hit' ? 'boss-recoil' : line.mood === 'hurt' ? 'animate-lift' : ''}`}
          style={{ borderColor: boss.boss.color, boxShadow: `0 0 24px ${boss.boss.color}55` }}
        >
          {boss.boss.image && <img src={boss.boss.image} alt="" className="size-full object-cover object-top" />}
          {line.mood === 'hit' && <span className="boss-hit-flash absolute inset-0 bg-white" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{boss.boss.name}</p>
            <p className="shrink-0 font-display text-[11px] uppercase tracking-widest text-ink-faint">{boss.boss.title}</p>
          </div>
          {/* Three life segments, one per phase. */}
          <div className="mt-1.5 flex gap-1" role="meter" aria-label="Boss health" aria-valuemin={0} aria-valuemax={PHASES.length} aria-valuenow={hp}>
            {PHASES.map((_, i) => {
              const alive = i < hp;
              return (
                <div key={i} className="relative h-4 flex-1 overflow-hidden rounded-sm border border-ink/40 bg-tile sm:h-5">
                  <div
                    className={`absolute inset-0 origin-left transition-transform duration-700 ease-out ${alive ? 'scale-x-100' : 'scale-x-0'}`}
                    style={{ background: `linear-gradient(180deg, ${boss.boss.color}, color-mix(in srgb, ${boss.boss.color} 65%, black))` }}
                  />
                  {!alive && <div className="boss-segment-break absolute inset-0 bg-white" />}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-display text-[11px] uppercase tracking-widest text-ink-faint">{Math.round((hp / PHASES.length) * 100)}% HP</span>
            <span className="flex items-center gap-0.5" aria-label={`${hearts} of ${PLAYER_HEARTS} hearts`}>
              <span className="mr-1 font-display text-[11px] uppercase tracking-widest text-ink-faint">You</span>
              {Array.from({ length: PLAYER_HEARTS }, (_, i) => (
                <HeartIcon key={i} full={i < hearts} className={i === hearts ? 'animate-pop' : ''} />
              ))}
            </span>
          </div>
        </div>
      </div>
      <p
        key={line.key}
        className={`animate-pop relative rounded-md border px-4 py-2.5 font-serif text-lg italic leading-snug ${
          line.mood === 'hurt' ? 'border-coral/50 bg-coral/10' : 'border-rule bg-card/70'
        }`}
      >
        <span className="absolute -top-2 left-8 size-3 rotate-45 border-l border-t border-inherit bg-inherit" aria-hidden />
        “{line.text}”
      </p>
    </div>
  );
}
