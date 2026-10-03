/* PPS-F-05  OIL ANALYSIS REPORT – PARTICLE COUNT.
   This is the original report of the app. Its entry screen is hand-written in index.html
   (the count table, the target picker and the verdict are built by app.js); the definition
   here tells the rest of the app what to call it and how it appears in the records list. */
(function (root) {
  'use strict';
  const C = root.PPSCalc;
  const today = () => C.today();

  const D = {
    id: 'particle',
    name: 'Oil Analysis – Particle Count',
    short: 'Particle Count',
    form: 'PPS-F-05',
    orientation: 'p',
    colour: 'gold',
    title: 'OIL ANALYSIS REPORT – PARTICLE COUNT',
    sub: 'Offline Particle Counter | ISO 4406 • NAS 1638 • SAE AS4059',
    about: 'Particle counts before and after, with ISO 4406, NAS 1638 and SAE AS4059 verdicts.',
    ownForm: true,                     // the entry screen and the sheet live in index.html + app.js
    list: { no: 'reportNo', date: 'testDate', client: 'client', detail: r => r.equipment, next: 'nextDate' },
    blank: () => ({
      reportNo: '', sampleDate: today(), testDate: today(), client: '', address: '', equipment: '', sampleId: '', oilGrade: '', oilQty: '', hours: '', samplingPoint: '',
      testedBy: '', counter: '', counterSr: '', calDate: '', iso11171: true, analysedBy: '',
      condition: 'clear', mode: 'before',
      c4B: '', c6B: '', c14B: '', c21B: '', c38B: '', c70B: '', c4A: '', c6A: '', c14A: '', c21A: '', c38A: '', c70A: '',
      nasB: '', nasA: '', asB: '', asA: '', asT: '', rhB: '', rhA: '', rhT: '',
      component: 'piston', t4: '17', t6: '15', t14: '13', tNas: '7',
      recs: {}, recAuto: true, retestManual: false, retestDays: '', obs: '', obsAuto: '', clientSign: '',
      contactName: '', designation: '', phone: '', email: '', industry: '', leadSource: '', machineMake: '', totalPacks: '', totalOil: '',
      changeInterval: '', lastChange: '', oilSpend: '', filtration: '', problems: '', decisionMaker: '',
      status: 'Sample taken', nextDate: '', nextStep: ''
    })
  };

  root.PPSReports.register(D);
})(window);
