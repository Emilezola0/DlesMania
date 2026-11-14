import { Link } from 'react-router-dom';
import { HL_DECKS } from '../arcade/higherLower';
import { JLPT_DECKS } from '../arcade/jlpt';
import { NAME_LISTS } from '../arcade/lists';
import { DleCoin } from '../components/DleCoin';
import { COLLECTIBLE } from '../gacha/cards';
import { HOT_BONUS, HOT_PLAYS, hotNow } from '../gacha/economy';
import { Quests } from '../gacha/Quests';
import { todayKey } from '../lib/date';
import { RANK_DATA, RANK_ROUNDS } from '../rank/data';
import { UNIVERSES } from '../specialist/rounds';
import { useProgress } from '../store/progress';
import { useT } from '../lib/i18n';

interface GameCard {
  to: string;
  icon: string;
  title: string;
  blurb: string;
  /** A line about the player's progress, or nothing yet. */
  stat?: string;
}

function Card({ game, hot }: { game: GameCard; hot?: string }) {
  const t = useT();
  return (
    <li className="relative">
      {hot === game.to && <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-coral px-2 py-0.5 font-display text-xs font-bold text-on-strong">🔥 +{Math.round(HOT_BONUS * 100)}%</span>}
      <Link to={game.to} className="page group flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
        <span className="text-3xl transition-transform group-hover:scale-110">{game.icon}</span>
        <span className="font-display text-xl font-bold">{game.title}</span>
        <span className="text-sm text-ink-soft">{game.blurb}</span>
        <span className="mt-auto pt-3 text-xs text-ink-faint">{game.stat ?? t('Not played yet', 'Pas encore joué')}</span>
      </Link>
    </li>
  );
}

/** /games: every game beyond the daily challenge, Free Play and the bosses. */
export default function GamesHub() {
  const { special, whosThat, bests, rogueRun, coins, cards, hotGame } = useProgress();
  const hot = hotNow(hotGame, todayKey());
  const collected = COLLECTIBLE.filter((c) => cards[c.id]).length;
  const today = todayKey();
  const doneToday = (key: string, rounds: number) => Object.values(special[`${key}:${today}`] ?? {}).filter((r) => r.status !== 'playing').length >= rounds;
  const universesDone = UNIVERSES.filter((u) => doneToday(u.id, u.types.length)).length;
  const rankDone = RANK_DATA.games.filter((g) => doneToday(`rank-${g.id}`, RANK_ROUNDS)).length;
  const best = (prefix: string) => Math.max(0, ...Object.entries(bests).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v));
  const whoBest = Math.max(0, ...Object.values(whosThat));
  const listsDone = NAME_LISTS.filter((l) => (bests[`ntl:${l.id}`] ?? 0) >= l.answers.length).length;
  const listsTried = NAME_LISTS.filter((l) => bests[`ntl:${l.id}`]).length;
  const t = useT();

  const dailies: GameCard[] = [
    {
      to: '/specialist',
      icon: '🎯',
      title: t('Specialist', 'Spécialiste'),
      blurb: t('One universe, every angle: One Piece, League, Marvel, Genshin, Warcraft, Overwatch, Japanese and more, each with its own rounds.', 'Un univers, sous tous les angles : One Piece, League, Marvel, Genshin, Warcraft, Overwatch, le japonais et plus encore, chacun avec ses propres manches.'),
      stat: universesDone ? t(`Today: ${universesDone}/${UNIVERSES.length} universes done`, `Aujourd’hui : ${universesDone}/${UNIVERSES.length} univers faits`) : undefined,
    },
    {
      to: '/rank',
      icon: '🏅',
      title: t('Guess the Rank', 'Devine le rang'),
      blurb: t('Watch a ranked game and say what rank the player is: League, Valorant, Rocket League and CS2.', 'Regarde une partie classée et devine le rang du joueur : League, Valorant, Rocket League et CS2.'),
      stat: rankDone ? t(`Today: ${rankDone}/${RANK_DATA.games.length} games done`, `Aujourd’hui : ${rankDone}/${RANK_DATA.games.length} jeux faits`) : undefined,
    },
  ];
  const arcade: GameCard[] = [
    {
      to: '/rail-rush',
      icon: '🚂',
      title: 'Rail Rush',
      blurb: t('A train on three tracks, faster and faster: name the character on a free track to switch to it before the barricade.', 'Un train sur trois voies, de plus en plus vite : nomme le personnage sur une voie libre pour y passer avant la barricade.'),
      stat: best('rail:') ? t(`Best: ${best('rail:')} gates`, `Record : ${best('rail:')} portes`) : undefined,
    },
    {
      to: '/whos-that',
      icon: '👤',
      title: t("Who's That?", 'Qui est-ce ?'),
      blurb: t('Silhouettes one after another: keep naming them until the first mistake.', "Des silhouettes l'une après l'autre : nomme-les jusqu'à la première erreur."),
      stat: whoBest ? t(`Best streak: ${whoBest}`, `Meilleure série : ${whoBest}`) : undefined,
    },
    {
      to: '/higher-lower',
      icon: '↕️',
      title: t('Higher or Lower', 'Plus ou moins'),
      blurb: t(`Bounties, box office, release years… is the next one higher or lower? ${HL_DECKS.length} decks.`, `Primes, box-office, années de sortie… le suivant est-il plus haut ou plus bas ? ${HL_DECKS.length} paquets.`),
      stat: best('hl:') ? t(`Best streak: ${best('hl:')}`, `Meilleure série : ${best('hl:')}`) : undefined,
    },
    {
      to: '/name-them-all',
      icon: '📝',
      title: t('Name Them All', 'Nomme-les tous'),
      blurb: t(`Every Straw Hat, every Dragon Aspect, every champion — against the clock. ${NAME_LISTS.length} lists.`, `Chaque Chapeau de paille, chaque Aspect dragon, chaque champion — contre la montre. ${NAME_LISTS.length} listes.`),
      stat: listsTried ? t(`${listsTried} lists tried · ${listsDone} completed`, `${listsTried} listes tentées · ${listsDone} terminées`) : undefined,
    },
    {
      to: '/wordle',
      icon: '🟩',
      title: t('Franchise Wordle', 'Wordle des franchises'),
      blurb: t('Wordle with names: a Pokémon, a champion, a Straw Hat… in six tries.', 'Le Wordle des noms : un Pokémon, un champion, un Chapeau de paille… en six essais.'),
      stat: best('wordle:') ? t(`Best streak: ${best('wordle:')}`, `Meilleure série : ${best('wordle:')}`) : undefined,
    },
    {
      to: '/quick-sort',
      icon: '↔️',
      title: t('Quick Sort', 'Tri express'),
      blurb: t('Horde or Alliance? Melee or ranged? Send each card to its side, faster and faster.', 'Horde ou Alliance ? Mêlée ou distance ? Envoie chaque carte de son côté, de plus en plus vite.'),
      stat: best('sort:') ? t(`Best: ${best('sort:')} sorted`, `Record : ${best('sort:')} triées`) : undefined,
    },
    {
      to: '/six-degrees',
      icon: '🕸️',
      title: t('Six Degrees', 'Six degrés'),
      blurb: t('Link two characters through the groups they share, in as few steps as you can.', 'Relie deux personnages par les groupes qu’ils partagent, en le moins d’étapes possible.'),
      stat: best('six:') ? t(`Best: ${best('six:')} / 15 ★`, `Record : ${best('six:')} / 15 ★`) : undefined,
    },
    {
      to: '/who-am-i',
      icon: '🕵️',
      title: t('Who Am I?', 'Qui suis-je ?'),
      blurb: t('Clues one at a time, vaguest first: name the character as early as you dare. One Piece, League, Marvel, Genshin and Warcraft.', 'Des indices un par un, du plus vague au plus précis : nomme le personnage aussi tôt que tu l’oses. One Piece, League, Marvel, Genshin et Warcraft.'),
      stat: best('who:') ? t(`Best: ${best('who:')} / 500`, `Record : ${best('who:')} / 500`) : undefined,
    },
    {
      to: '/summit',
      icon: '🧗',
      title: t('Summit', 'Sommet'),
      blurb: t('Climb hand over hand: type the name on a hold to grab it, before your stamina runs out. Your score is the height.', 'Grimpe prise après prise : tape le nom sur une prise pour l’attraper, avant d’être à bout de forces. Ton score, c’est la hauteur.'),
      stat: bests['climb:height'] ? t(`Best: ${(bests['climb:height'] / 10).toFixed(1)} m`, `Record : ${(bests['climb:height'] / 10).toFixed(1).replace('.', ',')} m`) : undefined,
    },
    {
      to: '/crossroads',
      icon: '🌉',
      title: t('Crossroads', 'Carrefours'),
      blurb: t('A character falls down the lines: draw bridges at any angle to steer them to their own franchise. Faster with every point.', 'Un personnage tombe le long des lignes : trace des ponts dans tous les angles pour le mener à sa franchise. Plus vite à chaque point.'),
      stat: bests['cross:score'] ? t(`Best: ${bests['cross:score']} points`, `Record : ${bests['cross:score']} points`) : undefined,
    },
    {
      to: '/odd-one-out',
      icon: '🧩',
      title: t('Odd One Out', 'L’intrus'),
      blurb: t('Five cards, four share a link: spot the intruder, and keep the streak going.', 'Cinq cartes, quatre ont un point commun : repère l’intrus, et prolonge la série.'),
      stat: best('odd:') ? t(`Best streak: ${best('odd:')}`, `Meilleure série : ${best('odd:')}`) : undefined,
    },
    {
      to: '/memory',
      icon: '🃏',
      title: t('Memory Pairs', 'Paires de mémoire'),
      blurb: t('Turn two cards at a time and match what goes together: a Devil Fruit and its user, a champion and their ultimate…', 'Retourne deux cartes à la fois et associe ce qui va ensemble : un fruit du démon et son utilisateur, un champion et son ultime…'),
      stat: best('memory:') ? t(`Best: ${best('memory:')} points`, `Record : ${best('memory:')} points`) : undefined,
    },
    {
      to: '/map-quiz',
      icon: '📍',
      title: t('Map Quiz', 'Quiz de cartes'),
      blurb: t('A place name, a world map: click where it is. Kanto and Runeterra to start.', 'Un nom de lieu, une carte du monde : clique où il se trouve. Kanto et Runeterra pour commencer.'),
      stat: best('map:') ? t(`Best: ${best('map:')}`, `Record : ${best('map:')}`) : undefined,
    },
    {
      to: '/guess-the-year',
      icon: '📅',
      title: t('Guess the Year', 'Devine l’année'),
      blurb: t('Five games, anime, films or albums: when did each come out? The closer, the more points.', 'Cinq jeux, anime, films ou albums : quand chacun est-il sorti ? Plus tu es proche, plus tu marques.'),
      stat: best('year:') ? t(`Best: ${best('year:')} / 500`, `Record : ${best('year:')} / 500`) : undefined,
    },
  ];

  // Apart from the rest: the games to learn with, and the side games (two players on one screen, a test). They
  // sit out the Hot Game, the missions and the quests.
  const learn: GameCard[] = [
    {
      to: '/jlpt',
      icon: '🇯🇵',
      title: t('Japanese', 'Japonais'),
      blurb: t(`Japanese from N5 to N1, by level or by theme (animals, food, the body…): the meaning or the reading of a word or a kanji, with a review list of the ones that give you trouble. ${JLPT_DECKS.length} decks.`, `Le japonais du N5 au N1, par niveau ou par thème (animaux, nourriture, le corps…) : le sens ou la lecture d’un mot ou d’un kanji, avec une liste de révision de ceux qui te posent problème. ${JLPT_DECKS.length} paquets.`),
      stat: best('jlpt:') ? t(`Best streak: ${best('jlpt:')}`, `Meilleure série : ${best('jlpt:')}`) : undefined,
    },
    {
      to: '/curve-clash',
      icon: '📈',
      title: 'Curve Clash',
      blurb: t('Two players, one screen: fire along the curve of a function you write, over the islands, and knock out the other side.', 'Deux joueurs, un écran : tire le long de la courbe d’une fonction que tu écris, par-dessus les îles, et élimine l’autre camp.'),
    },
    {
      to: '/stick-fight',
      icon: '🥊',
      title: t('Stick Fight (test)', 'Stick Fight (test)'),
      blurb: t('A turn-based duel with a mystery Overwatch hero, as a stickman: its moves are the clue, and only its name can finish the fight.', 'Un duel au tour par tour contre un héros mystère d’Overwatch, en bonhomme bâton : ses coups sont l’indice, et seul son nom peut finir le combat.'),
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{t('Beyond the daily', 'Au-delà du défi du jour')}</p>
        <h1 className="text-5xl font-bold">{t('Games', 'Jeux')}</h1>
        <p className="max-w-xl text-ink-soft">
          {t(
            'Everything else to play: more dailies with their own streaks, and arcade games to play as long as you like.',
            'Tout le reste à jouer : d’autres défis du jour avec leurs propres séries, et des jeux d’arcade à jouer aussi longtemps que tu veux.',
          )}
        </p>
      </div>
      {/* The Hot Game: more coins for moving around. */}
      <Link to={hot.game.to} className="page flex items-center gap-4 rounded-md p-4 ring-2 ring-coral/60 transition hover:-translate-y-0.5">
        <span className="text-3xl">{hot.game.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xs uppercase tracking-[0.25em] text-coral">🔥 {t('Hot game', 'Jeu brûlant')}</span>
          <span className="block font-display text-xl font-bold">
            {t(hot.game.title, hot.game.titleFr)}: +{Math.round(HOT_BONUS * 100)}% DleCoins
          </span>
          <span className="block text-sm text-ink-soft">
            {t(
              `${hot.left} game${hot.left === 1 ? '' : 's'} left, then the bonus moves to another game. Every ${HOT_PLAYS} games, and every new day.`,
              `Encore ${hot.left} partie${hot.left === 1 ? '' : 's'}, puis le bonus passe à un autre jeu. Toutes les ${HOT_PLAYS} parties, et chaque nouveau jour.`,
            )}
          </span>
        </span>
      </Link>

      <Quests compact />

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{t('Adventure', 'Aventure')}</h2>
        <Link to="/expedition" className="page group flex flex-col gap-2 rounded-md p-6 ring-2 ring-coral/50 transition hover:-translate-y-0.5 sm:flex-row sm:items-center">
          <span className="text-5xl transition-transform group-hover:scale-110">🗺️</span>
          <span className="flex-1">
            <span className="block font-display text-2xl font-bold">{t('Expedition', 'Expédition')}</span>
            <span className="block text-sm text-ink-soft">
              {t(
                'A roguelike made of every game: choose your path through rooms, collect gold and relics, beat a guardian at the end of each act. Lose all your hearts and the run is over.',
                'Un roguelike fait de tous les jeux : choisis ton chemin de salle en salle, ramasse or et reliques, bats un gardien à la fin de chaque acte. Perds tous tes cœurs et l’aventure s’arrête.',
              )}
            </span>
          </span>
          <span className="text-xs text-ink-faint">
            {rogueRun && !rogueRun.over ? t(`Run in progress · act ${rogueRun.act}`, `Partie en cours · acte ${rogueRun.act}`) : best('rogue:') ? t(`Best: ${best('rogue:')}`, `Record : ${best('rogue:')}`) : t('Not played yet', 'Pas encore joué')}
          </span>
        </Link>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{t('Collection', 'Collection')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/shop" className="page group flex items-center gap-4 rounded-md p-5 ring-2 ring-ochre/50 transition hover:-translate-y-0.5">
            <DleCoin className="size-12 transition-transform group-hover:scale-110" />
            <span className="flex-1">
              <span className="block font-display text-xl font-bold">{t('Card Shop', 'Boutique de cartes')}</span>
              <span className="block text-sm text-ink-soft">
                {t(
                  "Spend the DleCoins you earn playing on packs of cards. Beat a boss to unlock its franchise's pack.",
                  'Dépense les DleCoins gagnés en jouant pour des paquets de cartes. Bats un boss pour débloquer le paquet de sa franchise.',
                )}
              </span>
            </span>
            <span className="text-xs font-bold text-ink-faint">{coins.toLocaleString(t('en', 'fr'))} {t('coins', 'pièces')}</span>
          </Link>
          <Link to="/album" className="page group flex items-center gap-4 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
            <span className="text-5xl transition-transform group-hover:scale-110">🃏</span>
            <span className="flex-1">
              <span className="block font-display text-xl font-bold">Album</span>
              <span className="block text-sm text-ink-soft">{t('Every card you have pulled, sorted your way — and how many times.', 'Toutes les cartes que tu as tirées, triées à ta façon — et combien de fois.')}</span>
            </span>
            <span className="text-xs font-bold text-ink-faint">
              {collected}/{COLLECTIBLE.length}
            </span>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{t('More dailies', 'Autres défis du jour')}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {dailies.map((g) => (
            <Card key={g.to} game={g} hot={hot.game.to} />
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{t('Arcade · endless', 'Arcade · sans fin')}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {arcade.map((g) => (
            <Card key={g.to} game={g} hot={hot.game.to} />
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{t('Learn & side games', 'Apprendre et jeux à part')}</h2>
          <p className="text-sm text-ink-soft">
            {t(
              'To learn something (Japanese, functions), or to play apart. They still pay DleCoins, but stay out of the Hot Game, the missions and the quests.',
              'Pour apprendre quelque chose (le japonais, les fonctions), ou jouer à part. Ils rapportent toujours des DleCoins, mais restent hors du jeu brûlant, des missions et des quêtes.',
            )}
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {learn.map((g) => (
            <Card key={g.to} game={g} />
          ))}
        </ul>
      </section>
    </div>
  );
}
