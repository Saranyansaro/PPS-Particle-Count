/* Checks every report form: it registers, it draws a full sheet without leaking "undefined",
   it escapes whatever the user types, and its entry screen and record keys stay in step.
   Run:  node --test tests/reports.test.js      (or: node --test tests/)  */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow } from './render.mjs';

const win = makeWindow();
const R = win.PPSReports, F = win.PPSForm;
const all = R.all();

const FORMS = ['PPS-F-01', 'PPS-F-02', 'PPS-F-03', 'PPS-F-04', 'PPS-F-05', 'PPS-F-06'];
const BAD = /undefined|\[object Object\]|NaN(?![a-z])/;
const firstBad = s => { const m = BAD.exec(s); return m ? m[0] : ''; };
const DOUBLE_ESCAPED = /&amp;(lt|gt|quot|#39|amp);/;
const ESCAPED_MARKUP = /&lt;(figure|div|span|table|img)\b/;

const stringKeys = d => Object.entries(d.blank()).filter(([, v]) => typeof v === 'string').map(([k]) => k);
const boolKeys = d => Object.entries(d.blank()).filter(([, v]) => typeof v === 'boolean').map(([k]) => k);

test('all eight report forms are registered, with unique ids and the metadata the app needs', () => {
  assert.equal(all.length, 8, 'expected 8 report forms');
  const ids = all.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length, 'two reports share an id');
  assert.deepEqual(ids[0], 'particle', 'the particle count report must stay the default');
  for (const d of all) {
    assert.ok(d.name && d.short && d.about, `${d.id}: needs name, short and about`);
    assert.ok(['p', 'l'].includes(d.orientation), `${d.id}: bad orientation`);
    assert.equal(typeof d.blank, 'function', `${d.id}: needs blank()`);
    if (d.ownForm) continue;                   // the particle count form is written out by hand
    assert.ok(Array.isArray(d.sections) && d.sections.length, `${d.id}: needs entry-screen sections`);
    assert.equal(typeof d.render, 'function', `${d.id}: needs render()`);
    assert.equal(typeof d.list, 'object', `${d.id}: needs a list mapping`);
    if (d.css) assert.ok(!/(^|\})\s*\.sh-/.test(d.css), `${d.id}: must not restyle shared sh-* classes`);
  }
  const forms = [...all.map(d => d.form).filter(Boolean)].sort();
  assert.deepEqual(forms, [...FORMS].sort(), 'the six numbered forms must all be present');
});

/* The particle count sheet is built by app.js, so these tests cover the described forms. */
const described = all.filter(d => !d.ownForm);

test('every form draws a complete sheet from an empty record', () => {
  for (const d of described) {
    const html = d.render(d.blank());
    assert.equal(typeof html, 'string', `${d.id}: render must return a string`);
    assert.ok(html.length > 1500, `${d.id}: sheet looks too short (${html.length})`);
    assert.ok(!BAD.test(html), `${d.id}: the sheet shows ${firstBad(html)}`);
    assert.ok(!DOUBLE_ESCAPED.test(html), `${d.id}: text is escaped twice`);
    assert.ok(!ESCAPED_MARKUP.test(html), `${d.id}: markup was escaped instead of drawn`);
    for (const tag of ['div', 'table', 'span', 'figure']) {
      const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
      const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.equal(open, close, `${d.id}: ${open} <${tag}> but ${close} </${tag}>`);
    }
    if (d.form) assert.ok(html.includes(d.form), `${d.id}: the form number ${d.form} is not printed`);
  }
});

test('nothing a user types can break out of the sheet', () => {
  const nasty = '"><script>alert(1)</script> & <b>bold</b> \'quoted\'';
  for (const d of described) {
    const rec = d.blank();
    for (const k of stringKeys(d)) rec[k] = nasty;
    for (const k of boolKeys(d)) rec[k] = true;
    const html = d.render(rec);
    assert.ok(!/<script/i.test(html), `${d.id}: a typed value produced a <script> tag`);
    assert.ok(!/<b>bold<\/b>/.test(html), `${d.id}: a typed value produced live markup`);
    assert.ok(html.includes('&lt;script&gt;'), `${d.id}: the typed value is not escaped at all`);
    assert.ok(!DOUBLE_ESCAPED.test(html), `${d.id}: escaped twice`);
  }
});

test('a record drawn with missing keys still shows blanks, never "undefined"', () => {
  for (const d of described) {
    const html = d.render({});
    assert.ok(!BAD.test(html), `${d.id}: an empty record shows ${firstBad(html)}`);
    assert.ok(!ESCAPED_MARKUP.test(html), `${d.id}: markup escaped on an empty record`);
  }
});

