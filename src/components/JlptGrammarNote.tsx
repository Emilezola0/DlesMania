import { useEffect, useState, type ReactNode } from 'react';
import { allGrammarExamples, grammarExplanation, grammarMeaning, type SourceExample } from '../arcade/jlptGrammar';
import { audioUrl, pieces, tatoebaUrl, type JlptSentence } from '../arcade/jlptSentences';
import { bookPointsFor, bookShort, unitName, type Book, type BookPoint } from '../arcade/jlptBooks';
import { useProgress } from '../store/progress';
import { GrammarKeepButton } from './JlptKeep';

/** How many examples show at first; the rest behind "More examples". */
const FIRST = 3;
/**
 * Tatoeba's sentences (read aloud when a voice recorded them), after the sources' own: only those that
 * passed the same check as the sources' (the point's form in the part marked; the others are in
 * jlpt-grammar-examples.json's tatoebaOut). They were matched to the points by form, not chosen by a source.
 */
const SHOW_TATOEBA = true;

/** A sentence read aloud (the effects' volume, never silent on a tap). */
function playSentence(s: JlptSentence) {
  const a = new Audio(audioUrl(s));
  a.volume = Math.min(1, Math.max(0.6, useProgress.getState().sfxVolume / 100));
  a.play().catch(() => {});
}

