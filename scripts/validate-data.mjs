#!/usr/bin/env node
// Validates every works file against schema/work.schema.json and checks that each domain
// has enough content for its daily challenge. Exit code 1 on any error.
//   npm run data:validate
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAINS, ROOT, loadWorks } from './lib.mjs';

const schema = JSON.parse(readFileSync(join(ROOT, 'schema', 'work.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const validate = ajv.compile(schema);

/** Minimum works per domain for each single-target mini-game, so dailies rarely repeat. */
const MIN_PER_GAME = 8;
// Mirrors HAS_CONTENT in src/data/index.ts: picture rounds only draw works that have the picture.
const COVERAGE = {
  quote: (w) => w.quote || w.tracks?.length,
  audio: (w) => w.audio && (w.audio.youtubeId || w.cover?.image),
  voice: (w) => w.voice?.youtubeId,
  emoji: (w) => w.emoji,
  visual: (w) => w.cover?.image || w.visual,
  item: (w) => w.item?.image,
  location: (w) => w.location?.image,
  tiles: (w) => w.cover?.image,
};

let errors = 0;
let warnings = 0;
const ids = new Set();
const fail = (msg) => (errors++, console.error(`✗ ${msg}`));
const warn = (msg) => (warnings++, console.warn(`! ${msg}`));

for (const domain of DOMAINS) {
  const works = loadWorks(domain);
  for (const w of works) {
    if (!validate(w)) {
      for (const e of validate.errors) fail(`${domain}/${w.id ?? '?'}${e.instancePath}: ${e.message}`);
    }
    if (w.domain !== domain) fail(`${w.id}: domain "${w.domain}" in ${domain}.json`);
    if (ids.has(w.id)) fail(`${w.id}: duplicate id`);
    ids.add(w.id);
    if (domain === 'games' && !w.platforms?.length) warn(`${w.id}: no platforms (Classic falls back to format)`);
    if (w.audio && !w.audio.youtubeId) warn(`${w.id}: audio has no youtubeId (text clue only)`);
  }

  const years = new Set(works.map((w) => w.year));
  if (years.size < 4) fail(`${domain}: need at least 4 distinct years for Timeline`);

  // Voice lines only exist for anime and games.
  const coverage = Object.entries(COVERAGE)
    .filter(([game]) => game !== 'voice' || domain === 'anime' || domain === 'games')
    .map(([game, has]) => [game, works.filter(has).length])
    .map(([game, n]) => {
      if (n === 0) fail(`${domain}: no works playable in "${game}"`);
      else if (n < MIN_PER_GAME) warn(`${domain}: only ${n} works for "${game}"`);
      return `${game}:${n}`;
    });
  const images = ['cover', 'item', 'location'].map((k) => `${k} img:${works.filter((w) => w[k]?.image).length}`);
  console.log(`${domain.padEnd(7)} ${String(works.length).padStart(3)} works | ${coverage.join(' ')} | ${images.join(' ')} | clips:${works.filter((w) => w.audio?.youtubeId).length}`);
}

// ---------------------------------------------------------------- Connections
const puzzles = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'connections.json'), 'utf8'));
const puzzleIds = new Set();
let withImages = 0;
for (const pz of puzzles) {
  if (puzzleIds.has(pz.id)) fail(`connections/${pz.id}: duplicate id`);
  puzzleIds.add(pz.id);
  if (![...DOMAINS, 'mixed'].includes(pz.domain)) fail(`connections/${pz.id}: bad domain "${pz.domain}"`);
  const levels = pz.groups.map((g) => g.level).sort().join();
  if (pz.groups.length !== 4 || levels !== '0,1,2,3') fail(`connections/${pz.id}: needs 4 groups with levels 0-3 (got ${levels})`);
  if (pz.groups.some((g) => g.items.length !== 4)) fail(`connections/${pz.id}: every group needs 4 tiles`);
  const tiles = pz.groups.flatMap((g) => g.items.map((t) => (typeof t === 'string' ? { label: t } : t)));
  const labels = tiles.map((t) => t.label.toLowerCase());
  if (new Set(labels).size !== labels.length) fail(`connections/${pz.id}: duplicate tile label`);
  const missing = tiles.filter((t) => !t.image).length;
  if (missing === 0) withImages++;
  else if (missing < tiles.length) warn(`connections/${pz.id}: ${missing} tile(s) without image — grid shows text only`);
}
const perDomain = [...DOMAINS, 'mixed'].map((d) => `${d}:${puzzles.filter((p) => p.domain === d).length}`).join(' ');
console.log(`connections ${puzzles.length} puzzles (${perDomain}) | fully illustrated: ${withImages}`);

