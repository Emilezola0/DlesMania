// Seventeen titles added in October 2026 (merged by scripts/add-works-2026-10.mjs): ten games, five
// anime, two films. Descriptions and clues written for the game; no quotes (the Quote round skips
// works without one). Items and locations left out where unsure.
const clue = (name, description, src) => ({ name, description, ...(src ? { src } : {}) });
const audio = (clue, query) => ({ clue, query });

export const NEW_GAMES_2026_10 = [
  {
    id: 'g-clairobscur', name: 'Clair Obscur: Expedition 33', aliases: ['clair obscur', 'expedition 33', 'clair obscure'], year: 2025, genres: ['RPG', 'Turn-based'],
    studio: 'Sandfall Interactive', creator: 'Guillaume Broche', origin: 'France', format: 'Multi-platform', platforms: ['PC', 'PlayStation', 'Xbox'],
    characters: ['Gustave', 'Maelle', 'Lune', 'Sciel', 'Verso'], themes: ['Grief', 'Art', 'Mortality'],
    credits: ['Creative director: Guillaume Broche', 'Music: Lorien Testard', 'Publisher: Kepler Interactive'],
    cover: { wiki: 'Clair Obscur: Expedition 33' }, audio: audio('A soaring French vocal theme over strings and piano.', 'Clair Obscur Expedition 33 Lumière theme'),
    emoji: '🎨🖌️🗼⏳⚔️', item: clue('The Monolith', 'A towering monolith on which a number is painted every year — and everyone of that age vanishes.'),
    location: clue('Lumière', 'An island city of Belle Époque spires, cut off from the rest of the world.'), visual: { icon: '🎨', colors: ['#1e293b', '#f5d0a9'] },
    voice: { speaker: 'Gustave', query: 'Gustave Clair Obscur Expedition 33 voice lines' },
  },
  {
    id: 'g-valheim', name: 'Valheim', year: 2021, genres: ['Survival', 'Sandbox'], studio: 'Iron Gate Studio', creator: 'Richard Svensson', origin: 'Sweden', format: 'PC',
    platforms: ['PC', 'Xbox'], characters: ['Hugin', 'Eikthyr', 'The Elder', 'Moder'], themes: ['Norse mythology', 'Afterlife'],
    credits: ['Developer: Iron Gate Studio', 'Publisher: Coffee Stain Publishing'], fandom: 'valheim', cover: { wiki: 'Valheim' },
    audio: audio('Calm Nordic folk strings, like a song by the fire.', 'Valheim soundtrack Meadows'), emoji: '🪓🛶🌲⚡🐗',
    location: clue('The Meadows', 'The gentle first biome of the tenth world, where every Viking wakes up.', 'fandom:valheim:Meadows'), visual: { icon: '🪓', colors: ['#14532d', '#a3a3a3'] },
  },
  {
    id: 'g-deeprock', name: 'Deep Rock Galactic', aliases: ['drg', 'deep rock'], year: 2020, genres: ['FPS', 'Co-op'], studio: 'Ghost Ship Games', creator: 'Ghost Ship Games', origin: 'Denmark',
    format: 'Multi-platform', platforms: ['PC', 'PlayStation', 'Xbox'], characters: ['The Driller', 'The Engineer', 'The Gunner', 'The Scout', 'Bosco'], themes: ['Mining', 'Teamwork'],
    credits: ['Developer: Ghost Ship Games', 'Publisher: Coffee Stain Publishing'], fandom: 'deeprockgalactic', cover: { wiki: 'Deep Rock Galactic' },
    audio: audio('Thumping electronic battle music deep underground.', 'Deep Rock Galactic soundtrack'), emoji: '⛏️🍺🪨🕷️👷',
    item: clue('Molly', 'The four-legged mule robot that hauls the team’s minerals back to the drop pod.', 'fandom:deeprockgalactic:M.U.L.E.'),
    location: clue('Hoxxes IV', 'A hostile, cave-riddled planet full of minerals and giant bugs.', 'fandom:deeprockgalactic:Hoxxes IV'), visual: { icon: '⛏️', colors: ['#1c1917', '#f59e0b'] },
    voice: { speaker: 'The Driller', query: 'Deep Rock Galactic dwarf voice lines rock and stone' },
  },
  {
    id: 'g-enshrouded', name: 'Enshrouded', year: 2024, genres: ['Survival', 'Action RPG'], studio: 'Keen Games', creator: 'Keen Games', origin: 'Germany', format: 'PC', platforms: ['PC'],
    characters: ['The Flameborn'], themes: ['Survival', 'Corruption'], credits: ['Developer: Keen Games', 'Released in early access'], fandom: 'enshrouded', cover: { wiki: 'Enshrouded' },
    audio: audio('Wistful fantasy strings over a misty valley.', 'Enshrouded soundtrack'), emoji: '🔥🌫️🏰🗡️🌲',
    item: clue('The Flame Altar', 'An altar of fire that pushes the Shroud back around your base.'),
    location: clue('Embervale', 'A once-proud kingdom swallowed by a deadly fog, the Shroud.'), visual: { icon: '🔥', colors: ['#164e63', '#fb923c'] },
  },
  {
    id: 'g-titanfall2', name: 'Titanfall 2', aliases: ['titanfall', 'tf2 titanfall'], year: 2016, genres: ['FPS'], studio: 'Respawn Entertainment', creator: 'Steve Fukuda', origin: 'USA',
    format: 'Multi-platform', platforms: ['PC', 'PlayStation', 'Xbox'], characters: ['Jack Cooper', 'BT-7274', 'Kuben Blisk'], themes: ['Pilot and machine', 'War'],
    credits: ['Director: Steve Fukuda', 'Developer: Respawn Entertainment', 'Publisher: Electronic Arts'], fandom: 'titanfall', cover: { wiki: 'Titanfall 2' },
    audio: audio('A pounding orchestral and electronic battle score.', 'Titanfall 2 soundtrack Blood and Rust'), emoji: '🤖🔫🪂🧑‍✈️🦾',
    item: clue('The Ark', 'A mysterious power source the militia has to keep out of enemy hands.', 'fandom:titanfall:The Ark'),
    location: clue('Typhon', 'A jungle world on the Frontier where a rifleman becomes a pilot.', 'fandom:titanfall:Typhon'), visual: { icon: '🤖', colors: ['#0f172a', '#f97316'] },
    voice: { speaker: 'BT-7274', query: 'BT-7274 Titanfall 2 voice lines' },
  },
  {
    id: 'g-guiltygear', name: 'Guilty Gear -Strive-', aliases: ['guilty gear', 'guilty gear strive', 'ggst'], year: 2021, genres: ['Fighting'], studio: 'Arc System Works', creator: 'Daisuke Ishiwatari',
    origin: 'Japan', format: 'Multi-platform', platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], characters: ['Sol Badguy', 'Ky Kiske', 'May', 'Ramlethal Valentine'], themes: ['Heavy metal', 'Gears'],
    credits: ['Creator and composer: Daisuke Ishiwatari', 'Developer: Arc System Works'], fandom: 'guiltygear', cover: { wiki: 'Guilty Gear Strive' },
    audio: audio('Heavy metal guitars with a soaring rock vocal.', 'Guilty Gear Strive Smell of the Game'), emoji: '🎸🔥⚔️🥊🤘',
    location: clue('Illyria', 'The kingdom ruled by the knight Ky Kiske.', 'fandom:guiltygear:Illyria'), visual: { icon: '🎸', colors: ['#7f1d1d', '#fbbf24'] },
    voice: { speaker: 'Sol Badguy', query: 'Sol Badguy Guilty Gear Strive voice lines' },
  },
  {
    id: 'g-tekken8', name: 'Tekken 8', aliases: ['tekken'], year: 2024, genres: ['Fighting'], studio: 'Bandai Namco Studios', creator: 'Katsuhiro Harada', origin: 'Japan', format: 'Multi-platform',
    platforms: ['PC', 'PlayStation', 'Xbox'], characters: ['Jin Kazama', 'Kazuya Mishima', 'Heihachi Mishima', 'King'], themes: ['Family feud', 'Martial arts'],
    credits: ['Director: Katsuhiro Harada', 'Developer: Bandai Namco Studios'], fandom: 'tekken', cover: { wiki: 'Tekken 8' },
    audio: audio('Driving electronic rock for a tournament stage.', 'Tekken 8 soundtrack'), emoji: '🥊👊🌋🧬🏆',
    item: clue('The Devil Gene', 'A cursed inheritance that turns the Mishimas into demons.', 'fandom:tekken:Devil Gene'), visual: { icon: '👊', colors: ['#0c0a09', '#dc2626'] },
    voice: { speaker: 'Jin Kazama', query: 'Jin Kazama Tekken 8 voice lines' },
  },
  {
    id: 'g-octopath', name: 'Octopath Traveler', year: 2018, genres: ['JRPG'], studio: 'Square Enix & Acquire', creator: 'Tomoya Asano', origin: 'Japan', format: 'Multi-platform',
    platforms: ['Nintendo', 'PC', 'Xbox'], characters: ['Olberic', 'Primrose', 'Cyrus', 'Therion', "H'aanit", 'Ophilia', 'Tressa', 'Alfyn'], themes: ['Eight journeys', 'Faith'],
    credits: ['Producer: Tomoya Asano', 'Music: Yasunori Nishiki', 'Developers: Square Enix and Acquire'], fandom: 'octopathtraveler', cover: { wiki: 'Octopath Traveler' },
    audio: audio('A grand orchestral main theme with a sweeping melody.', 'Octopath Traveler main theme'), emoji: '8️⃣🗺️⚔️📜🏰',
    location: clue('Orsterra', 'The continent the eight travelers cross, each on a journey of their own.', 'fandom:octopathtraveler:Orsterra'), visual: { icon: '📜', colors: ['#1e3a8a', '#fde68a'] },
    voice: { speaker: 'Olberic', query: 'Olberic Octopath Traveler voice lines' },
  },
  {
    id: 'g-hogwartslegacy', name: 'Hogwarts Legacy', year: 2023, genres: ['Action RPG', 'Open world'], studio: 'Avalanche Software', creator: 'Alan Tew', origin: 'USA', format: 'Multi-platform',
    platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], characters: ['The Fifth-Year Student', 'Professor Fig', 'Sebastian Sallow', 'Ranrok'], themes: ['Ancient magic', 'Goblin rebellion'],
    credits: ['Director: Alan Tew', 'Developer: Avalanche Software', 'Publisher: Warner Bros. Games'], fandom: 'harrypotter', cover: { wiki: 'Hogwarts Legacy' },
    audio: audio('A magical orchestral theme with celesta and choir.', 'Hogwarts Legacy main theme'), emoji: '🪄🏰🧙🦅🐉',
    location: clue('The Room of Requirement', 'A hidden room that becomes the student’s own workshop and vivarium.', 'fandom:harrypotter:Room of Requirement'), visual: { icon: '🪄', colors: ['#1e1b4b', '#c4b5fd'] },
    voice: { speaker: 'Professor Fig', query: 'Hogwarts Legacy Professor Fig voice lines' },
  },
  {
    id: 'g-arcraiders', name: 'ARC Raiders', aliases: ['arc raiders'], year: 2025, genres: ['Extraction shooter'], studio: 'Embark Studios', creator: 'Embark Studios', origin: 'Sweden',
    format: 'Multi-platform', platforms: ['PC', 'PlayStation', 'Xbox'], characters: ['The Raider'], themes: ['Survival', 'Machines'], credits: ['Developer and publisher: Embark Studios'],
    cover: { wiki: 'ARC Raiders' }, audio: audio('Retro-futuristic synths over an empty landscape.', 'ARC Raiders soundtrack'), emoji: '🤖🏜️🎒🔫📡',
    location: clue('Speranza', 'The underground city the Raiders call home.'), visual: { icon: '📡', colors: ['#292524', '#fde047'] },
  },
];

