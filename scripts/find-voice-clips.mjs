#!/usr/bin/env node
// Finds Voice Line clips for anime that have none, from YouTube search results (no API key):
// the original Japanese voice first, the French dub (VF) when no Japanese clip turns up, never an
// English or other dub. Only titles are checked (they must name the character or the work and say
// the language), so a few picks may still deserve a listen.
//
//   node scripts/find-voice-clips.mjs [--dry] [--force]   (--force re-searches anime that have a clip)
import { loadWorks, parseArgs, saveWorks, sleep } from './lib.mjs';

/** Lowercase, no accents or punctuation, single spaces. */
const normalizeText = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const { flags } = parseArgs();
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  // Skips the EU cookie-consent interstitial.
  Cookie: 'SOCS=CAI',
};

/** Videos on a results page: [id, title, seconds]. YouTube pushes back when asked too fast: wait and retry. */
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
      out.push({ id: r.videoId, title: r.title?.runs?.map((t) => t.text).join('') ?? '', secs });
    }
    return v;
  });
  return out;
}

/** Anything that isn't one character's dialogue: music, other roles of the voice actor, whole episodes. */
const NOT_VOICE =
  /\b(opening|ending|op\s?\d|ed\s?\d|ost|soundtrack|song|lyrics|music|cover|amv|reaction|review|explained|trailer|asmr|karaoke|piano|remix|version|voice actors?|seiyuu?|roles|comparison|vs|episodes?|[ée]pisode|ep\s?\d+|full|film complet|int[ée]gral|beatbox|cries|all \d+)\b/i;
/** Fans voicing the character rather than its real voice actor. */
const FAN_MADE = /\b(fan|fandub|fan-?dub|impression|competition|contest|proposition|voice acting|i voice(d)?|my voice)\b/i;
/** Words that say the clip is someone speaking. */
const SPOKEN = /\b(voices?|voice ?lines|lines|quotes?|scenes?|speech|says|saying|said|clip|moments?|laugh|laughs|yells?|screams?|shouts?|introduces|talks?|dialogue|r[ée]plique|voix|extrait|sc[èe]ne)\b/i;
const OTHER_DUB = /\b(english|eng|dub(bed)?|latino|espa[ñn]ol|castellano|deutsch|german|italiano|italian|portugu[eê]s|brasil|hindi|tagalog|arabic|russian|korean)\b/i;
const JAPANESE = /\b(japanese|jp|jap|japonais|original|raw|no (subs?|subtitles)|sub(bed)?)\b|日本語/i;
const FRENCH = /\b(vf|version fran[çc]aise|voix fran[çc]aise|en fran[çc]ais|french( dub)?|doublage)\b/i;

/** Does the title name the character (any part of the name) or the work? */
function aboutIt(title, w) {
  const t = ` ${normalizeText(title)} `;
  const parts = normalizeText(w.voice.speaker).split(' ').filter((p) => p.length >= 3);
  return parts.some((p) => t.includes(` ${p} `)) || t.includes(` ${normalizeText(w.name)} `);
}

function pick(results, w, lang) {
  return results.find(({ id, title, secs }) => {
    if (used.has(id) || secs < 8 || secs > 600 || NOT_VOICE.test(title) || FAN_MADE.test(title) || !SPOKEN.test(title) || !aboutIt(title, w)) return false;
    if (lang === 'ja') return JAPANESE.test(title) && !OTHER_DUB.test(title.replace(/\bsub(bed|s)?\b/gi, '')) && !FRENCH.test(title);
    return FRENCH.test(title) && !OTHER_DUB.test(title.replace(/\bfrench dub\b/gi, ''));
  });
}

const works = loadWorks('anime');
const todo = works.filter((w) => w.voice && (flags.force || !w.voice.youtubeId));
// A clip already used by another work (Dragon Ball and Dragon Ball Z...) isn't picked twice.
const used = new Set(works.filter((w) => !todo.includes(w)).map((w) => w.voice?.youtubeId).filter(Boolean));
let ja = 0;
let fr = 0;
for (const [i, w] of todo.entries()) {
  const { speaker } = w.voice;
  let hit = pick(await search(`${speaker} ${w.name} japanese voice`), w, 'ja');
  let lang = 'ja';
  if (!hit) {
    await sleep(2500);
    hit = pick(await search(`${speaker} ${w.name} VF voix française`), w, 'fr');
    lang = 'fr';
  }
  if (hit) {
    used.add(hit.id);
    w.voice.youtubeId = hit.id;
    w.voice.start = hit.secs > 40 ? 3 : 1;
    if (lang === 'fr') w.voice.lang = 'fr';
    else delete w.voice.lang;
    lang === 'fr' ? fr++ : ja++;
  }
  console.log(`${String(i + 1).padStart(3)}/${todo.length} ${hit ? (lang === 'fr' ? 'VF' : 'JP') : '--'} ${w.name} — ${hit ? `${hit.title} [${hit.id}]` : 'nothing'}`);
  // Save as we go, so an interrupted run keeps what it found.
  if (!flags.dry && (i + 1) % 10 === 0) saveWorks('anime', works);
  await sleep(2500);
}
console.log(`\n${ja} Japanese, ${fr} French dub, ${todo.length - ja - fr} not found`);
if (!flags.dry) saveWorks('anime', works);
