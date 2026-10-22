#!/usr/bin/env node
// Builds src/data/specialist/onepiece.json for the One Piece Specialist mode, from the One Piece
// wiki (onepiece.fandom.com). Re-run it to pick up new characters, bounties and Devil Fruits.
//
//   node scripts/build-specialist-onepiece.mjs [--characters=300] [--fruits=120] [--crews=45]
//
// - Characters: every canon page with a character infobox ({{Char Box}}), the longest pages first
//   (a fair proxy for importance). The infobox gives affiliation, origin, height, bounty, debut
//   chapter and Devil Fruit; the page categories give gender and Haki.
// - Devil Fruits: canon Paramecia / Zoan / Logia pages and their {{Devil Fruit Box}}. A picture is
//   kept only for fruits whose look has been shown (otherwise the page picture is the user).
// - Crews: {{Crew Box}} pages with a Jolly Roger.
// - Laughs: the wiki's "Laughter Style" table, for characters in the roster.
// Only facts are kept (names, numbers, types); no article text is copied.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, mediawikiGet, parseArgs, sleep } from './lib.mjs';

const { flags } = parseArgs();
const API = fandomApi('onepiece');
const LIMITS = { characters: Number(flags.characters ?? 300), fruits: Number(flags.fruits ?? 120), crews: Number(flags.crews ?? 45) };
const OUT = join(ROOT, 'src', 'data', 'specialist', 'onepiece.json');

/** Story arcs by first chapter; a debut chapter maps to the last arc that starts at or before it. */
const ARCS = [
  [1, 'Romance Dawn'], [8, 'Orange Town'], [22, 'Syrup Village'], [42, 'Baratie'], [69, 'Arlong Park'], [96, 'Loguetown'],
  [101, 'Reverse Mountain'], [106, 'Whisky Peak'], [115, 'Little Garden'], [130, 'Drum Island'], [155, 'Arabasta'], [218, 'Jaya'],
  [237, 'Skypiea'], [303, 'Long Ring Long Land'], [322, 'Water 7'], [375, 'Enies Lobby'], [431, 'Post-Enies Lobby'], [442, 'Thriller Bark'],
  [490, 'Sabaody Archipelago'], [514, 'Amazon Lily'], [525, 'Impel Down'], [550, 'Marineford'], [581, 'Post-War'], [598, 'Return to Sabaody'],
  [603, 'Fish-Man Island'], [654, 'Punk Hazard'], [700, 'Dressrosa'], [802, 'Zou'], [825, 'Whole Cake Island'], [903, 'Levely'],
  [909, 'Wano Country'], [1058, 'Egghead'], [1126, 'Elbaph'],
];
const arcOf = (chapter) => ARCS.filter(([c]) => c <= chapter).pop()?.[1] ?? 'Romance Dawn';

const HAKI = { 'Observation Haki Users': 'Observation', 'Armament Haki Users': 'Armament', 'Supreme King Haki Users': "Conqueror's" };

// ── Wiki helpers ──────────────────────────────────────────────────────────────

