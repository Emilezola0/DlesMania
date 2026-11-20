// The owner's grammar books (src/data/jlpt-books.json, scripts/build-jlpt-books.mjs): each book's list of grammar
// points (its table of contents) with, for each point, a meaning, an explanation and examples written by an AI
// (Claude), never taken from the book — shown as such. A point that is also in Coto's list (src/data/jlpt.json)
// says which (`coto`), so its grammar note shows it too.

export interface BookExample {
  ja: string;
  /** "[漢字|かな]" for each kanji run. */
  furigana: string;
  /** The grammar in it: [start, end) in `ja`. */
  blank: [number, number];
  en: string;
  fr: string;
}
export interface BookPoint {
  /** Its number in the book (in order). */
  n: number;
  /** Its number as the book writes it, when not a plain count ("1-3": lesson 1, item 3). */
  l?: string;
  /** Its form, as the book lists it. */
  p: string;
  unit: number;
  /** The page its unit starts on. */
  page: number;
  coto?: { level: string; pattern: string };
  en: string;
  fr: string;
  form: string;
  note: { en: string; fr: string };
  ex: BookExample[];
}
export interface Book {
  id: string;
  title: string;
  edition: string;
  authors: string;
  publisher: string;
  level: string;
  /** Its units are lessons (課), each with a topic. */
  lessons?: boolean;
  units: { unit: number; from: number; to: number; page: number; title?: string }[];
  points: BookPoint[];
}

let loaded: Promise<Book[]> | null = null;
/** The books (a big file: loaded the first time it's needed). */
export const loadBooks = () => (loaded ??= import('../data/jlpt-books.json').then((m) => (m.default as unknown as { books: Book[] }).books));

/** The books' points that are this point of Coto's list (or the book's point of that form at its book's level), with their book. */
export async function bookPointsFor(level: string, pattern: string): Promise<{ book: Book; point: BookPoint }[]> {
  const books = await loadBooks();
  return books.flatMap((book) =>
    book.points.filter((p) => (p.coto?.level === level && p.coto.pattern === pattern) || (book.level === level && p.p === pattern)).map((point) => ({ book, point })),
  );
}

/** A book's short name, for the notes. */
export const bookShort = (b: Book) => (b.id === 'mimi-n2' ? '耳から覚える 文法 N2' : b.id === 'mimi-n3' ? '耳から覚える 文法 N3' : b.id === 'chukyu' ? '中級へ行こう' : b.title);
/** A unit's name: "Unit 01", or "第1課 ファストフード" for a book in lessons. */
export const unitName = (b: Book, unit: number) => {
  const u = b.units.find((x) => x.unit === unit);
  return b.lessons ? `第${unit}課${u?.title ? ` ${u.title}` : ''}` : `Unit ${String(unit).padStart(2, '0')}`;
};