// Grid size and mistakes (src/data/settings.json): 2-4 groups of 4 tiles.
const settings = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'settings.json'), 'utf8'));
const cs = settings.connections ?? {};
if (![2, 3, 4].includes(cs.groups)) fail(`settings: connections.groups must be 2, 3 or 4 (got ${cs.groups})`);
if (!(cs.maxMistakes >= 1)) fail('settings: connections.maxMistakes must be >= 1');
if (![2, 3, 4, 5].includes(cs.themed?.groups)) fail('settings: connections.themed.groups must be 2-5');
if (![3, 4].includes(cs.themed?.groupSize)) fail('settings: connections.themed.groupSize must be 3 or 4');

// Themed banks (src/data/connection-themes.json): grids are drawn from these at play time by
// src/lib/connections.ts, which also checks each grid has a single solution.
const themes = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'connection-themes.json'), 'utf8'));
const themeIds = new Set();
let herringCards = 0;
for (const th of themes) {
  const at = `connection-themes/${th.id}`;
  if (themeIds.has(th.id)) fail(`${at}: duplicate id`);
  themeIds.add(th.id);
  if (!DOMAINS.includes(th.domain)) fail(`${at}: bad domain "${th.domain}"`);
  const cards = th.cards.map((c) => (typeof c === 'string' ? { label: c } : c));
  const labels = new Set(cards.map((c) => c.label));
  if (labels.size !== cards.length) fail(`${at}: duplicate card label`);
  if (th.categories.length < 5) fail(`${at}: needs at least 5 sub-categories (has ${th.categories.length})`);
  const catIds = new Set();
  for (const c of th.categories) {
    if (catIds.has(c.id)) fail(`${at}/${c.id}: duplicate sub-category id`);
    catIds.add(c.id);
    if (![0, 1, 2, 3].includes(c.level)) fail(`${at}/${c.id}: level must be 0-3`);
    if (new Set(c.items).size < 3) fail(`${at}/${c.id}: needs at least 3 distinct cards`);
    // Smaller than the current group size: kept, but the generator skips it.
    for (const i of c.items) if (!labels.has(i)) fail(`${at}/${c.id}: "${i}" is not in cards`);
  }
  const used = new Set(th.categories.flatMap((c) => c.items));
  for (const l of labels) if (!used.has(l)) warn(`${at}: card "${l}" is in no sub-category`);
  // Red herrings come from cards listed in several sub-categories.
  herringCards += [...used].filter((l) => th.categories.filter((c) => c.items.includes(l)).length > 1).length;
  const noImage = cards.filter((c) => !c.image).map((c) => c.label);
  if (noImage.length) warn(`${at}: no image for ${noImage.join(', ')} — grids using them show text only`);
  const byImage = new Map();
  for (const c of cards.filter((c) => c.image)) {
    const key = c.image.split('?')[0];
    if (byImage.has(key)) warn(`${at}: "${c.label}" and "${byImage.get(key)}" share a picture`);
    byImage.set(key, c.label);
  }
}
console.log(`themes      ${themes.length} (${themes.reduce((n, t) => n + t.categories.length, 0)} sub-categories, ${herringCards} red-herring cards)`);

// ---------------------------------------------------------------- Boss Battle
// Minimums follow Hard in src/lib/boss.ts (16-card waves with 7 impostors, 5 faces twice), with room
// left so retries and second rounds draw something new.
const bosses = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'bosses.json'), 'utf8'));

