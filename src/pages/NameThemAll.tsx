import { useEffect, useRef, useState } from 'react';
import { useTypeToFocus } from '../lib/focus';
import { Link, Navigate, useParams } from 'react-router-dom';
import { NAME_LISTS, listsByFranchise, nameList, type NameList } from '../arcade/lists';
import { RARE_LABEL, addUses, bannedOf, pointsFor, setBanned, usesOf } from '../arcade/nameUses';
import { Customise, useCustomPicks } from '../components/Customise';

/** Franchises to show (Customise), and to draw the random list from. */
const NTL_OPTIONS = listsByFranchise().map(([f, lists]) => ({ key: f, label: f, hint: `${lists.length} lists` }));
import { matchAnswer } from '../lib/boss';
import { shownName } from '../lib/french';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

function Game({ list: whole }: { list: NameList }) {
  const key = `ntl:${whole.id}`;
  // Banned answers leave the list (kept per list on this device).
  const [banned, setBan] = useState<string[]>(() => bannedOf(whole.id));
  const [banOpen, setBanOpen] = useState(false);
  const [banFilter, setBanFilter] = useState('');
  const list = { ...whole, answers: whole.answers.filter((a) => !banned.includes(a.name)) };
  const toggleBan = (name: string) => {
    const next = banned.includes(name) ? banned.filter((n) => n !== name) : [...banned, name];
    setBan(next);
    setBanned(whole.id, next);
  };
  // How often each name was named in earlier runs: rarer names are worth more.
  const [uses, setUses] = useState(() => usesOf(whole.id));
  const [points, setPoints] = useState(0);
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [found, setFound] = useState<string[]>([]);
  const [left, setLeft] = useState(list.seconds);
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean; key: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useTypeToFocus(input);
  const prompt = { prompt: list.title, count: list.answers.length, answers: list.answers };
  const total = list.answers.length;

  useEffect(() => {
    if (state !== 'playing') return;
    input.current?.focus({ preventScroll: true });
    const t = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);
  useEffect(() => {
    if (state === 'playing' && left <= 0) finish(found);
  }, [left]);

  const finish = (names: string[]) => {
    setState('over');
    // Against the clock: a coin every few points (rare names count more; all of them is a long run).
    const pts = names.reduce((n, x) => n + pointsFor(uses[x] ?? 0), 0);
    recordBest(key, names.length, { reached: pts / 3 });
    addUses(whole.id, names);
    if (names.length === total) window.setTimeout(() => (sfx.streak(), celebrateBig()), 300);
    else sfx.wrong();
  };

  const accept = (name: string, typo: boolean) => {
    const next = [...found, name];
    setFound(next);
    setText('');
    const before = uses[name] ?? 0;
    setPoints((p) => p + pointsFor(before));
    const rare = RARE_LABEL(before);
    setNote({ text: `${typo ? `${name} (typo forgiven)` : name}${rare ? ` · ${rare} +${pointsFor(before)}` : ''}`, good: true, key: Date.now() });
    sfx.correct();
    if (next.length === total) finish(next);
  };

  // An exact, unambiguous spelling counts as soon as it's typed; Enter forgives typos.
  const onType = (value: string) => {
    setText(value);
    const m = matchAnswer(prompt, value, new Set(found));
    if (m && m.exact && !m.already) accept(m.name, false);
  };
  const onEnter = () => {
    const m = matchAnswer(prompt, text, new Set(found), true);
    if (!m) return setNote({ text: `“${text.trim()}” isn't on the list`, good: false, key: Date.now() });
    if (m.already) {
      setText('');
      return setNote({ text: `${m.name} — already named`, good: false, key: Date.now() });
    }
    accept(m.name, m.typo);
  };

  const start = () => {
    sfx.click();
    setUses(usesOf(whole.id));
    setPoints(0);
    setFound([]);
    setLeft(list.seconds);
    setText('');
    setNote(null);
    setState('playing');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-serif text-3xl font-bold tabular-nums">
          {found.length}
          <span className="text-base text-ink-faint"> / {total}</span>
          {state !== 'ready' && <span className="ml-3 font-display text-base text-ochre">{points} pts</span>}
        </p>
        <p className={`font-serif text-3xl font-bold tabular-nums ${state === 'playing' && left <= 10 ? 'text-coral' : ''}`}>{clock(left)}</p>
      </div>

      {state === 'ready' && (
        <div className="page space-y-3 rounded-md p-6 text-center">
          <p className="text-ink-soft">
            {total} to find in {clock(list.seconds)}. Type a name: it counts as soon as it&apos;s spelled right (Enter forgives a typo).
          </p>
          {best > 0 && <p className="text-sm text-ink-faint">Your best: {best} / {total}</p>}
          <p className="text-xs text-ink-faint">Names you rarely give are worth more: a new one 3 points, a rare one 2, a usual one 1 — and the DleCoins follow the points.</p>
          <button type="button" onClick={start} disabled={total === 0} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider disabled:opacity-50">
            Start
          </button>
          <div className="space-y-2 text-left">
            <button type="button" onClick={() => (sfx.click(), setBanOpen((o) => !o))} className="btn-paper rounded-full px-4 py-1.5 font-display text-sm font-bold">
              🚫 {banOpen ? 'Hide' : 'Ban some answers'}
              {banned.length > 0 && <span className="ml-1 font-normal text-ink-faint">· {banned.length} banned</span>}
            </button>
            {banOpen && (
              <div className="animate-pop space-y-2 rounded-md border border-rule-strong bg-card p-3">
                <p className="text-xs text-ink-soft">Tap an answer to take it off this list (tap again to bring it back). Banned answers don&apos;t count, and stay banned next time.</p>
                <input value={banFilter} onChange={(e) => setBanFilter(e.target.value)} placeholder="Find an answer…" autoComplete="off" className="w-full rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-sm" />
                <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
                  {whole.answers
                    .filter((a) => !banFilter || shownName(a.name).toLowerCase().includes(banFilter.toLowerCase()) || a.aliases?.some((x) => x.toLowerCase().includes(banFilter.toLowerCase())))
                    .slice(0, 300)
                    .map((a) => {
                      const off = banned.includes(a.name);
                      return (
                        <button key={a.name} type="button" aria-pressed={off} onClick={() => toggleBan(a.name)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${off ? 'border-miss bg-miss/15 text-miss line-through' : 'border-rule-strong bg-paper text-ink-soft hover:border-ink'}`}>
                          {shownName(a.name)}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {state === 'playing' && (
        <div className="flex gap-2">
          <input
            ref={input}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && text.trim() && onEnter()}
            placeholder="Type a name…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-lg outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4"
          />
          <button type="button" onClick={() => finish(found)} className="btn-paper shrink-0 rounded-md px-4 font-display text-sm font-semibold">
            Give up
          </button>
        </div>
      )}
      <p className="h-5 text-center text-sm font-semibold" aria-live="polite">
        {note && state === 'playing' && (
          <span key={note.key} className={`animate-pop inline-block ${note.good ? 'text-hit' : 'text-coral'}`}>
            {note.good ? `✓ ${note.text}` : note.text}
          </span>
        )}
      </p>

      {state === 'over' && (
        <div className="animate-pop space-y-3 rounded-md border border-rule-strong bg-card p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{found.length === total ? 'Every one of them!' : left <= 0 ? "Time's up" : 'Done'}</p>
          <p className="font-serif text-5xl font-bold">
            {found.length}
            <span className="text-xl text-ink-faint"> / {total}</span>
          </p>
          <p className="font-display text-sm text-ochre">{points} points{points > found.length ? ` · +${points - found.length} for rare names` : ''}</p>
          {found.length > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best} / {total}</p>}
          <button type="button" onClick={start} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Try again
          </button>
        </div>
      )}

      {state !== 'ready' && (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {list.answers.map((a, i) => {
            const got = found.includes(a.name);
            const missed = state === 'over' && !got;
            return (
              <li
                key={a.name}
                className={`truncate rounded-md border px-2.5 py-1.5 text-sm font-semibold ${got ? 'animate-pop border-hit/60 bg-hit/15' : missed ? 'border-miss/50 bg-miss/10 text-ink-soft' : 'border-rule bg-card text-ink-faint'}`}
              >
                {got || missed ? shownName(a.name) : `${i + 1}.`}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** /name-them-all and /name-them-all/:list */
export default function NameThemAll() {
  const { list: id } = useParams();
  const bests = useProgress((s) => s.bests);
  const { picks, setPicks } = useCustomPicks('omnidle-custom-ntl', NTL_OPTIONS);
  if (id) {
    const list = nameList(id);
    if (!list) return <Navigate to="/name-them-all" replace />;
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link to="/name-them-all" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Name Them All
          </Link>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{list.franchise}</p>
          <h1 className="text-4xl font-bold">{list.title}</h1>
        </div>
        <Game key={list.id} list={list} />
      </div>
    );
  }
  // Customise: only the picked franchises' lists, here and for the random list.
  const shown = NAME_LISTS.filter((l) => picks.includes(l.franchise));
  const random = shown[Math.floor(Math.random() * shown.length)];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Games
          </Link>
          <h1 className="text-5xl font-bold">Name Them All</h1>
          <p className="max-w-xl text-ink-soft">Pick a list and name every one of them before the clock runs out. {NAME_LISTS.length} lists across {listsByFranchise().length} franchises.</p>
        </div>
        {random && (
          <Link to={`/name-them-all/${random.id}`} className="btn-accent rounded-md px-5 py-2.5 font-display font-semibold tracking-wider">
            🎲 Random list
          </Link>
        )}
      </div>
      <Customise options={NTL_OPTIONS} picks={picks} onChange={setPicks} />
      {listsByFranchise().filter(([franchise]) => picks.includes(franchise)).map(([franchise, lists]) => (
        <section key={franchise} className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{franchise}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => {
              const best = bests[`ntl:${l.id}`] ?? 0;
              return (
                <li key={l.id}>
                  <Link to={`/name-them-all/${l.id}`} className="flex items-center justify-between gap-3 rounded-md border border-rule-strong bg-card px-3 py-2 transition hover:-translate-y-0.5 hover:border-ink">
                    <span className="font-semibold">{l.title}</span>
                    <span className={`shrink-0 font-display text-xs tabular-nums ${best === l.answers.length ? 'font-bold text-hit' : 'text-ink-faint'}`}>
                      {best ? `${best}/${l.answers.length}` : l.answers.length}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
