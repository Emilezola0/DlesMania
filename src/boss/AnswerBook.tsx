import { useEffect, useMemo, useRef, useState } from 'react';
import { frenchOf } from '../lib/french';
import type { Boss } from '../types';
import { finaleFaces } from './faces';

/** One accepted answer: its name, every other spelling the fight takes, and a picture when it has one. */
interface Entry {
  name: string;
  also: string[];
  image?: string;
  /** What it answers (a Signature's clue). */
  clue?: string;
}

/** Same words, ignoring case, accents and punctuation: "Lord Dominiks Regards" adds nothing to "Lord Dominik's Regards". */
const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function entry(name: string, spellings: (string | undefined)[], set: string, extra: Partial<Entry> = {}): Entry {
  const seen = new Set([key(name)]);
  const also = [...spellings, frenchOf(name, set)].filter((s): s is string => !!s && !seen.has(key(s)) && !!seen.add(key(s)));
  return { name, also, ...extra };
}

interface Section {
  id: string;
  title: string;
  note?: string;
  groups: { label?: string; entries: Entry[] }[];
}

function sectionsOf(boss: Boss): Section[] {
  const set = boss.id;
  const out: Section[] = [
    {
      id: 'blitz',
      title: 'I · Knowledge Blitz',
      groups: boss.blitz.map((p) => ({ label: p.prompt, entries: p.answers.map((a) => entry(a.name, a.aliases, set)) })),
    },
    {
      id: 'radar',
      title: 'II · Radar',
      note: 'Cards from the franchise, and the look-alikes from elsewhere.',
      groups: [
        { label: `From ${boss.franchise}`, entries: boss.radar.members.map((c) => entry(c.label, [...(c.aliases ?? []), c.fr], set, { image: c.image })) },
        { label: 'Impostors', entries: boss.radar.impostors.map((c) => entry(c.label, [], set, { image: c.image })) },
      ],
    },
    {
      id: 'finale',
      title: 'III · Final Blow',
      note: 'Every face the Final Blow can show.',
      groups: [{ entries: finaleFaces(boss).map((c) => entry(c.label, [...(c.aliases ?? []), c.fr], set, { image: c.image })) }],
    },
  ];
  if (boss.secret?.categories.length)
    out.push({
      id: 'chain',
      title: 'Secret · Name Chain',
      groups: boss.secret.categories.map((c) => ({ label: c.label, entries: c.entities.map((e) => entry(e.name, e.aliases, set)) })),
    });
  if (boss.signature)
    out.push({
      id: 'signature',
      title: `Secret · Signature`,
      note: boss.signature.prompt,
      groups: [
        {
          entries: boss.signature.clues.map((c) =>
            entry(c.answer.name, c.answer.aliases, set, { clue: c.text ? [c.text, c.effect].filter(Boolean).join(' — ') : '🔊 A sound clip' }),
          ),
        },
      ],
    });
  return out;
}

/**
 * Every answer a boss fight takes, phase by phase, with the other spellings that count — to see why an
 * answer wasn't accepted, or learn the ones missed. A button at the top of every fight opens it.
 */
export function AnswerBook({ boss, onClose }: { boss: Boss; onClose: () => void }) {
  const sections = useMemo(() => sectionsOf(boss), [boss]);
  const [tab, setTab] = useState(sections[0].id);
  const [query, setQuery] = useState('');
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const q = key(query);
  const matches = (e: Entry) => !q || [e.name, ...e.also, e.clue ?? ''].some((s) => key(s).includes(q));
  // A search looks through every phase; otherwise only the open tab.
  const shown = sections.filter((s) => q || s.id === tab);

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="answers-title"
        onClick={(e) => e.stopPropagation()}
        className="page animate-pop relative my-auto w-full max-w-3xl rounded-md bg-paper p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{boss.franchise}</p>
            <h2 id="answers-title" className="text-3xl font-bold sm:text-4xl">
              Every accepted answer
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Grey names are other spellings that count too. Small typos are forgiven.</p>
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-2xl leading-none text-ink-soft transition hover:bg-tile hover:text-ink">
            ×
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search every phase…"
          className="mt-4 w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-sm outline-none focus:border-ink"
        />

        {!q && (
          <div className="mt-3 flex flex-wrap gap-1 border-b border-rule" role="tablist">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={tab === s.id}
                onClick={() => setTab(s.id)}
                className={`-mb-px border-b-2 px-3 py-2 font-display text-sm font-semibold tracking-wider transition ${
                  tab === s.id ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {shown.map((s) => {
            const groups = s.groups.map((g) => ({ ...g, entries: g.entries.filter(matches) })).filter((g) => g.entries.length);
            if (!groups.length) return null;
            return (
              <section key={s.id} className="space-y-3">
                {q && <h3 className="font-display text-sm font-bold uppercase tracking-widest text-ink-faint">{s.title}</h3>}
                {s.note && !q && <p className="text-sm italic text-ink-soft">{s.note}</p>}
                {groups.map((g, i) => (
                  <div key={i}>
                    {g.label && (
                      <p className="mb-1.5 font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                        {g.label} <span className="font-normal text-ink-faint">· {g.entries.length}</span>
                      </p>
                    )}
                    <ul className={g.entries.some((e) => e.clue) ? 'space-y-1.5' : 'grid gap-1.5 sm:grid-cols-2'}>
                      {g.entries.map((e, k) => (
                        <li key={k} className="flex items-center gap-2 rounded-md border border-rule bg-card/60 px-2 py-1.5 text-sm">
                          {e.image && <img src={e.image} alt="" loading="lazy" className="size-8 shrink-0 rounded object-cover object-top" />}
                          <span className="min-w-0">
                            {e.clue && <span className="block text-xs text-ink-soft">{e.clue}</span>}
                            <span className="font-semibold">{e.name}</span>
                            {e.also.length > 0 && <span className="text-ink-faint"> · {e.also.join(' · ')}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
          {q && shown.every((s) => !s.groups.some((g) => g.entries.some(matches))) && <p className="text-center text-sm text-ink-soft">Not an answer anywhere in this fight.</p>}
        </div>
      </div>
    </div>
  );
}

/** The 📖 button that opens the book. */
export function AnswerBookButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Every accepted answer"
      aria-label={label ?? 'Every accepted answer'}
      className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-2.5 py-1.5 font-display text-xs font-semibold tracking-wider text-ink-soft transition hover:border-ink hover:text-ink"
    >
      <span aria-hidden>📖</span>
      {label && <span>{label}</span>}
    </button>
  );
}
