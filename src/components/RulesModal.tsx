import { useEffect, useRef } from 'react';
import { GAME_META, GAME_TYPES } from '../games/meta';
import { DIFFICULTIES, DIFFICULTY_IDS, PHASES, difficultyIn, phaseIn, totalRounds } from '../lib/boss';
import { useT } from '../boss/lang';
import { useProgress } from '../store/progress';
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
function Forgiving({ fr = false }: { fr?: boolean }) {
  if (fr)
    return (
      <p className="rounded-md border border-rule bg-card/70 px-3 py-2 text-sm text-ink-soft">
        <b className="text-ink">La frappe est indulgente.</b> Majuscules, accents et ponctuation ne comptent pas (<i>chateau</i> = <i>Château</i>), les noms
        anglais comptent autant que les français (<i>Spirited Away</i>, <i>Severus Snape</i>, <i>Iron Ingot</i>), et les petites fautes passent — une
        pour les mots de 3 à 5 lettres, deux pour les plus longs.
      </p>
    );
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
  const fr = useProgress((s) => s.nameLang) === 'fr';
  const t = useT();
  return (
    <div className="space-y-6">
      <Step n="⚔" title={t('The fight', 'Le combat')}>
        <p>
          {t(
            'Pick a domain, a franchise and a difficulty, then face its guardian. Its life bar has one segment per round: win a round to break one. Lose a round and the boss strikes — you lose one of your three hearts and retry with new content. Lose all three and the fight is over.',
            'Choisis un domaine, une franchise et une difficulté, puis affronte son gardien. Sa barre de vie a un segment par manche : gagne une manche pour en briser un. Perds une manche et le boss frappe — tu perds un de tes trois cœurs et tu recommences avec un nouveau contenu. Perds-les tous les trois et le combat est fini.',
          )}
        </p>
      </Step>
      <Step n="◆" title={t('The difficulties', 'Les difficultés')}>
        <ul className="space-y-1.5">
          {DIFFICULTY_IDS.map((id) => {
            const d = DIFFICULTIES[id];
            return (
              <li key={id}>
                <b className="text-ink">{difficultyIn(id, fr).label}</b> — {totalRounds(d)} {t('rounds', 'manches')}, ×{d.scoreMultiplier} points. {difficultyIn(id, fr).blurb}
              </li>
            );
          })}
        </ul>
        {fr ? (
          <p>
            En Difficile, certaines cartes inversent les zones (un bandeau affiche <i>⇄ zones inversées</i> et les étiquettes changent de côté), des zones peuvent s’allumer pour te leurrer,
            et un glissement fait avant qu’une carte se soit posée compte comme une erreur. Moyen et Difficile ajoutent une quatrième phase, la Chaîne de noms : le gardien nomme quelque chose, tu en nommes un autre du même genre, et rien ne peut revenir. Et en Difficile, quand la barre de vie est vide… une dernière épreuve : la Signature du gardien, un indice sur un aspect très précis de son monde (un rire, les statistiques d’un objet, un Patronus…). Trouve le bon nom et il tombe ; une mauvaise réponse prend tous tes cœurs, avec une dernière chance.
          </p>
        ) : (
          <p>
            On Hard, some cards swap the zones (a banner flashes <i>⇄ zones reversed</i> and the labels change sides), zones may glow as a decoy,
            and a swipe made before a card has settled counts as a mistake. Medium and Hard add a fourth phase, the Name Chain: the guardian names something, you name another of the same kind, and nothing can come back. And on Hard, when the life bar runs dry… one last test: the guardian's Signature, a clue on one very specific side of its world (a laugh, an item's stats, a Patronus…). Name it right and it falls; a wrong answer takes every heart, with one last chance.
          </p>
        )}
      </Step>
      {PHASES.map((p, i) => (
        <Step key={p.name} n={p.roman} title={phaseIn(i, fr).name} demo={demos[i]}>
          <p>{phaseIn(i, fr).how}</p>
          {i === 0 && <p>{t('Exact names count the moment you type them; a name with a typo counts when you press Enter or pause.', 'Les noms exacts comptent dès que tu les tapes ; un nom avec une faute compte quand tu appuies sur Entrée ou que tu marques une pause.')}</p>}
          {i === 1 && <p>{t('Cards show only a picture: impostors come from look-alike franchises. Each card has its own short timer.', 'Les cartes ne montrent qu’une image : les imposteurs viennent de franchises qui se ressemblent. Chaque carte a son propre petit chrono.')}</p>}
          {i === 2 && <p>{t('Pick from the suggestions or type the name yourself. The picture clears up as the clock runs down.', 'Choisis parmi les suggestions ou tape le nom toi-même. L’image s’éclaircit à mesure que le chrono s’écoule.')}</p>}
        </Step>
      ))}
      <p className="text-sm text-ink-soft">
        {t('Your score adds phases won, hearts kept, accuracy and speed. Best scores and times are saved per boss.', 'Ton score additionne les phases gagnées, les cœurs gardés, la précision et la vitesse. Les meilleurs scores et temps sont gardés pour chaque boss.')}
      </p>
      <Forgiving fr={fr} />
    </div>
  );
}

/** "How to play": opened from the header's ? button, the Daily page and the boss intro. */
export function RulesModal() {
  const tab = useUi((s) => s.rules);
  const open = useUi((s) => s.openRules);
  const close = useUi((s) => s.closeRules);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const t = useT();

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
              {t('How to Play', 'Comment jouer')}
            </h2>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label={t('Close the rules', 'Fermer les règles')}
            className="rounded-md p-2 text-2xl leading-none text-ink-soft transition hover:bg-tile hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex gap-1 border-b border-rule" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => open(x.id)}
              className={`-mb-px border-b-2 px-3 py-2 font-display text-sm font-semibold tracking-wider transition ${
                tab === x.id ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {x.id === 'daily' ? t(x.label, 'Quotidien et partie libre') : x.label}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {tab === 'daily' ? <DailyRules /> : <BossRules />}
        </div>

        <button type="button" onClick={close} className="btn-ink mt-6 w-full rounded-md py-3 font-display font-bold tracking-widest">
          {t('Got it', 'Compris')}
        </button>
      </div>
    </div>
  );
}

/** A small "?" / "How to play" button that opens the rules on a given tab. */
export function RulesButton({ tab, label, className = '' }: { tab: RulesTab; label?: string; className?: string }) {
  const open = useUi((s) => s.openRules);
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => open(tab)}
      title={t('How to play', 'Comment jouer')}
      aria-label={label ?? t('How to play', 'Comment jouer')}
      className={`inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-2.5 py-1.5 font-display text-xs font-semibold tracking-wider text-ink-soft transition hover:border-ink hover:text-ink ${className}`}
    >
      <span className="grid size-5 place-items-center rounded-full border border-current text-[11px] font-bold">?</span>
      {label && <span>{label}</span>}
    </button>
  );
}
