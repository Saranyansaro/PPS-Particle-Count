/* PPS-F-06  FIELD SERVICE REPORT
   One landscape sheet for a service visit: who we visited, which machine, what was found
   and done, the 22-point component checklist, and the two signatures taken on site. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { sec, kv, meta, table, cb, text, sig, foot } = Sh;

  /* The component checklist is written once: the entry screen draws it as a grid field and the
     sheet draws it as the printed table (Reading typed, Checked / To Attend ticked). */
  const COMP = [
    ['cur', 'Current (mA)'],
    ['volt', 'Voltage (kV)'],
    ['hour', 'Hour Meter'],
    ['float', 'Float Switch'],
    ['limit', 'Limit Switch'],
    ['mr3', 'MR-3 Relay'],
    ['pvc', 'PVC Plate'],
    ['loose', 'Loose Connection'],
    ['motor', 'Motor'],
    ['strainer', 'Strainer'],
    ['pump', 'Pump'],
    ['leak', 'Oil Leakage'],
    ['bulb', 'Indicating Bulb'],
    ['elcb', 'ELCB'],
    ['collector', 'Collector Stock'],
    ['membrane', 'Membrane Stock'],
    ['cckit', 'C.C. Kit'],
    ['fuses', 'Fuses'],
    ['castor', 'Castor Wheel'],
    ['oilTemp', 'Temperature of Oil'],
    ['oilGrade', 'Grade of Oil'],
    ['others', 'Others']
  ];

  const D = {
    id: 'fieldService',
    name: 'Field Service Report',
    short: 'Field Service',
    form: 'PPS-F-06',
    about: 'On-site service call for ELC / oil purification equipment, with the 22-point component checklist.',
    orientation: 'l',
    title: 'FIELD SERVICE REPORT',
    sub: 'ELC / Oil Purification Equipment Service',
    colour: 'gold',
    /* the landscape sheet: a narrow left column of details and a wide checklist on the right */
    css: `.fs-cols{display:grid;grid-template-columns:minmax(0,47fr) minmax(0,53fr);column-gap:14px;align-items:start}
.fs-col{min-width:0}
.fs-status{display:flex;align-items:center;flex-wrap:wrap;gap:4px 18px;margin:4px 0 8px;font-size:11px}
.fs-status b{font-weight:700}
.fs-svc>table+table{margin-top:4px}
.fs-tall{min-height:120px}
.fs-check td{vertical-align:middle}`,
    list: {
      no: 'reportNo',
      date: 'visitDate',
      client: 'customer',
      detail: r => [r.machineModel, r.serviceType].filter(Boolean).join(' · '),
      next: 'nextDate'
    },
    sections: [
    { n: '00', title: 'REPORT DETAILS', fields: [
      { k: 'reportNo', l: 'Report no.', t: 'text', w: 2 },
      { k: 'visitDate', l: 'Date of visit', t: 'date', w: 2 },
      { k: 'startService', l: 'Start of service', t: 'date', w: 1 },
      { k: 'endService', l: 'End of service', t: 'date', w: 1 },
      { k: 'engineer', l: 'Service engineer', t: 'text', w: 2 },
    ] },

      { n: '01', title: 'CUSTOMER DETAILS', fields: [
        { k: 'customer', l: 'Customer', t: 'text' },
        { k: 'address', l: 'Address', t: 'text' },
        { k: 'contactPerson', l: 'Contact Person', t: 'text', w: 2 },
        { k: 'phone', l: 'Phone', t: 'text', w: 2 }
      ] },
      { n: '02', title: 'MACHINE DETAILS', fields: [
        { k: 'machineModel', l: 'Machine Model', t: 'text', w: 2 },
        { k: 'srNo', l: 'Sr. No.', t: 'text', w: 2 },
        { k: 'serviceType', l: 'Service Type', t: 'text', w: 2, ph: 'Breakdown / Preventive / Installation' },
        { k: 'machineId', l: 'Machine ID', t: 'text', w: 2 },
        { k: 'warranty', l: 'Warranty', t: 'check', cl: 'Warranty', w: 1 },
        { k: 'postWarranty', l: 'Post Warranty', t: 'check', cl: 'Post Warranty', w: 1 },
        { k: 'amc', l: 'AMC', t: 'check', cl: 'AMC', w: 1 },
        { k: 'paid', l: 'Paid', t: 'check', cl: 'Paid', w: 1 }
      ] },
      { n: '03', title: 'SERVICE DETAILS', fields: [
        { k: 'problem', l: 'Nature of Problem', t: 'area', rows: 3 },
        { k: 'rectification', l: 'Rectification', t: 'area', rows: 3 },
        { k: 'oilPatchTest', l: 'Oil Patch Test', t: 'area', rows: 3 },
        { k: 'materialReplaced', l: 'Material Replaced', t: 'area', rows: 3 },
        { k: 'materialToReplace', l: 'Material to be Replaced', t: 'area', rows: 3 },
        { k: 'serviceRemarks', l: 'Remarks / Recommendations', t: 'area', rows: 3 }
      ] },
      { n: '04', title: 'COMPONENT CHECKLIST', fields: [
        { k: 'comp', l: 'Component checklist', t: 'grid',
          cols: [
            { c: 'reading', l: 'Reading', t: 'text' },
            { c: 'checked', l: 'Checked', t: 'check' },
            { c: 'attend', l: 'To Attend', t: 'check' }
          ],
          rows: COMP.map(([id, l], i) => [id, `${i + 1}. ${l}`]) }
      ] },
      { n: '05', title: 'SIGNATURES', fields: [
        { k: 'custName', l: 'Customer — name', t: 'text', w: 2 },
        { k: 'engName', l: 'Field Engineer (PPS) — name', t: 'text', w: 2 },
        { k: 'custSign', l: 'Customer — seal & sign', t: 'sig', w: 2 },
        { k: 'engSign', l: 'Field Engineer (PPS) — signature', t: 'sig', w: 2 }
      ] },
    { n: '98', title: 'STATUS & FOLLOW-UP (kept in Records, not printed)', open: false, fields: [
      { k: 'status', l: 'Status', t: 'select', w: 2, opts: C.SERVICE_STATUSES.map(s => [s, s]) },
      { k: 'nextDate', l: 'Next step date', t: 'date', w: 2 },
      { k: 'nextStep', l: 'Next step', t: 'text' }
    ] }
  ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', visitDate: C.today(), startService: C.today(), endService: '', engineer: '',
    warranty: false, postWarranty: false, amc: false, paid: false,
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => {
    const g = (row, col) => d[F.gridKey('comp', row, col)];
    /* a tall body cell: three of them side by side make one service-details block */
    const tall = v => Sh.raw(`<div class="fs-tall">${text(v)}</div>`);
    const svc = (head, vals) => table({
      head, align: ['l', 'l', 'l'], cls: 'fs-svc', widths: ['34%', '33%', '33%'],
      rows: [{ cells: vals.map(tall) }]
    });

    const serviceStatus = `<div class="fs-status"><b>Service Status:</b>${cb(!!d.warranty, 'Warranty')}${cb(!!d.postWarranty, 'Post Warranty')}${cb(!!d.amc, 'AMC')}${cb(!!d.paid, 'Paid')}</div>`;

    const checklist = table({
      head: ['Component', 'Reading', 'Checked', 'To Attend'],
      align: ['l', 'l', 'c', 'c'],
      cls: 'fs-check',
      widths: ['48%', '22%', '15%', '15%'],
      rows: COMP.map(([id, l], i) => ({ cells: [
        `${i + 1}. ${l}`,
        g(id, 'reading'),
        Sh.raw(cb(!!g(id, 'checked'))),
        Sh.raw(cb(!!g(id, 'attend')))
      ] }))
    });

    const left =
      sec('01', 'CUSTOMER DETAILS') +
      kv([
        { k: 'Customer', v: d.customer, full: true },
        { k: 'Address', v: d.address, full: true },
        { k: 'Contact Person', v: d.contactPerson },
        { k: 'Phone', v: d.phone }
      ]) +
      sec('02', 'MACHINE DETAILS') +
      kv([
        { k: 'Machine Model', v: d.machineModel },
        { k: 'Sr. No.', v: d.srNo },
        { k: 'Service Type', v: d.serviceType },
        { k: 'Machine ID', v: d.machineId }
      ]) +
      serviceStatus +
      sec('03', 'SERVICE DETAILS') +
      `<div class="fs-svc">` +
        svc(['Nature of Problem', 'Rectification', 'Oil Patch Test'], [d.problem, d.rectification, d.oilPatchTest]) +
        svc(['Material Replaced', 'Material to be Replaced', 'Remarks / Recommendations'], [d.materialReplaced, d.materialToReplace, d.serviceRemarks]) +
      `</div>` +
      sig([
        { title: 'Customer', rows: [['Name', d.custName]], sign: d.custSign, signLabel: 'Seal & Sign' },
        { title: 'Field Engineer (PPS)', rows: [['Name', d.engName]], sign: d.engSign, signLabel: 'Signature' }
      ]);

    const right = sec('04', 'COMPONENT CHECKLIST') + checklist;

    return Sh.head() + Sh.rule() +
      Sh.band(D.title, D.sub, D.form) +
      meta([
        ['REPORT NO.', d.reportNo],
        ['DATE OF VISIT', d.visitDate, 1],
        ['START OF SERVICE', d.startService, 1],
        ['END OF SERVICE', d.endService, 1],
        ['SERVICE ENGINEER', d.engineer]
      ]) +
      `<div class="fs-cols"><div class="fs-col">${left}</div><div class="fs-col">${right}</div></div>` +
      foot();
  };

  /* one line for the records list: what still has to be attended to, else the kind of visit */
  D.line = d => {
    const attend = COMP.filter(([id]) => d[F.gridKey('comp', id, 'attend')]).map(([, l]) => l);
    if (attend.length) return `To attend: ${Sh.esc(attend.slice(0, 3).join(', '))}${attend.length > 3 ? ` +${attend.length - 3}` : ''}`;
    return Sh.has(d.serviceType) ? Sh.esc(d.serviceType) : '';
  };

  root.PPSReports.register(D);
})(window);
