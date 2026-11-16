// /jlpt/books/:id — one of the owner's grammar books (src/arcade/jlptBooks.ts): its points unit by unit, as its
// table of contents lists them, each opening on its meaning, form, explanation and examples written by an AI
// (Claude), never taken from the book. A point also in Coto's list links to it there.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadBooks, unitName, type Book } from '../arcade/jlptBooks';
import { BookPointNote } from '../components/JlptGrammarNote';
import { useProgress } from '../store/progress';

export default function JlptBook() {
  const { id } = useParams();
  const lang = useProgress((s) => s.nameLang);
  const fr = lang === 'fr';
  const [books, setBooks] = useState<Book[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void loadBooks().then((b) => live && setBooks(b));
    return () => {
      live = false;
    };
  }, []);
  if (!books) return <p className="text-sm text-ink-faint">…</p>;
  const book = books.find((b) => b.id === id);
  if (!book) return <p className="text-sm">{fr ? 'Pas de livre à ce nom.' : 'No book by that name.'}</p>;
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link to="/jlpt" className="text-xs text-ink-faint hover:text-ink">
          ← {fr ? 'Japonais' : 'Japanese'}
        </Link>
        <h1 lang="ja" className="font-display text-2xl font-bold">
          {book.title}
        </h1>
        <p className="text-sm text-ink-soft">
          {book.edition} · {book.authors} · {book.publisher} · {book.points.length} {fr ? 'règles' : 'grammar points'}
        </p>
        <p className="text-xs text-ink-faint">
          {fr
            ? 'La liste des règles vient de la table des matières du livre. Le sens, les explications et les exemples sont écrits par une IA (Claude), pas tirés du livre : à vérifier, et le livre reste la référence.'
            : 'The list of points comes from the book’s table of contents. Meanings, explanations and examples are written by an AI (Claude), not taken from the book: check them; the book stays the reference.'}
        </p>
      </header>
      {book.units.map((u) => (
        <section key={u.unit} className="space-y-2">
          <h2 lang="ja" className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">
            {unitName(book, u.unit)} · {book.lessons ? `${u.to - u.from + 1} ${fr ? 'règles' : 'points'}` : `${u.from}–${u.to}`} · p. {u.page}
          </h2>
          <ul className="space-y-1.5">
            {book.points
              .filter((p) => p.unit === u.unit)
              .map((p) => (
                <li key={p.n} className="rounded-md border border-rule bg-card/60">
                  <button type="button" onClick={() => setOpen(open === p.n ? null : p.n)} className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-tile/60" aria-expanded={open === p.n}>
                    <span className="w-10 shrink-0 font-display text-sm font-bold text-accent tabular-nums">{p.l ?? p.n}</span>
                    <span lang="ja" className="shrink-0 font-serif text-lg">
                      {p.p}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{fr ? p.fr : p.en}</span>
                    {p.coto && <span className="shrink-0 rounded-full bg-tile px-2 py-0.5 text-[10px] font-semibold text-ink-faint">{p.coto.level}</span>}
                  </button>
                  {open === p.n && (
                    <div className="space-y-2 border-t border-rule px-3 py-2">
                      <BookPointNote book={book} point={p} lang={lang} head={false} />
                      {p.coto && (
                        <Link to={`/jlpt/list/${p.coto.level.toLowerCase()}`} className="text-xs font-semibold text-accent hover:underline">
                          {fr ? `Aussi dans la liste ${p.coto.level} (${p.coto.pattern}) →` : `Also in the ${p.coto.level} list (${p.coto.pattern}) →`}
                        </Link>
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
