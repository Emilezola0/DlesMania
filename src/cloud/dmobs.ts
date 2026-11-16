// The dungeon's mobs' lives, shared by everyone on an island (src/island/mobs.ts): dmobs/<owner>/<week>/<mob id> on the
// Realtime Database, never Firestore (each hit would be a write, each player there a read of it, against its free
// daily quota; here only bytes count). Where the mobs are is never sent: they follow their patterns on the server's
// clock (.info/serverTimeOffset), so everyone sees them alike. A hit is a transaction: two players striking at once both
// count. Rules: database.rules.json, "dmobs".
import { getDatabase, onValue, ref, runTransaction, type Database } from 'firebase/database';
import { applyAnswer, applyHit, type HitResult, type Mob, type MobBoard, type MobState } from '../island/mobs';
import { DATABASE_URL } from './config';
import { app } from './firebase';

let base: Database | null = null;
const dbOf = () => (base ??= getDatabase(app, DATABASE_URL));
/** No `undefined` in the database (a missing field is left out). */
const clean = (s: MobState | undefined) => (s ? (JSON.parse(JSON.stringify(s)) as MobState) : undefined);

/** The island's board for this week's dungeon. `fail` once if the database refuses or doesn't answer. */
export function rtBoard(owner: string, week: string, back: number, fail: () => void, wait = 6000): MobBoard {
  const path = `dmobs/${owner}/${week}`;
  let lives: Record<string, MobState> = {};
  let offset = 0;
  const fans = new Set<() => void>();
  const tell = () => fans.forEach((f) => f());
  let answered = false;
  let over = false;
  const give = () => {
    if (over || answered) return;
    over = true;
    stopAll();
    fail();
  };
  const timer = window.setTimeout(give, wait);
  const stopClock = onValue(ref(dbOf(), '.info/serverTimeOffset'), (s) => {
    offset = Number(s.val()) || 0;
  });
  const stopLives = onValue(
    ref(dbOf(), path),
    (s) => {
      answered = true;
      window.clearTimeout(timer);
      lives = (s.val() ?? {}) as Record<string, MobState>;
      tell();
    },
    () => give(),
  );
  const stopAll = () => {
    window.clearTimeout(timer);
    stopClock();
    stopLives();
  };
  const now = () => Date.now() + offset;
  return {
    states: () => lives,
    now,
    hit: async (m: Mob, damage: number, uid: string) => {
      let out: HitResult | null = null;
      // Shown at once (the database confirms it, or puts it right, a moment later).
      const mine = applyHit(m, lives[m.id], damage, uid, now());
      if (mine) {
        lives = { ...lives, [m.id]: mine.state };
        tell();
      }
      try {
        await runTransaction(ref(dbOf(), `${path}/${m.id}`), (cur: MobState | null) => {
          out = applyHit(m, cur ?? undefined, damage, uid, now());
          return out ? clean(out.state) : undefined;
        });
      } catch {
        return mine;
      }
      return out;
    },
    answer: async (m: Mob, right: boolean) => {
      await runTransaction(ref(dbOf(), `${path}/${m.id}`), (cur: MobState | null) => clean(applyAnswer(m, cur ?? undefined, right, now(), back))).catch(() => {});
    },
    listen: (on) => (fans.add(on), () => void fans.delete(on)),
    stop: () => {
      over = true;
      stopAll();
      fans.clear();
    },
  };
}
