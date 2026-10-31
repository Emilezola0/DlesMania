import { useId } from 'react';
import { GRADES } from './grades';

/**
 * A grade's emblem: a metal shield with its numeral, one more ornament each grade — wings at Silver,
 * a star above at Gold, at Radiant a ring of rays, the whole emblem shining, at Celestial
 * two rings turning opposite ways and a crown, and at Singularity a black shield with a hole of white light.
 */
export function GradeEmblem({ grade, className = '' }: { grade: number; className?: string }) {
  // Its own gradient ids: a hidden emblem's would leave the others without their metal.
  const id = `grade${useId().replace(/:/g, '')}`;
  const g = GRADES[grade];
  if (!g || grade < 2) return null;
  const [light, mid, dark] = g.metal;
  return (
    <svg viewBox="0 0 60 60" className={`${className} ${grade >= 5 ? 'grade-emblem-radiant' : ''} ${grade >= 6 ? 'grade-emblem-celestial' : ''} ${grade === 7 ? 'grade-emblem-singularity' : ''}`} aria-label={g.name} role="img">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        {grade >= 5 && (
          <linearGradient id={`${id}-prism`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={grade === 7 ? '#ffffff' : grade === 6 ? '#ffffff' : '#ff9ff3'} />
            <stop offset=".35" stopColor={grade === 7 ? '#c4b5fd' : grade === 6 ? '#fff1a8' : '#ffe58f'} />
            <stop offset=".65" stopColor={grade === 7 ? '#7dd3fc' : grade === 6 ? '#f2b92e' : '#9fdcff'} />
            <stop offset="1" stopColor={grade === 7 ? '#ffffff' : grade === 6 ? '#ffffff' : '#c4b5fd'} />
          </linearGradient>
        )}
      </defs>
      {/* Celestial and up: a second ring, turning the other way. */}
      {grade >= 6 && (
        <g className="grade-rays-back" stroke={`url(#${id}-prism)`} strokeWidth="1.4" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => {
            const a = ((i + 0.5) * Math.PI) / 6;
            return <line key={i} x1={30 + Math.cos(a) * 24} y1={31 + Math.sin(a) * 24} x2={30 + Math.cos(a) * 29.5} y2={31 + Math.sin(a) * 29.5} />;
          })}
        </g>
      )}
      {/* Radiant and up: rays behind it all. */}
      {grade >= 5 && (
        <g className="grade-rays" stroke={`url(#${id}-prism)`} strokeWidth="2.4" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={30 + Math.cos(a) * 20} y1={31 + Math.sin(a) * 20} x2={30 + Math.cos(a) * 28} y2={31 + Math.sin(a) * 28} />;
          })}
        </g>
      )}
      {/* Silver and up: wings. */}
      {grade >= 3 && (
        <g fill={`url(#${id}-metal)`} stroke={dark} strokeWidth="1">
          <path d="M16 22 L2 16 L6 24 L1 28 L8 31 L5 36 L16 34 Z" />
          <path d="M44 22 L58 16 L54 24 L59 28 L52 31 L55 36 L44 34 Z" />
        </g>
      )}
      {/* Gold and Radiant: a star on top. Celestial: a crown. */}
      {grade === 6 && <path d="M19 17 L16 4 L24 10 L30 1 L36 10 L44 4 L41 17 Z" fill={`url(#${id}-prism)`} stroke={dark} strokeWidth="1" />}
      {(grade === 4 || grade === 5) && (
        <path d="M30 1 L32.6 7.2 L39 7.6 L34 11.6 L35.8 18 L30 14.4 L24.2 18 L26 11.6 L21 7.6 L27.4 7.2 Z" fill={grade === 5 ? `url(#${id}-prism)` : light} stroke={dark} strokeWidth="1" />
      )}
      {/* The shield. */}
      <path d="M30 13 L46 19 V33 C46 43 38 50 30 54 C22 50 14 43 14 33 V19 Z" fill={`url(#${id}-metal)`} stroke={dark} strokeWidth="1.6" />
      <path d="M30 17 L42.5 21.8 V33 C42.5 41 36.5 46.5 30 49.7 C23.5 46.5 17.5 41 17.5 33 V21.8 Z" fill="none" stroke={light} strokeOpacity=".7" strokeWidth="1" />
      <text x="30" y={grade === 7 ? 38 : grade === 3 || grade === 6 ? 38.5 : 39} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" fontSize={grade === 7 ? 11 : grade === 3 || grade === 6 ? 13 : 15} fill={grade === 7 ? light : dark} stroke={grade === 7 ? '#c4b5fd' : light} strokeWidth={grade === 7 ? 0.3 : 0.5}>
        {g.numeral}
      </text>
    </svg>
  );
}