export const NEW_ANIME_2026_10 = [
  {
    id: 'a-nana', name: 'Nana', year: 2006, genres: ['Drama', 'Romance', 'Music'], studio: 'Madhouse', creator: 'Ai Yazawa', format: 'TV', source: 'Manga',
    characters: ['Nana Osaki', 'Nana Komatsu', 'Ren Honjo', 'Nobuo Terashima'], themes: ['Friendship', 'Punk rock', 'Love'],
    credits: ['Director: Morio Asaka', 'Original manga: Ai Yazawa', 'Studio: Madhouse'], fandom: 'nana', cover: { wiki: 'Nana (manga)' },
    audio: audio('A raw punk-rock opening with a raspy female vocal.', 'NANA opening Rose'), emoji: '🎸🍓🚃🏠🎤',
    item: clue('Strawberry glasses', 'A pair of glasses with strawberries on them, bought by the two Nanas.'),
    location: clue('Apartment 707', 'The Tokyo flat the two Nanas end up sharing.'), visual: { icon: '🎸', colors: ['#18181b', '#f43f5e'] },
    voice: { speaker: 'Nana Osaki', query: 'Nana Osaki NANA japanese voice lines' },
  },
  {
    id: 'a-tanya', name: 'Saga of Tanya the Evil', aliases: ['tanya the evil', 'youjo senki', 'the saga of tanya the evil'], year: 2017, genres: ['Military', 'Isekai', 'Fantasy'],
    studio: 'Nut', creator: 'Carlo Zen', format: 'TV', source: 'Light Novel', characters: ['Tanya Degurechaff', 'Viktoriya Serebryakova', 'Being X', 'Erich von Rerugen'],
    themes: ['Reincarnation', 'War', 'Faith'], credits: ['Director: Yutaka Uemura', 'Original novels: Carlo Zen', 'Studio: Nut'], fandom: 'youjo-senki', cover: { wiki: 'The Saga of Tanya the Evil' },
    audio: audio('A militaristic, choir-backed rock opening.', 'Youjo Senki opening JINGO JUNGLE'), emoji: '👧🔫✈️☁️😈',
    item: clue('The Elinium Type 95', 'An experimental computation orb that only works when its user prays.'),
    location: clue('The Rhine front', 'The trenches where a child mage becomes a war hero.'), visual: { icon: '✈️', colors: ['#1c1917', '#facc15'] },
    voice: { speaker: 'Tanya Degurechaff', query: 'Tanya Degurechaff Youjo Senki japanese voice lines' },
  },
  {
    id: 'a-kakegurui', name: 'Kakegurui', aliases: ['gambling school', 'kakegurui compulsive gambler', 'kakegurui – compulsive gambler'], year: 2017, genres: ['Psychological', 'Thriller'],
    studio: 'MAPPA', creator: 'Homura Kawamoto', format: 'TV', source: 'Manga', characters: ['Yumeko Jabami', 'Ryota Suzui', 'Kirari Momobami', 'Mary Saotome'], themes: ['Gambling', 'Hierarchy'],
    credits: ['Director: Yuichiro Hayashi', 'Original manga: Homura Kawamoto and Toru Naomura', 'Studio: MAPPA'], fandom: 'kakegurui', cover: { wiki: 'Kakegurui – Compulsive Gambler' },
    audio: audio('A frantic, sultry jazz-rock opening.', 'Kakegurui opening Deal with the devil'), emoji: '🎲🃏💰👁️🏫',
    item: clue('A House Pet tag', 'The humiliating rank given to students who fall too deep into debt.'),
    location: clue('Hyakkaou Private Academy', 'An elite school where gambling decides everyone’s place.'), visual: { icon: '🎲', colors: ['#450a0a', '#f43f5e'] },
    voice: { speaker: 'Yumeko Jabami', query: 'Yumeko Jabami Kakegurui japanese voice lines' },
  },
  {
    id: 'a-prisonschool', name: 'Prison School', aliases: ['prison school', 'kangoku gakuen'], year: 2015, genres: ['Comedy'], studio: 'J.C.Staff', creator: 'Akira Hiramoto', format: 'TV', source: 'Manga',
    characters: ['Kiyoshi Fujino', 'Mari Kurihara', 'Meiko Shiraki', 'Hana Midorikawa'], themes: ['Punishment', 'Escape'],
    credits: ['Director: Tsutomu Mizushima', 'Original manga: Akira Hiramoto', 'Studio: J.C.Staff'], fandom: 'prison-school', cover: { wiki: 'Prison School' },
    audio: audio('A dramatic, over-the-top choral opening.', 'Prison School opening Ai no Prison'), emoji: '🏫⛓️👓🧹🏃',
    location: clue('The school prison', 'A jail built on the grounds of an elite academy.'), visual: { icon: '⛓️', colors: ['#1f2937', '#f472b6'] },
    voice: { speaker: 'Kiyoshi Fujino', query: 'Kiyoshi Fujino Prison School japanese voice lines' },
  },
  {
    id: 'a-bakugan', name: 'Bakugan Battle Brawlers', aliases: ['bakugan'], year: 2007, genres: ['Action', 'Adventure'], studio: 'TMS Entertainment', creator: 'Mitsuo Hashimoto', format: 'TV',
    source: 'Original', characters: ['Dan Kuso', 'Drago', 'Runo Misaki', 'Shun Kazami'], themes: ['Battling', 'Friendship'],
    credits: ['Director: Mitsuo Hashimoto', 'Studio: TMS Entertainment', 'Based on the toy line by Sega Toys and Spin Master'], fandom: 'bakugan', cover: { wiki: 'Bakugan Battle Brawlers' },
    audio: audio('An upbeat rock opening for a battle show.', 'Bakugan Battle Brawlers opening'), emoji: '🐉🎴⚪🔥💥',
    item: clue('A Gate Card', 'The card a Bakugan is rolled onto to start a battle.', 'fandom:bakugan:Gate Card'),
    location: clue('Vestroia', 'The Bakugan’s home dimension.', 'fandom:bakugan:Vestroia'), visual: { icon: '🐉', colors: ['#7c2d12', '#facc15'] },
    voice: { speaker: 'Dan Kuso', query: 'Dan Kuso Bakugan japanese voice lines' },
  },
];

