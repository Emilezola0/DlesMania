// The special rarities' bigger effects (src/gacha/ranks.ts), drawn by CardFace when the card's rank has them on
// (src/data/tuning/special-rarities.json `effects`). Their looks are .card-rank-* in src/index.css.
//   Behind the card: Apex's flames, pillar of light and shockwaves; Eclipse's corona streamers; Bond's infinity.
//   Over the picture: Eclipse's stars in the dark; Bond's thread, where the two friends' lights meet in a heart.
//   On the rim: Eclipse's diamond ring and Baily's beads.
import { useId, type CSSProperties } from 'react';

type Fx = (k: string) => boolean;

/** A conic gradient of soft rays at uneven angles, widths and strengths: a corona's streamers. */
function rays(seed: number, n: number) {
  const stops: string[] = [];
  let a = seed % 20;
  for (let i = 0; i < n; i++) {
    const w = 3 + ((i * 7 + seed) % 6);
    const alpha = 35 + ((i * 13 + seed) % 50);
    stops.push(`transparent ${a}deg`, `color-mix(in srgb, var(--rk3) ${alpha}%, transparent) ${a + w / 2}deg`, `transparent ${a + w}deg`);
    a += 360 / n + (((i * 11 + seed) % 9) - 4);
    if (a > 355) break;
  }
  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
}
const CORONA_A = rays(3, 22);
const CORONA_B = rays(11, 16);

/** Apex's flames round the card: where each stands on the edge (x %, y %) and which way it leans. */
const FLAMES = [
  [8, 3, -22], [22, 0, -10], [36, 0, -4], [50, 0, 0], [64, 0, 4], [78, 0, 10], [92, 3, 22],
  [1, 25, -16], [0, 48, -12], [1, 72, -8], [2, 94, -6], [99, 25, 16], [100, 48, 12], [99, 72, 8], [98, 94, 6],
].map(([x, y, r], i) => ({ x, y, r, delay: -((i * 0.37) % 1.4), h: 0.75 + ((i * 7) % 5) / 10 }));

/** Eclipse's stars, out in the dark round the picture: x %, y %, size. */
const STARS = [
  [9, 7, 1], [24, 4, 0.6], [74, 6, 0.8], [91, 13, 0.6], [6, 30, 0.5], [95, 36, 0.7],
  [8, 84, 0.8], [27, 93, 0.6], [62, 95, 0.9], [86, 88, 0.7], [94, 66, 0.5], [4, 60, 0.6],
].map(([x, y, s], i) => ({ x, y, s, delay: -((i * 0.83) % 4) }));

/** Behind the card. `lift` sets it back in a 3D view, as the corona's always was. */
export function RankBehind({ fx, lift }: { fx: Fx; lift?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" style={lift} aria-hidden>
      {fx('pillar') && <div className="card-rank-pillar" />}
      {fx('flames') && (
        <div className="card-rank-flames">
          {FLAMES.map((f) => (
            <i key={`${f.x}-${f.y}`} style={{ left: `${f.x}%`, top: `${f.y}%`, rotate: `${f.r}deg`, animationDelay: `${f.delay}s`, ['--h' as string]: f.h }} />
          ))}
        </div>
      )}
      {fx('shockwave') && (
        <>
          <div className="card-rank-wave" />
          <div className="card-rank-wave" style={{ animationDelay: '-1.4s' }} />
        </>
      )}
      {fx('corona') && (
        <>
          <div className="card-rank-streamers" style={{ backgroundImage: CORONA_A }} />
          <div className="card-rank-streamers card-rank-streamers-b" style={{ backgroundImage: CORONA_B }} />
          <div className="card-rank-corona" />
        </>
      )}
      {fx('infinity') && (
        <svg className="card-rank-infinity" viewBox="0 0 200 100">
          <defs>
            <linearGradient id={`${id}g`} x1="0" x2="1">
              <stop offset="0" stopColor="var(--rk1)" />
              <stop offset="0.5" stopColor="#fff" />
              <stop offset="1" stopColor="var(--rk3)" />
            </linearGradient>
          </defs>
          <path id={`${id}p`} d="M100,50 C128,14 190,12 190,50 C190,88 128,86 100,50 C72,14 10,12 10,50 C10,88 72,86 100,50 Z" fill="none" stroke={`url(#${id}g)`} strokeWidth="2.4" />
          <path d="M100,50 C128,14 190,12 190,50 C190,88 128,86 100,50 C72,14 10,12 10,50 C10,88 72,86 100,50 Z" fill="none" stroke="#fff" strokeWidth="0.8" strokeDasharray="2 10" className="card-rank-infinity-flow" />
          {[
            ['var(--rk1)', '0s'],
            ['var(--rk3)', '-3s'],
          ].map(([c, begin]) => (
            <circle key={c} r="3.6" fill={c} className="card-rank-infinity-light">
              <animateMotion dur="6s" begin={begin} repeatCount="indefinite">
                <mpath href={`#${id}p`} />
              </animateMotion>
            </circle>
          ))}
        </svg>
      )}
    </div>
  );
}

/** Over the picture, under the words. */
export function RankOver({ fx }: { fx: Fx }) {
  const id = useId().replace(/:/g, '');
  return (
    <>
      {fx('stars') && (
        <div className="card-rank-stars pointer-events-none absolute inset-0 z-[5]" aria-hidden>
          {STARS.map((s) => (
            <i key={`${s.x}-${s.y}`} style={{ left: `${s.x}%`, top: `${s.y}%`, scale: String(s.s), animationDelay: `${s.delay}s` }} />
          ))}
        </div>
      )}
      {fx('thread') && (
        <svg className="card-rank-thread pointer-events-none absolute inset-0 z-[5] size-full" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${id}t`} x1="0" x2="1">
              <stop offset="0" stopColor="var(--rk1)" />
              <stop offset="0.5" stopColor="#fff" />
              <stop offset="1" stopColor="var(--rk3)" />
            </linearGradient>
          </defs>
          <path id={`${id}l`} d="M0,52 C18,74 36,76 50,74" fill="none" stroke={`url(#${id}t)`} strokeWidth="0.9" />
          <path id={`${id}r`} d="M100,52 C82,74 64,76 50,74" fill="none" stroke={`url(#${id}t)`} strokeWidth="0.9" />
          {[
            [`#${id}l`, 'var(--rk1)'],
            [`#${id}r`, 'var(--rk3)'],
          ].map(([path, c]) => (
            <circle key={path} r="1.6" fill={c} className="card-rank-thread-light">
              <animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear">
                <mpath href={path} />
              </animateMotion>
            </circle>
          ))}
        </svg>
      )}
      {fx('thread') && (
        <span className="card-rank-heart pointer-events-none absolute z-[6]" aria-hidden>
          ♥
        </span>
      )}
    </>
  );
}

/** On the card's rim, above everything but the ribbon. */
export function RankRim({ fx, lift }: { fx: Fx; lift?: CSSProperties }) {
  if (!fx('diamond')) return null;
  return (
    <div className="card-rank-diamond pointer-events-none absolute z-[15]" style={lift} aria-hidden>
      <b />
      <b />
      <b />
      <i />
    </div>
  );
}
