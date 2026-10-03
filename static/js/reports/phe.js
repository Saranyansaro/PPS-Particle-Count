/* PPS-F-04  PHE SERVICE REPORT
   Plate heat exchanger service: the problem found, the washing / DP-test checklist,
   the remarks and the two sign-offs (customer seal, service engineer). */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { head, rule, band, meta, sec, kv, table, box, text, sig, foot, cols, cb, raw } = Sh;

  /* The twelve checklist activities: one list feeds the entry grid and the two sheet tables. */
  const CHK_ROWS = [
    ['water', 'Water Washing'],
    ['acid', 'Acid Washing'],
    ['diesel', 'Diesel Washing'],
    ['dp', 'DP Test'],
    ['gasketDmg', 'Gasket Damaged'],
    ['gasketRep', 'Gasket Replaced'],
    ['pinHoles', 'Pin Holes'],
    ['plateDmg', 'Plate Damaged'],
    ['plateRep', 'Plate Replaced'],
    ['running', 'PHE Running Condition OK'],
    ['interMix', 'Inter Mixing'],
    ['leakage', 'PHE Leakage']
  ];
  const CHK_COLS = [
    { c: 'yes', l: 'Yes', t: 'check' },
    { c: 'no', l: 'No', t: 'check' },
    { c: 'qty', l: 'Qty / Remarks', t: 'text' }
  ];

  /* one checklist cell out of the record (grid keys are flat: chk__row__col) */
  const gc = (d, row, col) => d[F.gridKey('chk', row, col)];

  /* one of the two side-by-side checklist tables: the four columns of the printed form */
  const chkTable = (d, rows) => table({
    head: ['Activity / Check', 'Yes', 'No', 'Qty / Remarks'],
    align: ['l', 'c', 'c', 'l'],
    widths: ['52%', '11%', '11%', '26%'],
    rows: rows.map(([k, label]) => ({
      cells: [label, raw(cb(gc(d, k, 'yes'))), raw(cb(gc(d, k, 'no'))), gc(d, k, 'qty')]
    }))
  });

  const D = {
    id: 'phe',
    name: 'PHE Service Report',
    short: 'PHE Service',
    form: 'PPS-F-04',
    about: 'Plate heat exchanger service: the problem found, the checklist, and the plates, gaskets and other parts replaced.',
    orientation: 'p',
    colour: 'gold',
    title: 'PHE SERVICE REPORT',
    sub: 'Plate Heat Exchanger Service',
    list: { no: 'reportNo', date: 'visitDate', client: 'customer', detail: r => [r.pheModel, r.pheLocation].filter(Boolean).join(' · '), next: 'nextDate' },
    css: '.ph-svc{display:flex;flex-wrap:wrap;align-items:center;gap:28px;padding:6px 0 2px}.ph-svc>b{font-weight:700;white-space:nowrap}',
    sections: [
    { n: '00', title: 'REPORT DETAILS', fields: [
      { k: 'date', l: 'Report date', t: 'date', w: 2 },
    ] },

      { n: '00', title: 'REPORT DETAILS', fields: [
        { k: 'reportNo', l: 'Report No.', t: 'text', w: 1 },
        { k: 'visitDate', l: 'Date of Visit', t: 'date', w: 1 },
        { k: 'serviceStatus', l: 'Service Status', t: 'select', w: 1, opts: [['', '—'], ['Completed', 'Completed'], ['In Progress', 'In Progress'], ['Pending', 'Pending']] },
        { k: 'engineer', l: 'Service Engineer', t: 'text', w: 1 }
      ] },
      { n: '01', title: 'CUSTOMER DETAILS', fields: [
        { k: 'customer', l: 'Customer', t: 'text' },
        { k: 'address', l: 'Address', t: 'text' },
        { k: 'contactPerson', l: 'Contact Person', t: 'text', w: 2 },
        { k: 'phone', l: 'Phone', t: 'text', w: 2 }
      ] },
      { n: '02', title: 'EQUIPMENT DETAILS', fields: [
        { k: 'pheModel', l: 'PHE Model', t: 'text', w: 2 },
        { k: 'srNo', l: 'S/R No.', t: 'text', w: 2 },
        { k: 'pheCount', l: 'No. of PHE', t: 'num', w: 2 },
        { k: 'mcId', l: 'M/C ID', t: 'text', w: 2 },
        { k: 'pheLocation', l: 'PHE Location', t: 'text', w: 2 },
        { k: 'serviceType', l: 'Service Type', t: 'text', w: 2 },
        { k: 'warranty', l: 'Service Status', t: 'group', w: 4, items: [['warranty', 'Warranty'], ['amc', 'AMC'], ['paid', 'Paid']] }
      ] },
      { n: '03', title: 'NATURE OF PROBLEM', fields: [
        { k: 'problem', l: 'Nature of Problem', t: 'area', rows: 4 }
      ] },
      { n: '04', title: 'SERVICE CHECKLIST', fields: [
        { k: 'chk', l: 'Service Checklist', t: 'grid', cols: CHK_COLS, rows: CHK_ROWS },
        { k: 'startService', l: 'Start of Service', t: 'text', w: 2 },
        { k: 'endService', l: 'End of Service', t: 'text', w: 2 }
      ] },
      { n: '05', title: 'REMARKS', fields: [
        { k: 'remarks', l: 'Remarks', t: 'area', rows: 4 }
      ] },
      { n: '06', title: 'SIGNATURES', fields: [
        { k: 'custName', l: 'Customer — Name', t: 'text', w: 2 },
        { k: 'custDesignation', l: 'Customer — Designation', t: 'text', w: 2 },
        { k: 'custPhone', l: 'Customer — Phone', t: 'text', w: 2 },
        { k: 'custEmail', l: 'Customer — E-mail', t: 'text', w: 2 },
        { k: 'custSign', l: 'Customer — signature & seal', t: 'sig', w: 2, hint: 'Tap to sign' },
        { k: 'engName', l: 'Service Engineer — Name', t: 'text', w: 2 },
        { k: 'engPhone', l: 'Service Engineer — Phone', t: 'text', w: 2 },
        { k: 'engDate', l: 'Date', t: 'date', w: 2 },
        { k: 'engSign', l: 'Service Engineer — signature', t: 'sig', w: 2, hint: 'Tap to sign' }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', date: C.today(), visitDate: C.today(), serviceStatus: '', engineer: '',
    warranty: false, amc: false, paid: false,
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => head() + rule() +
    band(D.title, D.sub, D.form) +
    meta([
      ['REPORT NO.', d.reportNo],
      ['DATE OF VISIT', d.visitDate, 1],
      ['SERVICE STATUS', d.serviceStatus],
      ['SERVICE ENGINEER', d.engineer]
    ]) +
    sec('01', 'CUSTOMER DETAILS') +
    kv([
      { k: 'Customer', v: d.customer, full: true },
      { k: 'Address', v: d.address, full: true },
      { k: 'Contact Person', v: d.contactPerson },
      { k: 'Phone', v: d.phone }
    ]) +
    sec('02', 'EQUIPMENT DETAILS') +
    kv([
      { k: 'PHE Model', v: d.pheModel },
      { k: 'S/R No.', v: d.srNo },
      { k: 'No. of PHE', v: d.pheCount },
      { k: 'M/C ID', v: d.mcId },
      { k: 'PHE Location', v: d.pheLocation },
      { k: 'Service Type', v: d.serviceType }
    ]) +
    `<div class="ph-svc"><b>Service Status:</b>${cb(d.warranty, 'Warranty')}${cb(d.amc, 'AMC')}${cb(d.paid, 'Paid')}</div>` +
    sec('03', 'NATURE OF PROBLEM') +
    box('', text(d.problem), { min: 64 }) +
    sec('04', 'SERVICE CHECKLIST') +
    cols(chkTable(d, CHK_ROWS.slice(0, 6)), chkTable(d, CHK_ROWS.slice(6))) +
    kv([
      { k: 'Start of Service', v: d.startService },
      { k: 'End of Service', v: d.endService }
    ]) +
    box('REMARKS', text(d.remarks), { min: 95 }) +
    sig([
      { title: 'Customer', rows: [['Name', d.custName], ['Designation', d.custDesignation], ['Phone', d.custPhone], ['E-mail', d.custEmail]], sign: d.custSign, signLabel: 'Seal & Sign' },
      { title: 'Service Engineer (Prime Power Systems)', rows: [['Name', d.engName], ['Phone', d.engPhone], ['Date', d.engDate, 1]], sign: d.engSign, signLabel: 'Signature' }
    ]) +
    foot();

  root.PPSReports.register(D);
})(window);