/** A sentence, its furigana under the kanji and the grammar point it shows underlined, with its translation and where it's from. */
export function Sentence({ furigana, blank, kana, translation, after, foot }: { furigana: string; blank: [number, number]; kana?: string; translation: string; after?: ReactNode; foot: ReactNode }) {
  const [b0, b1] = blank;
  return (
    <li className="space-y-0.5 rounded-md border border-rule px-3 py-2">
      <p lang="ja" className="ruby-under font-serif text-xl leading-[2.2]">
        {pieces(furigana).flatMap((p, i) => {
          // A plain run cut where the grammar point starts and ends, to underline it.
          const cuts = p.reading
            ? [[p.start, p.start + p.text.length]]
            : [
                [p.start, Math.max(p.start, Math.min(b0, p.start + p.text.length))],
                [Math.max(p.start, b0), Math.min(p.start + p.text.length, b1)],
                [Math.max(p.start, b1), p.start + p.text.length],
              ];
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

/** One of a source's own examples for the point (Bunpro, JLPT Sensei, Wikibooks). */
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
 * own, then the checked Tatoeba sentences (`examples` of them shown, the rest a tap away; `not`: the one
 * already on screen). Nothing for a point no source translates, or with no sentence.
 */
export function GrammarNote({ level, pattern, not, examples = FIRST }: { level: string; pattern: string; not?: number; examples?: number }) {
  const lang = useProgress((s) => s.nameLang);
  const meaning = grammarMeaning(level, pattern, lang);
  const [found, setFound] = useState<{
    key: string;
    source: SourceExample[];
    tatoeba: JlptSentence[];
  } | null>(null);
  const [all, setAll] = useState(false);
  // Wikibooks' explanation of the point (N5–N3), when it has one.
  const [explained, setExplained] = useState<{
    key: string;
    text: string;
    url: string;
  } | null>(null);
  const key = `${level}|${pattern}|${not ?? ''}`;
  useEffect(() => {
    let live = true;
    setAll(false);
    void allGrammarExamples(level, pattern, not).then((x) => live && setFound({ key, ...x }));
    void grammarExplanation(level, pattern, lang).then((x) => live && setExplained(x && { key: `${key}|${lang}`, ...x }));
    return () => {
      live = false;
    };
  }, [key, level, pattern, not, lang]);
  const here = found?.key === key ? found : null;
  // (N3's page gives a short gloss, like the meaning above: shown only when there's no meaning.)
  const explanation = explained?.key === `${key}|${lang}` && (level !== 'N3' || !meaning) ? explained : null;
  const list: ReactNode[] = [
    ...(here?.source ?? []).map((s, i) => <SourceSentence key={`s${i}`} s={s} />),
    ...(SHOW_TATOEBA ? (here?.tatoeba ?? []) : []).map((s) => <Example key={s.id} s={s} lang={lang} />),
  ];
  const fr = lang === 'fr';
  return (
    <div className="animate-pop space-y-2 text-left">
      <GrammarKeepButton level={level} pattern={pattern} />
      {meaning && (
        <p className="text-sm">
          <span className="font-display font-bold">{fr ? 'Sens' : 'Meaning'}</span> · {meaning.text} <span className="text-[11px] text-ink-faint">({meaning.src})</span>
        </p>
      )}
      {explanation && (
        <div className="rounded-md bg-tile/60 px-3 py-2 text-sm">
          <p className="whitespace-pre-line">{explanation.text}</p>
          <p className="mt-1 text-[11px] text-ink-faint">
            <a href={explanation.url} target="_blank" rel="noreferrer" className="underline">
              Wikibooks, JLPT Guide
            </a>{' '}
            (CC BY-SA){fr && ' · traduit de l’anglais'}
          </p>
        </div>
      )}
      <BookNotes level={level} pattern={pattern} lang={lang} />
      <p className="text-[11px] text-ink-faint">
        {fr ? 'Règle' : 'Grammar point'}: Coto Academy
        {meaning && ` · ${fr ? 'sens' : 'meaning'}: ${meaning.src}`}
        {here?.source.length
          ? ` · ${fr ? 'exemples' : 'examples'}: ${[...new Set(here.source.map((s) => s.src))].join(', ')}${SHOW_TATOEBA && here.tatoeba.length ? ', Tatoeba' : ''}`
          : SHOW_TATOEBA && here?.tatoeba.length
            ? ` · ${fr ? 'exemples' : 'examples'}: Tatoeba`
            : ''}
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

/**
 * A point of one of the owner's grammar books (src/arcade/jlptBooks.ts): where it is in the book, and its meaning,
 * how it's formed, what to know and examples, all written by an AI (Claude), never taken from the book: said so.
 */
export function BookPointNote({ book, point, lang, head = true }: { book: Book; point: BookPoint; lang: 'en' | 'fr'; head?: boolean }) {
  const fr = lang === 'fr';
  return (
    <div className="space-y-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
      {head && (
        <p className="text-[11px] font-semibold text-ink-soft">
          📕 <span lang="ja">{bookShort(book)}</span> · n° {point.l ?? point.n} · <span lang="ja">{unitName(book, point.unit)}</span> (p. {point.page})
        </p>
      )}
      <p>
        <span className="font-display font-bold">{fr ? 'Sens' : 'Meaning'}</span> · {fr ? point.fr : point.en}
      </p>
      <p className="text-ink-soft">
        <span className="font-display font-bold text-ink">{fr ? 'Forme' : 'Form'}</span> · <span lang="ja">{point.form}</span>
      </p>
      <p>{fr ? point.note.fr : point.note.en}</p>
      <ul className="space-y-1.5">
        {point.ex.map((e, i) => (
          <Sentence key={i} furigana={e.furigana} blank={e.blank} translation={fr ? e.fr : e.en} foot={fr ? 'Exemple écrit par IA' : 'Example written by AI'} />
        ))}
      </ul>
      <p className="text-[11px] text-ink-faint">
        {fr
          ? `Écrit par IA (Claude) à partir de la table des matières du livre, pas de son contenu : à vérifier. Le livre l’explique p. ${point.page} et suivantes.`
          : `Written by AI (Claude) from the book’s table of contents, not its content: check it. The book covers it from p. ${point.page}.`}
      </p>
    </div>
  );
}

/** The owner's books' notes on a point of Coto's list, when a book has it. */
function BookNotes({ level, pattern, lang }: { level: string; pattern: string; lang: 'en' | 'fr' }) {
  const [found, setFound] = useState<{ key: string; list: { book: Book; point: BookPoint }[] } | null>(null);
  const key = `${level}|${pattern}`;
  useEffect(() => {
    let live = true;
    void bookPointsFor(level, pattern).then((list) => live && setFound({ key, list }));
    return () => {
      live = false;
    };
  }, [key, level, pattern]);
  if (found?.key !== key || !found.list.length) return null;
  return (
    <>
      {found.list.map(({ book, point }) => (
        <BookPointNote key={`${book.id}-${point.n}`} book={book} point={point} lang={lang} />
      ))}
    </>
  );
}
