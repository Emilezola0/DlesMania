#!/usr/bin/env node
// Builds src/data/specialist/marvel.json for the Marvel (MCU) Specialist mode, from the Marvel
// Cinematic Universe wiki (marvelcinematicuniverse.fandom.com). Re-run it after a release.
//
//   node scripts/build-specialist-marvel.mjs [--characters=150]
//
// - Films: every page in Category:Released Movies, with its {{Movie}} box (director, release date,
//   box office, poster) and Phase category.
// - Characters: the members of each film's "<Film> Characters" category, ranked by how many films
//   they appear in (then page size). Their debut is their earliest film; gender, species, status and
//   actor come from the {{Character}} box; their team is their best-known group category
//   ("Avengers Members", "HYDRA Agents"...).
// - Emoji summaries are hand-written in scripts/data/mcu-emoji.mjs.
// Only facts and names are kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, mediawikiGet, parseArgs, sleep } from './lib.mjs';
import { MCU_EMOJI } from './data/mcu-emoji.mjs';

const { flags } = parseArgs();
const API = fandomApi('marvelcinematicuniverse');
const LIMIT = Number(flags.characters ?? 180);
const OUT = join(ROOT, 'src', 'data', 'specialist', 'marvel.json');

async function categoryPages(category) {
  const out = [];
  let cont = {};
  do {
    const d = await mediawikiGet(API, { action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    out.push(...(d.query?.categorymembers ?? []).map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

/** Wikitext, categories, picture and size of many pages, 50 at a time. */
async function pages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont = {};
    do {
      const d = await mediawikiGet(API, {
        action: 'query', prop: 'revisions|categories|pageimages|info', rvprop: 'content', rvslots: 'main', cllimit: 'max', pithumbsize: '300', titles: batch.join('|'), ...cont,
      });
      for (const p of d.query?.pages ?? []) {
        const prev = out.get(p.title) ?? { text: '', cats: [], image: null, length: 0 };
        prev.text = p.revisions?.[0]?.slots?.main?.content ?? prev.text;
        prev.cats.push(...(p.categories ?? []).map((c) => c.title.replace(/^Category:/, '')));
        prev.image = p.thumbnail?.source ?? prev.image;
        prev.length = p.length ?? prev.length;
        out.set(p.title, prev);
      }
      // Big batches come back in parts (page texts and categories both continue): follow them all.
      cont = d.continue ?? null;
    } while (cont);
    // Pictures go missing from those big, continued answers: ask for them on their own.
    const pics = await mediawikiGet(API, { action: 'query', prop: 'pageimages', pithumbsize: '300', pilimit: '50', titles: batch.join('|') });
    for (const p of pics.query?.pages ?? []) if (out.has(p.title) && p.thumbnail?.source) out.get(p.title).image = p.thumbnail.source;
    await sleep(400);
  }
  return out;
}

/** A box field's raw value (up to the next field). */
function field(text, key) {
  const m = text.match(new RegExp(`\\n\\|\\s*${key}\\s*=([\\s\\S]*?)(?=\\n\\||\\n\\}\\})`, 'i'));
  return m?.[1]?.trim() ?? '';
}
/** Plain text: links to labels, refs, templates and markup dropped. */
const plain = (v = '') =>
  v
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\{\{Ref\|[^}]*\}\}/gi, '')
    // A name the wiki marks as conjecture is still the name.
    .replace(/\{\{Conjecture\|([^}]*)\}?\}?/gi, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/**
 * The main item of a <br>-separated list: the first one without a note ("(formerly)", "(The
 * Avengers)", "(young)"...), else the first that isn't a former, young or stand-in one.
 */
const firstItem = (v = '') => {
  const items = v
    .replace(/\{\{\s*(Infobox List|Collapse)\s*\|/gi, '')
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter((s) => plain(s));
  const keep =
    items.find((s) => !/<small>|\(/.test(s)) ?? items.find((s) => !/formerly|young|motion capture|stand-in|double|voice|archive/i.test(s)) ?? items[0] ?? '';
  return plain(keep.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/\(.*?\)/g, ''));
};
/** The text of a one-line field inside the box ("|primary = Tony Stark{{Ref|IM}}"); refs and a dangling "{{…" are dropped. */
const lineField = (text, key) => {
  const raw = text.match(new RegExp(`\\|\\s*${key}\\s*=([^\\n]*)`, 'i'))?.[1] ?? '';
  return plain(raw.replace(/\{\{\s*(Ref|ExpRef)\|[^}]*\}\}/gi, '').replace(/\{\{[^}]*$/, '').replace(/\}\}\s*$/, ''))
    .replace(/\s*\(.*?\)/g, '')
    .trim();
};
/** Roles recast early on, whose first listed actor isn't the one the role is known for. */
const RECAST = { Hulk: 'Mark Ruffalo', 'War Machine': 'Don Cheadle', Thanos: 'Josh Brolin' };

/**
 * The actor most associated with the role: the first one listed without a note ("(young)",
 * "(motion capture)"), or the voice actor when everyone on screen is motion capture (Groot, Rocket).
 */
function mainActor(text, title = '') {
  if (RECAST[title]) return RECAST[title];
  const clean = (v) => v.replace(/\{\{\s*(Infobox List|Collapse)\s*\|/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '');
  const items = (v) => clean(v).split(/<br\s*\/?>/i).map((s) => s.trim()).filter((s) => plain(s));
  // A note is visible text in brackets or small print; brackets inside a link target ("Ryan Reynolds (actor)") don't count.
  const plainOnes = (v) => items(v).filter((s) => !/<small>/.test(s) && !/\(/.test(plain(s))).map(plain);
  return plainOnes(field(text, 'actor'))[0] ?? plainOnes(field(text, 'voice actor'))[0] ?? (firstItem(field(text, 'actor')) || undefined);
}

/** Whether one actor clearly owns the role (a single credit, a voice-only role, or a known recast), so the Cast round can use it. */
function actorIsClear(text, title) {
  if (RECAST[title]) return true;
  const credits = field(text, 'actor')
    .replace(/\{\{\s*(Infobox List|Collapse)\s*\|/gi, '')
    .split(/<br\s*\/?>/i)
    .filter((s) => plain(s) && !/<small>/.test(s) && !/\(/.test(plain(s)));
  return credits.length === 1 || (credits.length === 0 && !!plain(field(text, 'voice actor')));
}

// ── Films ────────────────────────────────────────────────────────────────────────

console.log('▶ films');
const filmTitles = await categoryPages('Category:Released Movies');
const filmPages = await pages(filmTitles);
const films = [];
for (const title of filmTitles) {
  const p = filmPages.get(title);
  const phase = p.cats.map((c) => c.match(/^Phase (\w+) Movies$/)?.[1]).find(Boolean);
  const release = plain(field(p.text, 'release').split(/<br\s*\/?>/i)[0]).replace(/\(.*?\)/g, '').trim();
  const date = new Date(release);
  if (!phase || Number.isNaN(date.getTime())) {
    console.log(`  ✗ ${title}: no phase or release date`);
    continue;
  }
  const name = plain(field(p.text, 'title')) || title.replace(/ \(film\)$/, '');
  films.push({
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    page: title,
    aliases: [],
    year: date.getFullYear(),
    date: date.toISOString().slice(0, 10),
    phase: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].indexOf(phase) + 1,
    director: firstItem(field(p.text, 'director')),
    boxOffice: plain(field(p.text, 'boxoffice')).split(' (')[0] || undefined,
    // Page thumbnails are small; the Film round zooms in, so ask for a wide copy.
    poster: p.image?.replace(/scale-to-width-down\/\d+/, 'scale-to-width-down/800') ?? undefined,
    emoji: MCU_EMOJI[name] ?? undefined,
  });
}
films.sort((a, b) => a.date.localeCompare(b.date));
films.forEach((f, i) => (f.order = i + 1));
const missingEmoji = films.filter((f) => !f.emoji).map((f) => f.name);
if (missingEmoji.length) console.log(`  (no emoji yet for: ${missingEmoji.join(', ')})`);
console.log(`  ${films.length} films`);

// ── Characters ───────────────────────────────────────────────────────────────────

console.log('▶ characters');
const appearances = new Map();
for (const f of films) {
  for (const c of await categoryPages(`Category:${f.page} Characters`)) {
    if (!appearances.has(c)) appearances.set(c, []);
    appearances.get(c).push(f);
  }
  await sleep(250);
}
// Rank every candidate by films, then page size (cheap to fetch), before reading the best ones in full.
const candidates = [...appearances.keys()].filter((c) => !c.includes('/') && !c.includes('('));
const sizes = new Map();
for (let i = 0; i < candidates.length; i += 50) {
  const d = await mediawikiGet(API, { action: 'query', prop: 'info', titles: candidates.slice(i, i + 50).join('|') });
  for (const p of d.query?.pages ?? []) sizes.set(p.title, p.length ?? 0);
  await sleep(200);
}
// A film appearance counts like 15 kB of article: a single film's lead (Shang-Chi) outranks a recurring extra.
const weight = (t) => appearances.get(t).length + (sizes.get(t) ?? 0) / 15000;
const byWeight = (a, b) => weight(b) - weight(a);
const info = await pages([...candidates].sort(byWeight).slice(0, Math.round(LIMIT * 1.4)));
/** Cameos and people playing themselves aren't characters to guess. */
// Subpages, and variants or in-story actors with a bracketed title ("Loki (Asgardian Actor)").
const notACharacter = (title, text) => {
  const actor = mainActor(text) ?? '';
  return title.includes('/') || title.includes('(') || /Stan Lee/.test(actor) || (actor && actor === title) || /^(him|her)self$/i.test(actor);
};
// --why="Iron Man" tells why a character is or isn't in the roster.
if (flags.why) {
  const t = flags.why;
  const p = info.get(t);
  console.log(`  why ${t}: candidate ${candidates.includes(t)}, weight ${appearances.get(t) ? weight(t).toFixed(1) : '-'}, fetched ${!!p},`, p ? `box ${/\{\{\s*Character\b/.test(p.text)}, image ${!!p.image}, excluded ${notACharacter(t, p.text)} (actor "${mainActor(p.text)}")` : '');
}
const ranked = [...info.keys()]
  .filter((t) => /\{\{\s*Character\b/.test(info.get(t).text) && info.get(t).image && !notACharacter(t, info.get(t).text))
  .sort(byWeight)
  .slice(0, LIMIT);

/**
 * Pages named after a mantle that several people have held show the person the page is about
 * (the current holder); the mantle stays an accepted answer.
 */
const MANTLE_HOLDER = {
  'Captain America': 'Sam Wilson',
  'Black Widow': 'Yelena Belova',
  'Black Panther': 'Shuri',
  'Captain Marvel': 'Carol Danvers',
  Hawkeye: 'Clint Barton',
  'Ant-Man': 'Scott Lang',
  Wasp: 'Hope van Dyne',
};

// A character's team: the group category (… Members / … Agents) with the most members among the chosen ones.
const GROUP = /^(.+) (Members|Agents|Soldiers)$/;
const groupSize = {};
for (const t of ranked) for (const c of info.get(t).cats) if (GROUP.test(c)) groupSize[c] = (groupSize[c] ?? 0) + 1;

const characters = ranked.map((title) => {
  const p = info.get(title);
  const seen = appearances.get(title).sort((a, b) => a.order - b.order);
  const groups = p.cats.filter((c) => GROUP.test(c) && groupSize[c] >= 2).sort((a, b) => groupSize[b] - groupSize[a]);
  const primary = lineField(p.text, 'primary').split(/[;,]/)[0].replace(/"/g, '').trim();
  const real = lineField(p.text, 'real name').replace(/"/g, '').trim();
  const page = title.replace(/\s*\(.*\)$/, '');
  const name = MANTLE_HOLDER[page] ?? page;
  const status = plain(field(p.text, 'status')).split(' ')[0] || (p.cats.includes('Deceased Characters') ? 'Deceased' : 'Alive');
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    // The codename, the name they go by and their full name all count.
    aliases: [...new Set([page, primary, real])].filter((n) => n && n !== name && n.split(' ').length <= 5),
    image: p.image,
    gender: plain(field(p.text, 'gender')).split(' ')[0] || 'Unknown',
    species: plain(firstItem(field(p.text, 'species'))).split(/[,;]/)[0].trim() || 'Unknown',
    team: groups[0]?.replace(GROUP, '$1') ?? 'None',
    status: /deceased|dead/i.test(status) ? 'Deceased' : /alive/i.test(status) ? 'Alive' : 'Unknown',
    actor: mainActor(p.text, title),
    // Only clear-cut credits are used by the Cast round.
    castable: actorIsClear(p.text, title),
    debut: seen[0].id,
    phase: seen[0].phase,
    films: seen.length,
  };
});
// A spelling two characters share (a family name, a passed-on title) would make a guess ambiguous: it's dropped from both.
const owners = {};
for (const c of characters) for (const n of [c.name, ...c.aliases]) (owners[n.toLowerCase()] ??= new Set()).add(c.id);
for (const c of characters) c.aliases = c.aliases.filter((n) => owners[n.toLowerCase()].size === 1);
console.log(`  ${characters.length} characters`);

mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), films, characters }, null, 2) + '\n');
console.log(`✓ ${OUT}`);
