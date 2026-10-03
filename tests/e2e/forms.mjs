// Every report form, in a real browser: choose it, fill it, sign it by hand, attach a photo,
// and get a PDF of the right shape. Also checks the app is still usable on a phone.
// Run:  cd tests/e2e && npm install && npx playwright install webkit chromium && node forms.mjs
import { webkit, chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-forms-'));
const dataDir = path.join(SP, 'data');
fs.rmSync(dataDir, { recursive: true, force: true });
const OUT = path.join(SP, 'out'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8793;
const LAPTOP = `http://localhost:${PORT}/`;

const results = [];
const ok = (name, cond, info = '') => {
  results.push({ name, pass: !!cond, info });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : ''));
};

function start(cmd, args) {
  const p = spawn(cmd, args, { cwd: APP, stdio: 'ignore' });
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const tick = async () => {
      try { await fetch(LAPTOP); res(p); }
      catch { if (Date.now() - t0 > 12000) rej(new Error('server did not start')); else setTimeout(tick, 200); }
    };
    tick();
  });
}

/* the six numbered forms plus the two unnumbered service reports */
const FORMS = [
  ['particle', 'PPS-F-05', 'p'], ['crackle', '', 'p'], ['elcComm', 'PPS-F-01', 'p'],
  ['elcPurity', 'PPS-F-02', 'p'], ['lvdh', 'PPS-F-03', 'p'], ['phe', 'PPS-F-04', 'p'],
  ['fieldService', 'PPS-F-06', 'l'], ['oilPatch', '', 'p']
];

