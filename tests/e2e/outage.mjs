// Laptop server stops and restarts while someone types: nothing is lost and no false conflicts appear.
// Run:  cd tests/e2e && node outage.mjs   (after the install step in journey.mjs)
import { chromium, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
// Paths: the project is two folders up; scratch files go to a temporary folder
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'pps-e2e-'));
fs.mkdirSync(path.join(SP, 'pages'));
fs.symlinkSync(path.join(APP, 'static'), path.join(SP, 'pages', 'PPS-Particle-Count'));
const PORT = 8794;
fs.mkdirSync(SP + '/e2e-out');
const DATA = SP + '/e2e-outage'; fs.rmSync(DATA, { recursive: true, force: true });
const res = []; const ok = (n, c, i = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  — ' + i : '')); };
let srv = null;
const up = async () => {
  srv = spawn('python3', ['server.py', '--no-browser', '--port', String(PORT), '--data', DATA], { cwd: APP, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/ping`); return; } catch { await new Promise(r => setTimeout(r, 150)); } }
  throw new Error('server did not start');
};
const down = async () => { srv.kill(); await new Promise(r => setTimeout(r, 400)); };
const rec = async id => (await fetch(`http://127.0.0.1:${PORT}/api/records/${id}`)).json();
const state = p => p.evaluate(() => ({ save: document.getElementById('saveState').textContent, conflict: !document.getElementById('confBar').hidden,
  down: !document.getElementById('downBar').hidden, id: JSON.parse(localStorage.getItem('ppspc.currentId')) }));
const reconnect = async p => { await p.click('#retryBtn').catch(() => {}); await p.waitForTimeout(2500); };

for (const [name, engine, opts] of [['Chromium laptop', chromium, { viewport: { width: 1280, height: 900 } }], ['WebKit iPhone', webkit, devices['iPhone 13']]]) {
  fs.rmSync(DATA, { recursive: true, force: true });
  await up();
  const b = await engine.launch(); const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => document.documentElement.dataset.ready);

  // A: new report, server dies before the first save arrives, more typing, server back
  await p.fill('[data-k="client"]', 'Outage New Ltd');
  await down();
  for (const [k, v] of [['equipment', 'Press A'], ['c4B', '5000'], ['c6B', '1200'], ['c14B', '150']]) { await p.fill(`[data-k="${k}"]`, v); await p.waitForTimeout(700); }
  const whileDown = await state(p);
  ok(`${name} A: down bar visible while offline`, whileDown.down, whileDown.save);
  await up(); await reconnect(p);
  let st = await state(p);
  let r = await rec(st.id);
  ok(`${name} A: new report saved after outage, no false "deleted" bar`, !st.conflict && st.save.includes('Saved') && r.client === 'Outage New Ltd' && r.c14B === '150', JSON.stringify(st));

  // B: 25+ failed saves while offline on a stored report
  await down();
  const fields = ['address', 'sampleId', 'oilGrade', 'oilQty', 'hours', 'samplingPoint', 'nasB', 'contactName', 'designation', 'phone', 'industry',
    'machineMake', 'totalPacks', 'totalOil', 'changeInterval', 'lastChange', 'oilSpend', 'problems', 'decisionMaker', 'nextStep', 'clientSign',
    'counterSr', 'sampleId', 'address', 'hours', 'oilQty'];
  for (let i = 0; i < fields.length; i++) { await p.fill(`[data-k="${fields[i]}"]`, 'v' + i); await p.waitForTimeout(650); }
  await up(); await reconnect(p);
  st = await state(p); r = await rec(st.id);
  ok(`${name} B: ${fields.length} offline edits saved, no false "changed" bar`, !st.conflict && st.save.includes('Saved') && r.oilQty === 'v25' && r.nextStep === 'v19', JSON.stringify(st));

  // C: type, then reload before the save timer fires
  await p.fill('[data-k="equipment"]', 'Typed then reloaded');
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready); await p.waitForTimeout(1500);
  st = await state(p); r = await rec(st.id);
  ok(`${name} C: quick reload keeps the edit, no false conflict`, !st.conflict && r.equipment === 'Typed then reloaded' && (await p.inputValue('[data-k="equipment"]')) === 'Typed then reloaded', JSON.stringify(st));

  // D: a real conflict is still caught (another device saves; this one edits)
  const cur = await rec(st.id);
  await fetch(`http://127.0.0.1:${PORT}/api/records/${st.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cur, nextStep: 'from the other device', rev: 'vother', _base: [cur.rev] }) });
  await p.fill('[data-k="equipment"]', 'my later edit'); await p.waitForTimeout(1500);
  st = await state(p);
  const barBox = await p.locator('#confBar').boundingBox();
  const vh = await p.evaluate(() => innerHeight);
  ok(`${name} D: real conflict still detected and the bar is on screen`, st.conflict && barBox && barBox.y >= 0 && barBox.y + barBox.height <= vh, `bar y=${barBox && Math.round(barBox.y)} of ${vh}`);
  ok(`${name}: no script errors`, errs.length === 0, errs.join(' | '));
  if (name.startsWith('WebKit')) await p.screenshot({ path: SP + '/e2e-out/7-conflict-bar-phone.png' });
  await b.close(); await down();
}
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
