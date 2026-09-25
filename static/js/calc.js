/* PPS Particle Count – calculation core.
   No DOM access: the app and the automated tests (tests/calc.test.js) both use this file. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PPSCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ISO 4406 table: upper limit per ml ("up to and including") for codes 0..28 ---------- */
  const ISO_UP = [0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.3, 2.5, 5, 10, 20, 40, 80, 160, 320, 640, 1300, 2500,
    5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 1300000, 2500000];

  const TARGETS = {
    servo: { label: 'Servo valves', iso: [16, 14, 11], nas: 5 },
    prop: { label: 'Proportional valves', iso: [17, 15, 12], nas: 6 },
    piston: { label: 'Piston pumps', iso: [17, 15, 13], nas: 7 },
    vane: { label: 'Vane & gear pumps', iso: [18, 16, 14], nas: 8 },
    brg: { label: 'Rolling bearings', iso: [16, 14, 12], nas: 6 },
    turbine: { label: 'Turbines / journal brgs', iso: [17, 15, 12], nas: 6 },
    oem: { label: 'OEM specified', iso: null, nas: null }
  };
  const SIZES = [['c4', '≥ 4 µm(c)', '4'], ['c6', '≥ 6 µm(c)', '6'], ['c14', '≥ 14 µm(c)', '14'],
    ['c21', '≥ 21 µm(c)', '21'], ['c38', '≥ 38 µm(c)', '38'], ['c70', '≥ 70 µm(c)', '70']];
  const RECS = [['fit', 'Oil fit for continued service'], ['filt', 'Filtration recommended (PPS ELC)'],
    ['moist', 'Moisture removal recommended (PPS LVDH)'], ['change', 'Oil change recommended'],
    ['source', 'Check contamination source (breathers / seals / ingress)'], ['retest', 'Re-test after ___ days']];
  const STATUSES = ['Sample taken', 'Report delivered', 'Quote sent', 'Won', 'Lost'];

  /* A number typed by a person: '' -> null, '1,23,456' -> 123456, '12.5' -> 12.5, 'abc' -> NaN */
  function num(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(/[,\s ]/g, '');
    if (s === '') return null;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  const isNum = n => n != null && !isNaN(n);

  function isoCode(v) {
    const c = num(v);
    if (!isNum(c) || c < 0) return null;
    for (let n = 0; n <= 28; n++) if (c <= ISO_UP[n]) return n;
    return 29; // more than 2,500,000 per ml: shown as ">28"
  }
  const codeTxt = c => c == null ? '' : (c > 28 ? '>28' : String(c));

  /* A target code must be a whole number 0..28, otherwise it is treated as not set */
  function targetCode(v) {
    const n = num(v);
    return isNum(n) && Number.isInteger(n) && n >= 0 && n <= 28 ? n : null;
  }

  /* Compare a measured value with a target; null when either is missing or not a number */
  function above(measured, target) {
    const a = num(measured), b = num(target);
    return isNum(a) && isNum(b) ? a > b : null;
  }
  /* A class number where "000" < "00" < "0" < "1" (used by SAE AS4059 and NAS 1638) */
  const classNum = t => (/^0+$/.test(t) ? 1 - t.length : parseInt(t, 10));
  /* SAE AS4059 is written like "7", "7B", "7B-F" or per size "6A/8B/7C": the worst (highest) class counts */
  function asClass(v) {
    let worst = null;
    String(v == null ? '' : v).split(/[\/,;]+/).forEach(tok => {
      const m = tok.trim().match(/^(\d+)/);
      if (!m) return;
      const c = classNum(m[1]);
      if (worst == null || c > worst) worst = c;
    });
    return worst;
  }
  /* NAS 1638 classes run 00, 0, 1 … 12 */
  function nasClass(v) {
    const s = String(v == null ? '' : v).trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) return classNum(s);
    return isNum(num(s)) ? num(s) : NaN;
  }
  function nasAboveTarget(measured, target) {
    const a = nasClass(measured), b = nasClass(target);
    return isNum(a) && isNum(b) ? a > b : null;
  }
  function asAboveTarget(measured, target) {
    const a = asClass(measured), b = asClass(target);
    return a != null && b != null ? a > b : null;
  }

  /* Everything the report states is derived here from the report record S */
  function derive(S) {
    const after = S.mode === 'after';
    const codes = side => SIZES.map(([k]) => isoCode(S[k + side]));
    const cB = codes('B'), cA = codes('A');
    const tgt = [S.t4, S.t6, S.t14].map(targetCode);
    const hasT = tgt.every(v => v != null);
    const resSide = after ? 'A' : 'B';
    const res = after ? cA : cB;
    const haveRes = res.slice(0, 3).every(v => v != null);
    let isoAbove = null, worst = null;
    if (hasT && haveRes) {
      isoAbove = res.slice(0, 3).some((c, i) => c > tgt[i]);
      for (let i = 0; i < 3; i++) {
        const r = num(S[SIZES[i][0] + resSide]) / ISO_UP[tgt[i]];
        if (!worst || r > worst.r) worst = { r, size: SIZES[i][2], i };
      }
    }
    // the before sample against the target (used for wording such as "remains above" / "is now within")
    const isoAboveB = hasT && cB.slice(0, 3).every(v => v != null) ? cB.slice(0, 3).some((c, i) => c > tgt[i]) : null;
    const nasRes = after ? S.nasA : S.nasB, asRes = after ? S.asA : S.asB, rhRes = after ? S.rhA : S.rhB;
    const nasAbove = nasAboveTarget(nasRes, S.tNas);
    const asAbove = asAboveTarget(asRes, S.asT);
    const rhAbove = above(rhRes, S.rhT);
    const flags = [isoAbove, nasAbove, asAbove, rhAbove];
    const anyAbove = flags.some(v => v === true);
    const anyKnown = flags.some(v => v !== null);
    const wet = S.condition === 'hazy' || S.condition === 'water' || rhAbove === true;
    // every standard that is over its target, for the headline
    const fails = [];
    if (isoAbove) fails.push({ std: 'ISO 4406', measured: isoStr(res), target: tgt.join('/') });
    if (nasAbove) fails.push({ std: 'NAS 1638', measured: String(nasRes).trim(), target: String(S.tNas).trim() });
    if (asAbove) fails.push({ std: 'SAE AS4059', measured: String(asRes).trim(), target: String(S.asT).trim() });
    if (rhAbove) fails.push({ std: 'Water saturation', measured: String(rhRes).trim() + '%RH', target: String(S.rhT).trim() + '%RH' });
    const verdict = anyAbove ? 'above' : anyKnown ? 'within' : null;
    return { after, cB, cA, tgt, hasT, res, isoAbove, isoAboveB, worst, nasAbove, asAbove, rhAbove, anyAbove, anyKnown, wet,
      fails, verdict, pct: after ? reductionPct(S) : null };
  }

  /* % fewer particles >=4 um(c) after filtration; null when it can't be worked out */
  function reductionPct(S) {
    const b = num(S.c4B), a = num(S.c4A);
    if (!isNum(a) || !isNum(b) || b <= 0 || a < 0) return null;
    if (a === 0) return 100;
    const raw = (1 - a / b) * 100;
    // above 99% show one decimal (99.6), and never round up to 100 while particles remain
    return raw >= 99 ? Math.min(99.9, Math.floor(raw * 10) / 10) : Math.round(raw);
  }

  function suggestedRecs(D) {
    if (!D.anyKnown) return D.wet ? { fit: false, filt: false, moist: true, change: false, source: false, retest: true } : {};
    const isoUnjudged = D.res.slice(0, 3).every(v => v != null) && D.isoAbove === null;
    return { fit: !D.anyAbove && !D.wet && !isoUnjudged, filt: D.isoAbove === true || D.nasAbove === true || D.asAbove === true,
      moist: D.wet, change: false, source: D.anyAbove, retest: true };
  }
  const suggestedDays = D => (D.anyAbove || D.wet ? '30' : '90');

  const fmtRatio = r => (r >= 10 ? Math.round(r).toLocaleString('en-IN') : r > 1 && r < 1.1 ? Math.max(1.01, Math.round(r * 100) / 100).toFixed(2) : r.toFixed(1).replace(/\.0$/, ''));
  function fmtNum(v) {
    const n = num(v);
    if (n == null) return '';
    return isNaN(n) ? String(v) : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  const isoStr = a => (a.slice(0, 3).every(v => v != null) ? a.slice(0, 3).map(codeTxt).join('/') : '');
  const compName = S => (S.component === 'oem' || !TARGETS[S.component] ? 'the OEM specification' : TARGETS[S.component].label.toLowerCase());

  /* A paragraph for "Observations / impression"; null when the before counts are missing */
  function draftObs(S, D) {
    const eq = String(S.equipment || '').trim() || 'the system';
    const sp = String(S.samplingPoint || '').trim() ? ` (${String(S.samplingPoint).trim()})` : '';
    const comp = compName(S);
    const nas = v => (String(v || '').trim() ? ` / NAS ${String(v).trim()}` : '');
    const out = [];
    const isoB = isoStr(D.cB), isoA = isoStr(D.cA), tStr = D.hasT ? D.tgt.join('/') : '';
    if (!isoB) return null;
    out.push(`Sample from ${eq}${sp} tested at ISO 4406 ${isoB}${nas(S.nasB)}.`);
    if (D.after && isoA) {
      const sumB = D.cB.slice(0, 3).reduce((a, c) => a + c, 0), sumA = D.cA.slice(0, 3).reduce((a, c) => a + c, 0);
      if (sumA < sumB) out.push(`After offline filtration with PPS ELC, cleanliness improved to ISO 4406 ${isoA}${nas(S.nasA)}${D.pct != null && D.pct > 0 ? `, a ${D.pct}% reduction in particles ≥4 µm(c)` : ''}.`);
      else if (sumA === sumB) out.push(`After offline filtration with PPS ELC, cleanliness was unchanged at ISO 4406 ${isoA}${nas(S.nasA)}.`);
      else out.push(`After filtration the sample measured ISO 4406 ${isoA}${nas(S.nasA)}, which is not an improvement; check the sampling point and bottle cleanliness and re-test.`);
    }
    if (D.hasT && D.isoAbove != null) {
      const w = D.worst;
      if (D.isoAbove) {
        const steps = Math.min(D.res[2], 29) - D.tgt[2];
        out.push(`${D.after && D.isoAboveB ? 'The oil remains' : 'The oil is'} above the target of ${tStr} for ${comp}. At ≥${w.size} µm(c) it carries about ${fmtRatio(w.r)}× the particles the target allows${steps > 0 ? `; each ISO code step doubles the particle count and this sample is ${steps} step${steps > 1 ? 's' : ''} above target at ≥14 µm(c)` : ''}.`);
      } else {
        out.push(`The oil is ${D.after && D.isoAboveB ? 'now ' : ''}within the ISO 4406 target of ${tStr} for ${comp}.`);
      }
    }
    if (D.nasAbove) out.push(`NAS 1638 class ${String(D.after ? S.nasA : S.nasB).trim()} is above the target class ${String(S.tNas).trim()}.`);
    if (D.asAbove) out.push(`SAE AS4059 class ${String(D.after ? S.asA : S.asB).trim()} is above the target of ${String(S.asT).trim()}.`);
    const dirty = D.isoAbove || D.nasAbove || D.asAbove;
    if (dirty) {
      out.push('Particles at this level accelerate wear of pumps, valves and bearings, cause valve sticking and shorten oil life.');
      if (!D.after) out.push('Offline filtration with PPS ELC is recommended, with a re-test after purification to confirm the target is reached.');
    }
    if (S.condition === 'hazy' || S.condition === 'water') out.push(`The sample was ${S.condition === 'water' ? 'showing free water' : 'hazy'}. Optical counters count water droplets and air bubbles as particles, so moisture removal (PPS LVDH) and a water content test are advised.`);
    else if (D.rhAbove === true) out.push(`Water saturation (${String(D.after ? S.rhA : S.rhB).trim()}%RH) is above the target of ${String(S.rhT).trim()}%RH, so moisture removal (PPS LVDH) is advised.`);
    if (D.verdict === 'within' && !D.wet) out.push('Continue routine monitoring.');
    return out.join(' ');
  }

  /* Plain-language checks shown under the results table */
  function warnings(S, D) {
    const w = [];
    const sides = D.after ? ['B', 'A'] : ['B'];
    sides.forEach(side => {
      const word = side === 'B' ? 'before' : 'after';
      const v = SIZES.map(([k]) => num(S[k + side]));
      SIZES.forEach(([, , sz], i) => {
        if (v[i] != null && isNaN(v[i])) w.push(`The ≥${sz} ${word} count "${S[SIZES[i][0] + side]}" is not a number.`);
        else if (v[i] != null && v[i] < 0) w.push(`The ≥${sz} ${word} count can't be negative.`);
      });
      for (let i = 1; i < v.length; i++) {
        if (isNum(v[i]) && isNum(v[i - 1]) && v[i] > v[i - 1]) w.push(`Check the ${word} counts: ≥${SIZES[i][2]} can't be higher than ≥${SIZES[i - 1][2]}, because the ≥${SIZES[i - 1][2]} count already includes every particle ≥${SIZES[i][2]}. Probably a typing mistake.`);
      }
    });
    const badT = [['≥4', S.t4], ['≥6', S.t6], ['≥14', S.t14]].filter(([, t]) => String(t == null ? '' : t).trim() !== '' && targetCode(t) == null);
    if (badT.length) w.push(`Target codes must be whole numbers from 0 to 28 (check ${badT.map(x => x[0]).join(', ')}).`);
    [['NAS class, before', S.nasB], ['NAS class, after', D.after ? S.nasA : ''], ['Target NAS class', S.tNas],
      ['Water saturation, before', S.rhB], ['Water saturation, after', D.after ? S.rhA : ''], ['Water saturation target', S.rhT]]
      .forEach(([l, v]) => { if (isNaN(num(v))) w.push(`${l} "${v}" is not a number.`); });
    const recs = S.recs || {};
    if (!S.recAuto && recs.fit && D.anyAbove) w.push('"Oil fit for continued service" is ticked, but the result is above target.');
    if (!S.recAuto && !D.after && !recs.filt && (D.isoAbove || D.nasAbove || D.asAbove)) w.push('The result is above target but "Filtration recommended" is not ticked.');
    return w;
  }

  /* ---------- dates, numbering ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const today = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  /* Local time stamp, same format the laptop server writes: 2026-09-25T18:48:05 */
  const stamp = (d = new Date()) => `${today(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  /* Indian financial year (April to March) as "26-27" */
  function fy(d = new Date()) {
    const y = d.getFullYear() % 100;
    const s = d.getMonth() >= 3 ? y : (y + 99) % 100;
    return `${pad2(s)}-${pad2((s + 1) % 100)}`;
  }
  const dmy = v => {
    if (!v) return '';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v);
  };
  function nextReportNo(records, cur, d = new Date()) {
    const pre = `PPS/PC/${fy(d)}/`;
    let max = 0;
    const see = no => {
      no = String(no || '');
      if (!no.startsWith(pre)) return;
      const n = parseInt(no.slice(pre.length), 10);
      if (n > max) max = n;
    };
    (records || []).forEach(r => see(r.reportNo));
    if (cur && !(records || []).some(r => r.id === cur.id)) see(cur.reportNo);
    return pre + String(max + 1).padStart(3, '0');
  }

  /* Sort key for report numbers like PPS/PC/26-27/012: financial year first, then the number */
  function reportKey(no) {
    const s = String(no || '');
    const m = s.match(/(\d{2})-\d{2}\/(\d+)\s*$/);
    if (m) return (2000 + parseInt(m[1], 10)) * 1e6 + parseInt(m[2], 10);
    const t = s.match(/(\d+)\s*$/);
    return t ? parseInt(t[1], 10) : -1;
  }

  /* ---------- records ---------- */
  const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
  const validId = id => typeof id === 'string' && ID_RE.test(id);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  /* What an import should do with one incoming record, given the one already stored (or undefined) */
  function mergeAction(existing, incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || !validId(incoming.id)) return 'invalid';
    if (!existing) return 'add';
    return String(incoming.updatedAt || '') > String(existing.updatedAt || '') ? 'update' : 'skip';
  }

  /* Accept a backup file made by this app (or a bare list of records) */
  function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('This file is not a PPS backup (it is not valid JSON).'); }
    if (Array.isArray(data)) data = { records: data };
    if (!data || typeof data !== 'object' || !Array.isArray(data.records)) throw new Error('This file is not a PPS backup (no records list found).');
    const settings = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings : {};
    return { records: data.records, settings };
  }

  /* One CSV cell: quoted when needed, and protected against spreadsheet formula injection */
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !isNum(num(s)))) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  return { ISO_UP, TARGETS, SIZES, RECS, STATUSES, num, isoCode, codeTxt, targetCode, above, asClass, derive,
    nasClass, reductionPct, suggestedRecs, suggestedDays, fmtRatio, fmtNum, isoStr, compName, draftObs, warnings,
    today, stamp, fy, dmy, nextReportNo, reportKey, validId, cmp, mergeAction, parseBackup, csvCell };
});
