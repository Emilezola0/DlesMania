import { grammarExamples, grammarMeaning } from '../arcade/jlptGrammar';
import { audioUrl, pieces, tatoebaUrl, type JlptSentence } from '../arcade/jlptSentences';
import { useProgress } from '../store/progress';

/** A sentence read aloud (the effects' volume, never silent on a tap). */
function playSentence(s: JlptSentence) {
  const a = new Audio(audioUrl(s));
  a.volume = Math.min(1, Math.max(0.6, useProgress.getState().sfxVolume / 100));
  a.play().catch(() => {});
}

/** A real sentence, its furigana under the kanji and the grammar point it shows underlined, with its translation. */
function Example({ s, lang }: { s: JlptSentence; lang: 'en' | 'fr' }) {
  const [b0, b1] = s.blank;
  return (
    <li className="space-y-0.5 rounded-md border border-rule px-3 py-2">
      <p lang="ja" className="ruby-under font-serif text-xl leading-[2.2]">
        {pieces(s.furigana).flatMap((p, i) => {
          // A plain run cut where the grammar point starts and ends, to underline it.
          const cuts = p.reading ? [[p.start, p.start + p.text.length]] : [[p.start, Math.max(p.start, Math.min(b0, p.start + p.text.length))], [Math.max(p.start, b0), Math.min(p.start + p.text.length, b1)], [Math.max(p.start, b1), p.start + p.text.length]];
          return cuts
            .filter(([from, to]) => to > from)
            .map(([from, to], j) => {
              const text = p.text.slice(from - p.start, to - p.start);
              const mark = from >= b0 && to <= b1 ? 'font-bold underline decoration-accent decoration-2 underline-offset-4' : '';
              return p.reading ? (
                <ruby key={`${i}-${j}`} className={mark}>
                  {text}
                  <rt>{p.reading}</rt>
                </ruby>
              ) : (
                <span key={`${i}-${j}`} className={mark}>
                  {text}
                </span>
              );
            });
        })}
        {s.audio && (
          <button type="button" onClick={() => playSentence(s)} className="ml-2 align-middle font-sans text-sm text-ink-soft hover:text-ink" aria-label="Listen">
            🔊
          </button>
        )}
      </p>
      <p className="text-sm text-ink-soft">“{(lang === 'fr' && s.fr) || s.en}”</p>
      <p className="text-[11px] text-ink-faint">
        <a href={tatoebaUrl(s)} target="_blank" rel="noreferrer" className="underline">
          Tatoeba #{s.id}
        </a>
        {s.audio && ` · ${s.audio.by} (${s.audio.license})`}
      </p>
    </li>
  );
}

/**
 * Once a grammar question is answered (right or wrong): what the grammar point means, in the player's
 * language, and real sentences that use it (`not`: the sentence already on screen). Nothing for a point
 * no source translates, or with no sentence.
 */
export function GrammarNote({ level, pattern, not, examples = 2 }: { level: string; pattern: string; not?: number; examples?: number }) {
  const lang = useProgress((s) => s.nameLang);
  const meaning = grammarMeaning(level, pattern, lang);
  const sentences = grammarExamples(level, pattern, not, examples);
  if (!meaning && !sentences.length) return null;
  return (
    <div className="animate-pop space-y-2 text-left">
      {meaning && (
        <p className="text-sm">
          <span className="font-display font-bold">{lang === 'fr' ? 'Sens' : 'Meaning'}</span> · {meaning.text}{' '}
          <span className="text-[11px] text-ink-faint">({meaning.src})</span>
        </p>
      )}
      {sentences.length > 0 && (
        <>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-faint">{lang === 'fr' ? 'Exemples' : 'Examples'}</p>
          <ul className="space-y-1.5">
            {sentences.map((s) => (
              <Example key={s.id} s={s} lang={lang} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
