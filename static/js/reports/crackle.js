/* PPS Oil Condition Report – hot-plate crackle test (moisture screening).
   A drop of oil is dropped on a hot plate: free and emulsified water flashes to steam and
   shows as bubbles or an audible crackle, dry oil stays calm. The sheet keeps the whole
   screening on one page: what the sample was, one result row, the four-band response scale,
   the photographs and findings, the recommended actions and the two sign-offs. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { esc, has, val, raw, cb, kv, table, box, text, photo, note, cols, rule } = Sh;

  /* ---------- the four bands of the crackle response scale ---------- */
  /* value stored in the record, the printed label, the typical range and the block colour */
  const BANDS = [
    ['1', 'No bubbles / no crackle', 'Below ~500 ppm', '#2e7d32'],
    ['2', 'Fine bubbles, no crackle', '~500 - 1,000 ppm', '#f0a500'],
    ['3', 'Bubbles + audible crackle', '~1,000 - 2,000 ppm', '#e2711d'],
    ['4', 'Large bubbles, violent crackle', '> 2,000 ppm', '#c0392b']
  ];
  /* the same four bands as the choices offered on the entry screen */
  const BAND_OPTS = BANDS.map(([v, l, sub]) => [v, l + '  (' + sub + ')']);

  /* a stored tick may come back as a real boolean, or as text from an older record */
  const on = v => v === true || v === 1 || /^(1|true|yes|on|y)$/i.test(String(v == null ? '' : v).trim());
  /* a one-word choice is only ever compared, never printed */
  const pick = v => String(v == null ? '' : v).trim().toLowerCase();

  /* ---------- pieces of this sheet, all built from the shared helpers ---------- */
  /* the letterhead of this report: the logo on the left, the title and report number right */
  const header = d => `<div class="ck-hd"><img src="logo.png" alt="Prime Power Systems">
  <div class="ck-hr">
    <h1>${esc(D.title)}</h1>
    <div class="ck-hsub">${esc(D.sub).replace(/\|/g, '&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>
    <div class="ck-hno"><b>Report No.</b><span>${val(d.reportNo)}</span></div>
  </div></div>`;

  /* section heading: an orange bar, bold grey text and a thin rule through the line */
  const sech = t => `<div class="ck-sech"><b>${esc(t)}</b></div>`;

  /* a photograph with its printed caption under it; with no picture attached the dashed
     space asks for one to be inserted or affixed */
  const figure = (src, cap) => `<div class="ck-fig">${photo(src, has(src) ? '' : 'Insert / affix photo', { h: 165 })}<div class="ck-cap">${esc(cap)}</div></div>`;

  /* one tick-box line of the recommended actions, with any typed tail after the box */
  const actLine = (ticked, label, tail) => `<div class="ck-act">${cb(ticked, label, 'ck-al')}${tail || ''}</div>`;

  /* one hand-signed line: the hand-drawn signature goes above the rule, the printed name
     and the caption of the line below it (never the grey signature panels) */
  const signLine = (label, name, sign) => `<div class="ck-sig">
  <div class="ck-sigpad">${has(sign) ? `<img src="${esc(sign)}" alt="Signature">` : ''}</div>
  <div class="ck-sigrule"></div>
  <div class="ck-signm">${val(name)}</div>
  <div class="ck-siglbl">${esc(label)}</div>
</div>`;

  const D = {
    id: 'crackle',
    name: 'Crackle Test (Moisture Screening)',
    short: 'Crackle Test',
    form: '',
    orientation: 'p',
    colour: 'orange',
    title: 'OIL CONDITION REPORT',
    sub: 'Moisture Screening | Hot-Plate Crackle Test',
    about: 'Hot-plate crackle test for free and emulsified water in oil.',
    list: {
      no: 'reportNo',
      date: 'reportDate',
      client: 'client',
      detail: r => [r.equipment, r.lubricant].filter(Boolean).join(' · '),
      next: 'nextDate'
    },
    /* everything this page needs beyond the shared sheet styles, all ck- prefixed */
    css: `.ck-hd{display:flex;align-items:flex-start;gap:16px}
.ck-hd img{width:92px;height:auto;flex:none}
.ck-hr{flex:1;min-width:0;text-align:right}
.ck-hr h1{margin:2px 0 0;font-size:22px;font-weight:700;line-height:1.15;letter-spacing:.01em;color:#1f1f21}
.ck-hsub{color:#60666f;font-size:11.5px;margin-top:4px}
.ck-hno{display:flex;justify-content:flex-end;align-items:flex-end;gap:8px;margin-top:9px}
.ck-hno b{color:#ec8b00;font-size:11px;white-space:nowrap}
.ck-hno span{flex:0 1 auto;min-width:150px;border-bottom:1px dotted #9a9a9a;min-height:15px;padding:0 2px;font-size:10.8px;font-weight:600;text-align:left;overflow-wrap:anywhere}
.ck-top{display:grid;grid-template-columns:minmax(0,1fr) 261px;gap:38px;margin:10px 0 12px}
.ck-eq{display:flex;flex-direction:column;justify-content:space-between;min-height:56px}
.ck-lab{font-size:11px;color:#5a5f66}
.ck-eqv{border-bottom:1px dotted #9a9a9a;min-height:16px;padding:0 2px;font-size:10.8px;font-weight:600;overflow-wrap:anywhere}
.ck-status{background:#f6f7f8;padding:8px 16px 9px;min-width:0}
.ck-stath{font-size:9px;line-height:1.15;color:#5a5a5a;letter-spacing:.06em}
.ck-tick{margin-top:3px;line-height:1.15}
.ck-bad{color:#c0392b;font-weight:700}
.ck-ok{color:#1f7a45;font-weight:700}
.ck-panel{background:#f6f7f8;padding:8px 16px 6px;margin-bottom:14px}
.ck-sech{position:relative;margin:11px 0 5px;padding-left:13px}
.ck-sech::before{content:"";position:absolute;left:0;top:50%;width:4px;height:14px;margin-top:-7px;background:#ec8b00}
.ck-sech::after{content:"";position:absolute;left:4px;right:0;top:50%;height:1px;margin-top:-0.5px;background:#d3d6db}
.ck-sech b{position:relative;z-index:1;background:#fff;padding-right:9px;font-size:11.5px;font-weight:700;color:#4a4a4a;letter-spacing:.06em}
.ck-l{text-align:left}
.ck-res{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.ck-scale{font-size:11px;color:#3b3b3b;margin-top:6px}
.ck-bands{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:6px}
.ck-band{min-width:0}
.ck-bar{height:7px}
.ck-bt{display:flex;justify-content:center;margin-top:9px}
.ck-bl{font-weight:700}
.ck-bs{text-align:center;color:#60666f;font-size:10.5px;margin-top:4px}
.ck-figs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ck-cap{font-size:9.5px;color:#555;margin-top:5px}
.ck-how{font-size:10.6px;line-height:1.5;color:#333}
.ck-h4{font-weight:700;font-size:11px;color:#1f1f21;margin:7px 0 4px}
.ck-acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;margin-top:8px}
.ck-acts>div{min-width:0}
.ck-act{display:flex;align-items:flex-end;gap:5px;margin-bottom:5px}
.ck-al{font-size:10.4px}
.ck-dotline{display:inline-block;border-bottom:1px dotted #9a9a9a;min-height:14px;padding:0 3px;font-weight:600;text-align:center;overflow-wrap:anywhere}
.ck-days{width:76px}
.ck-grow{flex:1;min-width:60px}
.ck-remh{font-weight:700;font-size:11px;color:#1f1f21;margin-bottom:5px}
.ck-sigs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:26px;align-items:end;margin-top:16px}
.ck-sig{min-width:0}
.ck-sigpad{min-height:40px;display:flex;align-items:flex-end;padding-bottom:1px}
.ck-sigpad img{max-height:42px;max-width:100%;object-fit:contain}
.ck-sigrule{border-top:1px solid #b9b9b9}
.ck-signm{font-size:10.5px;font-weight:600;color:#1f1f21;min-height:15px;padding-top:3px;overflow-wrap:anywhere}
.ck-siglbl{font-size:10.5px;color:#555}
.ck-pr{text-align:right;white-space:nowrap;font-size:10px;color:#3b3b3b;line-height:1.5}
.ck-pr b{display:block;font-size:12.5px;font-weight:700;color:#1f1f21;margin-bottom:1px}`,
    sections: [
      { n: '01', title: 'REPORT & SAMPLE', fields: [
        { k: 'reportNo', l: 'Report No.', t: 'text', w: 1 },
        { k: 'reportDate', l: 'Report Date', t: 'date', w: 1 },
        { k: 'sampleDate', l: 'Sample Date', t: 'date', w: 1 },
        { k: 'testedAt', l: 'Tested At', t: 'text', w: 1 },
        { k: 'client', l: 'Customer', t: 'text', w: 2 },
        { k: 'sampleId', l: 'Sample ID', t: 'text', w: 2 },
        { k: 'equipment', l: 'Equipment', t: 'text', w: 2 },
        { k: 'lubricant', l: 'Lubricant / Oil Grade', t: 'text', w: 2 },
        { k: 'systemVolume', l: 'System Volume', t: 'text', w: 2 }
      ] },
      { n: '02', title: 'TEST RESULT', fields: [
        { k: 'overallStatus', l: 'Overall status', t: 'radios', w: 2, opts: [['moisture', 'Moisture detected'], ['normal', 'Normal - no moisture']] },
        { k: 'moistureResult', l: 'Crackle test result', t: 'radios', w: 2, opts: [['positive', 'Positive'], ['negative', 'Negative']] },
        { k: 'observation', l: 'Observation on the hot plate', t: 'area', rows: 2, w: 4 },
        { k: 'crackedBand', l: 'Crackle test response band observed', t: 'radios', w: 4, opts: BAND_OPTS }
      ] },
      { n: '03', title: 'TEST EVIDENCE & INTERPRETATION', fields: [
        { k: 'photoSample', l: 'Fig 1 — sample as received (photo)', t: 'img', w: 2, hint: 'Tap to add a photo of the sample' },
        { k: 'photoPlate', l: 'Fig 2 — hot-plate test (photo)', t: 'img', w: 2, hint: 'Tap to add a photo of the hot-plate test' },
        { k: 'findings', l: 'What we found', t: 'area', rows: 4, w: 4 }
      ] },
      { n: '04', title: 'RECOMMENDED ACTIONS', fields: [
        { k: 'actContinue', l: 'Continue in service - no corrective action for moisture at present', t: 'check', w: 2 },
        { k: 'actDrain', l: 'Drain free water from the reservoir bottom after settling', t: 'check', w: 2 },
        { k: 'actLvdh', l: 'Remove moisture with PPS LVDH system', t: 'check', w: 2 },
        { k: 'actRetest', l: 'Re-test after a number of days', t: 'check', w: 2 },
        { k: 'retestDays', l: 'Re-test after (days)', t: 'num', w: 2 },
        { k: 'actKarl', l: 'Quantify water content by Karl Fischer titration (ASTM D6304)', t: 'check', w: 2 },
        { k: 'actSource', l: 'Find and fix the source of water ingress (cooler, vent, seals, breather)', t: 'check', w: 2 },
        { k: 'actElc', l: 'Remove contaminants to required NAS level with PPS ELC machine', t: 'check', w: 2 },
        { k: 'actOther', l: 'Other action (written below)', t: 'check', w: 2 },
        { k: 'actionOther', l: 'Other action - what is to be done', t: 'text', w: 4 }
      ] },
      { n: '05', title: 'REMARKS', fields: [
        { k: 'remarks', l: 'Remarks / pending samples', t: 'area', rows: 3, w: 4 }
      ] },
      { n: '06', title: 'SIGNATURES', open: true, fields: [
        { k: 'testedBy', l: 'Tested by - name', t: 'text', w: 2 },
        { k: 'testedSign', l: 'Tested by - signature', t: 'sig', w: 2, hint: 'Tap to sign' },
        { k: 'approvedBy', l: 'Reviewed & approved by - name', t: 'text', w: 2 },
        { k: 'approvedSign', l: 'Reviewed & approved by - signature', t: 'sig', w: 2, hint: 'Tap to sign' }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportDate: C.today(), sampleDate: C.today(),
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => {
    /* the small panel of sample details, two label / value columns on light grey;
       the d flag prints both dates the readable way, through Sh.day */
    const details = `<div class="ck-panel">${kv([
      { k: 'Customer', v: d.client },
      { k: 'Sample ID', v: d.sampleId },
      { k: 'Equipment', v: d.equipment },
      { k: 'Sample Date', v: d.sampleDate, d: 1 },
      { k: 'Lubricant', v: d.lubricant },
      { k: 'Report Date', v: d.reportDate, d: 1 },
      { k: 'System Volume', v: d.systemVolume },
      { k: 'Tested At', v: d.testedAt }
    ])}</div>`;

    /* one result row: what was tested, how, what was seen and the verdict */
    const resultRow = { cells: [
      'Moisture (free / emulsified water)',
      raw('<div class="ck-l">Hot-plate crackle test (qualitative screening)</div>'),
      raw(`<div class="ck-l">${text(d.observation)}</div>`),
      raw(`<div class="ck-res">${cb(pick(d.moistureResult) === 'positive', 'POSITIVE', 'ck-bad')}${cb(pick(d.moistureResult) === 'negative', 'NEGATIVE', 'ck-ok')}</div>`)
    ] };

    /* the four coloured bands, the observed one ticked */
    const band = ([v, label, sub, colour]) => `<div class="ck-band">
      <div class="ck-bar" style="background:${colour}"></div>
      <div class="ck-bt">${cb(pick(d.crackedBand) === v, label, 'ck-bl')}</div>
      <div class="ck-bs">${esc(sub)}</div>
    </div>`;

    /* evidence: the two photographs beside how the test works and what was found */
    const evidence = cols(
      `<div class="ck-figs">${figure(d.photoSample, 'Fig 1. Sample as received')}${figure(d.photoPlate, 'Fig 2. Hot-plate test')}</div>`,
      `<div class="ck-how"><b>How the test works:</b> A drop of oil is heated on a hot plate. Any water present flashes to steam and escapes as visible bubbles; dry oil stays calm.</div>
      <div class="ck-h4">What we found</div>${box('', text(d.findings), { min: 150 })}`,
      34
    );

    /* the two columns of recommended actions */
    const actions = `<div class="ck-acts">
      <div>
        ${actLine(on(d.actContinue), 'Continue in service - no corrective action for moisture at present')}
        ${actLine(on(d.actDrain), 'Drain free water from the reservoir bottom after settling')}
        ${actLine(on(d.actLvdh), 'Remove moisture with PPS LVDH system')}
        ${actLine(on(d.actRetest), 'Re-test after', `<span class="ck-dotline ck-days">${val(d.retestDays)}</span> days`)}
      </div>
      <div>
        ${actLine(on(d.actKarl), 'Quantify water content by Karl Fischer titration (ASTM D6304)')}
        ${actLine(on(d.actSource), 'Find and fix the source of water ingress (cooler, vent, seals, breather)')}
        ${actLine(on(d.actElc), 'Remove contaminants to required NAS level with PPS ELC machine')}
        ${actLine(on(d.actOther), 'Other:', `<span class="ck-dotline ck-grow">${val(d.actionOther)}</span>`)}
      </div>
    </div>`;

    return header(d) + rule() +
      `<div class="ck-top">
        <div class="ck-eq"><div class="ck-lab">EQUIPMENT</div><div class="ck-eqv">${val(d.equipment)}</div></div>
        <div class="ck-status">
          <div class="ck-stath">OVERALL STATUS</div>
          <div class="ck-tick">${cb(pick(d.overallStatus) === 'moisture', 'MOISTURE DETECTED', 'ck-bad')}</div>
          <div class="ck-tick">${cb(pick(d.overallStatus) === 'normal', 'NORMAL - NO MOISTURE', 'ck-ok')}</div>
        </div>
      </div>` +
      details +
      sech('TEST RESULT') +
      table({
        head: ['Parameter', 'Method', 'Observation', 'Result'],
        align: ['l', 'l', 'l', 'c'],
        widths: ['19%', '21%', '32%', '28%'],
        rows: [resultRow]
      }) +
      `<div class="ck-scale">Crackle test response scale (typical indicative ranges) &nbsp;-&nbsp; tick the band observed for this sample</div>
      <div class="ck-bands">${BANDS.map(band).join('')}</div>` +
      sech('TEST EVIDENCE & INTERPRETATION') + evidence +
      sech('RECOMMENDED ACTIONS') + actions +
      box('', '<div class="ck-remh">Remarks / pending samples:</div>' + text(d.remarks), { accent: true, min: 70 }) +
      `<div class="ck-sigs">
        ${signLine('Tested by  (name & signature)', d.testedBy, d.testedSign)}
        ${signLine('Reviewed & approved by  (name & signature)', d.approvedBy, d.approvedSign)}
        <div class="ck-pr"><b>Prime Power Systems</b>Industrial Oil Purification &amp; Reliability Services<br>Coimbatore, Tamil Nadu</div>
      </div>` +
      note(esc('Note: The crackle test is a qualitative screening method that detects free and emulsified water; ppm ranges shown are typical indications, not measured values. Quantitative water content requires Karl Fischer titration (ASTM D6304). Results relate only to the sample tested as received.')) +
      rule();
  };

  /* one line for the records list */
  D.line = d => {
    const bits = [];
    if (has(d.moistureResult)) bits.push('Crackle ' + (pick(d.moistureResult) === 'positive' ? 'positive' : 'negative'));
    else if (has(d.overallStatus)) bits.push(pick(d.overallStatus) === 'normal' ? 'No moisture' : 'Moisture detected');
    const band = BANDS.filter(b => b[0] === pick(d.crackedBand))[0];
    if (band) bits.push(band[2]);
    return bits.join(' · ');
  };

  root.PPSReports.register(D);
})(window);
