#!/usr/bin/env node
// Phone and tablet checks: opens every page of the site in the installed Chrome (headless, throwaway profile, touch
// device emulated) at phone and tablet sizes, against the dev server (npm run dev), and lists what doesn't fit: a page
// wider than the screen (sideways scroll), and the elements that stick out past its right edge.
//
//   node scripts/mobile-check.mjs                       every page, at 375x812 (phone) and 768x1024 (tablet)
//   node scripts/mobile-check.mjs --paths=/album,/casino --sizes=360x740
//   node scripts/mobile-check.mjs --shot                a screenshot of each page too (in the temp folder)
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const base = String(flags.base ?? 'http://localhost:5173').replace(/\/$/, '');
const chrome = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');

const PATHS = [
  '/', '/daily', '/daily/games', '/play', '/archive', '/boss', '/boss/shrek', '/whos-that', '/specialist', '/specialist/overwatch', '/rank', '/games',
  '/higher-lower', '/jlpt', '/jlpt/grammar', '/name-them-all', '/guess-the-year', '/rail-rush', '/stick-fight', '/memory', '/odd-one-out',
  '/crossroads', '/summit', '/shop', '/casino', '/friends', '/album', '/account', '/trades', '/rarities', '/who-am-i', '/curve-clash',
  '/wordle', '/wordle/japanese', '/quick-sort', '/six-degrees', '/expedition', '/map-quiz',
];
const paths = flags.paths ? String(flags.paths).split(',') : PATHS;
const sizes = String(flags.sizes ?? '375x812,768x1024').split(',').map((s) => s.split('x').map(Number));
const outDir = join(tmpdir(), 'omnidle-mobile');
if (flags.shot) mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ browser: 'chrome', executablePath: chrome, headless: true });
const page = await browser.newPage();
let faults = 0;
for (const [width, height] of sizes) {
  await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  for (const path of paths) {
    await page.goto(`${base}/#${path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, Number(flags.wait ?? 1200)));
    const found = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = document.documentElement.scrollWidth - vw;
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= vw + 1) continue;
        // Skip what a parent already clips or scrolls, and what's meant to sit off screen.
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) {
            if (p.getBoundingClientRect().right <= vw + 1) clipped = true;
            break;
          }
        }
        const s = getComputedStyle(el);
        if (clipped || s.position === 'fixed' || s.visibility === 'hidden' || +s.opacity === 0) continue;
        // Only the outermost offender of a branch.
        if (out.some((o) => o.el.contains(el))) continue;
        out.push({ el, right: Math.round(r.right - vw) });
      }
      const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ').slice(0, 6).join('.')} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
      return { wide, out: out.slice(0, 8).map((o) => `+${o.right}px ${name(o.el)}`) };
    });
    if (flags.shot) await page.screenshot({ path: join(outDir, `${width}${path.replace(/\//g, '_') || '_home'}.png`) });
    if (found.wide > 0 || found.out.length) {
      faults++;
      console.log(`${width}x${height} ${path}  page ${found.wide > 0 ? `+${found.wide}px wide` : 'fits'}`);
      for (const o of found.out) console.log(`    ${o}`);
    }
  }
}
console.log(faults ? `${faults} page(s) don't fit.` : 'Every page fits.');
if (flags.shot) console.log(`Screenshots in ${outDir}`);
await browser.close();
