/* PPS-F-01  EQUIPMENT COMMISSIONING & ACCEPTANCE REPORT
   Electrostatic Liquid Cleaner (ELC): what was supplied and received, the 0.8 µm membrane
   patch test before and after cleaning, and the customer's acceptance signature. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { sec, kv, table, box, meta, sig, photo, note, foot, cb } = Sh;

  /* ---------- the equipment list, used by both the entry screen and the sheet ---------- */
  const ACC = [
    ['elc', 'Electrostatic Liquid Cleaner (ELC)'],
    ['collectors', 'Collectors'],
    ['suctionHose', "5 m Suction Hose with 'Y' Strainer"],
    ['deliveryHose', '5 m Delivery Hose'],
    ['oilSeals', 'Oil Seals for Pump'],
    ['ringSpanner', 'Ring Spanner for Top Cover'],
    ['oringTop', "'O' Ring for Top Cover"],
    ['oringProbe', "'O' Ring for PVC Probe"],
    ['gasketProbe', 'Gasket for PVC Probe'],
    ['manual', 'Operation Manual'],
    ['other', 'Other (see field below)']
  ];

  /* ---------- small helpers, kept inside this file ---------- */
  /* a stored tick may come back as a real boolean, or as text from an older record */
  const on = v => v === true || v === 1 || /^(1|true|yes|on|y)$/i.test(String(v == null ? '' : v).trim());
  /* grid cell keys are made by the shared form builder, so the sheet reads the same keys */
  const ak = (row, col) => F.gridKey('acc', row, col);

  /* a membrane patch photograph: the picture, or a dashed space to affix the patch on */
  const patchPhoto = src => Sh.raw(photo(src, 'Affix membrane patch', { h: 150 }));
  /* the two handwritten lines printed under every patch photograph */
  const patchLines = (date, hours) => Sh.raw(`<div class="ec-dl"><span>Date:</span><span>${Sh.day(date)}</span><span>Hour meter:</span><span>${Sh.val(hours)}</span></div>`);

  /* the wording printed on the form: the last sentence is the one set in bold */
  const DECL_TEXT = 'The equipment has been installed and commissioned by Prime Power Systems in the presence of the customer\u2019s representatives, who were trained on its operation and maintenance. ';
  const DECL_SIGN = 'Kindly sign below to accept receipt of the equipment in good working condition.';

  const D = {
    id: 'elcComm',
    name: 'Equipment Commissioning & Acceptance Report',
    short: 'ELC Commissioning',
    form: 'PPS-F-01',
    about: 'Installing an ELC machine and handing it over: accessories supplied, first patch test and the customer\'s acceptance signature.',
    orientation: 'p',
    colour: 'gold',
    title: 'EQUIPMENT COMMISSIONING & ACCEPTANCE REPORT',
    sub: 'Electrostatic Liquid Cleaner (ELC)',
    /* the little extra styling this page needs, all of it ec- prefixed */
    css: `.ec-dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:1px 6px;font-size:10.5px;color:#555}
.ec-dl span:nth-child(odd){white-space:nowrap}
.ec-dl span:nth-child(even){border-bottom:1px dotted #9a9a9a;color:#1f1f21;font-weight:600;min-height:14px;overflow-wrap:anywhere}`,
    list: {
      no: 'reportNo',
      date: 'date',
      client: 'company',
      detail: r => [r.machineInstalledOn, r.oilGrade].filter(Boolean).join(' · '),
      next: 'nextDate'
    },
    sections: [
    { n: '00', title: 'REPORT DETAILS', fields: [
      { k: 'reportNo', l: 'Report no.', t: 'text', w: 2 },
      { k: 'date', l: 'Report date', t: 'date', w: 2 },
    ] },

      { n: '01', title: 'ORDER & PO DETAILS', fields: [
        { k: 'poNo', l: 'Order / PO No.', t: 'text', w: 2 },
        { k: 'poDate', l: 'PO Date', t: 'date', w: 2 }
      ] },
      { n: '02', title: 'CUSTOMER & INSTALLATION DETAILS', fields: [
        { k: 'company', l: 'Company Name', t: 'text', w: 2 },
        { k: 'plant', l: 'Plant / Location', t: 'text', w: 2 },
        { k: 'machineInstalledOn', l: 'Machine Installed On', t: 'text', w: 2 },
        { k: 'segment', l: 'Segment / Application', t: 'text', w: 2 },
        { k: 'oilGrade', l: 'Oil Grade', t: 'text', w: 2 },
        { k: 'oilQty', l: 'Oil Quantity (L)', t: 'num', w: 2 },
        { k: 'machineOem', l: 'Machine OEM', t: 'text', w: 2 },
        { k: 'oemContact', l: 'OEM Contact / Ph.', t: 'text', w: 2 },
        { k: 'oemAddress', l: 'OEM Address', t: 'text', w: 4 }
      ] },
      { n: '03', title: 'EQUIPMENT & ACCESSORIES SUPPLIED', fields: [
        { k: 'acc', l: 'Accessories supplied', t: 'grid',
          cols: [
            { c: 'model', l: 'Model / Serial No.', t: 'text' },
            { c: 'qty', l: 'Qty', t: 'text' },
            { c: 'yes', l: 'Yes', t: 'check' },
            { c: 'no', l: 'No', t: 'check' }
          ],
          rows: ACC.map(([id, what], i) => [id, `${i + 1}. ${what}`]) },
        { k: 'accessoryOther', l: 'Other item — description', t: 'text', w: 4 },
        { k: 'pumpType', l: 'ELC Oil Pump Type', t: 'text', w: 2 },
        { k: 'pumpSr', l: 'Pump Sr. No. / Make', t: 'text', w: 2 }
      ] },
      { n: '04', title: 'OIL PURITY — 0.8 MICRON MEMBRANE PATCH TEST', fields: [
        { k: 'sampleVolume', l: 'Sample volume (ml)', t: 'num', w: 2 },
        { k: 'patch1', l: 'Membrane patch — before cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchDate1', l: 'Date — before cleaning', t: 'date', w: 1 },
        { k: 'patchHours1', l: 'Hour meter — before cleaning', t: 'text', w: 1 },
        { k: 'patch2', l: 'Membrane patch — after cleaning 1', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchDate2', l: 'Date — after cleaning 1', t: 'date', w: 1 },
        { k: 'patchHours2', l: 'Hour meter — after cleaning 1', t: 'text', w: 1 },
        { k: 'patch3', l: 'Membrane patch — after cleaning 2', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchDate3', l: 'Date — after cleaning 2', t: 'date', w: 1 },
        { k: 'patchHours3', l: 'Hour meter — after cleaning 2', t: 'text', w: 1 },
        { k: 'patch4', l: 'Membrane patch — after cleaning 3', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchDate4', l: 'Date — after cleaning 3', t: 'date', w: 1 },
        { k: 'patchHours4', l: 'Hour meter — after cleaning 3', t: 'text', w: 1 }
      ] },
      { n: '05', title: 'COMMISSIONING DECLARATION & SIGN-OFF', open: true, fields: [
        { t: 'note', cl: DECL_TEXT + DECL_SIGN },
        { k: 'custName', l: 'Customer — name', t: 'text', w: 2 },
        { k: 'custDesignation', l: 'Customer — designation', t: 'text', w: 2 },
        { k: 'custMobile', l: 'Customer — mobile / e-mail', t: 'text', w: 2 },
        { k: 'custSign', l: 'Customer — signature & seal', t: 'sig', w: 2 },
        { k: 'ppsName', l: 'Commissioned by (PPS) — name', t: 'text', w: 2 },
        { k: 'ppsDesignation', l: 'Commissioned by (PPS) — designation', t: 'text', w: 2 },
        { k: 'ppsDate', l: 'Date of commissioning', t: 'date', w: 2 },
        { k: 'ppsSign', l: 'Commissioned by (PPS) — signature', t: 'sig', w: 2 }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', date: C.today(), poNo: '', poDate: '',
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => {
    /* 02 – one row per item: Sr. | description | model / serial | qty | Received OK */
    const accRows = ACC.map(([id, what], i) => ({ cells: [
      String(i + 1),
      id === 'other' ? Sh.raw(Sh.val(d.accessoryOther)) : what,
      d[ak(id, 'model')],
      d[ak(id, 'qty')],
      Sh.raw(cb(on(d[ak(id, 'yes')]), 'Yes') + '&nbsp;&nbsp; ' + cb(on(d[ak(id, 'no')]), 'No'))
    ] }));

    /* 03 – the four patch columns: the photograph in one row, the date and hour meter in the next */
    const patchPhotos = { cells: [patchPhoto(d.patch1), patchPhoto(d.patch2), patchPhoto(d.patch3), patchPhoto(d.patch4)] };
    const patchLinesRow = { cells: [
      patchLines(d.patchDate1, d.patchHours1),
      patchLines(d.patchDate2, d.patchHours2),
      patchLines(d.patchDate3, d.patchHours3),
      patchLines(d.patchDate4, d.patchHours4)
    ] };

    /* 04 – the declaration, with the sentence the customer signs against set in bold */
    const decl = `<div class="sh-txt">${Sh.esc(DECL_TEXT)}<b>${Sh.esc(DECL_SIGN)}</b></div>`;

    return Sh.head() + Sh.rule() +
      Sh.band(D.title, D.sub, D.form) +
      meta([['REPORT NO.', d.reportNo], ['DATE', d.date, 1], ['ORDER / PO NO.', d.poNo], ['PO DATE', d.poDate, 1]]) +
      sec('01', 'CUSTOMER & INSTALLATION DETAILS') +
      kv([
        { k: 'Company Name', v: d.company },
        { k: 'Plant / Location', v: d.plant },
        { k: 'Machine Installed On', v: d.machineInstalledOn },
        { k: 'Segment / Application', v: d.segment },
        { k: 'Oil Grade', v: d.oilGrade },
        { k: 'Oil Quantity (L)', v: d.oilQty },
        { k: 'Machine OEM', v: d.machineOem },
        { k: 'OEM Contact / Ph.', v: d.oemContact },
        { k: 'OEM Address', v: d.oemAddress, full: true }
      ]) +
      sec('02', 'EQUIPMENT & ACCESSORIES SUPPLIED') +
      table({
        head: ['Sr.', 'Item Description', 'Model / Serial No.', 'Qty', 'Received OK'],
        align: ['c', 'l', 'l', 'c', 'c'],
        widths: ['6%', '42%', '26%', '10%', '16%'],
        rows: accRows
      }) +
      kv([
        { k: 'ELC Oil Pump Type', v: d.pumpType },
        { k: 'Pump Sr. No. / Make', v: d.pumpSr }
      ]) +
      sec('03', 'OIL PURITY - 0.8 MICRON MEMBRANE PATCH TEST') +
      note(`Oil samples are vacuum filtered through a 0.8 µm membrane before and after cleaning with the equipment. Sample volume: <b>${Sh.val(d.sampleVolume, '______')}</b> ml`) +
      table({
        head: ['Before Cleaning', 'After Cleaning - 1', 'After Cleaning - 2', 'After Cleaning - 3'],
        align: ['c', 'c', 'c', 'c'],
        widths: ['25%', '25%', '25%', '25%'],
        rows: [patchPhotos, patchLinesRow]
      }) +
      sec('04', 'COMMISSIONING DECLARATION') +
      box('', decl, { accent: true }) +
      sig([
        { title: 'Accepted By (Customer)', rows: [
          ['Name', d.custName],
          ['Designation', d.custDesignation],
          ['Mobile / E-mail', d.custMobile]
        ], sign: d.custSign, signLabel: 'Signature & Seal' },
        { title: 'Commissioned By (Prime Power Systems)', rows: [
          ['Name', d.ppsName],
          ['Designation', d.ppsDesignation],
          ['Date', d.ppsDate, 1]
        ], sign: d.ppsSign, signLabel: 'Signature' }
      ]) +
      foot();
  };

  /* one line for the records list */
  D.line = d => {
    const bits = [];
    const got = ACC.filter(([id]) => on(d[ak(id, 'yes')])).length;
    if (got) bits.push(`${got} of ${ACC.length} items received`);
    if (Sh.has(d.pumpType)) bits.push(`Pump: ${Sh.val(d.pumpType)}`);
    return bits.join(' · ');
  };

  root.PPSReports.register(D);
})(window);
