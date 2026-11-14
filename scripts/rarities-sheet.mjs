#!/usr/bin/env node
// The rarities sheet: sheets/rarities.xlsx, every card rarity in one place for the owner to change on Google Drive:
// the pack rarities (name, gem, order, light) and the special ones never found in packs (Apex, Relic, Eclipse: name,
// gem, colours, speed, words, which effects show, and their numbers).
//   npm run rarities:sheet    writes the sheet from the site's data (src/data/tuning/rarities.json, special-rarities.json)
//   npm run rarities:import   reads the sheet back into that data (download it from Drive as .xlsx over this file first)
// The import checks every value (a colour is #rrggbb, a number is a number, On is Yes or No) and says what changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const FILE = join(process.cwd(), 'sheets', 'rarities.xlsx');
const PACK_JSON = join(process.cwd(), 'src', 'data', 'tuning', 'rarities.json');
const SPECIAL_JSON = join(process.cwd(), 'src', 'data', 'tuning', 'special-rarities.json');
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

/** What each effect of a special rarity is (the Effects sheet's last column). */
const EFFECTS = {
  apex: { frame: 'Its frame: crimson, gold and white turning round the card', embers: 'Embers rising through the card', sheen: 'A light sweeping over the card now and then', flames: 'A crown of flames round the card', pillar: 'A pillar of light rising behind the card', shockwave: 'Shockwaves pulsing out from the card', ribbon: 'The "▲ APEX" ribbon on top (in place of OMNI)' },
  relic: { frame: 'Its frame: carved stone with a gold edge, a gold light running round it', runes: 'Runes down both sides, lighting up one after another', dust: 'Dust drifting up in the light', sheen: 'A golden light sweeping over the card now and then', seal: 'A seal of runes turning slowly behind the card', arcana: 'Under the mouse: a magic circle drawing itself over the picture, a light following the pointer', ribbon: 'The "⚱ RELIC" plaque on top' },
  eclipse: { frame: 'Its frame: dark, an arc of light running round it', corona: 'A pearly corona and its streamers, turning behind the card', sun: 'The sun behind the card (the card is the moon): the eclipse passes, and under the mouse the pointer moves the moon; at totality the sky goes dark', veil: 'The dark over the card, breathing in and out', diamond: 'Baily’s beads, then the diamond ring flaring on its edge', stars: 'Stars coming out in the dark round the picture', ribbon: 'The "◐ ECLIPSE" ribbon on top' },
  bond: { frame: 'Its frame: pink and teal light chasing round the card', twin: 'Two lights circling each other over the picture', names: 'The friend’s name on the card ("∞ with …")', infinity: 'An infinity of light behind the card, both friends’ lights chasing round it', fusion: 'Two cards in the friends’ colours parting and merging back into one, a seam down the middle (at once under the mouse)', thread: 'A thread across the card: the two lights meet in a heart', ribbon: 'The "∞ BOND" ribbon on top' },
};
/** The numbers of each special rarity (the Rules sheet): key, label, what it means, kind. */
const RULES = {
  apex: [
    ['copies', 'Copies needed', 'Copies of the same Omni it takes (the card itself and the rest as spares)', 'int'],
    ['reward', 'Reward (DleCoins)', 'Paid once, when the card reaches Apex', 'int'],
  ],
  relic: [['reward', 'Reward (DleCoins)', 'Paid once, when a card becomes its set\'s Relic', 'int']],
  eclipse: [
    ['chance', 'Chance from the black hole', 'The chance a swallowed card of the rarities below comes back Eclipsed (0.15 = 15%)', 'chance'],
    ['rarities', 'Rarities it can touch', 'Pack rarities that can be Eclipsed, separated by commas', 'list'],
    ['shards', 'Star shards needed', 'Star shards that eclipse a card of your choice (one shard per other star the black hole swallows)', 'int'],
  ],
  bond: [
    ['pointsPerDay', 'Points a day together', 'Bond points two friends get each day they both play the daily. Also in firestore.rules (keep it at 1 or change both)', 'int'],
    ['packCost', 'Bond pack cost (points)', 'Bond points a Bond pack costs. Also bondPackCost() in firestore.rules: change both, then publish the rules', 'int'],
    ['chance', 'Bond card chance', 'The chance a Bond pack holds the Bond card (its rarest card, linked to both friends; 0.25 = 25%)', 'chance'],
  ],
};
const SPECIAL_IDS = Object.keys(EFFECTS);
const PACK_IDS = ['common', 'rare', 'epic', 'legendary', 'mythic', 'omni'];