const server = await start('python3', ['server.py', '--no-browser', '--port', String(PORT), '--data', dataDir]);
const errs = [];
let cr;
try {
  cr = await chromium.launch();
  const page = await cr.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto(LAPTOP, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready);

  const startReport = async type => {
    await page.evaluate(() => { const b = document.getElementById('newBtn'); b.classList.remove('warn'); b.textContent = 'New report'; });
    await page.click('#newBtn');
    try { await page.waitForSelector('#pickView:not([hidden])', { timeout: 900 }); }
    catch { await page.click('#newBtn'); await page.waitForSelector('#pickView:not([hidden])', { timeout: 5000 }); }
    await page.click(`#pkGrid .pickcard[data-type="${type}"]`);
    await page.waitForTimeout(250);
  };
  const fillForm = () => page.evaluate(() => {
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    let n = 0;
    for (const el of document.querySelectorAll('#formGeneric [data-k]')) {
      const k = el.dataset.k;
      if (el.type === 'checkbox') { if (n++ % 3 === 0) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } continue; }
      if (el.tagName === 'SELECT') continue;
      if (/reportNo$/i.test(k)) set(el, 'PPS/PC/26-27/009');
      else if (/^(client|customer|company)$/i.test(k)) set(el, 'Sri Murugan Polymers');
      else if (/address/i.test(k)) set(el, 'Plot 14, Kurichi Industrial Estate, Coimbatore 641021');
      else if (el.type === 'date') set(el, '2026-09-12');
      else if (el.tagName === 'TEXTAREA') set(el, 'No free water seen. The membrane patch showed a light grey deposit; the oil was returned to service.');
      else set(el, 'Ferrocare ELC-3000');
    }
  });

  // the chooser offers every form
  await page.click('#newBtn');
  await page.waitForSelector('#pickView:not([hidden])');
  const offered = await page.$$eval('#pkGrid .pickcard', els => els.map(e => e.dataset.type));
  ok('chooser offers all eight forms', offered.length === 8, offered.join(','));
  ok('the report behind the chooser is hidden', await page.evaluate(() => getComputedStyle(document.getElementById('main')).display === 'none'));
  await page.click('#pkClose');

  // every form opens, draws and prints as one page of the right shape
  for (const [type, form, orient] of FORMS) {
    await startReport(type);
    if (type !== 'particle') await fillForm();
    const shape = await page.evaluate(() => {
      const r = document.getElementById('report');
      return { land: r.classList.contains('landscape'), w: r.offsetWidth, h: r.offsetHeight, bad: /undefined|\[object Object\]/.test(r.innerHTML) };
    });
    const wantW = orient === 'l' ? 1123 : 794;
    ok(`${type}: sheet is ${orient === 'l' ? 'landscape' : 'portrait'} and complete`,
      shape.land === (orient === 'l') && shape.w === wantW && !shape.bad && shape.h > 700,
      `${shape.w}x${shape.h} landscape=${shape.land}`);

    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#pdfBtn')]);
    const buf = fs.readFileSync(await dl.path());
    const body = buf.toString('latin1');
    const box = (body.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1] || '';
    const [_, __, bw, bh] = box.split(/\s+/).map(Number);
    const landscape = bw > bh;
    ok(`${type}: PDF is one ${orient === 'l' ? 'landscape' : 'portrait'} A4 page`,
      buf.subarray(0, 5).toString() === '%PDF-' && landscape === (orient === 'l') && (body.match(/\/Type\s*\/Page[^s]/g) || []).length === 1,
      `${dl.suggestedFilename()} ${Math.round(buf.length / 1024)}KB ${Math.round(bw)}x${Math.round(bh)}`);
    if (type === 'fieldService') fs.writeFileSync(path.join(OUT, 'fieldService.pdf'), buf);
  }

  // ---- signing by hand ----
  await startReport('phe');
  await page.fill('#formGeneric [data-k="customer"]', 'Sri Murugan Polymers');
  await page.waitForTimeout(400);
  ok('signature slots are offered', (await page.locator('#formGeneric [data-sig]').count()) >= 2);
  await page.locator('#formGeneric [data-sig]').first().click();
  await page.waitForSelector('.sigmodal:not([hidden])');
  const box = await page.locator('#sigCanvas').boundingBox();
  await page.mouse.move(box.x + 60, box.y + box.height * 0.7);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(box.x + 60 + t * (box.width - 130), box.y + box.height * (0.62 - 0.30 * Math.sin(t * Math.PI * 1.6)));
  }
  await page.mouse.up();
  await page.check('.sigmodal [data-sigremember]');
  await page.click('.sigmodal [data-siguse]');
  await page.waitForTimeout(300);
  const signed = await page.evaluate(() => {
    const img = document.querySelector('#formGeneric [data-sigslot] img:not([hidden])');
    const onSheet = [...document.querySelectorAll('#report img')].some(i => (i.getAttribute('src') || '').startsWith('data:image/png'));
    return { stored: !!img && img.src.startsWith('data:image/png'), kb: img ? Math.round(img.src.length * 3 / 4 / 1024) : 0, onSheet };
  });
  ok('the hand-drawn signature is stored small', signed.stored && signed.kb > 2 && signed.kb < 80, signed.kb + ' KB');
  ok('the signature prints in the signature block', signed.onSheet);

  const kept = await page.evaluate(() => {
    const k = document.querySelector('#formGeneric [data-sig]').dataset.sig;
    return window.PPSStore ? true : true;
  });
  void kept;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready);
  const afterReload = await page.evaluate(() => {
    const img = document.querySelector('#formGeneric [data-sigslot] img:not([hidden])');
    return !!img && img.src.startsWith('data:image/png');
  });
  ok('the signature survives a reload', afterReload);

  // a saved signature can be reused on a different form
  await startReport('lvdh');
  await page.locator('#formGeneric [data-sig]').first().click();
  await page.waitForSelector('.sigmodal:not([hidden])');
  ok('a remembered signature is offered on another form', await page.evaluate(() => !document.querySelector('[data-siguseSaved]').hidden));
  await page.click('.sigmodal [data-siguseSaved]');
  await page.waitForTimeout(300);
  await page.click('.sigmodal [data-siguse]');
  await page.waitForTimeout(250);
  ok('the remembered signature is placed', await page.evaluate(() => {
    const el = document.querySelector('#formGeneric [data-sigslot] img:not([hidden])');
    return !!el && el.src.startsWith('data:image/png');
  }));

  // ---- photograph ----
  const src = path.join(SP, 'patch.jpg');
  fs.writeFileSync(src, Buffer.from(await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2200;
    const g = c.getContext('2d'); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 3000, 2200);
    g.fillStyle = '#8a7a55'; g.beginPath(); g.arc(1500, 1100, 800, 0, 7); g.fill();
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  }), 'base64'));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#formGeneric [data-img]').first().click()]);
  await chooser.setFiles(src);
  await page.waitForTimeout(900);
  const photo = await page.evaluate(() => {
    const img = document.querySelector('#formGeneric [data-imgslot] img:not([hidden])');
    const onSheet = document.querySelector('#report .sh-ph.has img');
    return { kb: img ? Math.round(img.src.length * 3 / 4 / 1024) : 0, w: img ? img.naturalWidth : 0, onSheet: !!onSheet };
  });
  ok('a camera photo is shrunk before it is stored', photo.kb > 5 && photo.kb < 120 && photo.w <= 1400, `${photo.w}px, ${photo.kb} KB`);
  ok('the photo prints in the patch box', photo.onSheet);
  await page.screenshot({ path: path.join(OUT, 'forms-laptop.png') });

  // ---- a typed value can never become markup ----
  await startReport('crackle');
  await page.fill('#formGeneric [data-k="client"]', '<img src=x onerror="window.__hacked=1">');
  await page.waitForTimeout(400);
  ok('a typed value never becomes markup', await page.evaluate(() => !window.__hacked &&
    document.getElementById('report').innerHTML.includes('&lt;img src=x onerror=')));
  ok('laptop: no script errors', errs.length === 0, errs.join(' | '));
  await cr.close();

  // ---- on a phone ----
  const wk = await webkit.launch();
  const ph = await wk.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const werr = [];
  ph.on('pageerror', e => werr.push(e.message));
  await ph.goto(LAPTOP, { waitUntil: 'networkidle' });
  await ph.waitForFunction(() => document.documentElement.dataset.ready);
  await ph.click('#newBtn');
  await ph.waitForSelector('#pickView:not([hidden])');
  await ph.click('#pkGrid .pickcard[data-type="fieldService"]');
  await ph.waitForTimeout(400);
  ok('phone: the form fits the screen', await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await ph.click('.tab[data-view="preview"]');
  await ph.waitForTimeout(300);
  ok('phone: the Report tab shows the sheet', await ph.evaluate(() => {
    const r = document.getElementById('report');
    return r.offsetHeight > 500 && getComputedStyle(document.getElementById('form')).display === 'none';
  }));
  await ph.click('.tab[data-view="form"]');
  await ph.waitForTimeout(200);
  ok('phone: the Enter tab comes back', await ph.evaluate(() => getComputedStyle(document.getElementById('form')).display !== 'none'));
  await ph.locator('#formGeneric [data-sig]').first().click();
  await ph.waitForSelector('.sigmodal:not([hidden])');
  const pbox = await ph.locator('#sigCanvas').boundingBox();
  await ph.touchscreen.tap(pbox.x + 40, pbox.y + 40);
  await ph.waitForTimeout(150);
  ok('phone: the signature box is writable', await ph.evaluate(() => !document.querySelector('.sigmodal [data-siguse]').disabled));
  await ph.screenshot({ path: path.join(OUT, 'forms-phone.png') });
  ok('phone: no script errors', werr.length === 0, werr.join(' | '));
  await wk.close();
} catch (e) {
  ok('run finished without crashing', false, e.stack);
} finally {
  server.kill();
}
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed (files: ${OUT})`);
process.exit(failed.length ? 1 : 0);
