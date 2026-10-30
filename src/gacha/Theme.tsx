// What owning a franchise's best cards unlocks: its theme, which recolours the whole site and sets its
// symbols drifting behind the pages; and its companions, the other cards owned from that franchise, who
// pop up in the corner now and then to talk among themselves.
import { useEffect, useMemo, useRef, useState } from 'react';
import { shownName } from '../lib/french';
import { onCue, type Cue } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CARDS, CARD_BY_ID, RARITY_INFO, RARITY_LIGHT, type Card } from './cards';
import { pickExchange } from './Dialogue';
import { CardAvatar } from './Perks';
import { CHARACTER_LINES, REACTIONS } from './Reactions';

export interface FranchiseTheme {
  /** The site's main colour, and its deeper shade (buttons, links, highlights). */
  accent: string;
  strong: string;
  /** What drifts behind the pages. */
  glyphs: string[];
}

export const THEMES: Record<string, FranchiseTheme> = {
  lol: { accent: '#2b7fb8', strong: '#1f6595', glyphs: ['⚔️', '🛡️', '✨'] },
  overwatch: { accent: '#d9771f', strong: '#b05f15', glyphs: ['🎯', '⚡', '🛡️'] },
  minecraft: { accent: '#4d8f35', strong: '#3c7228', glyphs: ['🟩', '⛏️', '💎'] },
  onepiece: { accent: '#c73a32', strong: '#a02d27', glyphs: ['🏴‍☠️', '⚓', '🍖'] },
  dbz: { accent: '#e0701a', strong: '#b85a12', glyphs: ['⭐', '🐉', '💥'] },
  naruto: { accent: '#dd7a12', strong: '#b4620c', glyphs: ['🍥', '🌀', '🍃'] },
  starwars: { accent: '#3f6fd8', strong: '#2f57b0', glyphs: ['⭐', '🌌', '🚀'] },
  harrypotter: { accent: '#8c2b3a', strong: '#70212e', glyphs: ['⚡', '🪄', '🦉'] },
  lotr: { accent: '#6f7a34', strong: '#586127', glyphs: ['💍', '🌋', '🍃'] },
  mcu: { accent: '#b8232f', strong: '#941b25', glyphs: ['🛡️', '⚡', '🔨'] },
  smash: { accent: '#d43b52', strong: '#ad2d41', glyphs: ['🍄', '⭐', '🎮'] },
  genshin: { accent: '#4a8fb0', strong: '#39728e', glyphs: ['✨', '🌸', '💠'] },
  wow: { accent: '#3a6ea5', strong: '#2c5683', glyphs: ['⚔️', '🐉', '❄️'] },
  inazuma: { accent: '#d68a12', strong: '#ad6f0c', glyphs: ['⚽', '⚡', '🔥'] },
  forts: { accent: '#a5672a', strong: '#84511f', glyphs: ['💣', '🏰', '⚙️'] },
  forhonor: { accent: '#8a3b2a', strong: '#6f2e20', glyphs: ['⚔️', '🛡️', '🪓'] },
  avatar: { accent: '#2f8fa8', strong: '#247186', glyphs: ['💧', '🪨', '🔥', '🌪️'] },
  unreal: { accent: '#4b6cc4', strong: '#3a549e', glyphs: ['🔷', '⚙️', '🧩'] },
  destiny: { accent: '#5a7fa8', strong: '#466589', glyphs: ['🔺', '👁️', '✨'] },
  jlpt: { accent: '#b91c1c', strong: '#8f1515', glyphs: ['漢', '字', '⛩️', '🌸'] },
  balatro: { accent: '#c9352c', strong: '#a12a23', glyphs: ['♠️', '♥️', '♣️', '♦️', '🃏'] },
  ufouria: { accent: '#2563eb', strong: '#1d4ed8', glyphs: ['🐧', '🛸', '🌙', '☀️', '🚽'] },
};

/** The franchises whose theme is unlocked: a Legendary or better owned from it. */
export function unlockedThemes(cards: Record<string, number>): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(cards)) {
    if (!cards[id]) continue;
    const c = CARD_BY_ID.get(id);
    if (c && RARITY_INFO[c.rarity].rank >= 3) out.add(c.set);
  }
  return out;
}

/** The franchise on show: the one picked, if still unlocked, or the icon's when following it. */
function useThemeSet(): string | null {
  return useProgress((s) => {
    const pick = s.uiTheme ?? 'icon';
    if (pick === 'off') return null;
    if (pick === 'icon') {
      const c = s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined;
      return c && RARITY_INFO[c.rarity].rank >= 3 ? c.set : null;
    }
    return unlockedThemes(s.cards).has(pick) ? pick : null;
  });
}