const head = (ws, color = 'FF312E81') => {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  r.alignment = { vertical: 'middle' };
};
/** A colour cell shows its colour (as it was when the sheet was made). */
const swatch = (cell, hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex.slice(1).toUpperCase()}` } };
  cell.font = { color: { argb: r * 0.3 + g * 0.59 + b * 0.11 > 150 ? 'FF000000' : 'FFFFFFFF' }, bold: true };
};

async function makeSheet() {
  const pack = read(PACK_JSON);
  const special = read(SPECIAL_JSON);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Omnidle';

  const me = wb.addWorksheet('Read me');
  me.columns = [{ width: 120 }];
  [
    'Omnidle — card rarities',
    '',
    'Change anything in the coloured sheets, then put it back in the game:',
    '  1. On Google Drive: File > Download > Microsoft Excel (.xlsx).',
    '  2. Put it over sheets/rarities.xlsx in the project.',
    '  3. Run:  npm run rarities:import   (it checks every value and says what changed; then build and push as usual).',
    '',
    'Card rarities: the pack rarities (Common to Omni) and the special ones, never found in packs (Apex, Relic, Eclipse).',
    '  Colours are written #rrggbb (e.g. #ff2d55). Colour 1 is the main light, Colour 2 the body, Colour 3 the highlight.',
    '  The colour of the cell itself is only a preview from when the sheet was made: it is the text that counts.',
    '  Speed: the seconds its slowest movement takes (bigger = calmer).',
    '  Rank: the pack rarities\' order (0 = Common). Ids are the game\'s: don\'t change them.',
    'Effects: each effect of a special rarity, On (Yes) or Off (No).',
    'Rules: how each special rarity is obtained (copies, rewards, chances).',
    '',
    'To make this sheet again from the game (it replaces this file):  npm run rarities:sheet',
  ].forEach((t, i) => {
    const r = me.addRow([t]);
    if (i === 0) r.font = { bold: true, size: 16 };
  });

  const ws = wb.addWorksheet('Card rarities', { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] });
  ws.columns = [
    { header: 'Id', key: 'id', width: 11 },
    { header: 'Kind', key: 'kind', width: 13 },
    { header: 'Name', key: 'name', width: 13 },
    { header: 'Gem', key: 'gem', width: 7 },
    { header: 'Colour 1 (light)', key: 'c1', width: 15 },
    { header: 'Colour 2', key: 'c2', width: 11 },
    { header: 'Colour 3', key: 'c3', width: 11 },
    { header: 'Rank', key: 'rank', width: 7 },
    { header: 'Speed (s)', key: 'speed', width: 10 },
    { header: 'Description', key: 'blurb', width: 70 },
    { header: 'How to get it', key: 'how', width: 70 },
  ];
  for (const id of PACK_IDS) {
    const i = pack.info[id];
    const r = ws.addRow({ id, kind: 'In packs', name: i.name, gem: i.gem, c1: pack.light[id], rank: i.rank, c2: '—', c3: '—', speed: '—', blurb: '—', how: 'Card packs' });
    swatch(r.getCell('c1'), pack.light[id]);
  }
  for (const id of SPECIAL_IDS) {
    const s = special[id];
    const r = ws.addRow({ id, kind: 'Special', name: s.name, gem: s.gem, c1: s.colors[0], c2: s.colors[1], c3: s.colors[2], rank: '—', speed: s.speed, blurb: s.blurb, how: s.how });
    ['c1', 'c2', 'c3'].forEach((k, j) => swatch(r.getCell(k), s.colors[j]));
    r.getCell('kind').font = { bold: true, color: { argb: 'FFB45309' } };
  }
  ws.getColumn('blurb').alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn('how').alignment = { wrapText: true, vertical: 'top' };
  head(ws);

  const fx = wb.addWorksheet('Effects', { views: [{ state: 'frozen', ySplit: 1 }] });
  fx.columns = [
    { header: 'Rarity', key: 'id', width: 11 },
    { header: 'Effect', key: 'fx', width: 11 },
    { header: 'On', key: 'on', width: 7 },
    { header: 'What it is', key: 'what', width: 70 },
  ];
  for (const id of SPECIAL_IDS)
    for (const [k, what] of Object.entries(EFFECTS[id])) {
      const r = fx.addRow({ id, fx: k, on: special[id].effects?.[k] === false ? 'No' : 'Yes', what });
      r.getCell('on').dataValidation = { type: 'list', allowBlank: false, formulae: ['"Yes,No"'] };
    }
  head(fx);

  const rules = wb.addWorksheet('Rules', { views: [{ state: 'frozen', ySplit: 1 }] });
  rules.columns = [
    { header: 'Rarity', key: 'id', width: 11 },
    { header: 'Setting', key: 'key', width: 11 },
    { header: 'Name', key: 'label', width: 26 },
    { header: 'Value', key: 'value', width: 14 },
    { header: 'What it means', key: 'what', width: 90 },
  ];
  for (const id of SPECIAL_IDS)
    for (const [key, label, what, kind] of RULES[id]) {
      const v = special[id][key];
      const r = rules.addRow({ id, key, label, value: kind === 'list' ? v.join(', ') : v, what });
      if (kind === 'chance') r.getCell('value').numFmt = '0.0%';
    }
  head(rules);

  mkdirSync(join(process.cwd(), 'sheets'), { recursive: true });
  await wb.xlsx.writeFile(FILE);
  console.log(`${PACK_IDS.length} pack rarities and ${SPECIAL_IDS.length} special ones -> sheets/rarities.xlsx`);
}

async function importSheet() {
  if (!existsSync(FILE)) throw new Error('No sheets/rarities.xlsx: download it from Drive as .xlsx first (or npm run rarities:sheet).');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const pack = read(PACK_JSON);
  const special = read(SPECIAL_JSON);
  const errors = [];
  const changes = [];
  /** A sheet's rows as objects, by its header names. */
  const rows = (name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return errors.push(`No "${name}" sheet`), [];
    const names = ws.getRow(1).values;
    const out = [];
    ws.eachRow((r, n) => {
      if (n === 1) return;
      const o = {};
      names.forEach((h, i) => h && (o[h] = r.getCell(i).value));
      out.push({ ...o, _row: n });
    });
    return out;
  };
  const text = (v) => (v && typeof v === 'object' && 'richText' in v ? v.richText.map((t) => t.text).join('') : v && typeof v === 'object' && 'result' in v ? v.result : v ?? '').toString().trim();
  const colour = (v, where) => {
    const t = text(v).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(t)) errors.push(`${where}: "${t}" is not a colour like #ff2d55`);
    return t;
  };
  const number = (v, where, int) => {
    const n = Number(text(v).replace('%', '')) / (text(v).endsWith('%') ? 100 : 1);
    if (!Number.isFinite(n) || n < 0 || (int && !Number.isInteger(n))) errors.push(`${where}: "${text(v)}" is not a ${int ? 'whole number' : 'number'}`);
    return n;
  };
  const set = (obj, key, value, where) => {
    if (JSON.stringify(obj[key]) !== JSON.stringify(value)) changes.push(`${where}: ${JSON.stringify(obj[key])} -> ${JSON.stringify(value)}`);
    obj[key] = value;
  };

  for (const r of rows('Card rarities')) {
    const id = text(r['Id']);
    const at = `Card rarities, row ${r._row} (${id})`;
    if (PACK_IDS.includes(id)) {
      set(pack.info[id], 'name', text(r['Name']), `${id} name`);
      set(pack.info[id], 'gem', text(r['Gem']), `${id} gem`);
      set(pack.info[id], 'rank', number(r['Rank'], at, true), `${id} rank`);
      set(pack.light, id, colour(r['Colour 1 (light)'], at), `${id} light`);
    } else if (SPECIAL_IDS.includes(id)) {
      const s = special[id];
      set(s, 'name', text(r['Name']), `${id} name`);
      set(s, 'gem', text(r['Gem']), `${id} gem`);
      set(s, 'colors', [colour(r['Colour 1 (light)'], at), colour(r['Colour 2'], at), colour(r['Colour 3'], at)], `${id} colours`);
      set(s, 'speed', number(r['Speed (s)'], at, false), `${id} speed`);
      set(s, 'blurb', text(r['Description']), `${id} description`);
      set(s, 'how', text(r['How to get it']), `${id} how to get it`);
    } else if (id) errors.push(`${at}: unknown rarity id (ids can't be changed or added from the sheet)`);
  }
  for (const r of rows('Effects')) {
    const id = text(r['Rarity']);
    const k = text(r['Effect']);
    const on = text(r['On']).toLowerCase();
    if (!SPECIAL_IDS.includes(id) || !(k in EFFECTS[id])) {
      errors.push(`Effects, row ${r._row}: unknown effect "${id} ${k}"`);
      continue;
    }
    if (on !== 'yes' && on !== 'no') errors.push(`Effects, row ${r._row}: On must be Yes or No`);
    special[id].effects ??= {};
    set(special[id].effects, k, on === 'yes', `${id} effect ${k}`);
  }
  for (const r of rows('Rules')) {
    const id = text(r['Rarity']);
    const key = text(r['Setting']);
    const rule = RULES[id]?.find(([k]) => k === key);
    const at = `Rules, row ${r._row} (${id} ${key})`;
    if (!rule) {
      errors.push(`${at}: unknown setting`);
      continue;
    }
    const kind = rule[3];
    if (kind === 'list') {
      const list = text(r['Value']).split(/[,;]\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      for (const x of list) if (!PACK_IDS.includes(x)) errors.push(`${at}: "${x}" is not a pack rarity`);
      set(special[id], key, list, `${id} ${key}`);
    } else {
      const raw = r['Value'];
      const n = typeof raw === 'number' ? raw : number(raw, at, kind === 'int');
      if (kind === 'chance' && (n < 0 || n > 1)) errors.push(`${at}: a chance is between 0 and 1 (or 0% and 100%)`);
      if (kind === 'int' && !Number.isInteger(n)) errors.push(`${at}: must be a whole number`);
      set(special[id], key, n, `${id} ${key}`);
    }
  }
  if (special.apex.copies < 2) errors.push('Rules: Apex needs at least 2 copies');

  if (errors.length) {
    console.error(['Nothing was changed. Fix these in the sheet first:', ...errors.map((e) => `  ${e}`)].join('\n'));
    process.exit(1);
  }
  // Written only when something changed (the files keep their line endings otherwise).
  if (changes.length) (write(PACK_JSON, pack), write(SPECIAL_JSON, special));
  console.log(changes.length ? ['Changed:', ...changes.map((c) => `  ${c}`)].join('\n') : 'Nothing changed: the sheet and the game agree.');
}

if (process.argv[2] === 'import') await importSheet();
else await makeSheet();
