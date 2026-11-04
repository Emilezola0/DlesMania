import { useEffect, useState, type ReactNode } from 'react';
import { allGrammarExamples, grammarMeaning, type SourceExample } from '../arcade/jlptGrammar';
import { audioUrl, pieces, tatoebaUrl, type JlptSentence } from '../arcade/jlptSentences';
import { useProgress } from '../store/progress';

/** How many examples show at first; the rest behind "More examples". */
const FIRST = 3;
/**
 * Tatoeba's sentences were matched to the points by their form only, and a form isn't a meaning
 * (止まったらどうなる isn't ～たらどうですか): they stay in the data but aren't shown, only the sources' own
 * examples for each point are.
 */
const SHOW_TATOEBA = false;

/** A sentence read aloud (the effects' volume, never silent on a tap). */
function playSentence(s: JlptSentence) {
  const a = new Audio(audioUrl(s));
  a.volume = Math.min(1, Math.max(0.6, useProgress.getState().sfxVolume / 100));
  a.play().catch(() => {});
}

/** A sentence, its furigana under the kanji and the grammar point it shows underlined, with its translation and where it's from. */
function Sentence({ furigana, blank, kana, translation, after, foot }: { furigana: string; blank: [number, number]; kana?: string; translation: string; after?: ReactNode; foot: ReactNode }) {
  const [b0, b1] = blank;
  return (
    <li className="space-y-0.5 rounded-md border border-rule px-3 py-2">
      <p lang="ja" className="ruby-under font-serif text-xl leading-[2.2]">
        {pieces(furigana).flatMap((p, i) => {
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
        {after}
      </p>
      {/* The reading as the source writes it, when it couldn't be put under each kanji. */}
      {kana && (
        <p lang="ja" className="text-sm text-ink-soft">
          {kana}
        </p>
      )}
      <p className="text-sm text-ink-soft">“{translation}”</p>
      <p className="text-[11px] text-ink-faint">{foot}</p>
    </li>
  );
}

/** One of a source's own examples for the point (Bunpro, JLPT Sensei). */
function SourceSentence({ s }: { s: SourceExample }) {
  return (
    <Sentence
      furigana={s.furigana}
      blank={s.blank}
      kana={s.kana}
      translation={s.en}
      foot={
        <a href={s.url} target="_blank" rel="noreferrer" className="underline">
          {s.src}
        </a>
      }
    />
  );
}

/** A real sentence from Tatoeba that uses the point, read aloud when a voice recorded it. */
function Example({ s, lang }: { s: JlptSentence; lang: 'en' | 'fr' }) {
  return (
    <Sentence
      furigana={s.furigana}
      blank={s.blank}
      translation={(lang === 'fr' && s.fr) || s.en}
      after={
        s.audio && (
          <button type="button" onClick={() => playSentence(s)} className="ml-2 align-middle font-sans text-sm text-ink-soft hover:text-ink" aria-label="Listen">
            🔊
          </button>
        )
      }
      foot={
        <>
          <a href={tatoebaUrl(s)} target="_blank" rel="noreferrer" className="underline">
            Tatoeba #{s.id}
          </a>
          {s.audio && ` · ${s.audio.by} (${s.audio.license})`}
        </>
      }
    />
  );
}

/**
 * Once a grammar question is answered (right or wrong): what the grammar point means, in the player's
 * language, where the point and its meaning are from, and example sentences that use it — the sources'
 * own (`examples` of them shown, the rest a tap away). Nothing for a point no source translates, or with
 * no sentence.
 */
export function GrammarNote({ level, pattern, not, examples = FIRST }: { level: string; pattern: string; not?: number; examples?: number }) {
  const lang = useProgress((s) => s.nameLang);
  const meaning = grammarMeaning(level, pattern, lang);
  const [found, setFound] = useState<{ key: string; source: SourceExample[]; tatoeba: JlptSentence[] } | null>(null);
  const [all, setAll] = useState(false);
  const key = `${level}|${pattern}|${not ?? ''}`;
  useEffect(() => {
    let live = true;
    setAll(false);
    void allGrammarExamples(level, pattern, not).then((x) => live && setFound({ key, ...x }));
    return () => {
      live = false;
    };
  }, [key, level, pattern, not]);
  const here = found?.key === key ? found : null;
  const list: ReactNode[] = [...(here?.source ?? []).map((s, i) => <SourceSentence key={`s${i}`} s={s} />), ...(SHOW_TATOEBA ? (here?.tatoeba ?? []) : []).map((s) => <Example key={s.id} s={s} lang={lang} />)];
  if (!meaning && !list.length) return null;
  const fr = lang === 'fr';
  return (
    <div className="animate-pop space-y-2 text-left">
      {meaning && (
        <p className="text-sm">
          <span className="font-display font-bold">{fr ? 'Sens' : 'Meaning'}</span> · {meaning.text}{' '}
          <span className="text-[11px] text-ink-faint">({meaning.src})</span>
        </p>
      )}
      <p className="text-[11px] text-ink-faint">
        {fr ? 'Règle' : 'Grammar point'}: Coto Academy{meaning && ` · ${fr ? 'sens' : 'meaning'}: ${meaning.src}`}
        {here?.source.length ? ` · ${fr ? 'exemples' : 'examples'}: ${[...new Set(here.source.map((s) => s.src))].join(', ')}${SHOW_TATOEBA && here.tatoeba.length ? ', Tatoeba' : ''}` : SHOW_TATOEBA && here?.tatoeba.length ? ` · ${fr ? 'exemples' : 'examples'}: Tatoeba` : ''}
        {fr && here?.source.length ? ' · traductions des exemples en anglais, comme dans la source' : ''}
      </p>
      {list.length > 0 && (
        <>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-faint">{fr ? 'Exemples' : 'Examples'}</p>
          <ul className="space-y-1.5">{all ? list : list.slice(0, examples)}</ul>
          {!all && list.length > examples && (
            <button type="button" onClick={() => setAll(true)} className="btn-paper rounded-md px-3 py-1 text-xs font-semibold">
              {fr ? `Plus d’exemples (${list.length - examples})` : `More examples (${list.length - examples})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