const DRIFTERS = 10;
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The whole site in the franchise's colours (the CSS variables on the page), its symbols drifting behind. */
export function FranchiseTheme() {
  const set = useThemeSet();
  const theme = set ? THEMES[set] : undefined;
  useEffect(() => {
    const root = document.documentElement;
    if (!theme) return;
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-accent-strong', theme.strong);
    root.style.setProperty('--color-accent-soft', `color-mix(in srgb, ${theme.accent} 24%, var(--color-card))`);
    root.style.setProperty('--theme', theme.accent);
    root.classList.add('ui-themed');
    return () => {
      for (const v of ['--color-accent', '--color-accent-strong', '--color-accent-soft', '--theme']) root.style.removeProperty(v);
      root.classList.remove('ui-themed');
    };
  }, [theme]);
  const drifters = useMemo(() => (theme ? Array.from({ length: DRIFTERS }, (_, i) => ({ glyph: theme.glyphs[i % theme.glyphs.length], left: 4 + ((i * 97) % 92), delay: -(i * 5.3), duration: 26 + ((i * 7) % 18), size: 18 + ((i * 11) % 22) })) : []), [theme]);
  if (!theme || reducedMotion()) return null;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {drifters.map((d, i) => (
        <span key={i} className="theme-drift absolute bottom-0" style={{ left: `${d.left}%`, fontSize: d.size, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}>
          {d.glyph}
        </span>
      ))}
    </div>
  );
}

/** At least this long between two conversations (an icon at Mythic or above keeps them talking), the chance a plain play starts one, and how long each line stays. */
const CHAT_GAP_MS = 60_000;
const CHAT_GAP_TOP_MS = 20_000;
const CHAT_CHANCE = 0.25;
const CHAT_CHANCE_TOP = 0.6;
const LINE_MS = 2800;
/** After the play: the icon's own reaction reads first. */
const CHAT_DELAY_MS = 900;
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
/** What a lone card says: its own lines, else its franchise's. */
const lineOf = (c: Card, kind: Cue) => {
  const lines = CHARACTER_LINES[c.name] ?? REACTIONS[c.set] ?? { good: ['Nice!'], bad: ['Oops…'] };
  return pick(kind === 'bad' ? lines.bad : lines.good);
};

/**
 * The franchise's characters talking about the game: cards the player owns pop up after a play and hold a
 * little exchange, glad or dismayed according to how it went. Only cards that are owned come, so the
 * conversation grows with the collection; a Mythic or Omni icon joins in, and gets them talking far more often.
 */
export function Companions() {
  const on = useProgress((s) => s.companions ?? true);
  const themeSet = useThemeSet();
  const cards = useProgress((s) => s.cards);
  const avatarId = useProgress((s) => s.avatar);
  const icon = avatarId && cards[avatarId] ? CARD_BY_ID.get(avatarId) : undefined;
  const top = !!icon && RARITY_INFO[icon.rarity].rank >= 4;
  // A top icon brings its franchise along, whichever theme is on.
  const set = top ? icon.set : themeSet;
  const cast = useMemo(() => (set ? CARDS.filter((c) => c.set === set && cards[c.id] && c.id !== avatarId && c.rarity !== 'mythic' && c.rarity !== 'omni') : []), [set, cards, avatarId]);
  const [talk, setTalk] = useState<{ card: Card; text: string; key: number; side: number } | null>(null);
  const last = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!on || !set || cast.length < 1) return;
    const off = onCue((kind) => {
      const now = Date.now();
      if (now - last.current < (top ? CHAT_GAP_TOP_MS : CHAT_GAP_MS) || /\/(shop|album)/.test(window.location.hash)) return;
      // A big moment always draws them; otherwise now and then.
      if (kind !== 'great' && Math.random() > (top ? CHAT_CHANCE_TOP : CHAT_CHANCE)) return;
      last.current = now;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const first = pick(cast);
      // The icon answers about half the time, when it's a top card.
      const others = cast.filter((c) => c.name !== first.name);
      const second = top && icon && icon.name !== first.name && (Math.random() < 0.5 || !others.length) ? icon : others.length ? pick(others) : null;
      const say = (card: Card, text: string, i: number) => timers.current.push(window.setTimeout(() => setTalk({ card, text, key: now + i, side: i % 2 }), CHAT_DELAY_MS + LINE_MS * i));
      if (second) {
        const speaker = (i: number) => (i % 2 ? second : first);
        const lines = pickExchange(set, kind, (i) => shownName(speaker(i + 1).name, set));
        lines.forEach((text, i) => say(speaker(i), text, i));
        timers.current.push(window.setTimeout(() => setTalk(null), CHAT_DELAY_MS + LINE_MS * lines.length));
      } else {
        say(first, lineOf(first, kind), 0);
        timers.current.push(window.setTimeout(() => setTalk(null), CHAT_DELAY_MS + LINE_MS));
      }
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
    };
  }, [on, set, cast, top, icon]);
  if (!talk) return null;
  const light = RARITY_LIGHT[talk.card.rarity];
  return (
    <div key={talk.key} className="react-in pointer-events-none fixed bottom-4 left-3 z-40 flex max-sm:bottom-16 max-w-[18rem] items-center gap-2" style={{ marginBottom: talk.side ? '3.5rem' : 0 }} aria-live="polite">
      <CardAvatar card={talk.card} className="size-12 shrink-0" />
      <div className="rounded-2xl rounded-bl-sm border-2 bg-card px-3 py-1.5 text-sm shadow-xl" style={{ borderColor: light }}>
        <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: light }}>
          {talk.card.name}
        </p>
        <p className="font-bold">{talk.text}</p>
      </div>
    </div>
  );
}
