// Run with:  node --test tests/calc.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../static/js/calc.js');

const base = over => Object.assign({
  mode: 'before', condition: 'clear', component: 'piston', t4: '17', t6: '15', t14: '13', tNas: '7',
  c4B: '', c6B: '', c14B: '', c21B: '', c38B: '', c70B: '', c4A: '', c6A: '', c14A: '', c21A: '', c38A: '', c70A: '',
  nasB: '', nasA: '', asB: '', asA: '', asT: '', rhB: '', rhA: '', rhT: '', equipment: '', samplingPoint: ''
}, over);

test('num() reads what people type', () => {
  assert.equal(C.num(''), null);
  assert.equal(C.num(null), null);
  assert.equal(C.num('  '), null);
  assert.equal(C.num('1,23,456'), 123456);
  assert.equal(C.num('12 345'), 12345);
  assert.equal(C.num('12.5'), 12.5);
  assert.equal(C.num('.5'), 0.5);
  assert.equal(C.num(7), 7);
  assert.ok(Number.isNaN(C.num('abc')));
  assert.ok(Number.isNaN(C.num('0x10')));
  assert.ok(Number.isNaN(C.num('12abc')));
  assert.ok(Number.isNaN(C.num('Infinity')));
});

test('isoCode() follows ISO 4406 ranges (upper limit included)', () => {
  const cases = [[0, 0], [0.01, 0], [0.011, 1], [0.02, 1], [1.3, 7], [1.31, 8], [2.5, 8], [80, 13], [80.1, 14],
    [160, 14], [640, 16], [641, 17], [1300, 17], [1301, 18], [5000, 19], [10000, 20], [40000, 22],
    [123456, 24], [2500000, 28], [2500001, 29]];
  for (const [count, code] of cases) assert.equal(C.isoCode(count), code, `count ${count}`);
  assert.equal(C.isoCode('1,23,456'), 24);
  assert.equal(C.isoCode(''), null);
  assert.equal(C.isoCode('abc'), null);
  assert.equal(C.isoCode(-1), null);
  assert.equal(C.codeTxt(29), '>28');
  assert.equal(C.codeTxt(null), '');
});

test('the ISO table doubles at every step', () => {
  for (let n = 1; n < C.ISO_UP.length; n++) {
    const ratio = C.ISO_UP[n] / C.ISO_UP[n - 1];
    assert.ok(ratio > 1.8 && ratio < 2.2, `step ${n}`);
  }
  assert.equal(C.ISO_UP.length, 29);
});

test('targetCode() accepts whole numbers 0..28 only', () => {
  assert.equal(C.targetCode('17'), 17);
  assert.equal(C.targetCode(' 0 '), 0);
  assert.equal(C.targetCode('28'), 28);
  assert.equal(C.targetCode('29'), null);
  assert.equal(C.targetCode('16.5'), null);
  assert.equal(C.targetCode('-1'), null);
  assert.equal(C.targetCode(''), null);
  assert.equal(C.targetCode('x'), null);
});

test('derive(): free test above target, worst size and ratio', () => {
  const D = C.derive(base({ c4B: '123456', c6B: '40000', c14B: '3000', nasB: '11' }));
  assert.deepEqual(D.cB.slice(0, 3), [24, 22, 19]);
  assert.equal(D.isoAbove, true);
  assert.equal(D.nasAbove, true);
  assert.equal(D.anyAbove, true);
  // allowed at target 17/15/13: 1300, 320, 80 per ml
  assert.equal(D.worst.size, '6');
  assert.ok(Math.abs(D.worst.r - 40000 / 320) < 1e-9);
  assert.equal(C.fmtRatio(D.worst.r), '125');
});

test('derive(): after-filtration judged on the after counts', () => {
  const D = C.derive(base({ mode: 'after', c4B: '123456', c6B: '40000', c14B: '3000', c4A: '1500', c6A: '500', c14A: '60' }));
  assert.equal(D.after, true);
  assert.deepEqual(D.res.slice(0, 3), [18, 16, 13]);
  assert.equal(D.isoAbove, true);
  assert.equal(C.fmtRatio(D.worst.r), '1.6');
  assert.equal(D.pct, 99); // 98.8% rounds to 99; only results of 99% and up show a decimal
});

