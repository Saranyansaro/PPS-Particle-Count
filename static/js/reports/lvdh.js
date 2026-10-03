/* PPS-F-03  LVDH TEST REPORT FOR MOISTURE REMOVAL
   Low Vacuum Dehydration (LVDH): free water, hot-plate crackle test and Karl Fischer moisture
   before and after the machine, with a 0.8 µm membrane patch showing the solid contamination. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { sec, kv, table, box, meta, sig, photo, foot, cb } = Sh;

  /* The three printed tick-box rows. A record keeps one short word per row ('yes', 'positive',
     'karl' …); it is only ever compared with an option value and never printed, so a row left
     untouched on screen stays as two empty boxes on the sheet. */
  const FREE_WATER = [['yes', 'Yes'], ['no', 'No']];
  const CRACKLE = [['positive', 'Positive'], ['negative', 'Negative']];
  const METHOD = [['crackle', 'Crackle (est.)'], ['karl', 'Karl Fischer']];

  /* The table only passes a cell through untouched when it is wrapped as raw. Sh.cb, Sh.text and
     Sh.photo are markup helpers that have already escaped everything they carry, so wrap their
     output here; isRaw() keeps this right if a helper ever returns the wrapper itself. */
  const cellHTML = h => (Sh.isRaw(h) ? h : Sh.raw(h));

  const ticks = (cur, opts) => {
    const v = String(cur == null ? '' : cur).trim().toLowerCase();
    return cellHTML(`<div class="lv-l">${opts.map(([k, l]) => cb(v === k, l)).join(' ')}</div>`);
  };

  /* the Parameter cell of the membrane-patch row: title, filter detail and sample volume */
  const patchLabel = d => cellHTML(`<b>Membrane patch</b>
    <div class="lv-sub">0.8 µm pores, vacuum filtered</div>
    <div class="lv-sub">Sample volume: ${Sh.val(d.sampleVolume, '________')} ml</div>`);

  const D = {
    id: 'lvdh',
    name: 'LVDH Test Report for Moisture Removal',
    short: 'LVDH Moisture',
    form: 'PPS-F-03',
    about: 'Moisture removal by low vacuum dehydration, checked by crackle test, ppm and membrane patch.',
    orientation: 'p',
    title: 'LVDH TEST REPORT FOR MOISTURE REMOVAL',
    sub: 'Low Vacuum Dehydration (LVDH)',
    colour: 'gold',
    css: '.lv-l{text-align:left}.lv-sub{margin-top:3px;font-size:11.5px;line-height:1.35}',
    list: { no: 'reportNo', date: 'date', client: 'client', detail: r => D.line(r), next: 'nextDate' },
    sections: [
    { n: '00', title: 'REPORT DETAILS', fields: [
      { k: 'reportNo', l: 'Report no.', t: 'text', w: 2 },
      { k: 'date', l: 'Report date', t: 'date', w: 2 },
      { k: 'sampleDate', l: 'Sample date', t: 'date', w: 2 },
      { k: 'testedBy', l: 'Tested by', t: 'text', w: 2 },
    ] },

      { n: '01', title: 'CLIENT DETAILS', fields: [
        { k: 'client', l: 'Client Name', t: 'text' },
        { k: 'address', l: 'Address', t: 'text' },
        { k: 'contactPerson', l: 'Contact Person', t: 'text', w: 2 },
        { k: 'contactPhone', l: 'Phone / E-mail', t: 'text', w: 2 }
      ] },
      { n: '02', title: 'SPECIMEN DETAILS', fields: [
        { k: 'oilGrade', l: 'Name of Oil / Grade', t: 'text', w: 2 },
        { k: 'oilQty', l: 'Total Oil Qty (L)', t: 'num', w: 2 },
        { k: 'periodUsed', l: 'Period Already Used', t: 'text', w: 2 },
        { k: 'machineUsedOn', l: 'Machine Used On', t: 'text', w: 2 },
        { k: 'application', l: 'Application', t: 'text', w: 2 },
        { k: 'lvdhModel', l: 'LVDH Model / Sr. No.', t: 'text', w: 2 },
        { k: 'serviceStart', l: 'Service Start Date', t: 'date', w: 2 },
        { k: 'serviceEnd', l: 'Service End Date', t: 'date', w: 2 }
      ] },
      { n: '03', title: 'TEST RESULTS', fields: [
        { k: 'appearanceB', l: 'Visual appearance — before cleaning', t: 'text', w: 2 },
        { k: 'appearanceA', l: 'Visual appearance — after cleaning', t: 'text', w: 2 },
        { k: 'freeWaterB', l: 'Free water / droplets seen — before', t: 'radios', w: 2, opts: FREE_WATER },
        { k: 'freeWaterA', l: 'Free water / droplets seen — after', t: 'radios', w: 2, opts: FREE_WATER },
        { k: 'crackleB', l: 'Hot-plate crackle test — before', t: 'radios', w: 2, opts: CRACKLE },
        { k: 'crackleA', l: 'Hot-plate crackle test — after', t: 'radios', w: 2, opts: CRACKLE },
        { k: 'ppmB', l: 'Moisture content (ppm) — before', t: 'num', w: 2 },
        { k: 'ppmA', l: 'Moisture content (ppm) — after', t: 'num', w: 2 },
        { k: 'methodB', l: 'Test method for ppm — before', t: 'radios', w: 2, opts: METHOD },
        { k: 'methodA', l: 'Test method for ppm — after', t: 'radios', w: 2, opts: METHOD },
        { k: 'sampleVolume', l: 'Sample volume (ml)', t: 'num', w: 2 },
        { k: 'patchB', l: 'Membrane patch — before cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchA', l: 'Membrane patch — after cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'obsB', l: 'Observations — before', t: 'area', w: 2, rows: 2 },
        { k: 'obsA', l: 'Observations — after', t: 'area', w: 2, rows: 2 }
      ] },
      { n: '04', title: 'IMPRESSION', fields: [
        { k: 'impression', l: 'Impression', t: 'area', rows: 4 }
      ] },
      { n: '05', title: 'SIGNATURES', open: true, fields: [
        { k: 'clientAckName', l: 'Client Acknowledgement — name', t: 'text', w: 2 },
        { k: 'clientAckRemarks', l: 'Client — remarks', t: 'text', w: 2 },
        { k: 'clientSign', l: 'Client — signature & seal', t: 'sig', w: 2 },
        { k: 'analysedBy', l: 'Analysed by (PPS) — name', t: 'text', w: 1 },
        { k: 'analysedDate', l: 'Date', t: 'date', w: 1 },
        { k: 'analysedSign', l: 'Analysed by — signature', t: 'sig', w: 2 }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ],
    notes: [
      'A change in oil colour reflects a change in minute constituents of the oil. It does not mean the basic qualities of the oil have changed.',
      'The crackle test is a qualitative screen (typical detection ~500 ppm). Exact water content requires Karl Fischer titration (ASTM D6304).',
      'The membrane patch shows solid (particulate) contamination. Moisture removal is assessed by the tests above.'
    ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', date: C.today(), sampleDate: C.today(), testedBy: '',
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => {
    const rows = [
      ['Visual appearance', d.appearanceB, d.appearanceA],
      { cells: ['Free water / droplets seen', ticks(d.freeWaterB, FREE_WATER), ticks(d.freeWaterA, FREE_WATER)] },
      { cells: ['Hot-plate crackle test', ticks(d.crackleB, CRACKLE), ticks(d.crackleA, CRACKLE)] },
      ['Moisture content (ppm)', d.ppmB, d.ppmA],
      { cells: ['Test method for ppm', ticks(d.methodB, METHOD), ticks(d.methodA, METHOD)] },
      { cells: [
        patchLabel(d),
        cellHTML(photo(d.patchB, 'Affix membrane patch – before cleaning', { h: 190 })),
        cellHTML(photo(d.patchA, 'Affix membrane patch – after cleaning', { h: 190 }))
      ] },
      { cells: ['Observations', cellHTML(Sh.text(d.obsB)), cellHTML(Sh.text(d.obsA))] }
    ];
    return Sh.head() + Sh.rule() +
      Sh.band(D.title, D.sub, D.form) +
      meta([['REF. NO.', d.reportNo], ['DATE', d.date, 1], ['SAMPLE DATE', d.sampleDate, 1], ['TESTED BY', d.testedBy]]) +
      sec('01', 'CLIENT DETAILS') +
      kv([
        { k: 'Client Name', v: d.client, full: true },
        { k: 'Address', v: d.address, full: true },
        { k: 'Contact Person', v: d.contactPerson },
        { k: 'Phone / E-mail', v: d.contactPhone }
      ]) +
      sec('02', 'SPECIMEN DETAILS') +
      kv([
        { k: 'Name of Oil / Grade', v: d.oilGrade },
        { k: 'Total Oil Qty (L)', v: d.oilQty },
        { k: 'Period Already Used', v: d.periodUsed },
        { k: 'Machine Used On', v: d.machineUsedOn },
        { k: 'Application', v: d.application },
        { k: 'LVDH Model / Sr. No.', v: d.lvdhModel },
        { k: 'Service Start Date', v: d.serviceStart, d: 1 },
        { k: 'Service End Date', v: d.serviceEnd, d: 1 }
      ]) +
      sec('03', 'TEST RESULTS') +
      table({ head: ['Parameter', 'Before Cleaning', 'After Cleaning'], align: ['l', 'c', 'c'], widths: ['30%', '35%', '35%'], rows }) +
      sec('04', 'NOTES') +
      `<ol class="sh-list">${D.notes.map(t => `<li>${Sh.esc(t)}</li>`).join('')}</ol>` +
      box('IMPRESSION', Sh.text(d.impression), { min: 110 }) +
      sig([
        { title: 'Client Acknowledgement', rows: [['Name', d.clientAckName], ['Remarks', d.clientAckRemarks]], sign: d.clientSign, signLabel: 'Signature & Seal' },
        { title: 'Analysed By (Prime Power Systems)', rows: [['Name', d.analysedBy || d.testedBy], ['Date', d.analysedDate, 1]], sign: d.analysedSign, signLabel: 'Signature' }
      ]) +
      foot();
  };

  /* one line for the records list */
  D.line = d => {
    const bits = [];
    if (Sh.has(d.ppmB) || Sh.has(d.ppmA)) bits.push(`Moisture ${Sh.val(d.ppmB, '—')} → ${Sh.val(d.ppmA, '—')} ppm`);
    if (Sh.has(d.lvdhModel)) bits.push(`LVDH ${Sh.val(d.lvdhModel)}`);
    return bits.join(' · ');
  };

  root.PPSReports.register(D);
})(window);
