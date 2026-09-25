// End-to-end journey in WebKit (iPhone 13 emulation) and Chromium (laptop).
// Run:  cd tests/e2e && npm install && npx playwright install webkit chromium && node journey.mjs
import { webkit, chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import { fileURLToPath } from 'node:url';
import os from 'node:os';
// Paths: the project is two folders up; scratch files go to a temporary folder
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-e2e-'));
fs.mkdirSync(path.join(SP, 'pages'));
fs.symlinkSync(path.join(APP, 'static'), path.join(SP, 'pages', 'PPS-Particle-Count'));
const OUT = path.join(SP, 'e2e-out'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const pagesRoot = path.join(SP, 'pages');           // contains PPS-Particle-Count -> static
const dataDir = path.join(SP, 'e2e-pw-data'); fs.rmSync(dataDir, { recursive: true, force: true });
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); };

function start(cmd, args, port) {
  const p = spawn(cmd, args, { cwd: APP, stdio: 'ignore' });
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const tick = async () => {
      try { await fetch(`http://127.0.0.1:${port}/`); res(p); }
      catch { if (Date.now() - t0 > 10000) rej(new Error('server did not start')); else setTimeout(tick, 200); }
    };
    tick();
  });
}
let pages = await start('python3', ['-m', 'http.server', '8791', '--bind', '127.0.0.1', '--directory', pagesRoot], 8791);
const srv = await start('python3', ['server.py', '--no-browser', '--port', '8792', '--data', dataDir], 8792);
const HOSTED = 'http://localhost:8791/PPS-Particle-Count/';
const LAPTOP = 'http://localhost:8792/';

async function fillReport(page, o) {
  for (const [k, v] of Object.entries(o)) {
    const el = page.locator(`[data-k="${k}"]`).first();
    const type = await el.getAttribute('type');
    if (type === 'radio') await page.locator(`[data-k="${k}"][value="${v}"]`).check({ force: true });
    else if ((await el.evaluate(e => e.tagName)) === 'SELECT') await el.selectOption(v);
    else await el.fill(v);
  }
}

