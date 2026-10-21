#!/usr/bin/env node
// Merges the batches in scripts/data/new-anime.mjs and new-games.mjs into the works files (skipping
// ids that already exist), and gives every anime and voiced game a `voice` entry for the voice game.
//   node scripts/add-works.mjs
// Then: node scripts/enrich-media.mjs (covers, items, locations) and the clip seeders.
import { loadWorks, saveWorks } from './lib.mjs';
import { NEW_ANIME } from './data/new-anime.mjs';
import { NEW_GAMES } from './data/new-games.mjs';

const clue = (c) => (c ? { name: c[0], description: c[1], ...(c[2] ? { src: c[2] } : {}) } : undefined);
const audio = (a) => ({ clue: a[0], query: a[1] });

/** Games with no spoken voice acting: they stay out of the voice game. */
const NO_VOICE = new Set([
  'g-limbo', 'g-inside', 'g-braid', 'g-fez', 'g-nightinthewoods', 'g-vampsurvivors', 'g-balatro', 'g-seaofstars', 'g-animalwell', 'g-spelunky',
  'g-papersplease', 'g-ttyd', 'g-earthbound', 'g-gris', 'g-obradinn', 'g-slaythespire', 'g-astrobot', 'g-fallguys', 'g-tunic', 'g-chantsofsennaar',
  'g-tetris', 'g-pacman', 'g-minecraft', 'g-stardew', 'g-journey', 'g-celeste', 'g-hollowknight', 'g-undertale', 'g-terraria', 'g-amongus',
  'g-cuphead', 'g-doom', 'g-pikmin', 'g-ori', 'g-supermetroid', 'g-megaman2', 'g-kirby', 'g-dkc', 'g-smw', 'g-alttp', 'g-smb', 'g-sims',
  'g-chronotrigger', 'g-pokemon-rb', 'g-pokemon-gs', 'g-ff6', 'g-ff7', 'g-diablo2', 'g-sotc', 'g-ico', 'g-okami', 'g-banjo', 'g-spyro',
  'g-crash', 'g-goldeneye', 'g-rocketleague', 'g-tf2', 'g-halflife', 'g-hl2', 'g-portal', 'g-sf2', 'g-tetris', 'g-minecraft', 'g-myst',
]);
// Half-Life's Gordon never talks, but Portal has GLaDOS: put Portal back in.
NO_VOICE.delete('g-portal');

function anime([id, name, year, genres, studio, creator, format, source, characters, themes, credits, fandom, coverWiki, quote, au, emoji, item, location, visual, voice]) {
  return {
    id, name, domain: 'anime', year, genres, studio, creator, origin: 'Japan', format, source, characters, themes, credits,
    ...(fandom ? { fandom } : {}), cover: { wiki: coverWiki }, ...(quote ? { quote } : {}), audio: audio(au), emoji,
    item: clue(item), location: clue(location), visual: { icon: visual[0], colors: visual[1] },
    voice: { speaker: characters[0], query: voice[1] },
  };
}

function game([id, name, year, genres, studio, creator, origin, format, platforms, characters, themes, credits, fandom, coverWiki, quote, au, emoji, item, location, visual, voice]) {
  return {
    id, name, domain: 'games', year, genres, studio, creator, origin, format, platforms, characters, themes, credits,
    ...(fandom ? { fandom } : {}), cover: { wiki: coverWiki }, ...(quote ? { quote } : {}), audio: audio(au), emoji,
    item: clue(item), location: clue(location), visual: { icon: visual[0], colors: visual[1] },
    ...(NO_VOICE.has(id) ? {} : { voice: { speaker: characters[0], query: voice[1] } }),
  };
}

for (const [domain, rows, build] of [['anime', NEW_ANIME, anime], ['games', NEW_GAMES, game]]) {
  const works = loadWorks(domain);
  const ids = new Set(works.map((w) => w.id));
  const names = new Set(works.map((w) => w.name.toLowerCase()));
  let added = 0;
  for (const row of rows) {
    const w = build(row);
    if (ids.has(w.id) || names.has(w.name.toLowerCase())) continue;
    works.push(w);
    ids.add(w.id);
    added++;
  }
  // Voice entries for works that predate the voice game.
  let voiced = 0;
  for (const w of works) {
    if (w.voice || !w.characters?.length || (domain === 'games' && NO_VOICE.has(w.id))) continue;
    const speaker = w.characters[0];
    w.voice = { speaker, query: domain === 'anime' ? `${speaker} ${w.name} japanese voice lines` : `${speaker} ${w.name} voice lines` };
    voiced++;
  }
  saveWorks(domain, works);
  console.log(`${domain}: +${added} works (${works.length} total), +${voiced} voice entries`);
}
