/* Oil Cleanliness Test Report – ELC patch test (0.8 µm membrane filtration, NAS 1638).
   The membrane patch before and after electrostatic liquid cleaning, the NAS class where a
   laboratory rating was performed, and the engineer's recommendation + signatures.
   Everything this page needs is drawn here: header, framed grid, patch circles, NAS scale,
   tick boxes, signature boxes and footer. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;

  /* ---------- small helpers, kept inside this file ---------- */
  /* a stored tick may come back as a real boolean, or as text from an older record */
  const on = v => v === true || v === 1 || /^(1|true|yes|on|y)$/i.test(String(v == null ? '' : v).trim());
  /* A value the user typed is escaped here; markup from a shared helper (Sh.day, Sh.cb…) has
     already escaped what it carries and passes through untouched. */
  const V = (x, d) => (Sh.isRaw(x) ? Sh.raw(x).h : Sh.val(x, d));
  /* markup built in this file is wrapped before it goes into a value cell */
  const H = h => Sh.raw(h);
  const tick = (v, label) => Sh.cb(on(v), label);

  /* a section heading: navy, letter-spaced, with a rule filling the rest of the line */
  const sec = t => `<div class="op-sec"><b>${Sh.esc(t)}</b><i></i></div>`;

  /* The bordered label/value grid. A row is a list of [label, value, valueSpan?] cells, in the
     order the printed form shows them, so the sheet always has the same lines. */
  const grid = rows => `<div class="op-g">${rows.map(r => r.map(c =>
    `<div class="op-k">${Sh.esc(c[0])}</div>` +
    `<div class="op-v"${c[2] ? ` style="grid-column:${c[2]}"` : ''}>${V(c[1])}</div>`
  ).join('')).join('')}</div>`;

  /* One patch panel: heading band, the dashed circle (or the attached photograph clipped into
     it), then the two small boxed lines under it. */
  const pane = (title, src, date, nas, after) => `<div class="op-pan${after ? ' op-after' : ''}">
  <div class="op-panh">${Sh.esc(title)}</div>
  <div class="op-circle">${Sh.has(src)
    ? `<img src="${Sh.esc(src)}" alt="${Sh.esc(title)} membrane patch">`
    : '<span>AFFIX PATCH<br>HERE</span>'}</div>
  <div class="op-pl">
    <div class="op-plb"><i>SAMPLE DATE</i><b>${Sh.day(date)}</b></div>
    <div class="op-plb"><i>NAS · LAB ONLY</i><b>${V(nas)}</b></div>
  </div>
</div>`;

  /* a signature box: the hand-drawn signature, then the caption band underneath it */
  const sign = (title, src) => `<div class="op-sg">
  <div class="op-sgp">${Sh.has(src) ? `<img src="${Sh.esc(src)}" alt="Signature">` : ''}</div>
  <div class="op-sgc">${Sh.esc(title)}</div>
</div>`;

  const NOTES = [
    'Patch colour change reflects minute constituents of the oil; base oil properties are not altered. NAS class is recorded only when laboratory rating is performed.',
    'Please quote the Report No. and Asset / Machine ID in all correspondence regarding this service.'
  ];

  /* the four steps of the NAS 1638 scale printed under the result */
  const NAS_SCALE = [
    ['NAS ≤ 6', 'New-oil grade', 'op-new'],
    ['NAS 7–8', 'Target for hydraulics', 'op-tgt'],
    ['NAS 9–10', 'Caution – monitor', 'op-mon'],
    ['NAS 11–12', 'Critical – act now', 'op-crt']
  ];

  const D = {
    id: 'oilPatch',
    name: 'Oil Cleanliness Test Report (Patch Test)',
    short: 'Oil Patch Test',
    form: '',
    orientation: 'p',
    colour: 'navy',
    title: 'OIL CLEANLINESS TEST REPORT',
    sub: 'ELC PATCH TEST · 0.8 µm MEMBRANE FILTRATION · NAS 1638 RATING',
    about: '0.8 µm membrane patch test before and after ELC cleaning, with NAS 1638 rating.',
    /* all of this page's styling, every class prefixed op- so it cannot touch another report */
    css: `.op-frame{border:1px solid #1b2a5e;padding:11px 14px 9px;color:#1f1f21}
.op-hd{display:flex;align-items:flex-start;gap:12px}
.op-hl{flex:1;min-width:0}
.op-kx{font-size:7.8px;font-weight:700;letter-spacing:.14em;color:#1b2a5e}
.op-hd h1{margin:2px 0 3px;font-size:27px;line-height:1.06;font-weight:700;letter-spacing:.005em;color:#1b2a5e}
.op-ad{font-size:9.4px;line-height:1.5;color:#33406b}
.op-lg{width:50px;height:auto;flex:none;margin-top:5px}
.op-no{width:220px;flex:none;border:1px solid #1b2a5e}
.op-nor{display:grid;grid-template-columns:70px minmax(0,1fr);border-top:1px solid #1b2a5e}
.op-nor:first-child{border-top:0}
.op-nor>b{display:flex;align-items:center;background:#1b2a5e;color:#fff;font-size:7.6px;font-weight:700;letter-spacing:.05em;padding:4px 5px}
.op-nor>span{display:flex;align-items:center;min-height:19px;padding:3px 6px;font-size:9.6px;font-weight:700;overflow-wrap:anywhere}
.op-rule{height:3px;background:#1b2a5e;margin:6px 0 0}
.op-title{margin:7px 0 0;text-align:center;font-size:18.5px;font-weight:700;letter-spacing:.13em;color:#1b2a5e}
.op-sub{margin:3px 0 0;text-align:center;font-size:9.2px;font-weight:700;letter-spacing:.085em;color:#6b7391}
.op-sec{display:flex;align-items:center;gap:10px;margin:9px 0 4px}
.op-sec b{font-size:11px;font-weight:700;letter-spacing:.1em;color:#1b2a5e;white-space:nowrap}
.op-sec i{flex:1;height:1px;background:#1b2a5e}
.op-g{display:grid;grid-template-columns:minmax(0,19fr) minmax(0,31fr) minmax(0,25fr) minmax(0,25fr);gap:1px;background:#1b2a5e;border:1px solid #1b2a5e}
.op-g>*{display:flex;align-items:center;min-height:24px;padding:4px 6px;background:#fff;font-size:9.5px;overflow-wrap:anywhere}
.op-g .op-k{background:#eef1f8;color:#1b2a5e;font-size:8.2px;font-weight:700;letter-spacing:.05em}
.op-g .op-v{font-size:10px;font-weight:700}
.op-ticks{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;width:100%}
.op-bl{display:inline-block;min-width:38px;border-bottom:1px solid #1b2a5e;text-align:center;padding:0 4px;font-weight:700}
.op-blw{min-width:84px}
.op-patch{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#1b2a5e;border:1px solid #1b2a5e}
.op-pan{display:flex;flex-direction:column;align-items:center;padding:0 0 6px;background:#fff}
.op-panh{align-self:center;margin:7px 0 9px;border:1.5px solid #1b2a5e;padding:3px 14px;color:#1b2a5e;font-size:9.6px;font-weight:700;letter-spacing:.12em}
.op-after .op-panh{background:#1b2a5e;color:#fff}
.op-circle{display:flex;align-items:center;justify-content:center;width:148px;height:148px;border:1.5px dashed #8d95b3;border-radius:50%;background:#fff;color:#8d95b3;font-size:8.4px;font-weight:700;letter-spacing:.12em;line-height:1.6;text-align:center;overflow:hidden}
.op-circle img{display:block;width:100%;height:100%;object-fit:cover}
.op-pl{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-self:stretch;margin:11px 13px 0}
.op-plb{display:grid;grid-template-columns:auto minmax(0,1fr);border:1px solid #1b2a5e;min-width:0}
.op-plb i{display:flex;align-items:center;background:#eef1f8;color:#1b2a5e;font-style:normal;font-size:7.4px;font-weight:700;letter-spacing:.04em;padding:3px 4px;white-space:nowrap}
.op-plb b{display:flex;align-items:center;min-width:0;padding:3px 6px;font-size:9.4px;font-weight:700;overflow-wrap:anywhere}
.op-res{display:grid;grid-template-columns:84px minmax(0,1fr);gap:1px;margin-top:3px;background:#1b2a5e;border:1px solid #1b2a5e}
.op-resh{display:flex;align-items:center;justify-content:center;background:#eef1f8;color:#1b2a5e;font-size:11px;font-weight:700;letter-spacing:.07em}
.op-resb{display:flex;flex-direction:column;justify-content:center;gap:4px;background:#fff;padding:5px 12px}
.op-tk{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700}
.op-tk b{display:inline-block;min-width:28px;border-bottom:1px solid #1b2a5e;text-align:center;padding:0 3px}
.op-tk em{font-style:normal;color:#1b2a5e}
.op-tk i{font-style:italic;font-size:9px;font-weight:400;color:#6b7391;margin-left:2px}
.op-nas{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:4px;background:#1b2a5e;border:1px solid #1b2a5e}
.op-nasc{background:#fff;text-align:center;padding:3px 4px}
.op-nasc b{display:block;font-size:10.4px;letter-spacing:.03em;color:#1b2a5e}
.op-nasc i{font-style:italic;font-size:8.6px}
.op-crt b{color:#b3261e}
.op-new{color:#1f7a45}
.op-tgt{color:#1a5fd6}
.op-mon{color:#b35f00}
.op-crt{color:#b3261e}
.op-ref{margin-top:3px;font-size:7.6px;font-weight:700;letter-spacing:.05em;color:#6b7391}
.op-imp{border:1px solid #1b2a5e;padding:5px 11px 7px}
.op-impg{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
.op-dot{height:14px;margin-top:8px;border-bottom:1px dotted #9aa2bd}
.op-rem{display:flex;align-items:flex-end;gap:8px;margin-top:8px}
.op-rem>b{color:#1b2a5e;font-size:7.8px;font-weight:700;letter-spacing:.06em;white-space:nowrap;padding-bottom:2px}
.op-remv{flex:1;min-width:0;border-bottom:1px dotted #9aa2bd;padding:0 4px 1px}
.op-sigs{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
.op-sg{display:flex;flex-direction:column;height:100px;border:1px solid #1b2a5e;min-width:0}
.op-sgp{display:flex;align-items:flex-end;justify-content:center;flex:1;min-height:0;padding:4px 6px}
.op-sgp img{max-width:100%;max-height:58px;object-fit:contain}
.op-sgc{border-top:1px solid #1b2a5e;background:#fff;color:#1b2a5e;font-size:7.8px;font-weight:700;letter-spacing:.05em;text-align:center;padding:4px 6px}
.op-notes{display:flex;gap:10px;margin-top:8px}
.op-notes>b{color:#1b2a5e;font-size:8.6px;font-weight:700;letter-spacing:.08em;white-space:nowrap;padding-top:1px}
.op-notes ol{flex:1;margin:0;padding-left:15px;color:#33406b;font-size:8.4px;line-height:1.5}
.op-notes li{margin:0 0 1px}
.op-foot{display:flex;justify-content:space-between;gap:14px;margin-top:8px;padding-top:5px;border-top:1px solid #1b2a5e;color:#1b2a5e;font-size:7.8px;font-weight:700;letter-spacing:.06em}`,
    list: {
      no: 'reportNo',
      date: 'date',
      client: 'client',
      detail: r => [r.machine, r.assetId].filter(Boolean).join(' · '),
      next: 'nextDate'
    },
    sections: [
      { n: '01', title: 'REPORT DETAILS', fields: [
        { k: 'reportNo', l: 'Report No.', t: 'text', w: 1 },
        { k: 'date', l: 'Date', t: 'date', w: 1 },
        { k: 'analyzer', l: 'Analyzer / tested by', t: 'text', w: 2 }
      ] },
      { n: '02', title: 'CLIENT & MACHINE', fields: [
        { k: 'client', l: 'Client', t: 'text' },
        { k: 'location', l: 'Location', t: 'text', w: 2 },
        { k: 'department', l: 'Department', t: 'text', w: 2 },
        { k: 'contact', l: 'Contact / Ph.', t: 'text', w: 2 },
        { k: 'machine', l: 'Machine', t: 'text', w: 2 },
        { k: 'assetId', l: 'Asset / Machine ID', t: 'text', w: 2 },
        { k: 'oilGrade', l: 'Oil grade', t: 'text', w: 2 },
        { k: 'totalOilQty', l: 'Total oil qty (L)', t: 'num', w: 2 },
        { k: 'application', l: 'Application', t: 'text', w: 2 },
        { k: 'problem', l: 'Problem', t: 'text', w: 2 },
        { k: 'sampleFiltered', l: 'Sample filtered', t: 'text', w: 2 }
      ] },
      { n: '03', title: 'SERVICE DETAILS', fields: [
        { k: 'engineer', l: 'Service engineer', t: 'text', w: 2 },
        { k: 'ppsUnit', l: 'PPS unit model / Sl. No.', t: 'text', w: 2 },
        { k: 'svcType', l: 'Service type', t: 'group', w: 4, items: [
          ['svcAmc', 'AMC'], ['svcBreakdown', 'Breakdown'], ['svcDemo', 'Demo'],
          ['svcRental', 'Rental'], ['svcInstall', 'Installation'], ['svcOther', 'Others']
        ] },
        { k: 'svcOtherText', l: 'Others — details', t: 'text', w: 4 }
      ] },
      { n: '04', title: 'PATCH TEST RESULT', fields: [
        { k: 'patchBefore', l: 'Membrane patch — before cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'beforeDate', l: 'Sample date — before', t: 'date', w: 1 },
        { k: 'beforeNas', l: 'NAS class — before (lab only)', t: 'text', w: 1 },
        { k: 'patchAfter', l: 'Membrane patch — after cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'afterDate', l: 'Sample date — after', t: 'date', w: 1 },
        { k: 'afterNas', l: 'NAS class — after (lab only)', t: 'text', w: 1 }
      ] },
      { n: '05', title: 'RESULT & RECOMMENDATION', fields: [
        { k: 'patchReduced', l: 'Patch comparison — contamination visibly reduced', t: 'check', w: 4 },
        { k: 'labNasFrom', l: 'Lab NAS rating — from', t: 'num', w: 1 },
        { k: 'labNasTo', l: 'Lab NAS rating — to', t: 'num', w: 1 },
        { k: 'labDays', l: 'Days to reach that class', t: 'num', w: 2 },
        { k: 'rec', l: 'Recommendation', t: 'group', w: 4, items: [
          ['oilRestored', 'Oil restored — fit for continued use'],
          ['continueCycle', 'Continue filtration cycle'],
          ['retestRec', 'Re-test recommended'],
          ['amcRec', 'AMC / periodic servicing recommended']
        ] },
        { k: 'retestDate', l: 'Re-test recommended on', t: 'date', w: 2 },
        { k: 'impression', l: 'Other remarks / impression', t: 'area', w: 4, rows: 3 }
      ] },
      { n: '06', title: 'SIGNATURES', fields: [
        { k: 'custSign', l: 'Customer sign & remarks — name & seal', t: 'sig', w: 2, hint: 'Tap to sign' },
        { k: 'engSign', l: 'Service engineer sign — Prime Power Systems', t: 'sig', w: 2, hint: 'Tap to sign' }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ]
  };

  /* The shared field list gives every key; the tick boxes of a "group" field come back as text,
     so they are set to real booleans here (as the other reports do). */
  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', date: C.today(), analyzer: '', sampleFiltered: '20 ml',
    svcAmc: false, svcBreakdown: false, svcDemo: false, svcRental: false, svcInstall: false, svcOther: false,
    oilRestored: false, continueCycle: false, retestRec: false, amcRec: false,
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => `<div class="op-frame">
  <div class="op-hd">
    <div class="op-hl">
      <div class="op-kx">« KLEENTEX • FERRO CARE ELECTROSTATIC OIL CLEANERS</div>
      <h1>PRIME POWER SYSTEMS</h1>
      <div class="op-ad">18, Second Street, MGR Nagar, Sanganoor, Rathinapuri Post, Coimbatore - 641 027</div>
      <div class="op-ad">Phone: 0422-2331017 • E-mail: info@ppsystemss.com • ppstranter@gmail.com</div>
    </div>
    <img class="op-lg" src="logo.png" alt="Prime Power Systems">
    <div class="op-no">
      <div class="op-nor"><b>REPORT NO.</b><span>${V(d.reportNo)}</span></div>
      <div class="op-nor"><b>DATE</b><span>${Sh.day(d.date)}</span></div>
      <div class="op-nor"><b>ANALYZER</b><span>${V(d.analyzer)}</span></div>
    </div>
  </div>
  <div class="op-rule"></div>
  <div class="op-title">${Sh.esc(D.title)}</div>
  <div class="op-sub">${Sh.esc(D.sub)}</div>
  ${sec('CLIENT & MACHINE')}
  ${grid([
    [['CLIENT', d.client, '2/-1']],
    [['LOCATION', d.location], ['DEPARTMENT', d.department]],
    [['CONTACT / PH', d.contact], ['MACHINE', d.machine]],
    [['ASSET / MACHINE ID', d.assetId], ['OIL GRADE', d.oilGrade]],
    [['TOTAL OIL QTY', d.totalOilQty], ['APPLICATION', d.application]],
    [['PROBLEM', d.problem], ['SAMPLE FILTERED', d.sampleFiltered]]
  ])}
  ${sec('SERVICE DETAILS')}
  ${grid([
    [['SERVICE ENGINEER', d.engineer], ['PPS UNIT MODEL / SL. NO.', d.ppsUnit]],
    [['SERVICE TYPE', H(`<div class="op-ticks">${[
      [d.svcAmc, 'AMC'], [d.svcBreakdown, 'Breakdown'], [d.svcDemo, 'Demo'],
      [d.svcRental, 'Rental'], [d.svcInstall, 'Installation'], [d.svcOther, 'Others:']
    ].map(([v, l]) => tick(v, l)).join('')}<span class="op-bl op-blw">${V(d.svcOtherText, '')}</span></div>`), '2/-1']]
  ])}
  ${sec('PATCH TEST RESULT')}
  <div class="op-patch">
    ${pane('BEFORE CLEANING', d.patchBefore, d.beforeDate, d.beforeNas, false)}
    ${pane('AFTER CLEANING', d.patchAfter, d.afterDate, d.afterNas, true)}
  </div>
  <div class="op-res">
    <div class="op-resh">RESULT</div>
    <div class="op-resb">
      <div class="op-tk">${tick(d.patchReduced, 'Patch comparison — contamination visibly reduced')}</div>
      <div class="op-tk">${tick(Sh.has(d.labNasFrom) || Sh.has(d.labNasTo), 'Lab NAS rating:')}<span>NAS <b>${V(d.labNasFrom, '')}</b></span><em>→</em><span>NAS <b>${V(d.labNasTo, '')}</b></span><span>in <b>${V(d.labDays, '')}</b> days</span><i>(if lab-tested)</i></div>
    </div>
  </div>
  <div class="op-nas">${NAS_SCALE.map(([t, s, c]) =>
    `<div class="op-nasc ${c}"><b>${Sh.esc(t)}</b><i>${Sh.esc(s)}</i></div>`).join('')}</div>
  <div class="op-ref">REFERENCE: NAS 1638 CLEANLINESS CLASSES · APPLICABLE WHEN LAB RATING IS PERFORMED · EACH +1 CLASS = DOUBLE THE PARTICLE COUNT</div>
  ${sec('IMPRESSION & RECOMMENDATION')}
  <div class="op-imp">
    <div class="op-impg">
      <div class="op-tk">${tick(d.oilRestored, 'Oil restored — fit for continued use')}</div>
      <div class="op-tk">${tick(d.continueCycle, 'Continue filtration cycle')}</div>
      <div class="op-tk">${tick(d.retestRec, 'Re-test recommended on:')}<span class="op-bl op-blw">${Sh.day(d.retestDate)}</span></div>
      <div class="op-tk">${tick(d.amcRec, 'AMC / periodic servicing recommended')}</div>
    </div>
    <div class="op-dot"></div>
    <div class="op-dot"></div>
    <div class="op-rem"><b>OTHER REMARKS</b><div class="op-remv">${Sh.text(d.impression)}</div></div>
  </div>
  <div class="op-sigs">
    ${sign('CUSTOMER SIGN & REMARKS · NAME & SEAL', d.custSign)}
    ${sign('SERVICE ENGINEER SIGN · PRIME POWER SYSTEMS', d.engSign)}
  </div>
  <div class="op-notes"><b>NOTES</b><ol>${NOTES.map(t => `<li>${Sh.esc(t)}</li>`).join('')}</ol></div>
</div>
<div class="op-foot"><span>PRIME POWER SYSTEMS • COIMBATORE • SINCE 1997</span><span>HYDRAULIC OIL PURIFICATION • ELC / LVDH / PHE • AMC</span></div>`;

  root.PPSReports.register(D);
})(window);