async function allEmbeds(template, namespace = '0') {
  const out = [];
  let cont = {};
  do {
    const d = await mediawikiGet(API, { action: 'query', list: 'embeddedin', eititle: template, einamespace: namespace, eilimit: '500', ...cont });
    out.push(...d.query.embeddedin.map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

async function categoryPages(category) {
  const out = [];
  let cont = {};
  do {
    const d = await mediawikiGet(API, { action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    out.push(...d.query.categorymembers.map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

/** Page length, picture and (some) categories for many titles, 50 at a time. */
async function pageInfo(titles, categories) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont = {};
    do {
      const d = await mediawikiGet(API, {
        action: 'query', prop: 'info|categories|pageimages', titles: batch.join('|'), cllimit: 'max', pithumbsize: '240',
        clcategories: categories.map((c) => `Category:${c}`).join('|'), redirects: '1', ...cont,
      });
      for (const p of d.query?.pages ?? []) {
        const prev = out.get(p.title) ?? { length: 0, cats: new Set(), image: null };
        prev.length = p.length ?? prev.length;
        prev.image = p.thumbnail?.source ?? prev.image;
        for (const c of p.categories ?? []) prev.cats.add(c.title.replace(/^Category:/, ''));
        out.set(p.title, prev);
      }
      cont = d.continue ?? null;
    } while (cont);
    await sleep(300);
  }
  return out;
}

/** Wikitext of many pages, 50 at a time. */
async function wikitexts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const d = await mediawikiGet(API, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 50).join('|') });
    for (const p of d.query?.pages ?? []) out.set(p.title, p.revisions?.[0]?.slots?.main?.content ?? '');
    await sleep(300);
  }
  return out;
}

/** The {{<name> ...}} box's fields. */
function boxFields(text, name) {
  const start = text.search(new RegExp(`\\{\\{\\s*${name}`, 'i'));
  if (start < 0) return null;
  const fields = {};
  // Refs and footnotes carry their own templates; drop them before reading the fields.
  const body = text.slice(start).replace(/\{\{(Qref|Refn)[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}/gi, '').replace(/<ref[^>]*>.*?<\/ref>|<ref[^>]*\/>/gis, '');
  let depth = 0;
  let end = body.length;
  for (let i = 0; i < body.length - 1; i++) {
    if (body[i] === '{' && body[i + 1] === '{') depth++, i++;
    else if (body[i] === '}' && body[i + 1] === '}') {
      depth--, i++;
      if (depth === 0) { end = i; break; }
    }
  }
  // A value can run over several lines (bounty histories): later lines belong to the field above.
  let current = null;
  for (const line of body.slice(0, end).split('\n')) {
    const m = line.match(/^\|\s*(\w+)\s*=\s*(.*)$/);
    if (m) fields[(current = m[1].toLowerCase())] = m[2].trim();
    else if (current) fields[current] += `<br/>${line.trim()}`;
  }
  return fields;
}

/** The box itself, or the "{{<name> Tabs Top}}" template that holds it for the biggest characters. */
function boxSource(text) {
  if (/\{\{\s*Char Box/i.test(text)) return { text };
  const tabs = text.match(/\{\{\s*([^{}|]+ Tabs Top)\s*\}\}/)?.[1];
  return { tabs: tabs ? `Template:${tabs}` : null };
}

/**
 * Current height: childhood and flashback heights are left out; of the rest, the one at the oldest
 * stated age ("199 cm (age 39)" over "132 cm (age 13)"), else the last one given.
 */
function heightOf(v = '') {
  const parts = v
    .split(/<br\s*\/?>/i)
    .map((part) => ({ cm: Number(part.match(/([\d.]+)\s*cm/)?.[1]), age: Number(part.match(/age (\d+)/i)?.[1] ?? -1), part }))
    .filter((p) => p.cm && !/child|young|kid|flashback|\d+ years ago/i.test(p.part));
  if (!parts.length) return 0;
  const aged = parts.filter((p) => p.age >= 0).sort((a, b) => b.age - a.age);
  return Math.round((aged[0] ?? parts[parts.length - 1]).cm);
}

/** Current bounty, or the last known one when it's been withdrawn or is unknown (struck through). */
function bountyOf(v = '') {
  const amount = (s) => Number(s.match(/\{\{B\}\}\s*([\d,]{2,})/)?.[1]?.replace(/,/g, '') ?? 0);
  return amount(v.replace(/<s>.*?<\/s>/gs, '')) || amount(v.replace(/<\/?s>/g, ''));
}

/** Paramecia / Zoan / Logia, with the Zoan sub-kinds kept apart. */
function fruitTypeOf(v = '') {
  if (/mythical/i.test(v)) return 'Mythical Zoan';
  if (/ancient/i.test(v)) return 'Ancient Zoan';
  return ['Paramecia', 'Zoan', 'Logia'].find((t) => new RegExp(t, 'i').test(v)) ?? plain(v);
}

/** Plain text of a wiki value: links to their label, templates and markup dropped. */
const plain = (v = '') =>
  v.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^{}]*\}\}/g, '').replace(/<[^>]+>/g, ' ').replace(/'{2,}/g, '').replace(/\s+/g, ' ').trim();

/** First item of a list value ("A;<br/>B (former)", "A, B"), without notes in brackets. */
const firstItem = (v = '') =>
  v
    .split(/;|,|<br\s*\/?>/i)
    .map((s) => plain(s).replace(/\s*\(.*?\)\s*/g, ' ').trim())
    .find(Boolean) ?? '';

// ── Characters ────────────────────────────────────────────────────────────────

async function characters() {
  console.log('▶ characters');
  const titles = [...new Set([...(await allEmbeds('Template:Char Box', '0')), ...(await allEmbeds('Template:Character Tab', '10'))
    .filter((t) => / Tabs Top$/.test(t)).map((t) => t.replace(/^Template:/, '').replace(/ Tabs Top$/, ''))])];
  const tabbed = new Set((await allEmbeds('Template:Character Tab', '10')).filter((t) => / Tabs Top$/.test(t)).map((t) => t.replace(/^Template:| Tabs Top$/g, '')));
  console.log(`  ${titles.length} pages with an infobox`);
  const info = await pageInfo(titles, ['Male Characters', 'Female Characters', 'Non-Canon Characters', ...Object.keys(HAKI)]);
  // The biggest characters keep their infobox on a tabs template and spread over subpages: rank them first.
  // Subpages ("Monkey D. Luffy/History") repeat their character's box: only the main page counts,
  // but having them is the best sign of a major character (their main page is short, the rest is split off).
  const subpages = {};
  for (const t of titles) if (t.includes('/')) subpages[t.split('/')[0]] = (subpages[t.split('/')[0]] ?? 0) + 1;
  const weight = (t) => (tabbed.has(t) ? 2 : 0) + (subpages[t] ?? 0);
  const ranked = titles
    .filter((t) => !t.includes('/') && info.get(t) && !info.get(t).cats.has('Non-Canon Characters'))
    .sort((a, b) => weight(b) - weight(a) || info.get(b).length - info.get(a).length);
  const picked = ranked.slice(0, Math.round(LIMITS.characters * 1.25));
  const pages = await wikitexts(picked);
  // Pages whose box sits on a tabs template: fetch those templates too.
  const found = new Map(picked.map((t) => [t, boxSource(pages.get(t) ?? '')]));
  const templates = await wikitexts([...new Set([...found.values()].map((s) => s.tabs).filter(Boolean))]);
  const out = [];
  for (const title of picked) {
    const src = found.get(title);
    const f = boxFields(src.text ?? templates.get(src.tabs) ?? '', 'Char Box');
    const meta = info.get(title);
    const chapter = Number(f?.first?.match(/Chapter (\d+)/)?.[1]);
    if (!f || !chapter || !meta.image) continue;
    const bounty = bountyOf(f.bounty);
    const fruits = [f.dfname, f.dfname2].filter(Boolean).map(plain);
    const types = [f.dftype, f.dftype2].filter(Boolean).map(fruitTypeOf);
    out.push({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: title,
      // The name the series goes by when the page uses a full one ("Polo Marco" → "Marco").
      // Each translation's spelling counts, without the note on who uses it ("Coby (Funimation, 4Kids)").
      aliases: [...new Set(plain(f.ename ?? '').replace(/\s*\([^)]*\)/g, '').split(/;|,/).map((n) => n.trim()))].filter(
        // (Nested notes can leave a bracket behind; such leftovers aren't names.)
        (n) => n && n !== title && !/[()]/.test(n) && n.split(' ').length <= 4 && !/^(crunchyroll|viz|funimation|4kids|odex|bstation|wt100|opcg|netflix|toei|former|dub|sub)$/i.test(n),
      ),
      image: meta.image,
      gender: meta.cats.has('Female Characters') ? 'Female' : meta.cats.has('Male Characters') ? 'Male' : 'Unknown',
      affiliation: firstItem(f.affiliation) || 'None',
      fruit: fruits.length ? fruits : ['None'],
      fruitType: types.length ? [...new Set(types)] : ['None'],
      haki: Object.entries(HAKI).filter(([c]) => meta.cats.has(c)).map(([, h]) => h),
      bounty,
      height: heightOf(f.height),
      origin: (firstItem(f.origin) || 'Unknown').replace(/^Sky Islands?$/, 'Sky Island'),
      chapter,
      arc: arcOf(chapter),
    });
    if (out.length >= LIMITS.characters) break;
  }
  // Short names players type ("Luffy", "Zoro"): the last word, unless two characters share it.
  const last = (n) => n.replace(/\s*\(.*\)$/, '').split(' ').pop();
  const counts = {};
  for (const c of out) counts[last(c.name)] = (counts[last(c.name)] ?? 0) + 1;
  for (const c of out) if (last(c.name) !== c.name && last(c.name).length >= 3 && counts[last(c.name)] === 1) c.aliases.push(last(c.name));
  // Nicknames and French names from the Who's That? roster.
  const roster = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'silhouettes.json'), 'utf8')).find((s) => s.id === 'onepiece')?.entries ?? [];
  for (const r of roster) {
    const c = out.find((x) => x.name === r.name || r.aliases.includes(x.name) || x.aliases.includes(r.name));
    if (c) c.aliases = [...new Set([...c.aliases, ...r.aliases, r.name].filter((a) => a !== c.name))];
  }
  console.log(`  ${out.length} characters`);
  return out;
}