try {
  /* ---------------- iPhone (WebKit), hosted like GitHub Pages ---------------- */
  const iphone = devices['iPhone 13'];
  const wk = await webkit.launch();
  const ctx = await wk.newContext({ ...iphone, acceptDownloads: true });
  // capture what the app hands to the iPhone share sheet
  await ctx.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = () => true; // like iPhone Safari (some WebKit builds lack it)
    navigator.share = async data => {
      for (const f of (data && data.files) || []) {
        const buf = new Uint8Array(await f.arrayBuffer()); let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        window.__shared.push({ name: f.name, type: f.type, b64: btoa(s) });
      }
    };
  });
  const takeShared = async (page, ext) => {
    await page.waitForFunction(e => window.__shared.some(f => f.name.endsWith(e)), ext, { timeout: 30000 });
    const f = await page.evaluate(e => window.__shared.filter(x => x.name.endsWith(e)).pop(), ext);
    const p = path.join(OUT, f.name); fs.writeFileSync(p, Buffer.from(f.b64, 'base64')); return { name: f.name, path: p };
  };
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(HOSTED);
  await page.waitForFunction(() => document.documentElement.dataset.ready);
  ok('iPhone: starts in on-device mode', await page.evaluate(() => document.documentElement.dataset.ready) === 'local');
  ok('iPhone: bottom bar says Share PDF', (await page.textContent('#pdfBtn')) === 'Share PDF');
  const inputFont = await page.$eval('[data-k="client"]', e => getComputedStyle(e).fontSize);
  ok('iPhone: inputs are 16px (no zoom on focus)', inputFont === '16px', inputFont);

  await fillReport(page, { testedBy: 'Saranyan', client: 'Sri Murugan Polymers', equipment: '350T moulding machine', samplingPoint: 'tank drain',
    c4B: '1,23,456', c6B: '40000', c14B: '3000', c21B: '800', nasB: '11' });
  await page.locator('[data-k="mode"][value="after"]').check({ force: true });
  await fillReport(page, { c4A: '1500', c6A: '500', c14A: '60', nasA: '6' });
  await page.click('#draftBtn');
  await page.waitForTimeout(1200);
  ok('iPhone: autosaved', (await page.textContent('#saveState')).includes('Saved'));
  const codes = await page.$$eval('.code', els => els.map(e => e.textContent));
  ok('iPhone: ISO codes 24/22/19 → 18/16/13', codes.slice(0, 2).join() === '24,18' && codes[2] === '22' && codes[4] === '19' && codes[5] === '13', codes.slice(0, 6).join(' '));
  const verdict = await page.textContent('#report .r-verdict');
  ok('iPhone: verdict above target with 1.6×', /ABOVE TARGET/.test(verdict) && /1\.6× the allowed/.test(verdict), verdict.slice(0, 90));
  await page.screenshot({ path: path.join(OUT, '1-iphone-form.png') });

  // views
  await page.click('.tab[data-view="preview"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '2-iphone-report.png') });
  await page.click('.tab[data-view="records"]'); await page.waitForTimeout(500);
  ok('iPhone: records shown as cards', await page.locator('#rvCards li').count() === 1);
  const nag = await page.isVisible('#bkNag');
  ok('iPhone: backup reminder shows (on-device data)', nag);
  await page.screenshot({ path: path.join(OUT, '3-iphone-records.png') });
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('iPhone: no sideways page scroll', hScroll <= 0, String(hScroll));

  // PDF goes to the share sheet on iPhone
  await page.click('.tab[data-view="form"]');
  await page.click('#pdfBtn');
  const shared = await takeShared(page, '.pdf');
  const pdf = fs.readFileSync(shared.path);
  ok('iPhone/WebKit: PDF made and handed to the share sheet', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 60000, `${shared.name} ${Math.round(pdf.length / 1024)} KB`);

  // survives a reload and a crash-style reload with unsaved typing
  await page.fill('[data-k="obs"]', 'typed just before the phone killed the app');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.ready);
  ok('iPhone: data survives reload (IndexedDB + draft)', (await page.inputValue('[data-k="obs"]')) === 'typed just before the phone killed the app');

  // offline start from the service worker
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  ok('iPhone: offline worker active', controlled);
  if (controlled) {
    // the website disappears completely (like no signal at a plant); the app must still open
    pages.kill(); await new Promise(r => setTimeout(r, 500));
    const down = await fetch(HOSTED).then(() => false, () => true);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 15000 });
    ok('iPhone: opens with the website unreachable', down && (await page.inputValue('[data-k="client"]')) === 'Sri Murugan Polymers');
    await page.screenshot({ path: path.join(OUT, '5-iphone-offline.png') });
  }

  // backup file out of the phone
  await page.click('.tab[data-view="records"]'); await page.waitForTimeout(400);
  await page.click('#jsonBtn');
  const bk = await takeShared(page, '.json');
  const bkPath = bk.path;
  const backup = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  ok('iPhone: backup file has the record', backup.records.length === 1 && backup.records[0].client === 'Sri Murugan Polymers', bk.name);
  ok('iPhone: reminder cleared after backup', !(await page.isVisible('#bkNag')));
  ok('iPhone: no script errors', errors.length === 0, errors.join(' | '));
  await wk.close();

  /* ---------------- Laptop (Chromium desktop), server mode ---------------- */
  const cr = await chromium.launch();
  const dctx = await cr.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const lp = await dctx.newPage();
  const lerr = []; lp.on('pageerror', e => lerr.push(e.message));
  await lp.goto(LAPTOP);
  await lp.waitForFunction(() => document.documentElement.dataset.ready);
  ok('Laptop: starts in server mode', await lp.evaluate(() => document.documentElement.dataset.ready) === 'server');
  await lp.click('#recBtn');
  await lp.setInputFiles('#importFile', bkPath);
  await lp.waitForTimeout(1500);
  const toast = await lp.textContent('#toast');
  ok('Laptop: imports the phone backup', /1 new record/.test(toast), toast);
  ok('Laptop: record listed', (await lp.locator('#rvBody tr').count()) === 1);
  await lp.click('#rvBody tr [data-act="open"]');
  await lp.waitForTimeout(400);
  ok('Laptop: opened phone record', (await lp.inputValue('[data-k="client"]')) === 'Sri Murugan Polymers');

  // same record open in a second tab: an edit in tab 1 appears in tab 2
  const lp2 = await dctx.newPage();
  await lp2.goto(LAPTOP); await lp2.waitForFunction(() => document.documentElement.dataset.ready);
  await lp.fill('[data-k="nextStep"]', 'Quote on Monday');
  await lp.waitForTimeout(2000);
  ok('Laptop: second tab picks up the edit', (await lp2.inputValue('[data-k="nextStep"]')) === 'Quote on Monday');
  const [ldl] = await Promise.all([lp.waitForEvent('download', { timeout: 30000 }), lp.click('#pdfBtn')]);
  ok('Laptop: PDF download', /^PPS_ParticleCount_Sri_Murugan_Polymers_PPS_PC_/.test(ldl.suggestedFilename()), ldl.suggestedFilename());
  await lp.screenshot({ path: path.join(OUT, '4-laptop.png') });
  ok('Laptop: no script errors', lerr.length === 0, lerr.join(' | '));
  await cr.close();
} catch (e) {
  ok('run finished without crashing', false, e.stack);
} finally {
  pages.kill(); srv.kill();
}
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed (screenshots and files: ${OUT})`);
process.exit(failed.length ? 1 : 0);
