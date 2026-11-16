// /jlpt/grammar — every grammar point in one place: Coto's list (src/data/jlpt.json, N5 to N1) and the owner's
// books (src/arcade/jlptBooks.ts). A book's point that is also on Coto's list joins that point's row (its book
// note shows in the grammar note); the others get rows of their own, under their book's level. Filters: level,
// source (the list or one book), and a search on the form or the meaning.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { JLPT_LEVELS } from '../arcade/jlpt';
import { bookShort, loadBooks, type Book, type BookPoint } from '../arcade/jlptBooks';
import { grammarMeaning } from '../arcade/jlptGrammar';
import { BookPointNote, GrammarNote } from '../components/JlptGrammarNote';
import { useProgress } from '../store/progress';

interface Row {
  key: string;
  level: string;
  pattern: string;
  /** On Coto's list (its grammar note), or a book's point only. */
  coto: boolean;
  books: { book: Book; point: BookPoint }[];
}

const LEVELS = JLPT_LEVELS.map((l) => l.level);

export default function JlptAllGrammar() {
  const lang = useProgress((s) => s.nameLang);
  const fr = lang === 'fr';
  const [books, setBooks] = useState<Book[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadBooks().then((b) => live && setBooks(b));
    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const byCoto = new Map<string, Row>();
    for (const l of JLPT_LEVELS)
      for (const g of l.grammar) {
        const r: Row = { key: `${l.level}|${g}`, level: l.level, pattern: g, coto: true, books: [] };
        byCoto.set(r.key, r);
        out.push(r);
      }
    for (const book of books)
      for (const point of book.points) {
        const on = point.coto && byCoto.get(`${point.coto.level}|${point.coto.pattern}`);
        if (on) on.books.push({ book, point });
        else out.push({ key: `${book.id}|${point.n}`, level: book.level, pattern: point.p, coto: false, books: [{ book, point }] });
      }
    return out;
  }, [books]);

  const meaningOf = (r: Row) => (r.coto ? grammarMeaning(r.level, r.pattern, lang)?.text : undefined) ?? (r.books[0] ? (fr ? r.books[0].point.fr : r.books[0].point.en) : undefined);
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!level || r.level === level) &&
      (!source || (source === 'coto' ? r.coto : r.books.some((b) => b.book.id === source))) &&
      (!q || r.pattern.includes(q) || r.books.some((b) => b.point.p.includes(q)) || (meaningOf(r)?.toLowerCase().includes(q) ?? false)),
  );

  const chip = (on: boolean) => `rounded-full px-3 py-1 font-display text-sm font-bold ${on ? 'btn-ink' : 'btn-paper'}`;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {fr ? 'Japonais' : 'Japanese'}
        </Link>
        <h1 className="text-4xl font-bold">{fr ? 'Toute la grammaire' : 'All the grammar'}</h1>
        <p className="text-sm text-ink-soft">
          {rows.length} {fr ? 'règles' : 'grammar points'} · {fr ? 'la liste N5–N1 et tes livres' : 'the N5–N1 list and your books'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(!level)} onClick={() => setLevel(null)}>
          {fr ? 'Tous' : 'All'}
        </button>
        {LEVELS.map((l) => (
          <button key={l} type="button" className={chip(level === l)} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(!source)} onClick={() => setSource(null)}>
          {fr ? 'Toutes les sources' : 'Every source'}
        </button>
        <button type="button" className={chip(source === 'coto')} onClick={() => setSource('coto')}>
          {fr ? 'La liste (Coto)' : 'The list (Coto)'}
        </button>
        {books.map((b) => (
          <button key={b.id} type="button" className={chip(source === b.id)} onClick={() => setSource(b.id)}>
            <span lang="ja">{bookShort(b)}</span>
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={fr ? 'Chercher une règle ou un sens…' : 'Search a form or a meaning…'}
        className="w-full rounded-md border border-rule bg-card px-3 py-2 text-sm"
      />
      <p className="text-xs text-ink-faint">
        {shown.length} {fr ? 'règles affichées' : 'shown'}
      </p>
      {LEVELS.filter((l) => shown.some((r) => r.level === l)).map((l) => (
        <section key={l} className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{l}</h2>
          <ul className="space-y-1.5">
            {shown
              .filter((r) => r.level === l)
              .map((r) => (
                <li key={r.key} className="rounded-md border border-rule bg-card/60">
                  <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-tile/60" aria-expanded={open === r.key}>
                    <span lang="ja" className="shrink-0 font-serif text-lg font-bold">
                      {r.pattern}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink-soft">{meaningOf(r) ?? '—'}</span>
                    <span className="flex shrink-0 flex-wrap gap-1">
                      {r.coto && <span className="rounded-full bg-tile px-2 py-0.5 text-[10px] font-semibold text-ink-faint">Coto</span>}
                      {r.books.map(({ book, point }) => (
                        <span key={`${book.id}-${point.n}`} lang="ja" className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          {bookShort(book)} {point.l ?? point.n}
                        </span>
                      ))}
                    </span>
                  </button>
                  {open === r.key && (
                    <div className="space-y-2 border-t border-rule px-3 py-2">
                      {r.coto ? (
                        <GrammarNote level={r.level} pattern={r.pattern} />
                      ) : (
                        r.books.map(({ book, point }) => <BookPointNote key={`${book.id}-${point.n}`} book={book} point={point} lang={lang} />)
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
