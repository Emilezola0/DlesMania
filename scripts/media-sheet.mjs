#!/usr/bin/env node
// The card media sheet: sheets/card-media.xlsx, one row for every clip and voice link a card plays (its clip,
// its awakened clip, its voice lines, French ones too), with a Status and Notes for the owner to fill in
// (To check / Approved / To change / Broken). Run again after cards change:  npm run media:sheet
// What was filled in is kept: a row keeps its Status and Notes as long as its link is the same; a row whose
// link changed goes back to "To check". Edited on Google Drive? Download it as .xlsx over this file first.
// It ends with what's marked To change or Broken, with the notes.
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import ExcelJS from 'exceljs';

const SITE = 'https://emilezola0.github.io/DlesMania/';
const FILE = join(process.cwd(), 'sheets', 'card-media.xlsx');
const STATUSES = ['To check', 'Approved', 'To change', 'Broken'];
const RARITY_ORDER = ['omni', 'mythic', 'legendary', 'epic', 'rare', 'common'];

// The cards as the site builds them (bundled, so the TypeScript and JSON imports resolve).
const dir = mkdtempSync(join(tmpdir(), 'cards-'));
const out = join(dir, 'cards.mjs');
await build({ entryPoints: ['src/gacha/cards.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { CARDS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

/** Where a link is kept, a link that opens it in a browser, and whether it can show an ad. */
function where(src) {
  let m = /^youtube:([\w-]+)@([\d.]+)/.exec(src);
  if (m) return { host: 'YouTube', open: `https://www.youtube.com/watch?v=${m[1]}&t=${Math.floor(Number(m[2]))}s`, ads: 'Yes' };
  m = /^tiktok:(\d+)/.exec(src);
  if (m) return { host: 'TikTok', open: `https://www.tiktok.com/embed/v2/${m[1]}`, ads: 'No' };
  if (/^\.?\/?(clips|audio|art)\//.test(src)) return { host: 'Omnidle (own file)', open: SITE + src.replace(/^\.?\//, ''), ads: 'No' };
  let host = 'Other';
  try {
    host = new URL(src).hostname.replace(/^www\./, '').replace(/^(static|media)\d*\./, '');
  } catch {}
  return { host, open: src, ads: 'No' };
}

// Every link a card plays, in a stable order.
const rows = [];
const cards = [...CARDS].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.set.localeCompare(b.set) || a.id.localeCompare(b.id));
for (const c of cards) {
  const add = (slot, src, line = '') => src && rows.push({ id: c.id, name: c.name, set: c.franchise, rarity: c.rarity, slot, line, src });
  const clips = (slot, s) => {
    const parts = s ? s.split('|') : [];
    parts.forEach((p, i) => add(parts.length > 1 ? `${slot} ${i + 1}/${parts.length}` : slot, p));
  };
  clips('Clip', c.clip);
  clips('Awakened clip', c.awaken?.clip);
  add('Voice', c.audio, c.voice);
  add('Voice (FR)', c.audioFr, c.voiceFr);
  (c.voiceClips ?? []).forEach((v, i) => add(`Voice line ${i + 1}`, v.audio, v.line));
}

// What was filled in before.
const before = new Map();
if (existsSync(FILE)) {
  const old = new ExcelJS.Workbook();
  await old.xlsx.readFile(FILE);
  const ws = old.getWorksheet('Media');
  const head = ws?.getRow(1).values ?? [];
  const col = (name) => head.indexOf(name);
  ws?.eachRow((r, n) => {
    if (n === 1) return;
    const get = (name) => (col(name) > 0 ? r.getCell(col(name)).text.trim() : '');
    before.set(`${get('Card id')}|${get('Slot')}`, { src: get('Source'), status: get('Status'), notes: get('Notes') });
  });
}

const wb = new ExcelJS.Workbook();
wb.creator = 'Omnidle';
const ws = wb.addWorksheet('Media', { views: [{ state: 'frozen', ySplit: 1 }] });
ws.columns = [
  { header: 'Card id', key: 'id', width: 22 },
  { header: 'Card', key: 'name', width: 24 },
  { header: 'Franchise', key: 'set', width: 20 },
  { header: 'Rarity', key: 'rarity', width: 11 },
  { header: 'Slot', key: 'slot', width: 16 },
  { header: 'Line said', key: 'line', width: 34 },
  { header: 'Hosted on', key: 'host', width: 18 },
  { header: 'Can show ads', key: 'ads', width: 12 },
  { header: 'Open', key: 'open', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Notes', key: 'notes', width: 40 },
  { header: 'Source', key: 'src', width: 50 },
];
let kept = 0;
let changed = 0;
for (const r of rows) {
  const w = where(r.src);
  const old = before.get(`${r.id}|${r.slot}`);
  const same = old && old.src === r.src;
  if (same && old.status && old.status !== 'To check') kept++;
  if (old && !same) changed++;
  const status = same && STATUSES.includes(old.status) ? old.status : 'To check';
  const notes = old ? (same ? old.notes : [old.notes, 'New link'].filter(Boolean).join(' · ')) : '';
  const row = ws.addRow({ ...r, host: w.host, ads: w.ads, open: { text: 'Open ▶', hyperlink: w.open }, status, notes });
  row.getCell('open').font = { color: { argb: 'FF2563EB' }, underline: true };
  row.getCell('status').dataValidation = { type: 'list', allowBlank: false, formulae: [`"${STATUSES.join(',')}"`] };
}
const header = ws.getRow(1);
header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
const fill = (argb) => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } });
const last = rows.length + 1;
ws.addConditionalFormatting({
  ref: `J2:J${last}`,
  rules: [
    { type: 'containsText', operator: 'containsText', text: 'Approved', priority: 1, style: fill('FFC6EFCE') },
    { type: 'containsText', operator: 'containsText', text: 'To change', priority: 2, style: fill('FFFFEB9C') },
    { type: 'containsText', operator: 'containsText', text: 'Broken', priority: 3, style: fill('FFFFC7CE') },
  ],
});
ws.addConditionalFormatting({ ref: `H2:H${last}`, rules: [{ type: 'containsText', operator: 'containsText', text: 'Yes', priority: 4, style: fill('FFFFEB9C') }] });

mkdirSync(join(process.cwd(), 'sheets'), { recursive: true });
await wb.xlsx.writeFile(FILE);

const count = (s) => ws.getColumn('status').values.filter((v) => v === s).length;
console.log(`${rows.length} links from ${new Set(rows.map((r) => r.id)).size} cards -> sheets/card-media.xlsx`);
console.log(STATUSES.map((s) => `${s}: ${count(s)}`).join(' · ') + ` (${kept} kept from the last sheet, ${changed} with a new link)`);
const todo = [];
ws.eachRow((r, n) => {
  if (n > 1 && ['To change', 'Broken'].includes(r.getCell('status').text)) todo.push(`  ${r.getCell('status').text}: ${r.getCell('id').text} ${r.getCell('slot').text}${r.getCell('notes').text ? ` — ${r.getCell('notes').text}` : ''}`);
});
if (todo.length) console.log(['To do:', ...todo].join('\n'));
