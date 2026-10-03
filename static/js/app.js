/* PPS Field Report Creator – the app screen.
   Calculation rules live in calc.js, saving and loading in store.js,
   and each report form lives in reports/ (see reports/registry.js). */
(function () {
  'use strict';
  const C = window.PPSCalc;
  const { SIZES, RECS, TARGETS, STATUSES, SERVICE_STATUSES, codeTxt, derive, fmtRatio, fmtNum, isoStr, dmy, today, cmp } = C;
  const $ = id => document.getElementById(id);
  const LOGO = 'logo.png';
  const clone = o => JSON.parse(JSON.stringify(o));
  const R = window.PPSReports, Sh = window.PPSSheet, F = window.PPSForm;
  const Sig = window.PPSSig, Photo = window.PPSPhoto;
  /* Each report template brings its own styling, always under its own class prefix. */
  $('reportCss').textContent = R.all().map(d => d.css || '').join('\n');
  const pageWidth = () => ($('report').classList.contains('landscape') ? 1123 : 794);
  /* Image and signature data URLs are big: they are kept out of the crash-safety journal. */
  const isPic = v => typeof v === 'string' && v.slice(0, 11) === 'data:image/';
  const TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
    /iPad|iPhone|iPod|Android/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const phone = () => window.matchMedia && matchMedia('(max-width: 900px)').matches;
  const TAP = TOUCH ? 'Tap' : 'Click';

  /* ---------- small helpers ---------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TICK = '<svg viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.6 8.6 2.2" fill="none" stroke="#111" stroke-width="1.8"/></svg>';
  const cb = (on, l) => `<span class="cb"><i>${on ? TICK : ''}</i>${l}</span>`;
  const safeName = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  const newRev = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* Access key for phones using the laptop over Wi-Fi: it arrives in the link (…/?key=…) and is remembered */
  const KEY = (() => {
    let k = '';
    try { k = new URLSearchParams(location.search).get('key') || ''; } catch (e) { /* old browser */ }
    if (k) LS.set('ppspc.key', k);
    return k || LS.get('ppspc.key', '') || '';
  })();

  function status(m, action) {
    const t = $('toast');
    // on phones the saving bars sit above the bottom buttons: keep messages above them
    t.style.setProperty('--banners-h', (phone() ? $('banners').offsetHeight : 0) + 'px');
    t.textContent = m;
    if (action) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-primary'; b.textContent = action.label;
      b.onclick = () => { t.textContent = ''; action.run(); };
      t.appendChild(b);
    }
    clearTimeout(status.t);
    status.t = setTimeout(() => { t.textContent = ''; if (action && action.expire) action.expire(); }, action ? 10000 : 5000);
  }

  /* ---------- report records ---------- */
  const KEEP_KEYS = ['testedBy', 'counter', 'counterSr', 'calDate', 'iso11171', 'analysedBy'];
  const KEEP_DEFAULTS = { testedBy: '', counter: 'OPCOM2 (Ferrocare)', counterSr: '', calDate: '', iso11171: true, analysedBy: '' };
  const pickKeep = o => { const r = {}; KEEP_KEYS.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
  /* Settings hold the remembered field values plus "my signature". The signature is far too big
     to copy into every new report, so it is kept out of KEEP_KEYS and travels only in a backup. */
  const SETTING_KEYS = [...KEEP_KEYS, 'mySignature'];
  const SETTINGS_DEFAULTS = Object.assign({ mySignature: '' }, KEEP_DEFAULTS);
  const pickSettings = o => { const r = {}; SETTING_KEYS.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
  const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  /* Which report kind a record is: anything unknown is an old particle-count record. */
  const reportOf = rec => R.of(rec) || R.get('particle');
  const blankReport = type => (R.get(type) || R.get('particle')).blank();
  const BLANK = blankReport('particle');
  /* Fill any fields an older or imported record lacks, so the screen never shows "undefined" */
  function normalise(rec) {
    const src = clone(rec || {});
    const def = reportOf(src);
    const base = blankReport(def.id);
    const r = Object.assign({}, base, src);
    r.type = def.id;
    if (!C.validId(r.id)) r.id = newId();
    Object.keys(base).forEach(k => {
      if (r[k] === undefined || r[k] === null) r[k] = typeof base[k] === 'boolean' ? false : '';
      else if (typeof base[k] === 'boolean') r[k] = !!r[k];
      else if (typeof r[k] !== 'string' && typeof base[k] === 'string') r[k] = String(r[k]);
    });
    if (def.id !== 'particle') return r;
    if (!r.recs || typeof r.recs !== 'object' || Array.isArray(r.recs)) r.recs = {};
    if (!TARGETS[r.component]) r.component = 'oem';
    if (r.mode !== 'after') r.mode = 'before';
    // records from version 1 turned automatic ticks off when re-test days were typed
    if (src.retestManual === undefined) r.retestManual = !r.recAuto && String(r.retestDays || '').trim() !== '';
    return r;
  }
  const summaryOf = r => R.listing(r);
  const hasContent = r => !!r && String(summaryOf(r).client || '').trim() !== '';
  /* Every form names the customer differently: company, customer or client. */
  const needName = () => (S && reportOf(S).id === 'particle' ? 'Add client name to save' : 'Add a customer name to save');
  /* A report is stored once it has a client name; one that was stored keeps saving even if the name is cleared */
  const canSave = r => hasContent(r) || (!!r && RECORDS.some(x => x.id === r.id));

  /* ---------- state ---------- */
  let store = null;            // where records are kept (store.js)
  let RECORDS = [];            // every saved record
  let SETTINGS = Object.assign({}, SETTINGS_DEFAULTS);
  let S = null;                // the report on screen
  let serverOk = true, needKey = false;
  let editRev = 0, savedRev = 0, queued = { id: null, rev: -1 };
  let baseRevs = [null];       // revisions of S this screen knows about (see store.js)
  let autoNo = false;          // report number was filled in automatically and not yet used
  let conflict = null;
  let prevComp = null;         // the component chosen before the targets were typed over
  const settingsDirty = new Set();
  const isDirty = () => savedRev !== editRev;
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('ppspc') : null;

  /* ---------- build dynamic form parts ---------- */
  $('countRows').innerHTML = SIZES.map(([k, l]) => `<tr><td class="sz">${l.replace(' µm(c)', '')}</td>
    <td><input data-k="${k}B" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${l} before, counts per ml"></td><td class="cd"><span class="code" id="${k}Bcode"></span></td>
    <td class="col-after"><input data-k="${k}A" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${l} after, counts per ml"></td><td class="col-after cd"><span class="code" id="${k}Acode"></span></td></tr>`).join('');
  $('compSel').innerHTML = Object.entries(TARGETS).map(([k, t]) => `<option value="${k}">${esc(t.label)}${t.iso ? ' — ' + t.iso.join('/') : ''}</option>`).join('');
  $('recList').innerHTML = RECS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-rec="${k}">${esc(l.replace(' after ___ days', ' (set days below)'))}</label>`).join('');
  const PDF_LABEL = TOUCH ? 'Share PDF' : 'Save PDF';
  const DRAFT_LABEL = 'Write observations from the results';
  $('pdfBtn').textContent = PDF_LABEL;
  $('bkBtn').href = 'api/backup' + (KEY ? '?key=' + encodeURIComponent(KEY) : '');
  $('pkGrid').innerHTML = R.all().map(d => `<button type="button" class="pickcard" data-type="${esc(d.id)}">
    <span class="fm">${d.form ? 'Form ' + esc(d.form) : 'PPS service form'}</span>
    <b>${esc(d.name)}</b>
    <small>${esc(d.about || d.title || '')}</small></button>`).join('');
  document.querySelectorAll('#pkGrid .pickcard').forEach(b => {
    b.onclick = async () => { if (await startNew(b.dataset.type)) status('New ' + R.get(b.dataset.type).short + ' report started.'); };
  });
  /* My signature is remembered in settings so the same hand can be placed on any report. */
  Sig.useSaved(() => SETTINGS.mySignature || '', v => {
    SETTINGS.mySignature = v || '';
    settingsDirty.add('mySignature');     // saveSettings only writes keys marked as changed
    saveSettings();
  });
  /* The entry screen of the open report kind (the particle one is written in index.html). */
  let builtType = null;
  function ensureForm(def) {
    if (def.ownForm) return;
    if (builtType === def.id) return;
    $('formGeneric').innerHTML = F.build(def);
    builtType = def.id;
  }

  /* ---------- render ---------- */
  function render() {
    if (!S) return;
    const def = reportOf(S);
    $('formParticle').hidden = !def.ownForm;
    $('formGeneric').hidden = !!def.ownForm;
    $('barType').textContent = def.short + (def.form ? ' · ' + def.form : '');
    $('report').classList.toggle('landscape', def.orientation === 'l');
    if (!def.ownForm) { renderGeneric(def); return; }
    const D = derive(S);
    $('resWrap').classList.toggle('mode-after', D.after);
    document.querySelectorAll('.col-after-f').forEach(e => { e.style.display = D.after ? '' : 'none'; });
    document.querySelectorAll('.seg label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    $('barNo').textContent = S.reportNo || '—';
    document.title = (S.client ? S.client + ' – ' : '') + 'PPS Particle Count Report';

    // ISO code chips beside the counts
    SIZES.forEach(([k], i) => ['B', 'A'].forEach(side => {
      const el = $(k + side + 'code'); const c = side === 'B' ? D.cB[i] : D.cA[i];
      el.textContent = i < 3 ? codeTxt(c) : (c == null ? '' : '—');
      el.className = 'code' + (c != null && i < 3 ? ' has' : '');
      const isRes = (side === 'A') === D.after;
      if (isRes && i < 3 && c != null && D.hasT) el.classList.add(c > D.tgt[i] ? 'above' : 'within');
    }));

    // recommendations follow the results until the user changes them
    if (S.recAuto) S.recs = C.suggestedRecs(D);
    if (!S.retestManual && (D.anyKnown || D.wet)) S.retestDays = C.suggestedDays(D);
    document.querySelectorAll('[data-rec]').forEach(el => { el.checked = !!S.recs[el.dataset.rec]; });
    $('recReset').hidden = S.recAuto && !S.retestManual;
    const rd = document.querySelector('[data-k="retestDays"]'); if (document.activeElement !== rd) rd.value = S.retestDays;

    // observations written by the app follow later changes to the results
    let obsStale = false;
    if (String(S.obsAuto || '').trim()) {
      const fresh = C.draftObs(S, D);
      if (String(S.obs || '').trim() === String(S.obsAuto).trim()) {
        if (fresh && fresh !== S.obsAuto) { S.obs = S.obsAuto = fresh; if (document.activeElement !== $('obsBox')) $('obsBox').value = fresh; }
      } else if (fresh && fresh !== S.obsAuto) obsStale = true;
    }

    // plain-language checks
    const wb = $('warnBox'); wb.textContent = '';
    const warns = C.warnings(S, D);
    if (obsStale) warns.push('The results changed after the observations were written: tap "Write observations from the results" again, or update your text.');
    if (S.component === 'oem' && !D.hasT) warns.push('Type the OEM target codes (≥4, ≥6 and ≥14) under 04 Target cleanliness.');
    warns.forEach(t => { const p = document.createElement('p'); p.textContent = t; wb.appendChild(p); });
    const no = String(S.reportNo || '').trim();
    $('noWarn').textContent = no && RECORDS.some(r => r.id !== S.id && String(r.reportNo || '').trim() === no) ? 'Another saved report already has this number.' : '';

    $('report').innerHTML = reportHTML(S, D);
    fitPreview();
  }

  /* Any report whose entry screen is described by its own field list. */
  function renderGeneric(def) {
    document.title = [S.reportNo, summaryOf(S).client].filter(Boolean).join(' – ') + ' | ' + def.name;
    try {
      $('report').innerHTML = def.render(S);
    } catch (e) {
      $('report').innerHTML = `<p style="padding:20px;font-size:13px">This report could not be drawn (${esc(e && e.message)}). Please tell Prime Power Systems.</p>`;
    }
    fitPreview();
  }

  function verdictHTML(S, D) {
    if (!D.verdict) return '';
    const comp = esc(C.compName(S));
    const extra = D.after && D.pct != null && D.pct > 0 ? ` Filtration removed ${D.pct}% of particles ≥4 µm(c).` : '';
    const others = D.fails.filter(f => f.std !== 'ISO 4406').map(f => `${esc(f.std)} ${esc(f.measured)} vs target ${esc(f.target)}`);
    if (D.verdict === 'above') {
      const lead = D.isoAbove
        ? `<b>${fmtRatio(D.worst.r)}× the allowed particles at ≥${D.worst.size} µm(c)</b> for ${comp} (target ${D.tgt.join('/')}, measured ${isoStr(D.res)}).${others.length ? ` Also above target: ${others.join('; ')}.` : ''}`
        : `<b>${others.join('; ')}.</b>${D.isoAbove === false ? ` ISO 4406 ${isoStr(D.res)} is within the target of ${D.tgt.join('/')} for ${comp}.` : ''}`;
      return `<div class="r-verdict above"><div class="tagv">ABOVE TARGET</div><div class="txt"><span>${lead}${extra}</span></div></div>`;
    }
    const wet = D.wet ? ` The sample was ${S.condition === 'water' ? 'showing free water' : 'hazy'}, so moisture removal is advised.` : '';
    const judged = [D.nasAbove === false && 'NAS 1638', D.asAbove === false && 'SAE AS4059', D.rhAbove === false && 'water saturation'].filter(Boolean);
    const lead = D.isoAbove === false
      ? `<b>Measured ${isoStr(D.res)}</b> against a target of ${D.tgt.join('/')} for ${comp}.`
      : `<b>Within target for ${judged.join(', ')}.</b>${isoStr(D.res) ? ` ISO 4406 ${isoStr(D.res)} was not judged (no ISO target given).` : ''}`;
    return `<div class="r-verdict within"><div class="tagv">WITHIN TARGET</div><div class="txt"><span>${lead}${extra}${wet}</span></div></div>`;
  }

  function reportHTML(S, D) {
    const after = D.after;
    const wr = a => (a == null ? cb(false, 'Within') + ' ' + cb(false, 'Above target') : cb(!a, 'Within') + ' ' + cb(a, 'Above target'));
    const cell = v => (v === '' || v == null ? '' : esc(v));
    const isoCells = a => (a.slice(0, 3).every(v => v == null) ? '___ / ___ / ___' : a.slice(0, 3).map(c => (c == null ? '___' : codeTxt(c))).join(' / '));
    const filled = v => String(v == null ? '' : v).trim() !== '';
    const tDays = S.recs.retest && filled(S.retestDays) ? S.retestDays : '______';
    const rows = SIZES.map((sz, i) => [sz, i]).filter(([[k], i]) => i < 4 || filled(S[k + 'B']) || (after && filled(S[k + 'A'])))
      .map(([[k, l], i]) => `<tr><td>${l}</td><td>${esc(fmtNum(S[k + 'B']))}</td>${i < 3 ? `<td class="hi">${codeTxt(D.cB[i])}</td>` : '<td class="dash">–</td>'}<td>${after ? esc(fmtNum(S[k + 'A'])) : ''}</td>${i < 3 ? `<td class="hi">${after ? codeTxt(D.cA[i]) : ''}</td>` : '<td class="dash">–</td>'}</tr>`).join('');
    const notes = S.iso11171
      ? 'Notes: Particle counts are per ml, sized to ISO 11171 calibration. ISO 4406 codes refer to ≥4 / ≥6 / ≥14 µm(c).'
      : 'Notes: Particle counts are per ml. The counter is not marked as ISO 11171 calibrated, so the ISO 4406 codes (≥4 / ≥6 / ≥14 µm) are indicative.';
    return `
  <div class="r-head"><img src="${LOGO}" alt="Prime Power Systems"><div class="co">
    <h2>PRIME POWER SYSTEMS</h2><div class="tag">Industrial Oil Purification &amp; Reliability Services</div>
    <div>18, 2nd Street, MGR Nagar, Rathinapuri, Sanganoor, Coimbatore - 641 027, Tamil Nadu</div>
    <div>+91 93639 36420 | info@ppsystemss.com | www.primepowersystems.co | GSTIN: 33AAFFP5686C1Z9</div></div></div>
  <div class="r-rule"></div>
  <div class="r-title"><div><h3>OIL ANALYSIS REPORT – PARTICLE COUNT</h3><div class="sub">Offline Particle Counter | ISO 4406 • NAS 1638 • SAE AS4059</div></div><div class="form">Form PPS-F-05</div></div>
  <div class="r-meta"><div><b>REPORT NO.</b><span>${esc(S.reportNo)}</span></div><div><b>TEST DATE</b><span>${esc(dmy(S.testDate))}</span></div><div><b>SAMPLE DATE</b><span>${esc(dmy(S.sampleDate))}</span></div><div><b>TESTED BY</b><span>${esc(S.testedBy)}</span></div></div>

  <div class="r-sec"><em>01</em>CLIENT &amp; SAMPLE DETAILS</div>
  <div class="r-kv">
    <span class="k">Client Name</span><span class="v span3">${esc(S.client)}</span>
    <span class="k">Address</span><span class="v span3">${esc(S.address)}</span>
    <span class="k">Equipment / System</span><span class="v">${esc(S.equipment)}</span><span class="k">Sample ID</span><span class="v">${esc(S.sampleId)}</span>
    <span class="k">Oil Grade / Brand</span><span class="v">${esc(S.oilGrade)}</span><span class="k">Oil Quantity (L)</span><span class="v">${esc(S.oilQty)}</span>
    <span class="k">Sampling Point</span><span class="v">${esc(S.samplingPoint)}</span><span class="k">Hours in Service</span><span class="v">${esc(S.hours)}</span>
  </div>

  <div class="r-sec"><em>02</em>INSTRUMENT &amp; TEST CONDITIONS</div>
  <div class="r-kv">
    <span class="k">Particle Counter</span><span class="v">${esc(S.counter)}</span><span class="k">Sr. No.</span><span class="v">${esc(S.counterSr)}</span>
    <span class="k">Last Calibration</span><span class="v">${esc(dmy(S.calDate))}</span><span></span><span></span>
  </div>
  <div class="r-line">${cb(!!S.iso11171, 'Calibration: ISO 11171')}
    <span>Sample condition: ${cb(S.condition === 'clear', 'Clear')} ${cb(S.condition === 'hazy', 'Hazy')} ${cb(S.condition === 'water', 'Free water')}</span></div>

  <div class="r-sec"><em>03</em>PARTICLE COUNT RESULTS</div>
  <table class="r-t"><thead><tr><th>Particle Size</th><th>Before – Counts / ml</th><th>Before – Code</th><th>After – Counts / ml</th><th>After – Code</th></tr></thead><tbody>${rows}</tbody></table>

  <div class="r-sec"><em>04</em>CLEANLINESS SUMMARY</div>
  <table class="r-t"><thead><tr><th>Standard</th><th>Before</th><th>After</th><th>Target</th><th>${after ? 'Result (After)' : 'Result'}</th></tr></thead><tbody>
    <tr><td>ISO 4406 code (≥4/≥6/≥14 µm(c))</td><td class="hi">${isoCells(D.cB)}</td><td class="hi">${after ? isoCells(D.cA) : '___ / ___ / ___'}</td><td>${D.hasT ? D.tgt.join(' / ') : '___ / ___ / ___'}</td><td>${wr(D.isoAbove)}</td></tr>
    <tr><td>NAS 1638 class</td><td class="hi">${cell(S.nasB)}</td><td class="hi">${after ? cell(S.nasA) : ''}</td><td>${cell(S.tNas)}</td><td>${wr(D.nasAbove)}</td></tr>
    <tr><td>SAE AS4059 class</td><td>${cell(S.asB)}</td><td>${after ? cell(S.asA) : ''}</td><td>${cell(S.asT)}</td><td>${wr(D.asAbove)}</td></tr>
    <tr><td>Water saturation (%RH), if measured</td><td>${cell(S.rhB)}</td><td>${after ? cell(S.rhA) : ''}</td><td>${cell(S.rhT)}</td><td>${wr(D.rhAbove)}</td></tr>
  </tbody></table>
  ${verdictHTML(S, D)}
  <div class="r-targets-h">Typical target cleanliness, ISO 4406 (indicative – always follow the equipment OEM's recommendation)</div>
  <div class="r-targets">${Object.entries(TARGETS).filter(([k]) => k !== 'oem').map(([k, v]) => `<div class="${k === S.component ? 'sel' : ''}">${esc(v.label)}<b>${v.iso.join('/')}</b></div>`).join('')}</div>

  <div class="r-sec"><em>05</em>RECOMMENDATION</div>
  <div class="r-recs">${RECS.map(([k, l]) => cb(!!S.recs[k], k === 'retest' ? `Re-test after <b>${esc(tDays)}</b> days` : esc(l))).join('')}</div>
  <div class="r-obs"><b>OBSERVATIONS / IMPRESSION</b><p>${esc(S.obs)}</p></div>
  <div class="r-notes">${notes} Results relate only to the sample tested as received; sampling method and bottle cleanliness affect results.</div>
  <div class="r-sign"><div><b>Client Acknowledgement</b><div class="sl"><span>Name</span><span>${esc(S.clientSign)}</span></div><div class="sl sig"><span>Signature &amp; Seal</span><span></span></div></div>
    <div><b>Analysed By (Prime Power Systems)</b><div class="sl"><span>Name</span><span>${esc(S.analysedBy || S.testedBy)}</span></div><div class="sl sig"><span>Signature</span><span></span></div></div></div>
  <div class="r-foot">Prime Power Systems | 18, 2nd Street, MGR Nagar, Sanganoor, Coimbatore - 641 027 | +91 93639 36420 | info@ppsystemss.com</div>`;
  }

  /* ---------- preview scaling ---------- */
  let zoomed = false;
  function fitPreview() {
    const pane = $('previewPane'), wrap = $('pageWrap'), page = $('report');
    if (!pane.offsetWidth) return;
    const cs = getComputedStyle(pane);
    const avail = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const s = zoomed && phone() ? 1 : Math.max(0.1, Math.min(1, avail / pageWidth()));
    page.style.transform = `scale(${s})`;
    wrap.style.width = (pageWidth() * s) + 'px';
    wrap.style.height = (page.offsetHeight * s) + 'px';
  }
  if ('ResizeObserver' in window) new ResizeObserver(() => fitPreview()).observe($('previewPane'));
  else window.addEventListener('resize', fitPreview);
  $('zoomBtn').onclick = () => {
    zoomed = !zoomed;
    $('previewPane').classList.toggle('zoomed', zoomed);
    $('zoomBtn').setAttribute('aria-pressed', String(zoomed));
    $('zoomBtn').textContent = zoomed ? 'Fit to screen' : 'Zoom in';
    fitPreview();
  };

  /* ---------- saving ---------- */
  let saveTimer = null, saveChain = Promise.resolve(true), inFlight = 0, setTimer = null;
  function setSaveState(t, err) { const e = $('saveState'); e.textContent = t; e.classList.toggle('err', !!err); }
  function setServer(ok, keyMissing) {
    serverOk = ok; needKey = !!keyMissing;
    $('downTxt').innerHTML = needKey
      ? 'This phone needs the access link. Open the <b>full link shown in the laptop\'s black window</b> (it ends with <b>?key=…</b>). Your typing is kept.'
      : 'Can\'t reach the app server on the laptop, so changes are kept on this screen only. Start it again (double-click <b>start.bat</b> or run <b>python server.py</b>). Your typing is kept and saves by itself when the server is back.';
    $('downBar').hidden = ok || !store || store.kind !== 'server';
  }
  /* A copy of the open report in this browser, so nothing typed is lost if the phone kills the app.
     Pictures and signatures are far too big to rewrite on every keystroke, so they are kept
     under their own key and only rewritten when one of them actually changes. */
  let lastPics = null;
  function journal(dirty) {
    const rec = clone(S), pics = {};
    Object.keys(rec).forEach(k => { if (isPic(rec[k])) { pics[k] = rec[k]; delete rec[k]; } });
    const json = JSON.stringify(pics);
    try {
      LS.set('ppspc.draft', { rec, dirty, base: baseRevs, pics: Object.keys(pics).length > 0 });
      if (json !== lastPics) { LS.set('ppspc.draft.pics', pics); lastPics = json; }
    } catch (e) {
      /* Out of room: keep the typing safe and tell the user once. */
      try { LS.set('ppspc.draft', { rec, dirty, base: baseRevs, pics: false }); } catch (e2) { /* give up quietly */ }
      if (!journal.warned) { journal.warned = true; status('This device is short of space, so pictures may not be kept if the app closes. Save a backup and remove old reports.'); }
    }
  }

  function persist() {
    editRev++;
    journal(true);
    if (!canSave(S)) { setSaveState(needName()); return; }
    if (conflict) { setSaveState('Not saved', true); return; }
    setSaveState('Saving…');
    clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(), 600);
  }

  /* Saves are queued one after another, and each save carries a snapshot taken when it was asked for,
     so switching reports can never write one report's data into another. */
  function saveNow(opt) {
    clearTimeout(saveTimer); saveTimer = null;
    if (!S || !canSave(S) || !isDirty() || conflict || (queued.id === S.id && queued.rev === editRev)) return saveChain;
    const snap = clone(S), rev = editRev, id = S.id;
    snap.rev = newRev();
    if (baseRevs) {
      // baseRevs[0] is the last revision the store confirmed (or null for a report never stored):
      // it must always be sent, however many saves failed while offline
      snap._base = baseRevs.length > 50 ? [baseRevs[0], ...baseRevs.slice(-49)] : baseRevs.slice();
      baseRevs.push(snap.rev);
      journal(true); // this revision may reach the store even if the page dies before the reply
    }
    queued = { id, rev };
    const p = saveChain.then(() => doSave(snap, rev, id, opt));
    saveChain = p.catch(() => false);
    return p;
  }
  async function doSave(snap, rev, id, opt) {
    inFlight++;
    try {
      if (autoNo && S && S.id === id && !(opt && opt.keepalive)) {
        if (store.kind === 'server') { try { RECORDS = await store.list(); updateCount(); } catch (e) { /* the save below reports it */ } }
        const no = String(snap.reportNo || '').trim();
        if (RECORDS.some(r => r.id !== id && String(r.reportNo || '').trim() === no)) {
          snap.reportNo = C.nextReportNo(RECORDS, null);
          setField('reportNo', snap.reportNo); $('barNo').textContent = snap.reportNo;
          status(`Report number changed to ${snap.reportNo}: ${no} was already used.`);
        }
      }
      const res = await store.save(snap, opt) || {};
      delete snap._base;
      setServer(true);
      snap.updatedAt = res.updatedAt || snap.updatedAt;
      if (res.createdAt) snap.createdAt = res.createdAt;
      const i = RECORDS.findIndex(r => r.id === id);
      if (i >= 0) RECORDS[i] = snap; else RECORDS.unshift(snap);
      if (S && S.id === id) {
        S.updatedAt = snap.updatedAt; S.createdAt = snap.createdAt; S.rev = snap.rev;
        baseRevs = baseRevs ? baseRevs.slice(Math.max(0, baseRevs.indexOf(snap.rev))) : [snap.rev];
        if (rev > savedRev) savedRev = rev;
        if (!isDirty()) { journal(false); setSaveState('Saved ✓'); }
        if (autoNo) autoNo = false;
      }
      if (chan) chan.postMessage({ type: 'saved', id, rev: snap.rev });
      updateCount();
      return true;
    } catch (e) {
      if (S && S.id === id && queued.id === id && queued.rev === rev) queued = { id: null, rev: -1 };
      if (e && e.status === 409) {
        if (S && S.id === id) showConflict(e.reason, e.current);
        return false;
      }
      if (e && e.status === 401) { setServer(false, true); setSaveState('Not saved', true); return false; }
      const clientErr = e && e.status >= 400 && e.status < 500;
      if (store.kind === 'server' && !clientErr) setServer(false);
      setSaveState(clientErr ? 'Not saved: ' + e.message : 'Not saved', true);
      return false;
    } finally { inFlight--; }
  }

  /* ---------- someone else changed or deleted the open report ---------- */
  function showConflict(reason, current) {
    conflict = { reason, current };
    $('confTxt').textContent = reason === 'deleted'
      ? 'This report was deleted in another window or on another device. Your changes are not saved yet.'
      : 'This report was changed in another window or on another device after you opened it. Your changes are not saved yet.';
    $('confTheirs').textContent = reason === 'deleted' ? 'Close it' : 'Show the newer copy';
    $('confBar').hidden = false;
    setSaveState('Not saved', true);
  }
  function clearConflict() { conflict = null; $('confBar').hidden = true; }
  $('confMine').onclick = () => {
    clearConflict();
    baseRevs = null;           // save over the other copy on purpose
    queued = { id: null, rev: -1 };
    if (!isDirty()) editRev++; // e.g. deleted elsewhere with nothing new typed: it still has to be written back
    saveNow().then(ok => { if (ok) status('Your version is saved.'); });
  };
  $('confTheirs').onclick = () => {
    const c = conflict; clearConflict();
    if (!c) return;
    if (c.reason === 'deleted' || !c.current) { newReport(); status('Closed the deleted report.'); return; }
    show(normalise(c.current), false);
    status('Showing the newer copy.');
  };
  if (chan) chan.onmessage = async e => {
    const m = e.data || {};
    if (!store || (m.type !== 'saved' && m.type !== 'deleted')) return;
    await refreshRecords();
    if (S && S.id === m.id && !isDirty() && !conflict) {
      if (m.type === 'deleted') showConflict('deleted', null);
      else {
        const cur = await store.get(m.id).catch(() => null);
        if (cur && cur.rev !== S.rev) { show(normalise(cur), false, true); status('Updated with changes from another window.'); }
      }
    }
    if (!$('recView').hidden) renderRecords();
  };

  function saveSettings() {
    clearTimeout(setTimer); setTimer = null;
    if (!settingsDirty.size || !store) return;
    const keys = [...settingsDirty], payload = {};
    keys.forEach(k => { payload[k] = SETTINGS[k]; });
    settingsDirty.clear();
    store.saveSettings(payload).catch(() => {
      keys.forEach(k => settingsDirty.add(k));
      if (store.kind === 'server') setServer(false, needKey);
    });
  }
  function flush() {
    if (saveTimer) saveNow({ keepalive: true });
    if (setTimer) saveSettings();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else checkServer(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', e => {
    const pending = saveTimer || inFlight;
    flush();
    if (pending && store && store.kind === 'server' && !serverOk && canSave(S)) { e.preventDefault(); e.returnValue = ''; }
  });
  function updateCount() {
    const n = RECORDS.length || '';
    $('recN').textContent = n; $('recN2').textContent = n ? ' ' + n : '';
  }

  /* ---------- form input ---------- */
  function loadInputs() {
    if (!S) return;
    ensureForm(reportOf(S));
    document.querySelectorAll('#form [data-k]').forEach(el => {
      const k = el.dataset.k, v = S[k];
      if (el.type === 'radio') el.checked = v === el.value;
      else if (el.type === 'checkbox') el.checked = !!v;
      else {
        const val = v == null ? '' : String(v);
        if (el.tagName === 'SELECT' && val && ![...el.options].some(o => o.value === val)) {
          const o = document.createElement('option'); o.value = val; o.textContent = val; el.appendChild(o);
        }
        el.value = val;
      }
    });
    F.sync($('formGeneric'), S);
    prevComp = TARGETS[S.component] && TARGETS[S.component].iso ? S.component : null;
    $('undoObs').hidden = true; obsUndo = null;
  }
  /* Signature and photo slots are not <input>s: they are handled here. */
  $('form').addEventListener('click', async e => {
    const el = e.target.closest('[data-sig],[data-sigclear],[data-img],[data-imgclear]');
    if (!el || !S) return;
    const openSig = el.dataset.sig, clearSig = el.dataset.sigclear;
    const openImg = el.dataset.img, clearImg = el.dataset.imgclear;
    if (clearSig) {
      S[clearSig] = ''; F.sync($('formGeneric'), S); render(); persist(); return;
    }
    if (clearImg) {
      S[clearImg] = ''; F.sync($('formGeneric'), S); render(); persist(); return;
    }
    if (openSig) {
      const fld = el.closest('.fld'), lab = fld && fld.querySelector('.fl');
      Sig.open({
        title: lab ? lab.textContent.replace(/\s*—.*$/, '') : 'Sign here',
        value: S[openSig] || '',
        onDone: (data, opt) => {
          S[openSig] = data;
          if (opt && opt.remember) Sig.remember(data);
          loadInputs(); render(); persist();
        }
      });
      return;
    }
    if (openImg) {
      try {
        const data = await Photo.pick(el.dataset.img);
        const total = Object.keys(S).reduce((n, k) => n + (isPic(S[k]) ? S[k].length : 0), 0) + data.length;
        if (total > 3.2e6 && !confirm('This report is getting large (about ' + Math.round(total / 1e6 * 0.75) + ' MB of pictures).\n\nLarge reports are slower to save, back up and send. Add it anyway?')) return;
        S[openImg] = data;
        loadInputs(); render(); persist();
      } catch (err) {
        if (err && err.message && err.message !== 'no file') status(err.message);
      }
    }
  });
  const setField = (k, v) => { S[k] = v; const el = document.querySelector(`[data-k="${k}"]`); if (el) el.value = v; };
  function onField(e) {
    if (!S) return;
    const el = e.target;
    if (el.dataset.rec) {
      const k = el.dataset.rec;
      if (!S.recAuto && !!S.recs[k] === el.checked) return;
      S.recs = Object.assign({}, S.recs, { [k]: el.checked }); S.recAuto = false;
      render(); persist(); return;
    }
    const k = el.dataset.k; if (!k) return;
    let v;
    if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
    else if (el.type === 'checkbox') v = el.checked;
    else v = el.value;
    if (S[k] === v) return; // the 'change' that follows 'input' carries the same value
    const old = S[k];
    S[k] = v;
    // counter, calibration and names are remembered for the next report, but only when typed here
    if (el.hasAttribute('data-keep')) {
      SETTINGS[k] = v; settingsDirty.add(k);
      clearTimeout(setTimer); setTimer = setTimeout(saveSettings, 800);
    }
    if (k === 'reportNo') autoNo = false;
    if (k === 'retestDays') S.retestManual = String(v).trim() !== '';
    if (k === 'obs') { $('undoObs').hidden = true; obsUndo = null; }
    if (k === 'component') {
      if (TARGETS[v] && TARGETS[v].iso) {
        const t = TARGETS[v];
        ['t4', 't6', 't14'].forEach((x, i) => setField(x, String(t.iso[i])));
        setField('tNas', String(t.nas)); prevComp = v;
      } else if (v === 'oem') {
        if (TARGETS[old] && TARGETS[old].iso) prevComp = old;
        ['t4', 't6', 't14', 'tNas'].forEach(x => setField(x, ''));
      }
    }
    if (['t4', 't6', 't14'].includes(k)) {
      const typed = [S.t4, S.t6, S.t14].map(x => String(x).trim()).join('/');
      const matches = c => !!(c && TARGETS[c] && TARGETS[c].iso && TARGETS[c].iso.join('/') === typed);
      if (S.component !== 'oem' && !matches(S.component)) {
        prevComp = S.component; S.component = 'oem';
        if (TARGETS[prevComp] && String(S.tNas).trim() === String(TARGETS[prevComp].nas)) setField('tNas', '');
      } else if (S.component === 'oem' && matches(prevComp)) {
        S.component = prevComp;
        if (!String(S.tNas || '').trim()) setField('tNas', String(TARGETS[prevComp].nas));
      }
      $('compSel').value = S.component;
    }
    render(); persist();
  }
  $('form').addEventListener('input', onField);
  $('form').addEventListener('change', onField);
  // Enter in a count moves down the same column (Before, then After)
  $('countRows').addEventListener('keydown', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (e.key !== 'Enter' || !k) return;
    e.preventDefault();
    const side = k.slice(-1), i = SIZES.findIndex(([s]) => s + side === k);
    const nextK = SIZES[i + 1] ? SIZES[i + 1][0] + side : (side === 'B' && S.mode === 'after' ? 'c4A' : 'nasB');
    const next = document.querySelector(`[data-k="${nextK}"]`);
    if (next) next.focus();
  });
  $('recReset').onclick = () => { S.recAuto = true; S.retestManual = false; S.retestDays = ''; render(); persist(); };

  let obsUndo = null, obsArm = null;
  $('draftBtn').onclick = () => {
    if (!S) return;
    const b = $('draftBtn');
    const text = C.draftObs(S, derive(S));
    if (text == null) { status('Enter the ≥4, ≥6 and ≥14 counts first.'); return; }
    const cur = String(S.obs || '').trim();
    const ownText = cur !== '' && cur !== String(S.obsAuto || '').trim();
    if (ownText && !b.classList.contains('arm')) {
      b.classList.add('arm'); b.textContent = `Replace what you typed? ${TAP} again`;
      obsArm = setTimeout(() => { b.classList.remove('arm'); b.textContent = DRAFT_LABEL; }, 4000);
      return;
    }
    clearTimeout(obsArm); b.classList.remove('arm'); b.textContent = DRAFT_LABEL;
    obsUndo = cur ? S.obs : null;
    S.obs = text; S.obsAuto = text; $('obsBox').value = text;
    $('undoObs').hidden = obsUndo == null;
    render(); persist();
  };
  $('undoObs').onclick = () => {
    if (obsUndo == null) return;
    S.obs = obsUndo; obsUndo = null; $('obsBox').value = S.obs; $('undoObs').hidden = true;
    render(); persist();
  };

  /* ---------- views: Enter / Report / Records / New ---------- */
  let lastMainView = 'form', curView = 'form';
  const scrollPos = {};
  function setView(v) {
    if (phone()) scrollPos[curView] = window.scrollY;
    if (zoomed && v !== 'preview') $('zoomBtn').click();
    const rec = v === 'records', pick = v === 'pick';
    $('recView').hidden = !rec;
    $('pickView').hidden = !pick;
    document.body.classList.toggle('show-rec', rec);
    document.body.classList.toggle('show-pick', pick);
    if (!rec && !pick) { lastMainView = v; $('main').dataset.view = v; }
    curView = v;
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
    if (rec) renderRecords(); else if (!pick) requestAnimationFrame(fitPreview);
    if (phone()) window.scrollTo(0, scrollPos[v] || 0);
  }
  function toFormTop() {
    scrollPos.form = 0;
    if (phone()) window.scrollTo(0, 0); else $('form').scrollTop = 0;
  }
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => (b.dataset.view === 'records' ? openRecordsView() : setView(b.dataset.view)); });
  $('pkClose').onclick = () => setView(lastMainView);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (Sig.isOpen()) return;
    if (!$('pickView').hidden) setView(lastMainView);
    else if (!$('recView').hidden) setView(lastMainView);
  });
  async function refreshRecords() {
    try { RECORDS = await store.list(); if (store.kind === 'server') setServer(true); updateCount(); }
    catch (e) { if (store.kind === 'server') setServer(false, e && e.status === 401); }
  }
  async function openRecordsView() {
    if (!S) return;
    await saveNow();
    await refreshRecords();
    setView('records');
    updateNag();
    if (!TOUCH) $('rvSearch').focus();
  }
  $('recBtn').onclick = openRecordsView;
  $('rvClose').onclick = () => setView(lastMainView);

  /* ---------- open / new ---------- */
  function show(rec, fresh, keepView) {
    S = rec; editRev = 0; savedRev = 0; queued = { id: null, rev: -1 };
    baseRevs = [S.rev == null ? null : S.rev];
    clearConflict();
    LS.set('ppspc.currentId', S.id); LS.set('ppspc.lastType', reportOf(S).id); LS.del('ppspc.draft');
    builtType = null;                       // the next kind of report builds its own entry screen
    loadInputs(); render();
    setSaveState(fresh ? needName() : 'Saved ✓');
    if (!keepView) { setView('form'); toFormTop(); }
  }
  function newReport(type, keepType) {
    const id = R.get(type) ? type : (keepType && S ? reportOf(S).id : 'particle');
    const def = R.get(id);
    const r = normalise(Object.assign(blankReport(id), { id: newId(), type: id }));
    if (def.id === 'particle') Object.assign(r, KEEP_DEFAULTS, pickKeep(SETTINGS));
    r.reportNo = C.nextReportNo(RECORDS, null);
    autoNo = true;
    show(r, true);
    return def;
  }
  /* Open the chooser, or go straight to a report kind the caller already knows. */
  async function chooseReport(type) {
    if (type) { newReport(type); return true; }
    if (!(await leaveCurrent())) return false;
    setView('pick');
    return false;
  }
  /* Before leaving the open report, make sure it is stored */
  async function leaveCurrent() {
    if (conflict) { status('First choose what to do in the bar at the top: keep your version or show the other one.'); return false; }
    const ok = await saveNow();
    if (ok === false && canSave(S) && isDirty()) {
      status("Couldn't save the open report, so it stays open. " + (store.kind === 'server' ? 'Start the server and try again.' : 'Free some space and try again.'));
      return false;
    }
    return true;
  }
  async function openRecord(id, discard) {
    if (!discard && !canSave(S) && editRev > 0) {
      status('The report you started has no client name, so it is not saved.', { label: 'Discard it and open', run: () => openRecord(id, true) });
      return;
    }
    if (!(await leaveCurrent())) return;
    const rec = RECORDS.find(r => r.id === id); if (!rec) return;
    autoNo = false;
    show(normalise(rec), false);
  }
  async function startNew(type) {
    if (!(await leaveCurrent())) return false;
    const def = newReport(type, true);
    if (!TOUCH) { const c = document.querySelector('#formParticle [data-k="client"], #formGeneric [data-k="client"], #formGeneric [data-k="customer"], #formGeneric [data-k="company"]'); c && c.focus(); }
    return def;
  }
  let armTimer = null; const newBtn = $('newBtn');
  function disarmNew() { clearTimeout(armTimer); newBtn.classList.remove('warn'); newBtn.textContent = 'New report'; }
  newBtn.onclick = async () => {
    if (!S) return;
    const typed = canSave(S) || editRev > 0;
    if (typed && !newBtn.classList.contains('warn')) {
      newBtn.classList.add('warn');
      newBtn.textContent = canSave(S) ? `${TAP} again for new` : `Discard? ${TAP} again`;
      armTimer = setTimeout(disarmNew, 3000);
      return;
    }
    disarmNew();
    const saved = canSave(S);
    if (await chooseReport()) status(saved ? 'Current report saved. New report started.' : 'New report started.');
  };

  /* ---------- records view ---------- */
  let rvFilter = 'All', rvSort = 'date-desc';
  $('rvSearch').oninput = renderRecords;
  $('rvSort').onchange = e => { rvSort = e.target.value; renderRecords(); };
  document.querySelectorAll('table.rt th[data-s]').forEach(th => {
    th.onclick = () => {
      const map = { no: ['no-desc', 'no-asc'], date: ['date-desc', 'date-asc'], client: ['client-asc', 'client-desc'], status: ['status', 'status'], next: ['next-asc', 'next-desc'] };
      const [a, b] = map[th.dataset.s]; rvSort = rvSort === a ? b : a;
      $('rvSort').value = rvSort;
      renderRecords();
    };
  });
  function summary(r) {
    if (reportOf(r).id !== 'particle') return {};
    const D = derive(Object.assign({}, BLANK, r));
    return {
      iso: isoStr(D.cB), after: r.mode === 'after' ? isoStr(D.cA) : '',
      verdict: D.verdict || '',
      ratio: D.worst && D.isoAbove ? fmtRatio(D.worst.r) : '',
      fails: D.fails.filter(f => f.std !== 'ISO 4406').map(f => f.std.replace('Water saturation', 'Water')).join(', ')
    };
  }
  const rdate = r => summaryOf(r).date || '';
  const rno = r => summaryOf(r).no || '';
  const rclient = r => String(summaryOf(r).client || '');
  const SORTERS = {
    'date-desc': (a, b) => cmp(rdate(b), rdate(a)) || cmp(C.reportKey(rno(b)), C.reportKey(rno(a))),
    'date-asc': (a, b) => cmp(rdate(a), rdate(b)) || cmp(C.reportKey(rno(a)), C.reportKey(rno(b))),
    'client-asc': (a, b) => cmp(rclient(a).toLowerCase(), rclient(b).toLowerCase()) || cmp(rdate(b), rdate(a)),
    'client-desc': (a, b) => cmp(rclient(b).toLowerCase(), rclient(a).toLowerCase()) || cmp(rdate(b), rdate(a)),
    'next-asc': (a, b) => cmp(a.nextDate || '9999', b.nextDate || '9999'),
    'next-desc': (a, b) => cmp(b.nextDate || '', a.nextDate || ''),
    'status': (a, b) => cmp(STATUSES.indexOf(a.status), STATUSES.indexOf(b.status)) || cmp(rdate(b), rdate(a)),
    'no-desc': (a, b) => cmp(C.reportKey(rno(b)), C.reportKey(rno(a))) || cmp(rno(b), rno(a)),
    'no-asc': (a, b) => cmp(C.reportKey(rno(a)), C.reportKey(rno(b))) || cmp(rno(a), rno(b))
  };
  function renderRecords() {
    const q = $('rvSearch').value.trim().toLowerCase();
    const ALL = STATUSES.concat(SERVICE_STATUSES);
    const counts = { All: RECORDS.length }; ALL.forEach(s => { counts[s] = 0; });
    RECORDS.forEach(r => { if (counts[r.status] != null) counts[r.status]++; });
    const used = ALL.filter(s => counts[s] > 0 || STATUSES.includes(s));
    $('rvChips').innerHTML = ['All', ...used].map(s => `<button type="button" class="chip" data-f="${esc(s)}" aria-pressed="${rvFilter === s}">${esc(s)}<span>${counts[s] || 0}</span></button>`).join('');
    $('rvChips').querySelectorAll('.chip').forEach(c => { c.onclick = () => { rvFilter = c.dataset.f; renderRecords(); }; });
    const list = RECORDS.filter(r => (rvFilter === 'All' || r.status === rvFilter) &&
      (!q || Object.values(summaryOf(r)).concat([r.nextStep, r.address, r.phone, r.email, r.oilGrade])
        .map(x => String(x == null ? '' : x)).join(' ').toLowerCase().includes(q)));
    list.sort(SORTERS[rvSort] || SORTERS['date-desc']);
    const sortKey = rvSort.split('-')[0];
    document.querySelectorAll('table.rt th[data-s]').forEach(th => {
      th.classList.toggle('on', th.dataset.s === sortKey);
      th.classList.toggle('asc', /-asc$/.test(rvSort));
    });
    $('rvTotal').textContent = `(${RECORDS.length})`;
    $('rvWhere').textContent = store.kind === 'server' ? 'Saved in the database on the laptop.' : 'Saved on this device only. Use “Backup file” to keep a copy somewhere safe.';
    const t = today();
    const nextHTML = r => (r.nextDate ? `<span class="${r.nextDate < t && !['Won', 'Lost'].includes(r.status) ? 'overdue' : ''}">${esc(dmy(r.nextDate))}</span>` : '');
    const stClass = r => 'st st-' + String(r.status || '').replace(/[^A-Za-z]/g, '');
    const btns = '<button type="button" class="rowbtn" data-act="open">Open</button><button type="button" class="rowbtn del" data-act="del">Delete</button>';
    const views = list.map(r => [r, summary(r), summaryOf(r)]);
    const pill = v => (v.verdict ? `<span class="pill ${v.verdict}">${v.verdict === 'above' ? 'Above target' : 'Within target'}</span>` : '');
    const isoTxt = v => (v.iso ? 'ISO ' + v.iso + (v.after ? ' → ' + v.after : '') : '');
    const nasTxt = r => (r.nasB ? `NAS ${esc(r.nasB)}${r.mode === 'after' && r.nasA ? ' → ' + esc(r.nasA) : ''}` : '');
    const why = v => (v.ratio ? `${v.ratio}× allowed` : '') + (v.fails ? `${v.ratio ? '; ' : ''}${esc(v.fails)} above` : '');
    const resultCell = ([r, v, L]) => {
      if (reportOf(r).id !== 'particle') return `${r.line ? esc(r.line) : esc(L.detail)}`;
      return `${esc(isoTxt(v))}${nasTxt(r) ? `<small>${nasTxt(r)}</small>` : ''}`;
    };
    const verdictCell = ([r, v, L]) => {
      if (reportOf(r).id !== 'particle') return '';
      return `${pill(v)}${why(v) ? `<small>${why(v)}</small>` : ''}`;
    };
    $('rvBody').innerHTML = views.map(x => { const [r, , L] = x; return `<tr data-id="${esc(r.id)}">
      <td>${esc(L.no)}${r.id === S.id ? '<small>Open now</small>' : ''}</td>
      <td>${esc(dmy(L.date))}</td>
      <td><b>${esc(L.client)}</b><small>${esc([L.type, r.contactName].filter(Boolean).join(' · '))}</small></td>
      <td>${esc(L.detail)}</td>
      <td>${resultCell(x)}</td>
      <td>${verdictCell(x)}</td>
      <td><span class="${stClass(r)}">${esc(r.status || '')}</span></td>
      <td>${nextHTML(r)}<small>${esc(r.nextStep || '')}</small></td>
      <td style="white-space:nowrap">${btns}</td></tr>`; }).join('');
    $('rvCards').innerHTML = views.map(([r, v]) => `<li class="card" data-id="${esc(r.id)}">
      <div class="top"><div><b>${esc(r.client || '(no client)')}</b><div class="meta">${esc(r.reportNo)}${r.testDate ? ' · ' + esc(dmy(r.testDate)) : ''}${r.id === S.id ? ' · open now' : ''}</div></div>${pill(v)}</div>
      <div class="mid">${r.equipment ? `<span>${esc(r.equipment)}</span>` : ''}${v.iso ? `<span>${esc(isoTxt(v))}</span>` : ''}${nasTxt(r) ? `<span>${nasTxt(r)}</span>` : ''}${why(v) ? `<span>${why(v)}</span>` : ''}</div>
      ${r.contactName || r.phone ? `<small>${esc([r.contactName, r.phone].filter(Boolean).join(' · '))}</small>` : ''}
      ${r.nextDate || r.nextStep ? `<small>Next: ${nextHTML(r)} ${esc(r.nextStep || '')}</small>` : ''}
      <div class="foot"><span class="${stClass(r)}">${esc(r.status || '')}</span><span>${btns}</span></div></li>`).join('');
    const empty = $('rvEmpty');
    empty.hidden = list.length > 0;
    empty.textContent = RECORDS.length ? 'No records match this search or filter.' : 'No records yet. Start a report and type a client name; it saves here automatically.';
  }
  async function onRecordClick(e) {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const rec = RECORDS.find(r => r.id === row.dataset.id); if (!rec) return;
    const btn = e.target.closest('[data-act]');
    if (btn && btn.dataset.act === 'del') {
      if (!btn.classList.contains('arm')) {
        btn.classList.add('arm'); btn.textContent = 'Confirm delete'; btn.dataset.armedAt = String(Date.now());
        setTimeout(() => { if (btn.isConnected) { btn.classList.remove('arm'); btn.textContent = 'Delete'; } }, 3000);
        return;
      }
      // a double-click or double-tap is not a confirmation
      if (e.detail > 1 || Date.now() - Number(btn.dataset.armedAt || 0) < 450) return;
      try {
        if (S.id === rec.id) { clearTimeout(saveTimer); saveTimer = null; await saveChain; }
        const copy = RECORDS.find(r => r.id === rec.id) || rec;
        await store.del(rec.id);
        RECORDS = RECORDS.filter(r => r.id !== rec.id); updateCount();
        if (chan) chan.postMessage({ type: 'deleted', id: rec.id });
        if (S.id === rec.id) { newReport(); setView('records'); }
        renderRecords(); updateNag();
        status(`Deleted ${copy.client || 'the record'}.`, {
          label: 'Undo',
          run: async () => {
            try {
              await store.importData({ records: [copy], settings: {} });
              await refreshRecords();
              if (autoNo && !canSave(S)) { S.reportNo = C.nextReportNo(RECORDS, null); loadInputs(); render(); }
              renderRecords(); updateNag(); status('Record restored.');
            } catch (err) { status('Could not restore: ' + (err.message || 'error')); }
          }
        });
      } catch (err) { if (store.kind === 'server') setServer(false, err && err.status === 401); status('Could not delete: ' + (err.message || 'error')); }
      return;
    }
    await openRecord(rec.id);
  }
  $('rvBody').addEventListener('click', onRecordClick);
  $('rvCards').addEventListener('click', onRecordClick);

  /* ---------- files: PDF, CSV, backup (share sheet on phones, download on computers) ---------- */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 60000);
  }
  let pendingShare = null;
  async function deliverFile(blob, name, title) {
    let file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { /* very old browser */ }
    if (TOUCH && file && navigator.share && navigator.canShare) {
      let can = false; try { can = navigator.canShare({ files: [file] }); } catch (e) { /* ignore */ }
      if (can) {
        try { await navigator.share({ files: [file], title }); return 'shared'; }
        catch (e) {
          if (e && e.name === 'AbortError') return 'cancelled';
          // iPhone wants a fresh tap when making the file took a moment: offer a button
          pendingShare = { file, blob, name, title };
          $('shareTxt').textContent = name.endsWith('.pdf') ? 'Your PDF is ready.' : 'Your file is ready.';
          $('shareSheet').hidden = false; $('shareGo').focus();
          return 'sheet';
        }
      }
    }
    download(blob, name);
    return 'downloaded';
  }
  $('shareGo').onclick = async () => {
    const p = pendingShare; $('shareSheet').hidden = true; pendingShare = null; if (!p) return;
    try { await navigator.share({ files: [p.file], title: p.title }); status('Shared.'); }
    catch (e) { if (!e || e.name !== 'AbortError') { download(p.blob, p.name); status('Saved to Downloads.'); } }
  };
  $('shareX').onclick = () => { $('shareSheet').hidden = true; pendingShare = null; };
  const doneMsg = (how, what) => ({ shared: `${what} shared.`, cancelled: '', sheet: '', downloaded: TOUCH ? `${what} downloaded.` : `${what} saved to your Downloads folder.` }[how] || '');

  function waitImages(root) {
    return Promise.all([...root.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth ? null :
      new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000); }))));
  }
  async function makePdf() {
    if (!window.html2canvas || !window.jspdf) throw new Error('PDF library not loaded');
    const def = reportOf(S);
    const land = def.orientation === 'l';
    const holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${land ? 1123 : 794}px;pointer-events:none;`;
    const page = $('report').cloneNode(true);
    page.removeAttribute('id'); page.style.transform = 'none'; page.style.boxShadow = 'none';
    holder.appendChild(page); document.body.appendChild(holder);
    try {
      await waitImages(page);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = await window.html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 1400 });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'l' : 'p', compress: true });
      const pw = land ? 297 : 210, ph = land ? 210 : 297;
      let w = pw, h = canvas.height * pw / canvas.width, x = 0, y = 0;
      if (h > ph) { w = ph * canvas.width / canvas.height; h = ph; x = (pw - w) / 2; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h);
      pdf.setProperties({ title: `${def.name} ${S.reportNo || ''}`.trim(), author: 'Prime Power Systems', subject: summaryOf(S).client || '' });
      return pdf.output('blob');
    } finally { holder.remove(); }
  }
  $('pdfBtn').onclick = async () => {
    const btn = $('pdfBtn'); if (btn.disabled || !S) return;
    btn.disabled = true; btn.textContent = 'Making PDF…';
    try {
      saveNow();
      const def = reportOf(S);
      const blob = await makePdf();
      const name = `PPS_${def.short.replace(/[^A-Za-z0-9]+/g, '')}_${safeName(summaryOf(S).client) || 'Client'}_${safeName(S.reportNo) || 'Report'}.pdf`;
      const how = await deliverFile(blob, name, def.name);
      const m = doneMsg(how, 'PDF'); if (m) status(m);
    } catch (e) {
      status('Could not build the PDF. Opening print instead: choose "Save as PDF".');
      setTimeout(() => window.print(), 300);
    } finally { btn.disabled = false; btn.textContent = PDF_LABEL; }
  };

  // ISO codes are written "ISO 16/12/9" so Excel doesn't turn them into dates
  const isoCsv = s => (s ? 'ISO ' + s : '');
  const nasCsv = v => (String(v == null ? '' : v).trim() ? 'NAS ' + String(v).trim() : '');
  const CSV_COLS = [['Report no', 'reportNo'], ['Test date', 'testDate'], ['Sample date', 'sampleDate'], ['Client', 'client'], ['Address', 'address'], ['Contact', 'contactName'], ['Designation', 'designation'], ['Mobile', 'phone'], ['Email', 'email'], ['Industry', 'industry'], ['Lead source', 'leadSource'], ['Equipment', 'equipment'], ['Machine make', 'machineMake'], ['Oil grade', 'oilGrade'], ['Oil qty (L)', 'oilQty'], ['Hours in service', 'hours'], ['Sampling point', 'samplingPoint'], ['Sample condition', 'condition'],
    ['ISO before', x => isoCsv(summary(x).iso)], ['NAS before', x => nasCsv(x.nasB)],
    ['ISO after', x => isoCsv(summary(x).after)], ['NAS after', x => (x.mode === 'after' ? nasCsv(x.nasA) : '')],
    ['Result', x => { const v = summary(x); return v.verdict === 'above' ? 'Above target' : v.verdict === 'within' ? 'Within target' : ''; }],
    ['Target ISO', x => ([x.t4, x.t6, x.t14].every(t => String(t == null ? '' : t).trim() !== '') ? 'ISO ' + [x.t4, x.t6, x.t14].join('/') : '')],
    ['Critical component', x => (TARGETS[x.component] || {}).label || ''],
    ['Power packs in plant', 'totalPacks'], ['Total oil (L)', 'totalOil'], ['Oil change interval', 'changeInterval'], ['Last oil change', 'lastChange'], ['Yearly oil spend', 'oilSpend'], ['Current filtration', 'filtration'], ['Problems', 'problems'], ['Decision maker', 'decisionMaker'], ['Status', 'status'], ['Next step', 'nextStep'], ['Next step date', 'nextDate'], ['Observations', 'obs']];
  /* Every other report kind adds its own columns, so one spreadsheet holds all the forms.
     Labels come from the entry screen; pictures are noted, never pasted in as text. */
  function extraCsvCols() {
    const cols = [], seen = new Set();
    R.all().forEach(def => {
      if (def.id === 'particle') return;
      const labels = {};
      (def.sections || []).forEach(s => (s.fields || []).forEach(f => { if (f.k && f.l) labels[f.k] = f.l; }));
      const blank = def.blank();
      const prefix = def.short + ' – ';
      Object.keys(blank).forEach(k => {
        if (seen.has(k) || k === 'recs' || k === 'obsAuto' || k === 'type') return;
        seen.add(k);
        const label = prefix + (labels[k] || k);
        cols.push([label, x => (isPic(x[k]) ? (x[k] ? '[picture attached]' : '') : (typeof x[k] === 'boolean' ? (x[k] ? 'Yes' : '') : x[k]))]);
      });
    });
    return cols;
  }
  const ALL_CSV_COLS = CSV_COLS.concat(extraCsvCols());
  $('csvBtn').onclick = async () => {
    if (!RECORDS.length) { status('No records to export yet.'); return; }
    const rows = [...RECORDS].sort((a, b) => cmp(summaryOf(a).date || '', summaryOf(b).date || ''));
    const csv = '\ufeff' + [ALL_CSV_COLS.map(c => C.csvCell(c[0])).join(','),
      ...rows.map(x => ALL_CSV_COLS.map(([, f]) => C.csvCell(typeof f === 'function' ? f(x) : x[f])).join(','))].join('\r\n');
    const how = await deliverFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `PPS_records_${today()}.csv`, 'PPS records');
    const m = doneMsg(how, 'CSV'); if (m) status(m + ' Open it in Excel.');
  };

  /* ---------- backup and restore (moves records between phone and laptop) ---------- */
  async function exportBackup() {
    await saveNow();
    try {
      const [records, settings] = await Promise.all([store.list(), store.settings()]);
      const data = { app: 'PPS Field Report Creator', format: 1, exportedAt: C.stamp(), from: store.kind, records, settings: pickSettings(settings) };
      const how = await deliverFile(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `PPS_backup_${today()}_${records.length}rec.json`, 'PPS records backup');
      if (how !== 'cancelled') { LS.set('ppspc.lastBackup', today()); updateNag(); }
      const m = doneMsg(how, 'Backup'); if (m) status(m);
    } catch (e) { status('Backup failed: ' + (e.message || 'error')); }
  }
  $('jsonBtn').onclick = exportBackup;
  $('bkNagBtn').onclick = exportBackup;
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onerror = () => status('Could not read that file.');
    rd.onload = async () => {
      try {
        const data = C.parseBackup(String(rd.result || ''));
        if (!(await leaveCurrent())) return;
        const res = await store.importData({ records: data.records, settings: pickSettings(data.settings) });
        await refreshRecords();
        try { SETTINGS = Object.assign({}, SETTINGS_DEFAULTS, pickSettings(await store.settings())); } catch (x) { /* keep current */ }
        // if the open report was replaced by a newer copy, show the newer copy
        const fresh = RECORDS.find(r => r.id === S.id);
        if (fresh && !isDirty() && String(fresh.updatedAt || '') > String(S.updatedAt || '')) show(normalise(fresh), false, true);
        renderRecords();
        const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
        status(`Imported: ${n(res.added, 'new record', 'new records')}, ${res.updated} updated, ${res.skipped} already up to date${res.invalid ? `, ${n(res.invalid, 'damaged entry', 'damaged entries')} skipped` : ''}.`);
      } catch (err) { status(err.message || 'Import failed.'); }
    };
    rd.readAsText(f);
  };
  function updateNag() {
    const local = store && store.kind === 'local';
    const last = LS.get('ppspc.lastBackup', null);
    const days = last ? Math.round((Date.parse(today()) - Date.parse(last)) / 864e5) : null;
    const due = local && RECORDS.length > 0 && (days == null || days >= 7);
    $('bkNag').hidden = !due;
    if (due) $('bkNagTxt').textContent = (days == null ? 'No backup yet. ' : `Last backup ${days} days ago. `) +
      'These records are stored only on this device: save a backup file to Files, Google Drive, email or WhatsApp.';
    [$('recBtn'), document.querySelector('.tab[data-view="records"]')].forEach(b => {
      const dot = b.querySelector('.dot');
      if (due && !dot) b.insertAdjacentHTML('beforeend', '<span class="dot" title="Backup due"></span>');
      if (!due && dot) dot.remove();
    });
    $('bkBtn').hidden = !(store && store.kind === 'server');
  }

  /* ---------- server health (laptop mode) ---------- */
  let checking = false;
  async function checkServer() {
    if (!store || store.kind !== 'server' || checking) return;
    checking = true;
    try {
      const p = await store.ping();
      if (!p.auth) { setServer(false, true); return; }
      const wasDown = !serverOk;
      setServer(true);
      if (wasDown) await reconnect();
    } catch (e) { setServer(false); }
    finally { checking = false; }
  }
  async function reconnect() {
    try {
      const [recs, settings] = await Promise.all([store.list(), store.settings()]);
      RECORDS = recs;
      const mine = {}; settingsDirty.forEach(k => { mine[k] = SETTINGS[k]; });
      SETTINGS = Object.assign({}, SETTINGS_DEFAULTS, pickSettings(settings), mine);
      updateCount();
    } catch (e) { setServer(false, e && e.status === 401); return; }
    const taken = no => RECORDS.some(r => r.id !== S.id && String(r.reportNo || '').trim() === String(no || '').trim());
    if (autoNo && (!canSave(S) || taken(S.reportNo))) { S.reportNo = C.nextReportNo(RECORDS, null); loadInputs(); }
    render();
    if (settingsDirty.size) saveSettings();
    if (isDirty() && canSave(S)) { queued = { id: null, rev: -1 }; saveNow(); }
    if (!$('recView').hidden) renderRecords();
    status('Connected to the laptop again.');
  }
  $('retryBtn').onclick = checkServer;
  window.addEventListener('online', checkServer);

  /* ---------- offline app (hosted / iPhone) ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false, userAsked = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if ((!hadController && !userAsked) || reloading) return;
      reloading = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const waiting = () => { if (reg.waiting && navigator.serviceWorker.controller) $('updBar').hidden = false; };
      waiting();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') waiting(); });
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      $('updBtn').onclick = async () => {
        await saveNow();
        userAsked = true;
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
      };
    }).catch(() => { /* offline support is a bonus; the app still works */ });
  }
  function unregisterSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  }

  /* ---------- start ---------- */
  (async function boot() {
    let picked;
    try { picked = await window.PPSStore.pickStore(KEY); }
    catch (e) { picked = { store: await window.PPSStore.FallbackStore.open(), online: true }; }
    store = picked.store;
    if (picked.degraded) $('banners').insertAdjacentHTML('afterbegin', '<div class="banner down">This phone\'s app storage could not be opened, so saved records are not shown. Close the app completely (swipe it away) and open it again. What you type now is kept and merged back afterwards.</div>');
    if (picked.online) {
      try {
        const [recs, settings] = await Promise.all([store.list(), store.settings()]);
        RECORDS = recs; SETTINGS = Object.assign({}, SETTINGS_DEFAULTS, pickSettings(settings)); setServer(true);
      } catch (e) { setServer(false, e && e.status === 401); }
    } else setServer(false, picked.needKey);

    const draft = LS.get('ppspc.draft', null);
    const cur = LS.get('ppspc.currentId', null);
    const rec = cur && RECORDS.find(r => r.id === cur);
    if (draft && draft.dirty && draft.rec && typeof draft.rec === 'object' && C.validId(draft.rec.id)) {
      /* pictures and signatures travel in their own key, so typing stays fast */
      if (draft.pics) Object.assign(draft.rec, LS.get('ppspc.draft.pics', {}) || {});
      S = normalise(draft.rec); editRev = 1; savedRev = 0;
      baseRevs = Array.isArray(draft.base) ? draft.base : [S.rev == null ? null : S.rev];
      loadInputs(); render();
      if (canSave(S)) { setSaveState('Saving…'); saveNow(); status('Unsaved changes were recovered.'); }
      else setSaveState('Add ' + (reportOf(S).id === 'particle' ? 'client name' : 'a customer name') + ' to save');
    } else if (rec) {
      S = normalise(rec); baseRevs = [S.rev == null ? null : S.rev];
      loadInputs(); render(); setSaveState('Saved ✓');
    } else {
      const lastType = LS.get('ppspc.lastType', 'particle');
      S = normalise(Object.assign(blankReport(lastType), { id: newId(), type: lastType }));
      if (reportOf(S).id === 'particle') Object.assign(S, KEEP_DEFAULTS, pickKeep(SETTINGS));
      S.reportNo = C.nextReportNo(RECORDS, null); autoNo = true;
      loadInputs(); render(); setSaveState('Add a customer name to save');
    }
    LS.set('ppspc.currentId', S.id);
    LS.set('ppspc.lastType', reportOf(S).id);
    updateCount(); setView('form'); updateNag();
    document.body.classList.remove('booting');

    if (store.kind === 'local') {
      store.persistStorage();
      registerSW();
    } else {
      unregisterSW();
      setInterval(checkServer, 15000);
    }
    document.documentElement.dataset.ready = store.kind;
  })().catch(e => {
    document.body.classList.remove('booting');
    document.body.insertAdjacentHTML('afterbegin', `<div class="banner down">The app could not start: ${esc(e && e.message)}. Reload the page.</div>`);
  });
})();