// Balancing lives in src/data/difficulties.json: check its shape, and that Hard's secret Name Chain
// can be won (each exchange uses two entities of one category, so n allow floor(n / 2) exchanges).
const difficulties = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'difficulties.json'), 'utf8'));
const positive = ['hearts', 'blitzSecondsPer', 'radarCards', 'radarImpostors', 'finaleTargets', 'finaleSeconds', 'scoreMultiplier'];
for (const id of ['easy', 'medium', 'hard']) {
  const d = difficulties[id];
  const at = `difficulties/${id}`;
  if (!d) {
    fail(`${at}: missing`);
    continue;
  }
  for (const k of positive) if (!(d[k] > 0)) fail(`${at}: "${k}" must be a positive number`);
  if (!Array.isArray(d.rounds) || d.rounds.length !== 3 || d.rounds.some((n) => !(n >= 1))) fail(`${at}: "rounds" needs three counts >= 1`);
  if (d.radarImpostors >= d.radarCards) fail(`${at}: more impostors than cards`);
  if (![0, 1, 2].includes(d.distortion)) fail(`${at}: "distortion" must be 0, 1 or 2`);
  const sl = d.secondLoop;
  if (sl) {
    if (!sl.blitz || !sl.radar || !sl.finale) fail(`${at}: secondLoop needs blitz, radar and finale`);
    else {
      if (!(sl.blitz.secondsPer > 0)) fail(`${at}: secondLoop.blitz.secondsPer must be > 0`);
      if (!(sl.radar.cards > sl.radar.impostors && sl.radar.impostors >= 1)) fail(`${at}: secondLoop.radar needs more cards than impostors`);
      if (!(sl.radar.speed > 0 && sl.radar.speed <= 1)) fail(`${at}: secondLoop.radar.speed must be in (0, 1]`);
      if (!(sl.finale.targets >= 1 && sl.finale.seconds > 0)) fail(`${at}: secondLoop.finale needs targets >= 1 and seconds > 0`);
      for (const p of [sl.radar, sl.finale]) {
        if (!Array.isArray(p.zoom) || p.zoom.length !== 2 || !(p.zoom[0] >= 1 && p.zoom[1] >= p.zoom[0])) fail(`${at}: secondLoop zoom must be [min, max] with 1 <= min <= max`);
        if (!Array.isArray(p.hue) || p.hue.length !== 2 || !(p.hue[1] >= p.hue[0])) fail(`${at}: secondLoop hue must be [min, max]`);
        if (!(p.flip >= 0 && p.flip <= 1)) fail(`${at}: secondLoop flip must be a chance in [0, 1]`);
        if (p.turns && (!Array.isArray(p.turns) || p.turns.some((t) => typeof t !== 'number'))) fail(`${at}: secondLoop turns must be a list of angles`);
      }
    }
  }
  const sc = d.secret;
  if (sc) {
    if (!(sc.picksToWin >= 1)) fail(`${at}: secret.picksToWin must be >= 1`);
    if (!(sc.turnSeconds >= 0)) fail(`${at}: secret.turnSeconds must be >= 0`);
  }
}
const bossIds = new Set();
const label = (c) => (typeof c === 'string' ? c : c.label);
for (const b of bosses) {
  const at = `bosses/${b.id}`;
  if (bossIds.has(b.id)) fail(`${at}: duplicate id`);
  bossIds.add(b.id);
  if (!['games', 'anime', 'cinema'].includes(b.domain)) fail(`${at}: bad domain "${b.domain}"`);
  if (!b.boss?.name || !b.boss?.color) fail(`${at}: boss needs a name and a color`);
  if (!b.boss?.image) warn(`${at}: no boss portrait`);
  for (const k of ['intro', 'phase2', 'phase3', 'win', 'lose']) if (!b.lines?.[k]) fail(`${at}: missing line "${k}"`);
  for (const k of ['hit', 'hurt']) if (!b.lines?.[k]?.length) fail(`${at}: needs at least one "${k}" line`);
  if ((b.blitz?.length ?? 0) < 6) fail(`${at}: needs at least 6 Knowledge Blitz prompts`);
  for (const p of b.blitz ?? []) {
    const names = p.answers.map((a) => a.split('|')[0].toLowerCase());
    if (new Set(names).size !== names.length) fail(`${at}: duplicate answer in "${p.prompt}"`);
    if (p.answers.length < p.count) fail(`${at}: "${p.prompt}" has fewer answers than required`);
  }
  if (b.radar.members.length < 12) fail(`${at}: needs at least 12 Radar members`);
  if (b.radar.impostors.length < 10) fail(`${at}: needs at least 10 Radar impostors`);
  if (b.finale.length < 12) fail(`${at}: needs at least 12 Final Blow cards`);
  const members = new Set(b.radar.members.map((c) => label(c).toLowerCase()));
  for (const c of b.radar.impostors) if (members.has(label(c).toLowerCase())) fail(`${at}: "${label(c)}" is both member and impostor`);
  const noImage = [...b.radar.members, ...b.radar.impostors, ...b.finale].filter((c) => typeof c === 'string' || !c.image).map(label);
  if (noImage.length) warn(`${at}: no image for ${noImage.join(', ')} (run scripts/enrich-bosses.mjs)`);
  for (const k of ['secret', 'secretLost']) if (!b.lines?.[k]) warn(`${at}: no "${k}" line (a generic one is used)`);
  // Hard's Name Chain: categories of entities, each entity in exactly one.
  if (difficulties.hard?.secret) {
    const cats = b.secret?.categories ?? [];
    if (cats.length < 2) fail(`${at}: secret.categories needs at least 2 categories`);
    const owner = new Map();
    for (const c of cats) {
      if (c.entities.length < 2) fail(`${at}: secret category "${c.label}" needs at least 2 entities`);
      for (const e of c.entities) {
        for (const sp of e.split('|')) {
          const key = sp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!key) continue;
          if (owner.has(key) && owner.get(key) !== `${c.label}/${e}`) fail(`${at}: "${sp}" is spelled the same in "${owner.get(key)}" and "${c.label}/${e}"`);
          owner.set(key, `${c.label}/${e}`);
        }
      }
    }
    const max = cats.reduce((n, c) => n + Math.floor(c.entities.length / 2), 0);
    const want = b.secret?.picksToWin ?? difficulties.hard.secret.picksToWin;
    if (want > max) warn(`${at}: Name Chain needs ${want} answers but its categories allow ${max} (lowered in game)`);
  }
}
console.log(`bosses      ${bosses.length} (${['games', 'anime', 'cinema'].map((d) => `${d}:${bosses.filter((b) => b.domain === d).length}`).join(' ')})`);

