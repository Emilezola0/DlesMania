#!/usr/bin/env node
// Builds src/data/ranks.json for "Guess the Rank": per game, its rank ladder (with emblems) and
// gameplay clips from YouTube whose title states the player's rank. Search results only (no API
// key), and only titles are checked: one rank named, real ranked gameplay (no montage, no "Iron to
// Radiant" climb, no smurf, no coaching, no guess-the-rank video). Clips are capped per rank so every
// rank has about as many — YouTube is full of Challenger and Radiant games, Silver ones are rarer.
//
//   node scripts/find-rank-clips.mjs [--game=lol] [--per-rank=5] [--dry]
//
// Clips already in the file are kept (unless rejected below); new ones fill the ranks up to the cap.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getJson, parseArgs, sleep } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'ranks.json');
const PER_RANK = Number(flags['per-rank'] ?? 5);
/** At most this many clips per channel per rank, so one creator doesn't make a whole rank. */
const PER_CHANNEL = 2;
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  Cookie: 'SOCS=CAI',
};

// League's compact crests (the full emblems are mostly empty margin).
const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests';
/** A wiki file, resolved to its image URL later (see `fandomIcons`). */
const fandomFile = (wiki, file) => `fandom:${wiki}:${file}`;

/**
 * Each game's ladder, lowest first. \`match\` finds the rank in a title (divisions like "Gold 2" or
 * "Plat IV" count as the tier): one pattern, or several when a short form ("GE", "LEM") only counts in
 * capitals — in lower case it's an ordinary word. \`exclude\` turns down other modes and other games
 * that share the ranks (the search already keeps to the game, so titles needn't name it).
 */
const GAMES = [
  {
    id: 'lol',
    own: /league of legends/i,
    label: 'League of Legends',
    exclude: /\b(tft|teamfight|wild ?rift|aram|urf|arena|valorant|rocket league|cs ?2|cs ?go|overwatch|apex|legends of runeterra|lor)\b/i,
    query: 'league of legends',
    ranks: [
      ['iron', 'Iron', /\biron\b/i],
      ['bronze', 'Bronze', /\bbronze\b/i],
      ['silver', 'Silver', /\bsilver\b/i],
      ['gold', 'Gold', /\bgold\b/i],
      ['platinum', 'Platinum', /\bplat(inum)?\b/i],
      ['emerald', 'Emerald', /\bemerald\b/i],
      ['diamond', 'Diamond', /\bdiamond\b/i],
      // "Master Yi" is a champion, not a rank.
      ['master', 'Master', /\bmasters?\b(?! ?yi)/i],
      ['grandmaster', 'Grandmaster', [/\bgrand ?master\b/i, /\bGM\b/]],
      ['challenger', 'Challenger', /\bchall(enger)?\b/i],
    ].map(([id, name, match]) => ({ id, name, match, icon: `${CDRAGON}/${id}.svg` })),
  },
  {
    id: 'valorant',
    own: /valorant/i,
    label: 'Valorant',
    exclude: /\b(league of legends|lol|rocket league|cs ?2|cs ?go|overwatch|apex|deathmatch|swiftplay|spike rush|unrated|team deathmatch)\b/i,
    query: 'valorant',
    ranks: [
      ['iron', 'Iron', /\biron\b/i],
      ['bronze', 'Bronze', /\bbronze\b/i],
      ['silver', 'Silver', /\bsilver\b/i],
      ['gold', 'Gold', /\bgold\b/i],
      ['platinum', 'Platinum', /\bplat(inum)?\b/i],
      ['diamond', 'Diamond', /\bdiamond\b/i],
      ['ascendant', 'Ascendant', [/\bascendant\b/i, /\bASC\b/]],
      ['immortal', 'Immortal', /\bimmortal\b|\bimmo\b/i],
      ['radiant', 'Radiant', /\bradiant\b/i],
    ].map(([id, name, match]) => ({ id, name, match })),
  },
  {
    id: 'rocketleague',
    own: /rocket league/i,
    label: 'Rocket League',
    exclude: /\b(league of legends|valorant|cs ?2|cs ?go|sideswipe|hoops|rumble|dropshot|snow ?day|heatseeker|casual|tournament|1v1|1s)\b/i,
    query: 'rocket league',
    ranks: [
      ['bronze', 'Bronze', /\bbronze\b/i],
      ['silver', 'Silver', /\bsilver\b/i],
      ['gold', 'Gold', /\bgold\b/i],
      ['platinum', 'Platinum', /\bplat(inum)?\b/i],
      ['diamond', 'Diamond', /\bdiamond\b/i],
      ['champion', 'Champion', /\bchamp(ion)?s?\b/i],
      ['grandchampion', 'Grand Champion', [/\bgrand ?champ(ion)?\b/i, /\bGC\b/]],
      ['ssl', 'Supersonic Legend', [/\bsupersonic legend\b/i, /\bSSL\b/]],
    ].map(([id, name, match]) => ({ id, name, match, icon: fandomFile('rocketleague', `Season reward level ${name.toLowerCase()}.png`) })),
  },
  {
    id: 'cs2',
    own: /cs ?2|cs ?go|counter[- ]strike/i,
    label: 'Counter-Strike 2',
    // Competitive skill groups only: Premier ratings and FACEIT levels are other ladders.
    exclude: /\b(league of legends|valorant|rocket league|faceit|premier|wingman|deathmatch|retake|danger ?zone|arms race|surf|aim map|overwatch)\b/i,
    query: 'cs2',
    ranks: [
      ['silver', 'Silver', /\bsilver\b/i, 6],
      ['goldnova', 'Gold Nova', /\bgold ?nova\b|\bnova\b/i, 10],
      ['mg', 'Master Guardian', [/\bmaster guardian\b/i, /\bMG ?(1|2|I|II|E|ELITE)?\b|\bMGE\b/], 12],
      ['dmg', 'Distinguished Master Guardian', [/\bdistinguished master guardian\b/i, /\bDMG\b/], 14],
      ['le', 'Legendary Eagle', [/\blegendary eagle\b/i, /\bLE\b/], 15],
      ['lem', 'Legendary Eagle Master', [/\blegendary eagle master\b/i, /\bLEM\b/], 16],
      ['supreme', 'Supreme', [/\bsupreme\b/i, /\bSMFC\b/], 17],
      ['ge', 'Global Elite', [/\bglobal elite\b/i, /\bGE\b/], 18],
    ].map(([id, name, match, n]) => ({ id, name, match, icon: fandomFile('counterstrike', `Skillgroup${n} new.png`) })),
  },
];