test('derive(): within target', () => {
  const D = C.derive(base({ c4B: '1000', c6B: '300', c14B: '40' }));
  assert.equal(D.isoAbove, false);
  assert.deepEqual(C.suggestedRecs(D), { fit: true, filt: false, moist: false, change: false, source: false, retest: true });
  assert.equal(C.suggestedDays(D), '90');
});

test('derive(): bad or missing inputs never produce a verdict', () => {
  assert.equal(C.derive(base({ c4B: '1000', c6B: '300' })).isoAbove, null); // no >=14 count
  assert.equal(C.derive(base({ c4B: '1000', c6B: '300', c14B: '40', t4: '16.5' })).isoAbove, null);
  assert.equal(C.derive(base({ c4B: '1000', c6B: '300', c14B: '40', t14: '' })).worst, null);
  assert.equal(C.derive(base({ nasB: '7A', tNas: '7' })).nasAbove, null);
  assert.equal(C.derive(base({ nasB: '8', tNas: '' })).nasAbove, null);
  assert.equal(C.derive(base({ rhB: 'wet', rhT: '50' })).rhAbove, null);
  assert.equal(C.derive(base({})).anyKnown, false);
  assert.deepEqual(C.suggestedRecs(C.derive(base({}))), {});
});

test('derive(): NAS "00", AS4059 classes and water', () => {
  assert.equal(C.derive(base({ nasB: '00', tNas: '5' })).nasAbove, false);
  assert.equal(C.derive(base({ asB: '7B-F', asT: '6' })).asAbove, true);
  assert.equal(C.derive(base({ asB: '6A/5B/5C', asT: '6B' })).asAbove, false);
  assert.equal(C.derive(base({ asB: 'B', asT: '6' })).asAbove, null);
  const wet = C.derive(base({ rhB: '80', rhT: '50' }));
  assert.equal(wet.rhAbove, true);
  assert.equal(wet.wet, true);
  assert.equal(C.suggestedRecs(wet).moist, true);
  assert.equal(C.derive(base({ condition: 'hazy' })).wet, true);
});

test('reductionPct() is safe with zero and missing counts', () => {
  assert.equal(C.reductionPct(base({ c4B: '0', c4A: '10' })), null);
  assert.equal(C.reductionPct(base({ c4B: '1000', c4A: '' })), null);
  assert.equal(C.reductionPct(base({ c4B: '1000', c4A: '250' })), 75);
  assert.equal(C.reductionPct(base({ c4B: '1000', c4A: '2000' })), -100);
});

test('draftObs() writes a sensible paragraph', () => {
  const S = base({ mode: 'after', equipment: '250T press', samplingPoint: 'return line', c4B: '123456', c6B: '40000', c14B: '3000', nasB: '11', c4A: '1500', c6A: '500', c14A: '60', nasA: '6' });
  const t = C.draftObs(S, C.derive(S));
  assert.match(t, /Sample from 250T press \(return line\) tested at ISO 4406 24\/22\/19 \/ NAS 11\./);
  assert.match(t, /improved to ISO 4406 18\/16\/13 \/ NAS 6, a 99% reduction/);
  assert.match(t, /remains above the target of 17\/15\/13 for piston pumps/);
  assert.doesNotMatch(t, /undefined|NaN/);
  const empty = base({});
  assert.equal(C.draftObs(empty, C.derive(empty)), null);
  const within = base({ c4B: '1000', c6B: '300', c14B: '40', component: 'oem' });
  const wt = C.draftObs(within, C.derive(within));
  assert.match(wt, /within the ISO 4406 target of 17\/15\/13 for the OEM specification/);
  assert.match(wt, /Continue routine monitoring\.$/);
});

