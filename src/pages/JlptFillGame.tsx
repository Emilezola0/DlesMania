import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { audioUrl, pieces } from '../arcade/jlptSentences';
import { fillRight, loadFill, type FillItem } from '../arcade/jlptFill';
import { GrammarNote } from '../components/JlptGrammarNote';
import { celebrateBig, shake } from '../lib/fx';
import { useT } from '../lib/i18n';
import { romajiSpellings, toHiragana } from '../lib/romaji';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Mistakes allowed before it's over. */
const LIVES = 3;

/**
 * A sentence, its furigana over the kanji, with the grammar point's place either a hole (`hole`) or underlined
 * (once answered).
 */
function FillSentence({ item, hole }: { item: FillItem; hole: boolean }) {
  const [b0, b1] = item.blank;
  const out: React.ReactNode[] = [];
  let holed = false;
  pieces(item.furigana).forEach((p, i) => {
    const end = p.start + p.text.length;
    // A run cut where the hole starts and ends (a kanji word is never cut: the hole holds whole words).
    const cuts = p.reading ? [[p.start, end]] : [[p.start, Math.max(p.start, Math.min(b0, end))], [Math.max(p.start, b0), Math.min(end, b1)], [Math.max(p.start, b1), end]];
    cuts
      .filter(([from, to]) => to > from)
      .forEach(([from, to], j) => {
        const inHole = from >= b0 && to <= b1;
        if (inHole && hole) {
          if (!holed) {
            holed = true;
            out.push(
              <span key="hole" className="mx-1 inline-block min-w-[3em] border-b-4 border-accent align-baseline" style={{ width: `${Math.max(3, [...item.answer].length) * 1.05}em` }} aria-label="blank">
                &nbsp;
              </span>,
            );
          }
          return;
        }
        const text = p.text.slice(from - p.start, to - p.start);
        const mark = inHole ? 'font-bold text-accent underline decoration-2 underline-offset-4' : '';
        out.push(
          p.reading ? (
            <ruby key={`${i}-${j}`} className={mark}>
              {text}
              <rt>{p.reading}</rt>
            </ruby>
          ) : (
            <span key={`${i}-${j}`} className={mark}>
              {text}
            </span>
          ),
        );
      });
  });
  return (
    <p lang="ja" className="font-serif text-2xl leading-[2.4] sm:text-3xl">
      {out}
    </p>
  );
}

