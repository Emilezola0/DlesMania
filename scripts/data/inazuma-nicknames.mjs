#!/usr/bin/env node
// Adds the Inazuma Eleven characters' nicknames (from the Inazuma Eleven Wiki's infoboxes: nickname_dub,
// nickname_jp and the lead's "also known as") to every answer of the Inazuma boss that names them.
// Safe to run again. Short, shared ones are left out (Dave, Sam, JP, Shun, Hugh): they would stand for two characters.
//
//   node scripts/data/inazuma-nicknames.mjs
import fs from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';
const FILE = join(ROOT, 'src', 'data', 'bosses.json');
const NICKS = {
  'Claude Beacons': ['Torch', 'Burn'],
  'Bryce Whitingale': ['Gazelle', 'Gazel'],
  'Jordan Greenway': ['Janus', 'Reize'],
  'Xavier Foster': ['Xene', 'Gran', 'Hiroto'],
  'Byron Love': ['Aphrodi', 'Aphrodite'],
  'Maxwell Carson': ['Max'],
  'William Glass': ['Willy'],
  'Tim Saunders': ['Timmy', 'Shourin'],
  'Thor Stoutberg': ['Raiden'],
  'Joseph King': ['Genou'],
  'Dave Quagmire': ['Dvalin', 'Desarm'],
  'Clark Wonderbot': ['Wonderbot', 'Wandaba'],
  'Simeon Ayp': ['SARU'],
  'Camellia Travis': ['Cammy', 'Fuyuppe'],
  'Aquilina Schiller': ['Lina'],
  'Michael Ballzack': ['Kaiser'],
  'Gabriel Garcia': ['Gabi'],
  'Subaru Honda': ['Rusty'],
  'Doug McArthur': ['Dodge'],
  'David Evans': ['Daisuke'],
};
const raw = fs.readFileSync(FILE, 'utf8');
const j = JSON.parse(raw);
const b = j.find((x) => x.id === 'inazuma');
const norm = (s) => s.toLowerCase();
const nicksFor = (parts) => {
  for (const [name, n] of Object.entries(NICKS)) if (parts.some((p) => norm(p) === norm(name))) return n;
  return null;
};
let changed = 0;
const fixPipe = (s) => {
  const parts = s.split('|');
  const n = nicksFor(parts);
  if (!n) return s;
  const more = n.filter((x) => !parts.some((p) => norm(p) === norm(x)));
  if (more.length) changed++;
  return [...parts, ...more].join('|');
};
const fixMember = (m) => {
  const n = nicksFor([m.label, ...(m.aliases ?? [])]);
  if (!n) return;
  const have = [m.label, ...(m.aliases ?? [])].map(norm);
  const more = n.filter((x) => !have.includes(norm(x)));
  if (more.length) ((m.aliases = [...(m.aliases ?? []), ...more]), changed++);
};
for (const q of b.blitz) q.answers = q.answers.map(fixPipe);
for (const c of b.secret.categories) c.entities = c.entities.map(fixPipe);
b.radar.members.forEach(fixMember);
b.finale.forEach(fixMember);
const left = Object.keys(NICKS).filter((name) => !JSON.stringify(b).includes(name));
console.log('changed', changed, 'not in the boss:', left.join(', '));
fs.writeFileSync(FILE, (JSON.stringify(j, null, 2) + '\n').replace(/\n/g, '\r\n'));
