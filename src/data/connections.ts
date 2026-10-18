import type { ConnectionsLevel, ConnectionsPuzzle } from '../types';

type Group = ConnectionsPuzzle['groups'][number];

/** level: 0 yellow (straightforward) · 1 green · 2 blue · 3 purple (trickiest). */
const g = (level: ConnectionsLevel, label: string, a: string, b: string, c: string, d: string): Group => ({ level, label, items: [a, b, c, d] });

export const connectionsPuzzles: ConnectionsPuzzle[] = [
  // ------------------------------------------------------------ Video games
  {
    id: 'cg-lol',
    domain: 'games',
    theme: 'League of Legends',
    groups: [
      g(0, 'Yordles', 'Teemo', 'Tristana', 'Lulu', 'Veigar'),
      g(1, 'Champions from Piltover', 'Vi', 'Caitlyn', 'Jayce', 'Ezreal'),
      g(2, 'Champions from Zaun', 'Jinx', 'Ekko', 'Singed', 'Warwick'),
      g(3, 'Shuriman Ascended', 'Azir', 'Nasus', 'Renekton', 'Xerath'),
    ],
  },
  {
    id: 'cg-ff',
    domain: 'games',
    theme: 'Final Fantasy',
    groups: [
      g(0, 'Final Fantasy VII party members', 'Cloud', 'Tifa', 'Barret', 'Aerith'),
      g(1, 'Summons', 'Ifrit', 'Shiva', 'Bahamut', 'Odin'),
      g(2, 'Main villains of other entries', 'Kefka', 'Kuja', 'Ultimecia', 'Exdeath'),
      g(3, 'Tiered spells', 'Fira', 'Blizzaga', 'Thundara', 'Curaga'),
    ],
  },
  {
    id: 'cg-nintendo',
    domain: 'games',
    theme: 'Nintendo',
    groups: [
      g(0, 'Mario characters', 'Toad', 'Yoshi', 'Wario', 'Daisy'),
      g(1, 'Races of Hyrule', 'Goron', 'Zora', 'Rito', 'Gerudo'),
      g(2, 'Metroid', 'Samus', 'Ridley', 'Kraid', 'Mother Brain'),
      g(3, 'Third-party Smash Bros. fighters', 'Sonic', 'Snake', 'Cloud Strife', 'Pac-Man'),
    ],
  },
  {
    id: 'cg-genres',
    domain: 'games',
    groups: [
      g(0, 'Battle royales', 'Fortnite', 'PUBG', 'Apex Legends', 'Warzone'),
      g(1, 'FromSoftware Soulslikes', 'Bloodborne', 'Sekiro', "Demon's Souls", 'Elden Ring'),
      g(2, 'Roguelikes', 'Hades', 'Dead Cells', 'The Binding of Isaac', 'Slay the Spire'),
      g(3, 'Supercell mobile games', 'Clash of Clans', 'Clash Royale', 'Brawl Stars', 'Hay Day'),
    ],
  },
  {
    id: 'cg-items',
    domain: 'games',
    groups: [
      g(0, 'Mario power-ups', 'Fire Flower', 'Super Star', 'Super Leaf', 'Cape Feather'),
      g(1, 'Zelda items', 'Hookshot', 'Ocarina', 'Boomerang', 'Master Sword'),
      g(2, 'Halo vehicles', 'Warthog', 'Scorpion', 'Ghost', 'Banshee'),
      g(3, 'Things in Minecraft', 'Creeper', 'Redstone', 'Enderman', 'Nether'),
    ],
  },

  // ------------------------------------------------------------ Anime
  {
    id: 'ca-naruto',
    domain: 'anime',
    theme: 'Naruto',
    groups: [
      g(0, 'Team 7', 'Naruto', 'Sasuke', 'Sakura', 'Kakashi'),
      g(1, 'Akatsuki members', 'Itachi', 'Pain', 'Deidara', 'Kisame'),
      g(2, 'Hokage', 'Hashirama', 'Tobirama', 'Hiruzen', 'Minato'),
      g(3, 'Tailed beasts', 'Kurama', 'Shukaku', 'Gyuki', 'Matatabi'),
    ],
  },
  {
    id: 'ca-onepiece',
    domain: 'anime',
    theme: 'One Piece',
    groups: [
      g(0, 'Straw Hat Pirates', 'Luffy', 'Zoro', 'Nami', 'Sanji'),
      g(1, 'Four Emperors', 'Shanks', 'Kaido', 'Big Mom', 'Blackbeard'),
      g(2, 'Marine admirals', 'Akainu', 'Aokiji', 'Kizaru', 'Fujitora'),
      g(3, 'Story arcs named after islands', 'Alabasta', 'Skypiea', 'Wano', 'Dressrosa'),
    ],
  },
  {
    id: 'ca-directors',
    domain: 'anime',
    groups: [
      g(0, 'Studio Ghibli films', 'Ponyo', 'Porco Rosso', "Kiki's Delivery Service", "Howl's Moving Castle"),
      g(1, 'Makoto Shinkai films', 'Your Name', 'Weathering with You', 'Suzume', '5 Centimeters per Second'),
      g(2, 'Satoshi Kon films', 'Perfect Blue', 'Paprika', 'Millennium Actress', 'Tokyo Godfathers'),
      g(3, 'Mamoru Hosoda films', 'Wolf Children', 'Summer Wars', 'Mirai', 'Belle'),
    ],
  },
  {
    id: 'ca-blades',
    domain: 'anime',
    groups: [
      g(0, 'Mecha series', 'Gundam', 'Evangelion', 'Gurren Lagann', 'Macross'),
      g(1, 'Anime cats', 'Luna', 'Jiji', 'Happy', 'Meowth'),
      g(2, 'Sword-wielding protagonists', 'Tanjiro', 'Kirito', 'Guts', 'Kenshin'),
      g(3, 'Gods of death', 'Ryuk', 'Rem', 'Rukia', 'Byakuya'),
    ],
  },
  {
    id: 'ca-shonen',
    domain: 'anime',
    groups: [
      g(0, 'Dragon Ball fighters', 'Goku', 'Vegeta', 'Piccolo', 'Krillin'),
      g(1, 'U.A. High students', 'Deku', 'Bakugo', 'Todoroki', 'Uraraka'),
      g(2, 'Hunter x Hunter', 'Gon', 'Killua', 'Kurapika', 'Leorio'),
      g(3, 'JoJo protagonists', 'Jonathan', 'Joseph', 'Jotaro', 'Giorno'),
    ],
  },

  // ------------------------------------------------------------ Cinema
  {
    id: 'cc-marvel',
    domain: 'cinema',
    theme: 'Marvel Cinematic Universe',
    groups: [
      g(0, 'Original Avengers (2012)', 'Iron Man', 'Thor', 'Hulk', 'Hawkeye'),
      g(1, 'Guardians of the Galaxy', 'Groot', 'Rocket', 'Drax', 'Gamora'),
      g(2, 'Villains', 'Thanos', 'Ultron', 'Killmonger', 'Hela'),
      g(3, 'Infinity Stones', 'Space', 'Mind', 'Reality', 'Soul'),
    ],
  },
  {
    id: 'cc-directors',
    domain: 'cinema',
    groups: [
      g(0, 'Steven Spielberg films', 'Jaws', 'E.T.', 'Jurassic Park', "Schindler's List"),
      g(1, 'Quentin Tarantino films', 'Pulp Fiction', 'Kill Bill', 'Django Unchained', 'Inglourious Basterds'),
      g(2, 'Stanley Kubrick films', 'The Shining', '2001: A Space Odyssey', 'A Clockwork Orange', 'Full Metal Jacket'),
      g(3, 'Denis Villeneuve films', 'Arrival', 'Sicario', 'Dune', 'Prisoners'),
    ],
  },
  {
    id: 'cc-scifi',
    domain: 'cinema',
    groups: [
      g(0, 'Star Wars characters', 'Yoda', 'Chewbacca', 'R2-D2', 'Obi-Wan'),
      g(1, 'Star Wars planets', 'Hoth', 'Endor', 'Naboo', 'Dagobah'),
      g(2, 'Movie robots', 'WALL-E', 'The Iron Giant', 'RoboCop', 'Johnny 5'),
      g(3, 'Spaceships', 'Nostromo', 'Serenity', 'Enterprise', 'Millennium Falcon'),
    ],
  },
  {
    id: 'cc-animation',
    domain: 'cinema',
    groups: [
      g(0, 'Disney princesses', 'Ariel', 'Belle', 'Mulan', 'Moana'),
      g(1, 'Pixar films', 'Up', 'Coco', 'Cars', 'Brave'),
      g(2, 'DreamWorks films', 'Shrek', 'Kung Fu Panda', 'Madagascar', 'How to Train Your Dragon'),
      g(3, 'Toy Story toys', 'Rex', 'Hamm', 'Slinky', 'Bo Peep'),
    ],
  },
  {
    id: 'cc-icons',
    domain: 'cinema',
    groups: [
      g(0, 'Slasher villains', 'Freddy Krueger', 'Jason Voorhees', 'Michael Myers', 'Ghostface'),
      g(1, 'James Bond actors', 'Connery', 'Moore', 'Brosnan', 'Craig'),
      g(2, 'Best Picture winners', 'Parasite', 'Moonlight', 'The Artist', 'Birdman'),
      g(3, 'Titled with a number', 'Se7en', '300', '1917', 'Apollo 13'),
    ],
  },

  // ------------------------------------------------------------ Music
  {
    id: 'cm-beatles',
    domain: 'music',
    theme: 'The Beatles',
    groups: [
      g(0, 'Band members', 'John', 'Paul', 'George', 'Ringo'),
      g(1, 'Albums', 'Revolver', 'Rubber Soul', 'Help!', 'Let It Be'),
      g(2, 'Songs named after a woman', 'Michelle', 'Eleanor Rigby', 'Julia', 'Lucy in the Sky with Diamonds'),
      g(3, 'Songs named after a place', 'Penny Lane', 'Strawberry Fields Forever', 'Back in the U.S.S.R.', 'Norwegian Wood'),
    ],
  },
  {
    id: 'cm-pop',
    domain: 'music',
    groups: [
      g(0, 'Taylor Swift albums', 'Fearless', 'Red', 'Folklore', 'Midnights'),
      g(1, 'Michael Jackson songs', 'Billie Jean', 'Beat It', 'Smooth Criminal', 'Black or White'),
      g(2, 'Beyoncé songs', 'Halo', 'Single Ladies', 'Crazy in Love', 'Formation'),
      g(3, 'Lady Gaga songs', 'Poker Face', 'Bad Romance', 'Shallow', 'Just Dance'),
    ],
  },
  {
    id: 'cm-rock',
    domain: 'music',
    groups: [
      g(0, 'Queen members', 'Freddie Mercury', 'Brian May', 'Roger Taylor', 'John Deacon'),
      g(1, 'Nirvana songs', 'Lithium', 'In Bloom', 'Come as You Are', 'Heart-Shaped Box'),
      g(2, 'Led Zeppelin songs', 'Kashmir', 'Black Dog', 'Whole Lotta Love', 'Immigrant Song'),
      g(3, 'Bands with an animal in the name', 'Arctic Monkeys', 'The Beatles', 'Def Leppard', 'Eagles'),
    ],
  },
  {
    id: 'cm-hiphop',
    domain: 'music',
    groups: [
      g(0, 'Rappers from Compton', 'Kendrick Lamar', 'Dr. Dre', 'Eazy-E', 'The Game'),
      g(1, 'Wu-Tang Clan members', 'RZA', 'GZA', 'Method Man', 'Ghostface Killah'),
      g(2, 'Kanye West albums', 'Graduation', 'Yeezus', 'The College Dropout', 'Donda'),
      g(3, 'Drake albums', 'Views', 'Scorpion', 'Take Care', 'Nothing Was the Same'),
    ],
  },
  {
    id: 'cm-misc',
    domain: 'music',
    groups: [
      g(0, 'Daft Punk songs', 'Around the World', 'One More Time', 'Get Lucky', 'Digital Love'),
      g(1, 'Woodwind instruments', 'Flute', 'Clarinet', 'Oboe', 'Bassoon'),
      g(2, 'Genres born in Jamaica', 'Reggae', 'Ska', 'Dancehall', 'Dub'),
      g(3, 'Grammy Album of the Year winners', 'Rumours', 'Thriller', '21', '1989'),
    ],
  },

  // ------------------------------------------------------------ Cross-domain (free play)
  {
    id: 'cx-1',
    domain: 'mixed',
    groups: [
      g(0, 'Studio Ghibli films', 'Spirited Away', 'Ponyo', 'Princess Mononoke', 'My Neighbor Totoro'),
      g(1, 'Valve games', 'Portal', 'Half-Life', 'Left 4 Dead', 'Team Fortress 2'),
      g(2, 'Scored by Hans Zimmer', 'Inception', 'Interstellar', 'Gladiator', 'Dune'),
      g(3, 'Albums named with a number', '21', '1989', '25', '1999'),
    ],
  },
  {
    id: 'cx-2',
    domain: 'mixed',
    groups: [
      g(0, 'Queen songs', 'Bohemian Rhapsody', 'Radio Ga Ga', 'Under Pressure', "Don't Stop Me Now"),
      g(1, 'Christopher Nolan films', 'Memento', 'Tenet', 'Dunkirk', 'Oppenheimer'),
      g(2, 'Weekly Shōnen Jump manga', 'Naruto', 'Bleach', 'One Piece', 'Jujutsu Kaisen'),
      g(3, 'Legendary swords', 'Master Sword', 'Excalibur', 'Buster Sword', 'Zangetsu'),
    ],
  },
  {
    id: 'cx-3',
    domain: 'mixed',
    groups: [
      g(0, 'Pixar films', 'Up', 'Coco', 'Cars', 'Brave'),
      g(1, 'Nintendo hardware', 'Wii', 'Switch', 'GameCube', 'Game Boy'),
      g(2, 'Daft Punk songs', 'Around the World', 'One More Time', 'Get Lucky', 'Digital Love'),
      g(3, 'Studio Bones anime', 'Mob Psycho 100', 'My Hero Academia', 'Bungo Stray Dogs', 'Fullmetal Alchemist'),
    ],
  },
  {
    id: 'cx-4',
    domain: 'mixed',
    groups: [
      g(0, 'Video game villains', 'Bowser', 'Ganondorf', 'Sephiroth', 'GLaDOS'),
      g(1, 'Movie villains', 'Darth Vader', 'Hannibal Lecter', 'Hans Gruber', 'Agent Smith'),
      g(2, 'Anime villains', 'Frieza', 'Madara', 'Dio Brando', 'Muzan'),
      g(3, 'Britpop bands', 'Oasis', 'Blur', 'Pulp', 'Suede'),
    ],
  },
  {
    id: 'cx-5',
    domain: 'mixed',
    groups: [
      g(0, 'Hayao Miyazaki films', 'Porco Rosso', "Kiki's Delivery Service", 'The Wind Rises', 'Castle in the Sky'),
      g(1, 'Post-apocalyptic games', 'Fallout', 'The Last of Us', 'Metro 2033', 'Horizon Zero Dawn'),
      g(2, 'Sci-fi set among the stars', 'Star Wars', 'Cowboy Bebop', 'Mass Effect', 'Alien'),
      g(3, '"Dark" in the title', 'Dark Souls', 'The Dark Knight', 'Darker than Black', 'The Dark Side of the Moon'),
    ],
  },
  {
    id: 'cx-6',
    domain: 'mixed',
    groups: [
      g(0, 'Tom Hanks films', 'Big', 'Cast Away', 'Forrest Gump', 'Philadelphia'),
      g(1, 'Metroidvanias', 'Hollow Knight', 'Ori and the Blind Forest', 'Dead Cells', 'Axiom Verge'),
      g(2, 'School-set anime', 'Haikyu!!', 'Assassination Classroom', 'K-On!', 'Toradora!'),
      g(3, 'Kanye West albums', 'Graduation', 'Yeezus', 'The College Dropout', '808s & Heartbreak'),
    ],
  },
  {
    id: 'cx-7',
    domain: 'mixed',
    groups: [
      g(0, 'Starter Pokémon in Red, Blue & Yellow', 'Bulbasaur', 'Charmander', 'Squirtle', 'Pikachu'),
      g(1, 'John Williams scores', 'Jaws', 'Jurassic Park', 'Superman', 'E.T.'),
      g(2, 'Albums by The Beatles', 'Abbey Road', 'Revolver', 'Help!', 'Let It Be'),
      g(3, 'Fictional cities', 'Midgar', 'Gotham', 'Rapture', 'Neo-Tokyo'),
    ],
  },
];