export const NEW_CINEMA_2026_10 = [
  {
    id: 'c-meninblack', name: 'Men in Black', aliases: ['mib'], year: 1997, genres: ['Sci-Fi', 'Comedy'], studio: 'Columbia Pictures', creator: 'Barry Sonnenfeld', origin: 'USA', format: 'Live-action',
    characters: ['Agent J', 'Agent K', 'Edgar the Bug', 'Zed'], themes: ['Aliens among us', 'Secrets'],
    credits: ['Director: Barry Sonnenfeld', 'Executive producer: Steven Spielberg', 'Based on the comics by Lowell Cunningham'], cover: { wiki: 'Men in Black (1997 film)' },
    audio: audio('A funky hip-hop title song by the film’s star.', 'Men in Black Will Smith song'), emoji: '🕶️👽🔫⚡🗽',
    item: clue('The Neuralyzer', 'A flashing pen-sized device that wipes memories clean.'),
    location: clue('MIB headquarters', 'A secret base for aliens on Earth, under an old ventilation building in Manhattan.'), visual: { icon: '🕶️', colors: ['#0a0a0a', '#e5e7eb'] },
  },
  {
    id: 'c-planetapes', name: 'Planet of the Apes', nameFr: 'La Planète des singes', aliases: ['la planete des singes'], year: 1968, genres: ['Sci-Fi', 'Adventure'], studio: '20th Century Fox',
    creator: 'Franklin J. Schaffner', origin: 'USA', format: 'Live-action', characters: ['George Taylor', 'Cornelius', 'Zira', 'Dr. Zaius'], themes: ['Evolution', 'Humanity'],
    credits: ['Director: Franklin J. Schaffner', 'Based on the novel by Pierre Boulle', 'Score: Jerry Goldsmith'], cover: { wiki: 'Planet of the Apes (1968 film)' },
    audio: audio('An avant-garde percussive score full of strange sounds.', 'Planet of the Apes 1968 Jerry Goldsmith main title'), emoji: '🐒🚀🏜️⏳👨‍🚀',
    location: clue('The Forbidden Zone', 'A desert wasteland the apes forbid anyone to enter.'), visual: { icon: '🐒', colors: ['#78350f', '#fcd34d'] },
  },
];
