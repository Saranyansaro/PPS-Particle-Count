/* PPS-F-02  ELC TEST REPORT FOR OIL PURITY
   Membrane patch (0.8 µm) before and after electrostatic liquid cleaning. */
(function (root) {
  'use strict';
  const C = root.PPSCalc, Sh = root.PPSSheet, F = root.PPSForm;
  const { sec, kv, table, box, meta, sig, photo, note, foot, cb } = Sh;

  const D = {
    id: 'elcPurity',
    name: 'ELC Test Report for Oil Purity',
    short: 'ELC Oil Purity',
    form: 'PPS-F-02',
    about: 'Membrane patch (0.8 µm) before and after electrostatic liquid cleaning, with the NAS and ISO cleanliness classes.',
    orientation: 'p',
    title: 'ELC TEST REPORT FOR OIL PURITY',
    sub: 'Electrostatic Liquid Cleaning (ELC)',
    colour: 'gold',
    list: { no: 'reportNo', date: 'date', client: 'client', detail: r => [r.elcModel, r.oilGrade].filter(Boolean).join(' · '), next: 'nextDate' },
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
        { k: 'elcModel', l: 'ELC Model / Sr. No.', t: 'text', w: 2 },
        { k: 'serviceStart', l: 'Service Start Date', t: 'date', w: 2 },
        { k: 'serviceEnd', l: 'Service End Date', t: 'date', w: 2 }
      ] },
      { n: '03', title: 'TEST RESULTS', fields: [
        { k: 'patchBefore', l: 'Membrane patch — before cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'patchAfter', l: 'Membrane patch — after cleaning', t: 'img', w: 2, hint: 'Tap to add a photo of the patch' },
        { k: 'appearanceBefore', l: 'Visual appearance / colour — before', t: 'text', w: 2 },
        { k: 'appearanceAfter', l: 'Visual appearance / colour — after', t: 'text', w: 2 },
        { k: 'nasBefore', l: 'Cleanliness class (NAS 1638) — before', t: 'text', w: 2 },
        { k: 'nasAfter', l: 'Cleanliness class (NAS 1638) — after', t: 'text', w: 2 },
        { k: 'isoBefore', l: 'Cleanliness code (ISO 4406) — before', t: 'text', w: 2, ph: 'e.g. 20/18/15' },
        { k: 'isoAfter', l: 'Cleanliness code (ISO 4406) — after', t: 'text', w: 2, ph: 'e.g. 16/14/11' },
        { k: 'obsBefore', l: 'Observations — before', t: 'area', w: 2, rows: 2 },
        { k: 'obsAfter', l: 'Observations — after', t: 'area', w: 2, rows: 2 },
        { k: 'sampleVolume', l: 'Sample volume (ml)', t: 'num', w: 2 },
        { k: 'solvent', l: 'Dilution solvent used', t: 'text', w: 2 }
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
      'The oil sample is diluted with a filtered solvent to reduce viscosity before membrane filtration.',
      'Results relate only to the samples tested.'
    ]
  };

  D.blank = () => Object.assign(F.keys(D), {
    reportNo: '', date: C.today(), sampleDate: C.today(), testedBy: '',
    status: 'Draft', nextDate: '', nextStep: ''
  });

  D.render = d => {
    const patchRow = ['Membrane patch (0.8 µm)', photo(d.patchBefore, 'Affix membrane patch', { h: 170 }), photo(d.patchAfter, 'Affix membrane patch', { h: 170 })];
    const rows = [
      { cells: patchRow },
      ['Visual appearance / colour', d.appearanceBefore, d.appearanceAfter],
      ['Cleanliness class (NAS 1638)', d.nasBefore, d.nasAfter],
      ['Cleanliness code (ISO 4406)', d.isoBefore, d.isoAfter],
      { cells: ['Observations', Sh.text(d.obsBefore), Sh.text(d.obsAfter)] }
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
        { k: 'ELC Model / Sr. No.', v: d.elcModel },
        { k: 'Service Start Date', v: d.serviceStart, d: 1 },
        { k: 'Service End Date', v: d.serviceEnd, d: 1 }
      ]) +
      sec('03', 'TEST RESULTS') +
      table({ head: ['Parameter', 'Before Cleaning', 'After Cleaning'], align: ['l', 'c', 'c'], widths: ['30%', '35%', '35%'], rows }) +
      note(`Membrane filter: 0.8 µm pores, vacuum filtered. &nbsp; Sample volume: <b>${Sh.val(d.sampleVolume, '______')}</b> ml &nbsp;&nbsp; Dilution solvent used: <b>${Sh.val(d.solvent, '____________')}</b>`) +
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
    if (Sh.has(d.isoBefore)) bits.push(`ISO ${Sh.val(d.isoBefore)}${Sh.has(d.isoAfter) ? ' → ' + Sh.val(d.isoAfter) : ''}`);
    if (Sh.has(d.nasBefore)) bits.push(`NAS ${Sh.val(d.nasBefore)}${Sh.has(d.nasAfter) ? ' → ' + Sh.val(d.nasAfter) : ''}`);
    return bits.join(' · ');
  };
  void cb;

  root.PPSReports.register(D);
})(window);
