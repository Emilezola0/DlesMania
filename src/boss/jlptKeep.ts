// The JLPT boss's answers as entries of the list, to put the ones a round showed on the review list: each
// answer's name or one of its other spellings is a kanji or a word of the list (src/data/jlpt.json).
import { jlptIdOfText } from '../arcade/jlpt';
import type { Boss } from '../types';

const cache = new WeakMap<Boss, Map<string, string>>();
function byName(boss: Boss) {
  let m = cache.get(boss);
  if (m) return m;
  m = new Map();
  const add = (name: string, aliases: string[] = []) => {
    if (m!.has(name)) return;
    for (const t of [name, ...aliases]) {
      const id = jlptIdOfText(t);
      if (id) return void m!.set(name, id);
    }
  };
  for (const p of boss.blitz) for (const a of p.answers) add(a.name, a.aliases);
  for (const c of [...boss.radar.members, ...boss.finale]) add(c.label, c.aliases);
  for (const c of boss.secret?.categories ?? []) for (const e of c.entities) add(e.name, e.aliases);
  return m;
}

/** The entries the JLPT boss's answers named are (no other boss has any). */
export const jlptIdsOf = (boss: Boss, names: string[]) => (boss.id === 'jlpt' ? names.flatMap((n) => byName(boss).get(n) ?? []) : []);
