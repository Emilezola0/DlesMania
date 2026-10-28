import { sfx } from '../lib/sfx';
import { useProgress, type NameLang } from '../store/progress';

const LANGS: { id: NameLang; label: string; title: string }[] = [
  { id: 'en', label: 'EN', title: 'English names' },
  { id: 'fr', label: 'FR', title: 'French names' },
];

/**
 * English or French names, for the games that need one spelling (Franchise Wordle). Saved with the progress.
 * `display` replaces the default `inline-flex` (the header hides it on phones).
 */
export function NameLangSwitch({ display = 'inline-flex' }: { display?: string }) {
  const lang = useProgress((s) => s.nameLang);
  const setLang = useProgress((s) => s.setNameLang);
  return (
    <div role="group" aria-label="Names in" className={`${display} rounded-md border border-rule-strong p-0.5`}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          title={l.title}
          aria-pressed={lang === l.id}
          onClick={() => lang !== l.id && (sfx.click(), setLang(l.id))}
          className={`rounded px-1.5 py-0.5 font-display text-xs font-bold tracking-wider transition ${lang === l.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
