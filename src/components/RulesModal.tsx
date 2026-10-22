import { useEffect, useRef } from 'react';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { DIFFICULTIES, DIFFICULTY_IDS, PHASES, totalRounds } from '../lib/boss';
import { useUi, type RulesTab } from '../store/ui';
import { Glyph } from './Glyph';
import { ClassicDemo, FinalDemo, SwipeDemo, TilesDemo, TypingDemo } from './RulesDemos';

/** "Who said it — and where?" → "who said it — and where?"; adds a full stop when there's no punctuation. */
const sentence = (s: string) => `${s[0].toLowerCase()}${s.slice(1)}${/[.?!]$/.test(s) ? '' : '.'}`;

const TABS: { id: RulesTab; label: string }[] = [
  { id: 'daily', label: 'Daily & Free Play' },
  { id: 'boss', label: 'Boss Battle' },
];

function Step({ n, title, children, demo }: { n: string; title: string; children: React.ReactNode; demo?: React.ReactNode }) {
  return (
    <section className="grid items-center gap-4 sm:grid-cols-[1fr_220px]">
      <div>
        <h3 className="flex items-baseline gap-2 font-display text-lg font-bold">
          <span className="text-ink-faint">{n}</span> {title}
        </h3>
        <div className="mt-1 space-y-1.5 text-sm text-ink-soft">{children}</div>
      </div>
      {demo}
    </section>
  );
}

/** A note shared by both tabs: how typed answers are judged. */
function Forgiving() {
  return (
    <p className="rounded-md border border-rule bg-card/70 px-3 py-2 text-sm text-ink-soft">
      <b className="text-ink">Typing is forgiving.</b> Capitals, accents and punctuation don't matter (<i>chateau</i> = <i>Château</i>), French names
      count as much as English ones (<i>Le Voyage de Chihiro</i>, <i>Severus Rogue</i>, <i>Lingot de fer</i>), and small typos are let through — one
      for words of 3–5 letters, two for longer ones.
    </p>
  );
}

function DailyRules() {
  return (
    <div className="space-y-6">
      <Step n="I" title="One daily per category">
        <p>
          Video Games, Anime, Cinema and Music each have their own daily: ten rounds of different mini-games (Anime and Video Games add a voice game, so one sits out each day), the same for everyone. Finish
          a category to keep your streak alive. Free Play lets you replay any mini-game as often as you like.
        </p>
      </Step>
      <Step n="II" title="Classic — read the attributes" demo={<ClassicDemo />}>
        <p>
          Guess any work: each of its attributes is compared with the answer. <b className="text-hit">Green</b> is a match, <b className="text-near">amber</b> a
          partial match (one shared genre, say), <b className="text-miss">red</b> no match. Narrow it down until every cell is green.
        </p>
      </Step>
      <Step n="III" title="Cover Puzzle — name the cover" demo={<TilesDemo />}>
        <p>The cover is cut up, shuffled, recoloured, blurred and partly mirrored. Swap two tiles or tap one twice to rotate it if that helps you read it — but only typing the title wins. Each piece keeps its disguise when you move it, and each miss gives two pieces their true colours back.</p>
      </Step>
      <Step n="IV" title="Every other round">
        <ul className="grid gap-1 sm:grid-cols-2">
          {GAME_TYPES.filter((t) => t !== 'classic' && t !== 'tiles').map((t) => (
            <li key={t} className="flex items-start gap-1.5">
              <Glyph seed={t} size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>
                <b className="text-ink">{GAME_META[t].name}</b> — {sentence(GAME_META[t].tagline)}
              </span>
            </li>
          ))}
        </ul>
        <p>Fewer guesses means more points. Hints unlock as you miss.</p>
      </Step>
      <Forgiving />
    </div>
  );
}

function BossRules() {
  const demos = [<TypingDemo key="1" />, <SwipeDemo key="2" />, <FinalDemo key="3" />];
  return (
    <div className="space-y-6">
      <Step n="⚔" title="The fight">
        <p>
          Pick a domain, a franchise and a difficulty, then face its guardian. Its life bar has one segment per round: win a round to break one. Lose
          a round and the boss strikes — you lose one of your three hearts and retry with new content. Lose all three and the fight is over.
        </p>
      </Step>
      <Step n="◆" title="Three difficulties">
        <ul className="space-y-1.5">
          {DIFFICULTY_IDS.map((id) => {
            const d = DIFFICULTIES[id];
            return (
              <li key={id}>
                <b className="text-ink">{d.label}</b> — {totalRounds(d)} rounds, ×{d.scoreMultiplier} points. {d.blurb}
              </li>
            );
          })}
        </ul>
        <p>
          On Hard, some cards swap the zones (a banner flashes <i>⇄ zones reversed</i> and the labels change sides), zones may glow as a decoy,
          and a swipe made before a card has settled counts as a mistake. Every second loop on Hard is shorter but harder: less time, fewer but faster cards, and pictures zoomed in tight, recoloured and sometimes upside down. And when a Hard guardian's life bar runs dry… don't relax just yet.
        </p>
      </Step>
      {PHASES.map((p, i) => (
        <Step key={p.name} n={p.roman} title={p.name} demo={demos[i]}>
          <p>{p.how}</p>
          {i === 0 && <p>Exact names count the moment you type them; a name with a typo counts when you press Enter or pause.</p>}
          {i === 1 && <p>Cards show only a picture: impostors come from look-alike franchises. Each card has its own short timer.</p>}
          {i === 2 && <p>Pick from the suggestions or type the name yourself. The picture clears up as the clock runs down.</p>}
        </Step>
      ))}
      <p className="text-sm text-ink-soft">Your score adds phases won, hearts kept, accuracy and speed. Best scores and times are saved per boss.</p>
      <Forgiving />
    </div>
  );
}

/** "How to play": opened from the header's ? button, the Daily page and the boss intro. */
export function RulesModal() {
  const tab = useUi((s) => s.rules);
  const open = useUi((s) => s.openRules);
  const close = useUi((s) => s.closeRules);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!tab) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    // Keep the page behind still while the rules are open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [tab, close]);

  if (!tab) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:p-6" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
        className="page animate-pop relative my-auto w-full max-w-3xl rounded-md bg-paper p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Règles du jeu</p>
            <h2 id="rules-title" className="text-3xl font-bold sm:text-4xl">
              How to Play
            </h2>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label="Close the rules"
            className="rounded-md p-2 text-2xl leading-none text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex gap-1 border-b border-rule" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => open(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 font-display text-sm font-semibold tracking-wider transition ${
                tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {tab === 'daily' ? <DailyRules /> : <BossRules />}
        </div>

        <button type="button" onClick={close} className="btn-ink mt-6 w-full rounded-md py-3 font-display font-bold tracking-widest">
          Got it
        </button>
      </div>
    </div>
  );
}

/** A small "?" / "How to play" button that opens the rules on a given tab. */
export function RulesButton({ tab, label, className = '' }: { tab: RulesTab; label?: string; className?: string }) {
  const open = useUi((s) => s.openRules);
  return (
    <button
      type="button"
      onClick={() => open(tab)}
      title="How to play"
      aria-label={label ?? 'How to play'}
      className={`inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-2.5 py-1.5 font-display text-xs font-semibold tracking-wider text-ink-soft transition hover:border-ink hover:text-ink ${className}`}
    >
      <span className="grid size-5 place-items-center rounded-full border border-current text-[11px] font-bold">?</span>
      {label && <span>{label}</span>}
    </button>
  );
}