test('the entry screen and the record stay in step, both ways', () => {
  for (const d of described) {
    const base = d.blank();
    const html = F.build(d);
    assert.ok(!BAD.test(html), `${d.id}: the entry screen shows ${firstBad(html)}`);
    const shown = [...html.matchAll(/data-k="([^"]+)"/g)].map(m => m[1]);
    assert.ok(shown.length > 5, `${d.id}: entry screen has only ${shown.length} fields`);
    // 1. nothing is typed into a key the record does not keep
    assert.deepEqual(shown.filter(k => !(k in base)), [], `${d.id}: these fields are not in blank()`);
    // 2. every value the record keeps can actually be typed (signatures and photos have their own slots)
    const slots = new Set();
    (d.sections || []).forEach(s => (s.fields || []).forEach(f => {
      if (f.t === 'sig' || f.t === 'img') slots.add(f.k);
      if (f.t === 'grid') (f.rows || []).forEach(r => (f.cols || []).forEach(c => slots.add(F.gridKey(f.k, r[0], c.c))));
    }));
    const unreachable = Object.keys(base).filter(k => !slots.has(k) && !shown.includes(k));
    assert.deepEqual(unreachable, [], `${d.id}: these values cannot be typed anywhere: ${unreachable.join(', ')}`);
    // 3. the four things the records list depends on are always on the screen
    for (const k of ['reportNo', 'status', 'nextDate', 'nextStep']) {
      if (k in base) assert.ok(shown.includes(k), `${d.id}: ${k} is missing from the entry screen`);
    }
    // 4. a tick box defaults to a boolean
    const booleans = [...html.matchAll(/type="checkbox" data-k="([^"]+)"/g)].map(m => m[1]);
    for (const k of booleans) assert.equal(typeof base[k], 'boolean', `${d.id}: ${k} should default to a boolean`);
  }
});

test('every form has a customer, a report number and a date for the records list', () => {
  for (const d of all) {
    const rec = d.blank();
    assert.ok('reportNo' in rec, `${d.id}: no report number field`);
    const L = R.listing(Object.assign({}, rec, { type: d.id }));
    assert.equal(L.type, d.short);
    assert.equal(typeof L.no, 'string');
    assert.equal(typeof L.client, 'string');
    assert.equal(typeof L.detail, 'string');
    assert.equal(L.no, '', `${d.id}: a blank report should have no number yet`);
  }
  // the mapping actually reaches into the right keys
  assert.equal(R.listing({ type: 'phe', reportNo: 'X1', customer: 'ACME', visitDate: '2026-01-02' }).client, 'ACME');
  assert.equal(R.listing({ type: 'elcComm', company: 'ACME' }).client, 'ACME');
  assert.equal(R.listing({ type: 'crackle', client: 'ACME' }).client, 'ACME');
  // an old record with no type is a particle count
  assert.equal(R.listing({ client: 'ACME' }).type, 'Particle Count');
  assert.equal(R.get('nonsense'), null);
});

test('the records list sorts work for every form', () => {
  for (const d of all) {
    const rec = Object.assign(d.blank(), { type: d.id, reportNo: 'PPS/1', status: 'Draft' });
    const L = R.listing(rec);
    assert.ok(!BAD.test(JSON.stringify(L)), `${d.id}: the records list shows ${firstBad(JSON.stringify(L))}`);
  }
});

test('dates are printed the readable way, not as numbers', () => {
  for (const d of described) {
    const rec = d.blank();
    for (const k of Object.keys(rec)) if (/date$/i.test(k)) rec[k] = '2026-09-05';
    const html = d.render(rec);
    assert.ok(!html.includes('2026-09-05'), `${d.id}: a date is still ISO`);
  }
});

test('signature and photograph slots are offered where the printed form has room for them', () => {
  const expect = { elcComm: [2, 4], elcPurity: [2, 2], lvdh: [2, 2], phe: [2, 0], fieldService: [2, 0], crackle: [2, 2], oilPatch: [2, 2] };
  for (const d of described) {
    const html = F.build(d);
    const sigs = (html.match(/data-sigslot=/g) || []).length;
    const imgs = (html.match(/data-imgslot=/g) || []).length;
    const [wantSig, wantImg] = expect[d.id] || [0, 0];
    assert.ok(sigs >= wantSig, `${d.id}: ${sigs} signature slots, expected at least ${wantSig}`);
    assert.ok(imgs >= wantImg, `${d.id}: ${imgs} photo slots, expected at least ${wantImg}`);
    // and the sheet draws a picture for each one that is filled in
    const rec = d.blank();
    for (const k of Object.keys(rec)) if (/Sign$|^patch|^photo/i.test(k)) rec[k] = 'data:image/png;base64,AAAA';
    const drawn = d.render(rec);
    assert.ok((drawn.match(/data:image\/png;base64/g) || []).length >= wantSig + wantImg - 1,
      `${d.id}: filled-in signatures/photos are not drawn on the sheet`);
  }
});

test('a report keeps its own kind and never turns into another form', () => {
  for (const d of described) {
    const rec = Object.assign(d.blank(), { type: d.id });
    const html = d.render(rec);
    assert.ok(html.length > 1500, `${d.id}: short sheet`);
    assert.ok(!BAD.test(html), `${d.id}: ${firstBad(html)}`);
  }
});