/** One level's game: sentences one after the other, until the lives are gone. */
function FillGame({ level, items }: { level: string; items: FillItem[] }) {
  const t = useT();
  const lang = useProgress((s) => s.nameLang);
  const key = `jlpt:${level.toLowerCase()}-fill`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const recent = useRef<string[]>([]);
  const draw = () => {
    // Not the same sentence again soon, nor the same grammar point twice in a row.
    const last = recent.current[0]?.split('|')[1];
    const fresh = items.filter((x) => !recent.current.includes(x.key) && x.pattern !== last);
    const pool = fresh.length ? fresh : items;
    const item = pool[Math.floor(Math.random() * pool.length)];
    recent.current = [item.key, ...recent.current].slice(0, Math.floor(items.length / 2));
    return item;
  };
  const [item, setItem] = useState(draw);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const [hint, setHint] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const field = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const over = lives <= 0;

  useEffect(() => {
    if (state === 'guess') field.current?.focus();
  }, [state, item]);

  const submit = () => {
    if (state !== 'guess' || !typed.trim()) return;
    if (fillRight(item, typed)) {
      sfx.correct();
      setScore(score + 1);
      setState('right');
      return;
    }
    sfx.wrong();
    shake(card.current, 10, 420);
    setState('wrong');
    const left = lives - 1;
    setLives(left);
    if (left <= 0) {
      if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
      recordBest(key, score, { reached: score / 2 });
    }
  };
  const next = () => {
    sfx.click();
    if (over) {
      setScore(0);
      setLives(LIVES);
    }
    setItem(draw());
    setTyped('');
    setHint(false);
    setState('guess');
  };

  // What goes in the hole, in kana and romaji.
  const kana = item.kana ?? (/^[ぁ-ゖァ-ヶー]+$/.test(item.answer) ? item.answer : null);
  const roman = kana ? romajiSpellings(toHiragana(kana))[0] : '';
  const translation = (lang === 'fr' && item.fr) || item.en;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-display text-sm text-ink-soft" aria-label={t(`${lives} lives left`, `${lives} vies restantes`)}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={i < lives ? '' : 'opacity-25 grayscale'}>
              ❤️
            </span>
          ))}
        </p>
        <p className="font-display text-sm text-ink-soft">
          {t('Score', 'Score')} <span className="font-serif text-2xl font-bold text-ink">{score}</span> · {t('best', 'record')} {Math.max(best, over ? score : 0)}
        </p>
      </div>
      <div ref={card} className="page space-y-3 rounded-md p-5 text-center sm:p-7">
        <div key={item.key} className="animate-round-in">
          <FillSentence item={item} hole={state === 'guess'} />
        </div>
        <p className="text-sm text-ink-soft">“{translation}”</p>
        {state === 'guess' &&
          (hint ? (
            <p className="text-sm">
              💡 {t('The grammar point', 'La règle')}:{' '}
              <span lang="ja" className="font-semibold">
                {item.pattern}
              </span>
            </p>
          ) : (
            <button type="button" onClick={() => (sfx.click(), setHint(true))} className="btn-paper rounded-full px-3 py-1 text-xs font-semibold">
              💡 {t('Hint: which grammar point?', 'Indice : quelle règle ?')}
            </button>
          ))}
        {state !== 'guess' && (
          <div className="animate-pop space-y-0.5">
            <p className={`font-display text-sm font-bold ${state === 'right' ? 'text-hit' : 'text-coral'}`}>{state === 'right' ? t('✓ Right', '✓ Juste') : t('✗ Not quite', '✗ Pas tout à fait')}</p>
            <p className="text-sm">
              <span className="text-ink-faint">{t('In the gap: ', 'Dans le trou : ')}</span>
              <span lang="ja" className="font-semibold">
                {item.answer}
              </span>
              {kana && kana !== item.answer && (
                <span lang="ja" className="text-ink-soft">
                  {' '}
                  ({kana})
                </span>
              )}
              {roman && <span className="text-ink-soft"> · {roman}</span>}
            </p>
            {item.reading && (
              <p lang="ja" className="text-sm text-ink-soft">
                {item.reading}
              </p>
            )}
            <p className="text-[11px] text-ink-faint">
              <a href={item.url} target="_blank" rel="noreferrer" className="underline">
                {item.src}
              </a>
              {item.tatoeba?.audio && (
                <button type="button" onClick={() => void new Audio(audioUrl(item.tatoeba!)).play().catch(() => {})} className="ml-2 text-sm text-ink-soft hover:text-ink" aria-label={t('Listen', 'Écouter')}>
                  🔊
                </button>
              )}
            </p>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (state === 'guess') submit();
          else next();
        }}
        className="flex gap-2"
      >
        <input
          ref={field}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={state !== 'guess'}
          lang="ja"
          placeholder={t('What goes in the gap, in kana or romaji…', 'Ce qui va dans le trou, en kana ou en romaji…')}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="jlpt-fill"
          className={`min-w-0 flex-1 rounded-md border-2 bg-card px-4 py-3 text-lg outline-none focus:border-ink ${state === 'right' ? 'border-hit' : state === 'wrong' ? 'border-miss' : 'border-rule-strong'}`}
        />
        {state === 'guess' ? (
          <button type="submit" disabled={!typed.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
            ↵
          </button>
        ) : (
          <button type="submit" autoFocus data-next className="btn-ink rounded-md px-5 font-display font-bold tracking-wider">
            {over ? t('Play again', 'Rejouer') : t('Next ↵', 'Suivante ↵')}
          </button>
        )}
      </form>
      {over && (
        <div className="animate-pop space-y-1 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{t('Out of lives', 'Plus de vies')}</p>
          <p className="font-serif text-5xl font-bold">{score}</p>
          {score > best ? <p className="font-display text-sm font-bold text-ochre">★ {t('New best', 'Nouveau record')}</p> : <p className="text-sm text-ink-soft">{t(`Best: ${best}`, `Record : ${best}`)}</p>}
        </div>
      )}
      {/* Right or wrong: what the grammar point means, and more sentences that use it. */}
      {state !== 'guess' && (
        <div className="page rounded-md p-4">
          <p className="mb-2 text-sm">
            <span className="font-display font-bold">{t('Grammar point', 'Règle')}</span> ·{' '}
            <span lang="ja" className="font-semibold">
              {item.pattern}
            </span>
          </p>
          <GrammarNote level={level} pattern={item.pattern} not={item.tatoeba?.id} />
        </div>
      )}
    </div>
  );
}

/** /jlpt/n5-fill…: a level's Fill the Gap. */
export function FillPage({ level }: { level: string }) {
  const t = useT();
  const [all, setAll] = useState<Record<string, FillItem[]> | null>(null);
  useEffect(() => {
    let live = true;
    void loadFill().then((x) => live && setAll(x));
    return () => {
      live = false;
    };
  }, []);
  const items = useMemo(() => all?.[level] ?? [], [all, level]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {t('Japanese', 'Japonais')}
        </Link>
        <h1 className="text-4xl font-bold">✏️ {level} {t('Fill the Gap', 'Texte à trous')}</h1>
        <p className="text-sm text-ink-soft">
          {t(
            `Real sentences with a gap where one of ${level}'s grammar points goes: write it in, in kana or romaji, as the sentence needs it. ${LIVES} lives, no clock; every answer shows the sentence whole and what the grammar point means.`,
            `De vraies phrases avec un trou à la place d’une règle de grammaire du ${level} : écris-la, en kana ou en romaji, telle que la phrase la demande. ${LIVES} vies, pas de chrono ; chaque réponse montre la phrase entière et le sens de la règle.`,
          )}
        </p>
      </div>
      {!all ? <p className="text-center text-sm text-ink-soft">{t('Loading the sentences…', 'Chargement des phrases…')}</p> : items.length ? <FillGame key={level} level={level} items={items} /> : <p className="text-center text-sm text-ink-soft">{t('No sentences for this level.', 'Pas de phrases pour ce niveau.')}</p>}
    </div>
  );
}