/** Videos on a results page: id, title, channel, seconds. YouTube pushes back when asked too fast: wait and retry. */
async function search(query) {
  let html = '';
  for (let attempt = 0; attempt < 4 && !html; attempt++) {
    try {
      html = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { headers: HEADERS })).text();
    } catch {
      console.log(`  (YouTube is throttling — waiting ${30 * (attempt + 1)} s)`);
      await sleep(30_000 * (attempt + 1));
    }
  }
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const out = [];
  JSON.stringify(JSON.parse(m[1]), (_, v) => {
    const r = v?.videoRenderer;
    if (r?.videoId && r.lengthText?.simpleText) {
      const secs = r.lengthText.simpleText.split(':').reduce((a, b) => a * 60 + Number(b), 0);
      out.push({ id: r.videoId, title: r.title?.runs?.map((t) => t.text).join('') ?? '', channel: r.ownerText?.runs?.[0]?.text ?? '', secs });
    }
    return v;
  });
  return out;
}

/** Clips checked and turned down: a smurf, a climb, a show, another game... */
const REJECTED = new Set([
  // League: high-elo players in low lobbies, an "educational" smurf, a fan edit.
  '5BdNS6YdgvQ', 'z6XKrZfTfpY', 'bmyP761BjfQ', 'N9FzSaQQQto', 'oPNCTebQOHk', 'uy51XiOe9vg', 'QxqMicIQZpY', 'LAt2eHfq1uQ', 'VugcgJJjlMs',
  // Valorant: game shows, advice, climbs, a tournament, TenZ in Plat, a coaching 1v1, an aim clip.
  'quXSkINouCE', 'LIOhYI-zlXw', 'f0lYHO5jD9A', 'ZSps-Q7w2JM', 'S6cJU_M0hO0', 'sakBB0SHRtU', 'm_Ui6TzbaBk', 'O-NH1ahBT8E', 'uzba_LiDtYQ',
  'skiS4JdP6oE', 'xBbYYVvzpEw', 'ssnbUWk26TM', 'krKlOmPs1MQ',
  // Rocket League: a documentary, a climb.
  'fiFwlPHVy4g', '3wy_HW5mBxA',
  // CS2: coaching, a smurf, another game (Cyber Strike Manager), a meme lobby, rank-up games.
  'ul6gM5HthsQ', '-IXClG2o7Pc', 'HhgBXyII8Fw', '5YTSk7Ttr8A', 'wM_vpH6d9cU', '7zBv0-q39hc', '3DQ4S21-h7A', '06xjP-0nsT8', 'O0JIouDRn9I', '0veyzmQy4lo', 'etNU54oPFWU', 'fQHctM-00f4', 'aozpyKZdUAw', 'm8OQaI_M6J4', 'n2vpTs80CJo', 'Niw8P1B_3KY', 'LNwbf5HU0Fo', 'qCn2tUFkiVQ', 'gzlBzSRrBNw',
]);

