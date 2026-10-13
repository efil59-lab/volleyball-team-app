// Renders the short promo (a vertical 9:16 clip for WhatsApp / Facebook /
// Instagram) from scripts/promo/promo.html. Same method as miri-kitchen.
//
//   npm run dev                         (the app on :5200 — the phone screens are real screenshots)
//   node scripts/make-promo.mjs --out <folder>
//   node scripts/make-promo.mjs --out <folder> --still 2,6,10    (a quick look before a full render)
//
// The phone screens come from scripts/promo/demo.jsx: the app's real screens fed
// an invented team. promo.html animates everything on one CSS clock; this script
// steps that clock frame by frame and photographs each frame, so the clip is
// smooth however slow the machine is. Needs Chrome and ffmpeg.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('--app', 'http://localhost:5200');
const OUT = arg('--out', ROOT);
const TMP = path.join(ROOT, 'node_modules', '.promo');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const SECONDS = Number(arg('--seconds', 36)), FPS = 30;
const still = arg('--still', '');
const shotsOnly = process.argv.includes('--shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(TMP, 'shots'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--allow-file-access-from-files'] });

// ---------- 1. the phone screens: the real screens, an invented team ----------
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 796, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // The demo team lives only in the page. Nothing may reach the real backend.
  await page.setRequestInterception(true);
  page.on('request', (r) => (/googleapis\.com|cloudfunctions\.net|firebaseio\.com|google-analytics|googletagmanager/.test(r.url()) ? r.abort() : r.continue()));
  page.on('pageerror', (e) => console.log('page error:', String(e).slice(0, 200)));
  const open = async (shot) => { await page.goto(`${APP}/scripts/promo/demo.html?team=promo-demo&shot=${shot}`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#root > *', { timeout: 60000 }); await sleep(1500); };
  const snap = (name, opts = {}) => page.screenshot({ path: path.join(TMP, 'shots', name + '.png'), ...opts });
  // One tall picture of the whole screen, so the promo can pan down it.
  const unroll = () => page.evaluate(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root'), ...document.querySelectorAll('.vb-shell, .vb-pager, .vb-pane, .app-shell')]) {
      if (!el) continue; el.style.height = 'auto'; el.style.minHeight = '0'; el.style.overflow = 'visible'; el.style.position = 'static';
    }
    document.querySelectorAll('.vb-incoming').forEach((e) => e.remove());
    document.querySelectorAll('*').forEach((e) => { if (getComputedStyle(e).position === 'fixed') e.style.display = 'none'; });
  });

  await open('home');
  await snap('home');

  await open('event');
  await snap('event');
  await unroll(); await sleep(400);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await snap('event-tall', { clip: { x: 0, y: 0, width: 390, height: Math.min(h, 2400) }, captureBeyondViewport: true });
  console.log('event-tall height:', h);

  await open('calendar');
  await snap('calendar');
  await page.close();
}
if (shotsOnly) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(path.join(TMP, 'shots'))) fs.copyFileSync(path.join(TMP, 'shots', f), path.join(OUT, f));
  console.log('shots copied to', OUT);
  await browser.close();
  process.exit(0);
}

// ---------- 2. the clip ----------
const page = await browser.newPage();
await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
const html = fs.readFileSync(path.join(HERE, 'promo', 'promo.html'), 'utf8').split('SHOTS/').join(pathToFileURL(path.join(TMP, 'shots')).href + '/');
const tmpHtml = path.join(HERE, 'promo', '.promo-run.html');
fs.writeFileSync(tmpHtml, html);
await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
const seek = (ms) => page.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);

if (still) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const s of still.split(',')) { await seek(Number(s) * 1000); await page.screenshot({ path: path.join(OUT, `promo-${s}.jpg`), type: 'jpeg', quality: 85 }); }
  console.log('stills:', still);
} else {
  const total = SECONDS * FPS;
  for (let f = 0; f < total; f++) {
    await seek((f * 1000) / FPS);
    await page.screenshot({ path: path.join(TMP, 'f' + String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    if (f % 150 === 0) console.log(`frame ${f}/${total}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, 'promo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.jpg'), '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
  // the poster: the closing frame
  await seek((SECONDS - 0.5) * 1000);
  await page.screenshot({ path: path.join(OUT, 'promo.jpg'), type: 'jpeg', quality: 86 });
  console.log(`promo.mp4: ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB, ${SECONDS}s`);
}
await browser.close();
fs.rmSync(tmpHtml, { force: true });
