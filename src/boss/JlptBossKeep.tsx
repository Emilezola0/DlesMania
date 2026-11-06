import { KeepRow } from '../components/JlptKeep';
import type { Boss } from '../types';
import { jlptIdsOf } from './jlptKeep';

/** The JLPT boss: the words and kanji a round showed (its answers), each onto the review list. */
export default function JlptBossKeep({ boss, names }: { boss: Boss; names: string[] }) {
  return <KeepRow ids={jlptIdsOf(boss, names)} />;
}