/**
 * Not one player's ranked game at one rank: talk, compilations, climbs, two ranks meeting, and games
 * where the player isn't at the rank they're playing in (a smurf "proving a point", "2 games off Gold").
 */
const NOT_ONE_GAME =
  /\b(guess|rankdle|every|each|all ranks|tier ?list|vs\.?|versus|visits?|against|road|climb(ing|ed|s)?|journey|speedrun|smurf(s|ing)?|coach(ing|ed|es)?|tips?|guide|how|why|what|react(s|ion|ing)?|explained|montage|highlights?|outplays?|plays|clips|minutes of|edit|best|top \d+|funny|moments|compilation|boost(ing|ed)?|unranked|placements?|tutorial|analysis|review|duo|trolls?|shorts?|meme|pro ?play|esports|worlds|lcs|lec|lck|vct|major|teaching|lesson|day \d+|episode|ep\.? ?\d+|part \d+|#\d+|record|vs bots?|bots?|custom|prove|point|experiment|starts?|started|hit|hits|reach(ed)?|got|became|become|until|escaped?|off|before|away|almost|beginner|noob|first time|new player|scripts?|scripting|cheat(s|ing)?|hack(s|ing)?|hearthstone|rank ?1|visit(s|ing)?|educational|getting|gets|achievable|escap(e|es|ing)|monter?|objectif|tournament|enters?|trained|training|impost[eo]r|advice|tested|hours in|wrong about|greatest|manager|analy[sz](e|ed|es|is|ing)|rank you up|will|caster|premiere|till|tried|trying|scrims?|put me|v\.s\.|placed)\b|→|->|➜|=>|(?:^|\s)(to|à|au)\s.*\b(rank|iron|bronze|silver|gold|plat|emerald|diamond|master|challenger|radiant|immortal|ascendant|global|champ|ssl|supreme|eagle|nova)/i;

/** Other ranked games: a loose search can bring them in under the same rank names. */
const OTHER_GAMES =
  /\b(overwatch|marvel rivals|fortnite|apex|dota|siege|r6|rainbow six|fifa|fc ?2\d|chess|brawl ?stars|brawlhalla|smite|deadlock|pubg|warzone|call of duty|cod|hearthstone|wild rift|tft|league of legends|valorant|rocket league|cs ?2|cs ?go|counter[- ]strike)\b/i;

/** The single rank a title names, or null (none, or several). */
function rankOf(game, title) {
  const named = game.ranks.filter((r) => [r.match].flat().some((re) => re.test(title)));
  // A longer rank swallows the shorter one it contains (Grandmaster/Master, Grand Champion/Champion, LEM/LE, DMG/MG).
  const keep = named.filter((r) => !named.some((o) => o !== r && o.name.length > r.name.length && o.name.includes(r.name)));
  return keep.length === 1 ? keep[0] : null;
}

function accept(game, v) {
  if (REJECTED.has(v.id) || v.secs > 75 * 60) return null;
  // Ten minutes at least: a whole game, not a clip.
  if (v.secs < 600 || game.exclude.test(v.title) || NOT_ONE_GAME.test(v.title)) return null;
  // Naming another game (but not this one) means it's about that game.
  const others = [...v.title.matchAll(new RegExp(OTHER_GAMES, 'gi'))].map((m) => m[0].toLowerCase());
  if (others.some((o) => !game.own.test(o))) return null;
  return rankOf(game, v.title);
}

async function valorantIcons(game) {
  const d = await getJson('https://valorant-api.com/v1/competitivetiers');
  const tiers = d.data.at(-1).tiers;
  for (const r of game.ranks) {
    // The tier's middle division stands for the whole rank (Radiant has just one).
    const t = tiers.filter((x) => x.tierName.toLowerCase().startsWith(r.name.toLowerCase()) && x.largeIcon);
    r.icon = t[Math.floor((t.length - 1) / 2)]?.largeIcon;
  }
}

/** Fandom wikis don't serve images from their page URLs to other sites: ask the API for the file's image URL. */
async function fandomIcons(game) {
  for (const r of game.ranks) {
    const m = r.icon?.match(/^fandom:([^:]+):(.+)$/);
    if (!m) continue;
    const d = await getJson(`https://${m[1]}.fandom.com/api.php?${new URLSearchParams({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: `File:${m[2]}`, format: 'json', formatversion: '2' })}`);
    r.icon = d.query?.pages?.[0]?.imageinfo?.[0]?.url;
  }
}

let data = { games: [] };
try {
  data = JSON.parse(readFileSync(FILE, 'utf8'));
} catch {}

for (const game of GAMES) {
  if (flags.game && flags.game !== game.id) continue;
  console.log(`▶ ${game.label}`);
  if (game.id === 'valorant') await valorantIcons(game);
  await fandomIcons(game);
  const old = data.games.find((g) => g.id === game.id);
  // Clips already found stay if they still pass today's filters (the reject list grows).
  const clips = (old?.clips ?? []).filter((c) => accept(game, { id: c.youtubeId, title: c.title, secs: c.seconds })?.id === c.rank);
  const seen = new Set(clips.map((c) => c.youtubeId));
  for (const rank of game.ranks) {
    const have = () => clips.filter((c) => c.rank === rank.id);
    // Low ranks are rarer on YouTube: several phrasings, most specific first.
    const queries = [
      `${rank.name} ${game.query} gameplay`, `${rank.name} ${game.query} ranked full game`, `${game.query} ${rank.name} elo pov`,
      `${rank.name} 1 ${game.query} ranked`, `spectating ${rank.name} ${game.query}`, `${game.query} ${rank.name} no commentary`,
      `${rank.name} 4 ${game.query} full game`, `${rank.name} elo ${game.query}`,
    ];
    for (const q of queries) {
      if (have().length >= PER_RANK) break;
      for (const v of await search(q)) {
        if (have().length >= PER_RANK) break;
        if (seen.has(v.id) || accept(game, v)?.id !== rank.id) continue;
        if (have().filter((c) => c.channel === v.channel).length >= PER_CHANNEL) continue;
        seen.add(v.id);
        clips.push({ youtubeId: v.id, rank: rank.id, title: v.title, channel: v.channel, seconds: v.secs });
      }
      await sleep(1500);
    }
    console.log(`  ${rank.name.padEnd(30)} ${have().length}`);
  }
  const entry = {
    id: game.id,
    label: game.label,
    ranks: game.ranks.map(({ id, name, icon }) => ({ id, name, icon })),
    clips: clips.sort((a, b) => game.ranks.findIndex((r) => r.id === a.rank) - game.ranks.findIndex((r) => r.id === b.rank)),
  };
  data.games = [...data.games.filter((g) => g.id !== game.id), entry].sort((a, b) => GAMES.findIndex((g) => g.id === a.id) - GAMES.findIndex((g) => g.id === b.id));
}

data.generated = new Date().toISOString().slice(0, 10);
if (flags.dry) console.log(JSON.stringify(data, null, 2).slice(0, 3000));
else writeFileSync(FILE, JSON.stringify({ generated: data.generated, games: data.games }, null, 2) + '\n');
console.log(flags.dry ? '(dry run)' : `✓ ${FILE}`);
