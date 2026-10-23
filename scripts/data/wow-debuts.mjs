// The game each World of Warcraft Specialist character first appeared in (as a character in the game,
// not in a novel or a manual), for the Timeline round. Hand-written: the wiki has no field for it.
// Characters missing here simply sit out the Timeline. Used by scripts/build-specialist-wow.mjs.

/** The Warcraft games in release order. */
export const WOW_GAMES = [
  'Warcraft: Orcs & Humans (1994)', 'Warcraft II (1995)', 'Beyond the Dark Portal (1996)', 'Warcraft III (2002)', 'The Frozen Throne (2003)',
  'World of Warcraft (2004)', 'The Burning Crusade (2007)', 'Wrath of the Lich King (2008)', 'Cataclysm (2010)', 'Mists of Pandaria (2012)',
  'Warlords of Draenor (2014)', 'Legion (2016)', 'Battle for Azeroth (2018)', 'Shadowlands (2020)', 'Dragonflight (2022)', 'The War Within (2024)',
];

const BY_GAME = {
  'Warcraft: Orcs & Humans (1994)': ['Medivh', 'Garona Halforcen', 'Blackhand', 'Anduin Lothar'],
  'Warcraft II (1995)': ['Orgrim Doomhammer', "Gul'dan", 'Terenas Menethil II', 'Antonidas', 'Uther the Lightbringer', 'Turalyon', 'Alleria Windrunner', "Cho'gall", "Zul'jin", 'Deathwing', 'Teron Gorefiend', 'Alexstrasza'],
  'Beyond the Dark Portal (1996)': ["Ner'zhul", 'Kargath Bladefist', 'Khadgar'],
  'Warcraft III (2002)': [
    'Thrall', 'Jaina Proudmoore', 'Arthas Menethil', 'Grommash Hellscream', 'Cairne Bloodhoof', 'Tyrande Whisperwind', 'Malfurion Stormrage', 'Illidan Stormrage',
    'Archimonde', "Kel'Thuzad", "Mal'Ganis", 'Tichondrius', 'Muradin Bronzebeard', 'Sylvanas Windrunner', 'Cenarius', 'Mannoroth', 'Monte Gazlowe',
  ],
  'The Frozen Throne (2003)': ["Anub'arak", 'Varimathras', 'Maiev Shadowsong', "Kael'thas Sunstrider", 'Vashj', 'Akama', 'Rexxar', 'Chen Stormstout', "Vol'jin", "Kil'jaeden"],
  'World of Warcraft (2004)': [
    'Anduin Wrynn', 'Bolvar Fordragon', 'Magni Bronzebeard', 'Gelbin Mekkatorque', 'Moira Thaurissan', 'Ragnaros', 'Onyxia', 'Nefarian', 'Hogger', 'Edwin VanCleef',
    'Hakkar the Soulflayer', "C'Thun", 'Arugal', 'Sally Whitemane', 'Mathias Shaw', 'Leeroy Jenkins', 'Headless Horseman', 'Tirion Fordring', 'Chronormu',
    'Shandris Feathermoon', 'Nathanos Blightcaller', 'Hamuul Runetotem', 'Fandral Staghelm', 'Archbishop Benedictus', 'Rehgar Earthfury', "Drek'Thar",
  ],
  'The Burning Crusade (2007)': ['Velen', "Lor'themar Theron", 'Garrosh Hellscream', 'Vindicator Maraad', 'Kalecgos', 'Lady Liadrin'],
  'Wrath of the Lich King (2008)': ['Varian Wrynn', 'Varok Saurfang', 'Darion Mograine', 'Yogg-Saron', 'Sindragosa', 'Lady Deathwhisper', 'Professor Putricide', 'Talanji', 'Rhonin', 'Thorim'],
  'Cataclysm (2010)': ['Genn Greymane', 'Vanessa VanCleef', 'Wrathion', 'Jastor Gallywix', 'Tess Greymane', 'Liam Greymane', 'Lilian Voss', 'Queen Azshara'],
  'Mists of Pandaria (2012)': ['Taran Zhu', 'Li Li Stormstout', 'Lei Shen'],
  'Warlords of Draenor (2014)': ['Yrel'],
  'Legion (2016)': ["Xal'atath", 'Helya', 'Odyn', 'Elisande', 'Thalyssra', 'Sargeras', 'Xavius'],
  'Battle for Azeroth (2018)': ["G'huun"],
  'Shadowlands (2020)': ['Zovaal', 'Denathrius'],
};

/** Character name → index in WOW_GAMES. */
export const WOW_DEBUT = Object.fromEntries(Object.entries(BY_GAME).flatMap(([game, names]) => names.map((n) => [n, WOW_GAMES.indexOf(game)])));
