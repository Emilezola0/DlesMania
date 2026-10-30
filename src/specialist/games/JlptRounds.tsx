import { shortMeaning } from '../../arcade/jlpt';
import { kanjiPicture } from '../../lib/kanji';
import { romajiSpellings, toHiragana } from '../../lib/romaji';
import type { RoundRecord } from '../../types';
import { JLPT_KANJI, JLPT_READINGS, JLPT_WORDS, jlptKanji, jlptWord, onKun, wordDetail } from '../jlpt';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** The character big, with its reading under it once the round is over (the point is to learn). */
function Character({ text, reading, done, size = 'text-8xl' }: { text: string; reading?: string; done: boolean; size?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <p lang="ja" className={`font-serif font-bold leading-none ${size}`}>
        {text}
      </p>
      <p lang="ja" className={`min-h-8 text-xl text-ink-soft ${done ? 'animate-pop' : 'invisible'}`}>
        {reading}
      </p>
    </div>
  );
}

/** Kanji: a kanji of the list — what does it mean? (Its readings count too.) */
export function JlptKanjiRound({ round, record, onChange }: Props) {
  const k = jlptKanji(round.targetId)!;
  const { on, kun } = onKun(k.entry.reading);
  const shown = [on && `On ${on}`, kun && `Kun ${kun}`].filter(Boolean).join(' · ');
  return (
    <SpGuessRound
      type="kanji"
      question="What does this kanji mean? (Its reading counts too.)"
      pool={JLPT_KANJI}
      targetId={k.id}
      hints={[`JLPT ${k.entry.level}`, ...(on ? [`On reading: ${on}`] : []), ...(kun ? [`Kun reading: ${kun}`] : []), `Its meaning starts with “${k.name[0]}”`]}
      record={record}
      onChange={onChange}
      answer={{ name: k.name, image: kanjiPicture(`kanji:${k.entry.text}`), detail: `${k.entry.text} — ${shown} · ${shortMeaning(k.entry.meaning, 4)} · JLPT ${k.entry.level}` }}
      noPictures
      clue={(_, done) => <Character text={k.entry.text} reading={shown} done={done} />}
    />
  );
}

/** Reading: a word written in kanji — how is it read? (In kana or in romaji.) */
export function JlptReadingRound({ round, record, onChange }: Props) {
  const w = jlptWord(round.targetId)!;
  const h = toHiragana(w.kana);
  return (
    <SpGuessRound
      type="reading"
      question="How is this word read? (Kana or romaji.)"
      pool={JLPT_READINGS}
      targetId={`r:${h}`}
      hints={[`It means “${shortMeaning(w.entry.meaning, 3)}”`, `JLPT ${w.entry.level}`, `${[...h].length} kana`, `It starts with “${[...h][0]}” (${romajiSpellings([...h][0])[0]})`]}
      record={record}
      onChange={onChange}
      answer={{ name: `${w.entry.text} · ${w.entry.reading}`, detail: wordDetail(w) }}
      noPictures
      clue={(_, done) => <Character text={w.entry.text} reading={w.entry.reading} done={done} size="text-7xl" />}
    />
  );
}

/** Word: a meaning in English — which word of the list is it? (In kanji, kana or romaji.) */
export function JlptWordRound({ round, record, onChange }: Props) {
  const w = jlptWord(round.targetId)!;
  return (
    <SpGuessRound
      type="word"
      question="Which Japanese word means this? (Kanji, kana or romaji.)"
      pool={JLPT_WORDS}
      targetId={w.id}
      hints={[`JLPT ${w.entry.level}`, `${[...w.kana].length} kana`, `It starts with “${[...w.kana][0]}” (${romajiSpellings([...w.kana][0])[0]})`, `Written ${w.entry.text}`]}
      record={record}
      onChange={onChange}
      answer={{ name: w.name, detail: wordDetail(w) }}
      noPictures
      clue={(_, done) => (
        <div className="space-y-3 text-center">
          <p className="font-serif text-3xl font-bold italic">“{shortMeaning(w.entry.meaning, 4)}”</p>
          {done && <Character text={w.entry.text} reading={w.entry.reading !== w.entry.text ? w.entry.reading : ''} done size="text-6xl" />}
        </div>
      )}
    />
  );
}
