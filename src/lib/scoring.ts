import type { GameType } from '../types';

/** Points (0-100) for a round won after `attempts` tries. */
export function scoreFor(type: GameType, attempts: number, mistakes = 0): number {
  switch (type) {
    case 'classic':
      return Math.max(20, 100 - (attempts - 1) * 10);
    case 'timeline':
      return [100, 60, 30][attempts - 1] ?? 0;
    case 'connections':
      return Math.max(20, 100 - mistakes * 20);
    default:
      return Math.max(10, 100 - (attempts - 1) * 15);
  }
}

export const MAX_DAILY_SCORE = 1000;
