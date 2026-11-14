// The Ascended pieces that evolve (src/casino/cosmetics.ts `evolve`): the stage this player has reached, worked
// out from the dailies played since each was bought, and the id as friends see it, stage and all.
import { useProgress } from '../store/progress';
import { COSMETIC_BY_ID, stageOf } from './cosmetics';

type Save = ReturnType<typeof useProgress.getState>;

/** Dailies played (one per daily and day): what makes a piece evolve. */
export const dailiesOf = (s: Pick<Save, 'days'>) => Object.keys(s.days ?? {}).length;

/** This player's stage of a cosmetic (its id, "name:ascendant"), and the dailies played since buying it. */
export function myStage(s: Pick<Save, 'days' | 'ascendFrom'>, id: string): { stage: number; since: number } {
  const all = dailiesOf(s);
  const since = Math.max(0, all - (s.ascendFrom?.[id] ?? all));
  return { stage: stageOf(COSMETIC_BY_ID.get(id), since), since };
}

/** An id with this player's stage on it ("name:ascendant#3"; a plain id at the first stage or for one that doesn't evolve). */
export function withStage(s: Pick<Save, 'days' | 'ascendFrom'>, id: string | null | undefined, prefix = ''): string | null {
  if (!id) return null;
  const { stage } = myStage(s, prefix + id);
  return stage > 1 ? `${id}#${stage}` : id;
}

/** The worn name style, staged. */
export const useMyNameStyle = () => useProgress((s) => withStage(s, s.nameStyle));
/** A title id of this player's, staged (titles' cosmetics are "title:<id>"). */
export const useMyTitle = (titleId: string | null | undefined) => useProgress((s) => withStage(s, titleId, 'title:'));