// ── Devil Fruits ──────────────────────────────────────────────────────────────

async function devilFruits(roster) {
  console.log('▶ devil fruits');
  const titles = [...new Set([...(await categoryPages('Category:Paramecia')), ...(await categoryPages('Category:Zoan')), ...(await categoryPages('Category:Logia'))])]
    .filter((t) => / no Mi\b/.test(t));
  const info = await pageInfo(titles, ['Non-Canon Devil Fruits', 'Shown Devil Fruits']);
  const known = new Set(roster.map((c) => c.name));
  const ranked = titles
    .filter((t) => info.get(t) && !info.get(t).cats.has('Non-Canon Devil Fruits'))
    .sort((a, b) => info.get(b).length - info.get(a).length);
  const texts = await wikitexts(ranked.slice(0, Math.round(LIMITS.fruits * 1.3)));
  const out = [];
  for (const title of ranked) {
    const f = boxFields(texts.get(title) ?? '', 'Devil Fruit Box');
    if (!f) continue;
    const users = (f.user ?? '')
      .split(/;|<br\s*\/?>/i)
      .map((u) => plain(u).replace(/\s*\(.*?\)\s*/g, '').replace(/[{}|]/g, '').trim())
      .filter((u) => u.length > 1);
    const type = fruitTypeOf(f.type);
    // The first English name, without the note on which translation uses it.
    const english = firstItem(plain(f.ename ?? '').replace(/\s*\([^)]*\)/g, '')) || undefined;
    out.push({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: title,
      aliases: [english].filter(Boolean),
      english,
      meaning: plain(f.meaning) || undefined,
      type,
      users,
      // Only the fruit itself: a page whose fruit was never shown pictures its user instead.
      image: info.get(title).cats.has('Shown Devil Fruits') ? info.get(title).image ?? undefined : undefined,
      chapter: Number(f.first?.match(/Chapter (\d+)/)?.[1]) || undefined,
      arc: Number(f.first?.match(/Chapter (\d+)/)?.[1]) ? arcOf(Number(f.first.match(/Chapter (\d+)/)[1])) : undefined,
      known: users.some((u) => known.has(u)),
    });
    if (out.length >= LIMITS.fruits) break;
  }
  console.log(`  ${out.length} fruits (${out.filter((x) => x.image).length} with a picture)`);
  return out.map(({ known: _, ...f }) => f);
}

