import { jlptIdOfText } from '../arcade/jlpt';
import { KeepRow } from './JlptKeep';

/** Kanji or words of the JLPT list, by how they're written, each onto the review list (loaded lazily by the games that only sometimes show Japanese). */
export default function JlptTextKeep({ texts }: { texts: string[] }) {
  return <KeepRow ids={texts.flatMap((t) => jlptIdOfText(t) ?? [])} />;
}