// ---------------------------------------------------------------- Who's That? (src/data/silhouettes.json)
const silhouettes = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'silhouettes.json'), 'utf8'));
for (const sr of silhouettes) {
  const at = `silhouettes/${sr.id}`;
  if (!DOMAINS.includes(sr.domain)) fail(`${at}: bad domain "${sr.domain}"`);
  if (sr.entries.length < 20) warn(`${at}: only ${sr.entries.length} entries — a minute will run out of faces`);
  const names = new Set();
  for (const e of sr.entries) {
    if (!e.image) fail(`${at}/${e.name}: no image`);
    if (names.has(e.name.toLowerCase())) fail(`${at}: duplicate "${e.name}"`);
    names.add(e.name.toLowerCase());
  }
}
console.log(`silhouettes ${silhouettes.map((sr) => `${sr.id}:${sr.entries.length}`).join(' ')}`);

// ---------------------------------------------------------------- Specialist (src/data/specialist/*.json)
const op = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'onepiece.json'), 'utf8'));
const opIds = new Set();
const spellings = new Map();
for (const c of op.characters) {
  const at = `specialist/onepiece/${c.name}`;
  if (opIds.has(c.id)) fail(`${at}: duplicate id ${c.id}`);
  opIds.add(c.id);
  for (const k of ['image', 'gender', 'affiliation', 'origin', 'arc']) if (!c[k]) fail(`${at}: no ${k}`);
  if (!(c.chapter > 0)) fail(`${at}: no debut chapter`);
  // Two characters answering to the same name would make a guess ambiguous.
  for (const s of [c.name, ...c.aliases].map((n) => n.toLowerCase())) {
    if (spellings.has(s) && spellings.get(s) !== c.id) fail(`${at}: "${s}" is also a name of ${spellings.get(s)}`);
    spellings.set(s, c.id);
  }
}
for (const l of op.laughs) if (!opIds.has(l.character)) fail(`specialist/onepiece: laugh "${l.laugh}" belongs to an unknown character ${l.character}`);
for (const f of op.fruits) if (!f.type) fail(`specialist/onepiece/${f.name}: no type`);
for (const c of op.crews) if (!c.flag) fail(`specialist/onepiece/${c.name}: no Jolly Roger`);
if (op.characters.length < 150) warn(`specialist/onepiece: only ${op.characters.length} characters`);
const lol = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'lol.json'), 'utf8'));
const lolNames = new Map();
for (const c of lol.champions) {
  const at = `specialist/lol/${c.name}`;
  for (const k of ['image', 'splash', 'gender', 'resource', 'range']) if (!c[k]) fail(`${at}: no ${k}`);
  if (c.abilities.length !== 5 || c.abilities.some((a) => !a.icon || !a.name)) fail(`${at}: needs five abilities with names and icons`);
  if (!c.complete) warn(`${at}: no wiki data yet (new champion?) — left out of Classic`);
  for (const s of [c.name, ...c.aliases].map((n) => n.toLowerCase())) {
    if (lolNames.has(s) && lolNames.get(s) !== c.id) fail(`${at}: "${s}" is also a name of ${lolNames.get(s)}`);
    lolNames.set(s, c.id);
  }
}
const gi = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'genshin.json'), 'utf8'));
const giNames = new Map();
for (const c of gi.characters) {
  const at = `specialist/genshin/${c.name}`;
  for (const k of ['image', 'element', 'weapon', 'region', 'version']) if (!c[k]) fail(`${at}: no ${k}`);
  if (!c.portrait) warn(`${at}: no portrait (left out of the silhouettes)`);
  for (const s of [c.name, ...c.aliases].map((n) => n.toLowerCase())) {
    if (giNames.has(s) && giNames.get(s) !== c.id) fail(`${at}: "${s}" is also a name of ${giNames.get(s)}`);
    giNames.set(s, c.id);
  }
}
console.log(`specialist  genshin: ${gi.characters.length} characters (${gi.generated})`);
const mcu = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'marvel.json'), 'utf8'));
const filmIds = new Set(mcu.films.map((f) => f.id));
for (const f of mcu.films) {
  if (!f.poster) warn(`specialist/marvel/${f.name}: no poster (left out of the Film round)`);
  if (!f.emoji) warn(`specialist/marvel/${f.name}: no emoji summary — add one to scripts/data/mcu-emoji.mjs`);
}
const mcuNames = new Map();
for (const c of mcu.characters) {
  const at = `specialist/marvel/${c.name}`;
  if (!filmIds.has(c.debut)) fail(`${at}: debut ${c.debut} isn't a known film`);
  for (const k of ['image', 'gender', 'species', 'status']) if (!c[k]) fail(`${at}: no ${k}`);
  for (const s of [c.name, ...c.aliases].map((n) => n.toLowerCase())) {
    if (mcuNames.has(s) && mcuNames.get(s) !== c.id) fail(`${at}: "${s}" is also a name of ${mcuNames.get(s)}`);
    mcuNames.set(s, c.id);
  }
}
console.log(`specialist  marvel: ${mcu.films.length} films, ${mcu.characters.length} characters (${mcu.characters.filter((c) => c.castable).length} for Cast), ${mcu.generated}`);
console.log(`specialist  lol: ${lol.champions.length} champions (Data Dragon ${lol.version}, ${lol.generated})`);
console.log(`specialist  onepiece: ${op.characters.length} characters, ${op.fruits.length} fruits, ${op.crews.length} crews, ${op.laughs.length} laughs (${op.generated})`);

console.log(`\n${ids.size} works, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
