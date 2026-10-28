import { SETS } from './cards';
import type { Pack } from './packs';

/** A pack's wrapper: its colours, a torn top edge, a shine — and for a franchise pack, its guardian. */
export function PackArt({ pack, className = '' }: { pack: Pack; className?: string }) {
  const set = pack.boss ? SETS.find((s) => s.id === pack.boss) : undefined;
  return (
    <div
      className={`relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-lg text-white shadow-xl [container-type:inline-size] ${className}`}
      style={{ background: `linear-gradient(160deg, ${pack.colors[0]}, ${pack.colors[1]})`, clipPath: 'polygon(0 4%, 5% 0, 10% 4%, 15% 0, 20% 4%, 25% 0, 30% 4%, 35% 0, 40% 4%, 45% 0, 50% 4%, 55% 0, 60% 4%, 65% 0, 70% 4%, 75% 0, 80% 4%, 85% 0, 90% 4%, 95% 0, 100% 4%, 100% 100%, 0 100%)' }}
    >
      {set?.guardian.image ? <img src={set.guardian.image} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-40 mix-blend-luminosity" /> : null}
      <div className="relative text-center">
        <p className="text-[26cqw] leading-none drop-shadow">{pack.icon}</p>
        <p className="mt-[4cqw] px-[6cqw] font-display text-[10cqw] font-bold leading-tight drop-shadow">{pack.name.replace(' pack', '')}</p>
        <p className="mt-[2cqw] font-display text-[6cqw] font-semibold tracking-[0.3em] opacity-80">5 CARDS</p>
      </div>
      <div className="card-sheen pointer-events-none absolute inset-0" />
    </div>
  );
}