test('warnings() catches typing mistakes', () => {
  const S = base({ c4B: '100', c6B: '200', c14B: 'abc', t4: '17.5' });
  const w = C.warnings(S, C.derive(S)).join(' | ');
  assert.match(w, /≥6 can't be higher than ≥4/);
  assert.match(w, /"abc" is not a number/);
  assert.match(w, /whole numbers from 0 to 28/);
  const ok = base({ c4B: '1000', c6B: '300', c14B: '40' });
  assert.deepEqual(C.warnings(ok, C.derive(ok)), []);
});

test('financial year and report numbers', () => {
  assert.equal(C.fy(new Date(2026, 3, 1)), '26-27');   // 1 April
  assert.equal(C.fy(new Date(2027, 2, 31)), '26-27');  // 31 March
  assert.equal(C.fy(new Date(2099, 5, 1)), '99-00');
  assert.equal(C.fy(new Date(2100, 0, 15)), '99-00');
  assert.equal(C.fy(new Date(2100, 3, 15)), '00-01');
  const d = new Date(2026, 8, 25);
  assert.equal(C.nextReportNo([], null, d), 'PPS/PC/26-27/001');
  const recs = [{ id: 'a', reportNo: 'PPS/PC/26-27/009' }, { id: 'b', reportNo: 'PPS/PC/25-26/120' }, { id: 'c', reportNo: 'junk' }];
  assert.equal(C.nextReportNo(recs, null, d), 'PPS/PC/26-27/010');
  assert.equal(C.nextReportNo(recs, { id: 'x', reportNo: 'PPS/PC/26-27/011' }, d), 'PPS/PC/26-27/012');
  assert.equal(C.nextReportNo([{ id: 'a', reportNo: 'PPS/PC/26-27/999' }], null, d), 'PPS/PC/26-27/1000');
});

test('dates and stamps', () => {
  assert.equal(C.dmy('2026-09-25'), '25-09-2026');
  assert.equal(C.dmy(''), '');
  assert.equal(C.dmy('<b>'), '<b>'); // passed through; the page escapes it
  assert.equal(C.today(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(C.stamp(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
});

test('CSV cells are quoted and safe to open in Excel', () => {
  assert.equal(C.csvCell('plain'), 'plain');
  assert.equal(C.csvCell('a,b'), '"a,b"');
  assert.equal(C.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(C.csvCell('line1\r\nline2'), '"line1\r\nline2"');
  assert.equal(C.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(C.csvCell('+91 93639'), "'+91 93639");
  assert.equal(C.csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(C.csvCell('-5'), '-5');
  assert.equal(C.csvCell('-cmd'), "'-cmd");
  assert.equal(C.csvCell(null), '');
});

test('backup import rules', () => {
  assert.equal(C.mergeAction(undefined, { id: 'r1' }), 'add');
  assert.equal(C.mergeAction({ updatedAt: '2026-01-01T00:00:00' }, { id: 'r1', updatedAt: '2026-02-01T00:00:00' }), 'update');
  assert.equal(C.mergeAction({ updatedAt: '2026-02-01T00:00:00' }, { id: 'r1', updatedAt: '2026-01-01T00:00:00' }), 'skip');
  assert.equal(C.mergeAction({ updatedAt: '2026-02-01T00:00:00' }, { id: 'r1', updatedAt: '2026-02-01T00:00:00' }), 'skip');
  assert.equal(C.mergeAction(undefined, { id: '../x' }), 'invalid');
  assert.equal(C.mergeAction(undefined, null), 'invalid');
  assert.equal(C.mergeAction(undefined, [1]), 'invalid');
  assert.deepEqual(C.parseBackup('[{"id":"a"}]').records, [{ id: 'a' }]);
  assert.deepEqual(C.parseBackup('{"records":[],"settings":{"testedBy":"X"}}').settings, { testedBy: 'X' });
  assert.throws(() => C.parseBackup('not json'), /not valid JSON/);
  assert.throws(() => C.parseBackup('{"foo":1}'), /no records list/);
});

test('every component target is a valid ISO code triple', () => {
  for (const [k, t] of Object.entries(C.TARGETS)) {
    if (k === 'oem') continue;
    assert.equal(t.iso.length, 3);
    t.iso.forEach(c => assert.notEqual(C.targetCode(c), null));
    assert.ok(t.iso[0] > t.iso[1] && t.iso[1] > t.iso[2], k);
  }
});

test('the headline verdict covers NAS, AS4059 and water, not only ISO', () => {
  const S = base({ c4B: '1000', c6B: '300', c14B: '60', nasB: '9' }); // ISO 17/15/13 = target, NAS 9 > 7
  const D = C.derive(S);
  assert.equal(D.isoAbove, false);
  assert.equal(D.nasAbove, true);
  assert.equal(D.verdict, 'above');
  assert.deepEqual(D.fails.map(f => f.std), ['NAS 1638']);
  const t = C.draftObs(S, D);
  assert.match(t, /NAS 1638 class 9 is above the target class 7/);
  assert.doesNotMatch(t, /Continue routine monitoring/);
  assert.equal(C.suggestedRecs(D).filt, true);
  const wet = base({ c4B: '1000', c6B: '300', c14B: '40', rhB: '80', rhT: '50' });
  const W = C.derive(wet);
  assert.equal(W.verdict, 'above');
  assert.match(C.draftObs(wet, W), /Water saturation \(80%RH\) is above the target of 50%RH/);
  assert.equal(C.derive(base({})).verdict, null);
  assert.equal(C.derive(base({ c4B: '1000', c6B: '300', c14B: '40' })).verdict, 'within');
});

test('after-filtration wording follows what actually happened', () => {
  const worse = base({ mode: 'after', c4B: '1000', c6B: '300', c14B: '60', c4A: '2400', c6A: '600', c14A: '150' });
  const tw = C.draftObs(worse, C.derive(worse));
  assert.match(tw, /not an improvement/);
  assert.match(tw, /The oil is above the target/);          // it was within before, so not "remains"
  const same = base({ mode: 'after', c4B: '1000', c6B: '300', c14B: '60', c4A: '1000', c6A: '300', c14A: '60' });
  assert.match(C.draftObs(same, C.derive(same)), /unchanged at ISO 4406 17\/15\/13/);
  const fixed = base({ mode: 'after', c4B: '123456', c6B: '40000', c14B: '3000', c4A: '900', c6A: '200', c14A: '30' });
  assert.match(C.draftObs(fixed, C.derive(fixed)), /is now within the ISO 4406 target/);
});

test('class parsing for NAS 1638 and SAE AS4059', () => {
  assert.equal(C.nasClass('00'), -1);
  assert.equal(C.nasClass('0'), 0);
  assert.equal(C.nasClass('12'), 12);
  assert.ok(Number.isNaN(C.nasClass('7A')));
  assert.equal(C.derive(base({ nasB: '0', tNas: '00' })).nasAbove, true);
  assert.equal(C.asClass('6A/8B/7C'), 8);
  assert.equal(C.asClass('000'), -2);
  assert.equal(C.asClass('07B'), 7);
  assert.equal(C.derive(base({ asB: '6A/8B/7C', asT: '7B-F' })).asAbove, true);
  assert.equal(C.suggestedRecs(C.derive(base({ asB: '9B', asT: '7B' }))).filt, true);
});

test('numbers on the report never overstate', () => {
  assert.equal(C.reductionPct(base({ c4B: '250000', c4A: '1000' })), 99.6);
  assert.equal(C.reductionPct(base({ c4B: '250000', c4A: '1' })), 99.9);
  assert.equal(C.reductionPct(base({ c4B: '250000', c4A: '0' })), 100);
  assert.equal(C.fmtRatio(1340 / 1300), '1.03');
  assert.equal(C.fmtRatio(1.6), '1.6');
  assert.equal(C.fmtRatio(2), '2');
});

test('hazy or wet sample asks for moisture removal even without counts', () => {
  const D = C.derive(base({ condition: 'water' }));
  assert.equal(D.anyKnown, false);
  assert.equal(C.suggestedRecs(D).moist, true);
  assert.equal(C.suggestedDays(D), '30');
});

test('hand-set recommendations that contradict the result are flagged', () => {
  const S = base({ c4B: '123456', c6B: '40000', c14B: '3000', recAuto: false, recs: { fit: true } });
  const w = C.warnings(S, C.derive(S)).join(' | ');
  assert.match(w, /Oil fit for continued service" is ticked/);
  assert.match(w, /"Filtration recommended" is not ticked/);
});

test('report numbers sort by year then number, past 999', () => {
  const nos = ['PPS/PC/26-27/999', 'PPS/PC/26-27/1000', 'PPS/PC/25-26/120', 'PPS/PC/26-27/012', '', 'junk'];
  const sorted = [...nos].sort((a, b) => C.reportKey(b) - C.reportKey(a));
  assert.deepEqual(sorted.slice(0, 4), ['PPS/PC/26-27/1000', 'PPS/PC/26-27/999', 'PPS/PC/26-27/012', 'PPS/PC/25-26/120']);
});