// ── Crews and their Jolly Rogers ──────────────────────────────────────────────

async function crews() {
  console.log('▶ crews');
  const titles = await allEmbeds('Template:Crew Box', '0');
  const info = await pageInfo(titles, ['Non-Canon Pirate Crews']);
  const ranked = titles.filter((t) => info.get(t) && !info.get(t).cats.has('Non-Canon Pirate Crews')).sort((a, b) => info.get(b).length - info.get(a).length);
  const texts = await wikitexts(ranked.slice(0, LIMITS.crews * 2));
  const files = [];
  for (const title of ranked.slice(0, LIMITS.crews * 2)) {
    const f = boxFields(texts.get(title) ?? '', 'Crew Box');
    const file = f?.jroger?.split('|')[0]?.trim();
    if (file) files.push([title, file, plain(f.first).match(/Chapter (\d+)/)?.[1]]);
    if (files.length >= LIMITS.crews) break;
  }
  const out = [];
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const d = await mediawikiGet(API, { action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '360', titles: batch.map(([, f]) => `File:${f}`).join('|') });
    const norm = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]));
    const urls = new Map((d.query?.pages ?? []).map((p) => [norm.get(p.title) ?? p.title, p.imageinfo?.[0]?.thumburl]));
    for (const [title, file, chapter] of batch) {
      const flag = urls.get(`File:${file}`);
      if (flag) {
        const ch = Number(chapter) || undefined;
        out.push({ id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: title, aliases: [title.replace(/ Pirates$/, '')], flag, chapter: ch, arc: ch ? arcOf(ch) : undefined });
      }
    }
  }
  console.log(`  ${out.length} crews with a Jolly Roger`);
  return out;
}

// ── Laughs ────────────────────────────────────────────────────────────────────

async function laughs(roster) {
  console.log('▶ laughs');
  const text = (await wikitexts(['Laughter Style'])).get('Laughter Style') ?? '';
  const out = [];
  for (const row of text.split(/\n\|-[^\n]*\n/)) {
    const cells = row.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}'));
    if (cells.length < 2) continue;
    const who = plain(cells[0].slice(1)).replace(/\s*\(.*?\)\s*/g, '').trim();
    const laugh = cells[1].match(/''"([^"]+)"''/)?.[1];
    const c = roster.find((x) => x.name === who || x.aliases.includes(who));
    if (c && laugh && !out.some((l) => l.character === c.id)) out.push({ character: c.id, laugh });
  }
  console.log(`  ${out.length} laughs`);
  return out;
}

const roster = await characters();
const data = { generated: new Date().toISOString().slice(0, 10), characters: roster, fruits: await devilFruits(roster), crews: await crews(), laughs: await laughs(roster) };
mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`✓ ${OUT}`);
