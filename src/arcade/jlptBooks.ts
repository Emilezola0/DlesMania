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
  /** Its number in the book. */
  n: number;
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
  units: { unit: number; from: number; to: number; page: number }[];
  points: BookPoint[];
}

let loaded: Promise<Book[]> | null = null;
/** The books (a big file: loaded the first time it's needed). */
export const loadBooks = () => (loaded ??= import('../data/jlpt-books.json').then((m) => (m.default as unknown as { books: Book[] }).books));

/** The books' points that are this point of Coto's list, with their book. */
export async function bookPointsFor(level: string, pattern: string): Promise<{ book: Book; point: BookPoint }[]> {
  const books = await loadBooks();
  return books.flatMap((book) => book.points.filter((p) => p.coto?.level === level && p.coto.pattern === pattern).map((point) => ({ book, point })));
}

/** A book's short name, for the notes. */
export const bookShort = (b: Book) => (b.id === 'mimi-n2' ? '耳から覚える 文法 N2' : b.title);
