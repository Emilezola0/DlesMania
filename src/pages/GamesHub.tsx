import { Link } from 'react-router-dom';
import { HL_DECKS } from '../arcade/higherLower';
import { NAME_LISTS } from '../arcade/lists';
import { todayKey } from '../lib/date';
import { RANK_DATA, RANK_ROUNDS } from '../rank/data';
import { UNIVERSES } from '../specialist/rounds';
import { useProgress } from '../store/progress';

interface GameCard {
  to: string;
  icon: string;
  title: string;
  blurb: string;
  /** A line about the player's progress, or nothing yet. */
  stat?: string;
}

function Card({ game }: { game: GameCard }) {
  return (
    <li>
      <Link to={game.to} className="page group flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
        <span className="text-3xl transition-transform group-hover:scale-110">{game.icon}</span>
        <span className="font-display text-xl font-bold">{game.title}</span>
        <span className="text-sm text-ink-soft">{game.blurb}</span>
        <span className="mt-auto pt-3 text-xs text-ink-faint">{game.stat ?? 'Not played yet'}</span>
      </Link>
    </li>
  );
}

/** /games: every game beyond the daily challenge, Free Play and the bosses. */
export default function GamesHub() {
  const { special, whosThat, bests, rogueRun } = useProgress();
  const today = todayKey();
  const doneToday = (key: string, rounds: number) => Object.values(special[`${key}:${today}`] ?? {}).filter((r) => r.status !== 'playing').length >= rounds;
  const universesDone = UNIVERSES.filter((u) => doneToday(u.id, u.types.length)).length;
  const rankDone = RANK_DATA.games.filter((g) => doneToday(`rank-${g.id}`, RANK_ROUNDS)).length;
  const best = (prefix: string) => Math.max(0, ...Object.entries(bests).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v));
  const whoBest = Math.max(0, ...Object.values(whosThat));
  const listsDone = NAME_LISTS.filter((l) => (bests[`ntl:${l.id}`] ?? 0) >= l.answers.length).length;
  const listsTried = NAME_LISTS.filter((l) => bests[`ntl:${l.id}`]).length;

  const dailies: GameCard[] = [
    {
      to: '/specialist',
      icon: '🎯',
      title: 'Specialist',
      blurb: 'One universe, every angle: One Piece, League, Marvel, Genshin and World of Warcraft, each with its own rounds.',
      stat: universesDone ? `Today: ${universesDone}/${UNIVERSES.length} universes done` : undefined,
    },
    {
      to: '/rank',
      icon: '🏅',
      title: 'Guess the Rank',
      blurb: 'Watch a ranked game and say what rank the player is: League, Valorant, Rocket League and CS2.',
      stat: rankDone ? `Today: ${rankDone}/${RANK_DATA.games.length} games done` : undefined,
    },
  ];
  const arcade: GameCard[] = [
    {
      to: '/rail-rush',
      icon: '🚂',
      title: 'Rail Rush',
      blurb: 'A train on three tracks, faster and faster: name the character on a free track to switch to it before the barricade.',
      stat: best('rail:') ? `Best: ${best('rail:')} gates` : undefined,
    },
    {
      to: '/whos-that',
      icon: '👤',
      title: "Who's That?",
      blurb: 'Silhouettes one after another: keep naming them until the first mistake.',
      stat: whoBest ? `Best streak: ${whoBest}` : undefined,
    },
    {
      to: '/higher-lower',
      icon: '↕️',
      title: 'Higher or Lower',
      blurb: `Bounties, box office, release years… is the next one higher or lower? ${HL_DECKS.length} decks.`,
      stat: best('hl:') ? `Best streak: ${best('hl:')}` : undefined,
    },
    {
      to: '/name-them-all',
      icon: '📝',
      title: 'Name Them All',
      blurb: `Every Straw Hat, every Dragon Aspect, every champion — against the clock. ${NAME_LISTS.length} lists.`,
      stat: listsTried ? `${listsTried} lists tried · ${listsDone} completed` : undefined,
    },
    {
      to: '/wordle',
      icon: '🟩',
      title: 'Franchise Wordle',
      blurb: 'Wordle with names: a Pokémon, a champion, a Straw Hat… in six tries.',
      stat: best('wordle:') ? `Best streak: ${best('wordle:')}` : undefined,
    },
    {
      to: '/quick-sort',
      icon: '↔️',
      title: 'Quick Sort',
      blurb: 'Horde or Alliance? Melee or ranged? Send each card to its side, faster and faster.',
      stat: best('sort:') ? `Best: ${best('sort:')} sorted` : undefined,
    },
    {
      to: '/six-degrees',
      icon: '🕸️',
      title: 'Six Degrees',
      blurb: 'Link two characters through the groups they share, in as few steps as you can.',
      stat: best('six:') ? `Best: ${best('six:')} / 15 ★` : undefined,
    },
    {
      to: '/who-am-i',
      icon: '🕵️',
      title: 'Who Am I?',
      blurb: 'Clues one at a time, vaguest first: name the character as early as you dare. One Piece, League, Marvel, Genshin and Warcraft.',
      stat: best('who:') ? `Best: ${best('who:')} / 500` : undefined,
    },
    {
      to: '/odd-one-out',
      icon: '🧩',
      title: 'Odd One Out',
      blurb: 'Five cards, four share a link: spot the intruder, and keep the streak going.',
      stat: best('odd:') ? `Best streak: ${best('odd:')}` : undefined,
    },
    {
      to: '/memory',
      icon: '🃏',
      title: 'Memory Pairs',
      blurb: 'Turn two cards at a time and match what goes together: a Devil Fruit and its user, a champion and their ultimate…',
      stat: best('memory:') ? `Best: ${best('memory:')} points` : undefined,
    },
    {
      to: '/map-quiz',
      icon: '📍',
      title: 'Map Quiz',
      blurb: 'A place name, a world map: click where it is. Kanto and Runeterra to start.',
      stat: best('map:') ? `Best: ${best('map:')}` : undefined,
    },
    {
      to: '/guess-the-year',
      icon: '📅',
      title: 'Guess the Year',
      blurb: 'Five games, anime, films or albums: when did each come out? The closer, the more points.',
      stat: best('year:') ? `Best: ${best('year:')} / 500` : undefined,
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Beyond the daily</p>
        <h1 className="text-5xl font-bold">Games</h1>
        <p className="max-w-xl text-ink-soft">Everything else to play: more dailies with their own streaks, and arcade games to play as long as you like.</p>
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Adventure</h2>
        <Link to="/expedition" className="page group flex flex-col gap-2 rounded-md p-6 ring-2 ring-coral/50 transition hover:-translate-y-0.5 sm:flex-row sm:items-center">
          <span className="text-5xl transition-transform group-hover:scale-110">🗺️</span>
          <span className="flex-1">
            <span className="block font-display text-2xl font-bold">Expedition</span>
            <span className="block text-sm text-ink-soft">
              A roguelike made of every game: choose your path through rooms, collect gold and relics, beat a guardian at the end of each act. Lose all
              your hearts and the run is over.
            </span>
          </span>
          <span className="text-xs text-ink-faint">
            {rogueRun && !rogueRun.over ? `Run in progress · act ${rogueRun.act}` : bests['rogue:mixed'] ? `Best: ${bests['rogue:mixed']}` : 'Not played yet'}
          </span>
        </Link>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">More dailies</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {dailies.map((g) => (
            <Card key={g.to} game={g} />
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Arcade · endless</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {arcade.map((g) => (
            <Card key={g.to} game={g} />
          ))}
        </ul>
      </section>
    </div>
  );
}
