/* PPS Field Report Creator – the report catalogue.
   Each report file calls PPSReports.register({...}) with everything the app needs to know:
   what to call it, which form number it carries, the fields to type and how to draw the sheet. */
(function (root) {
  'use strict';
  const items = [];
  const byId = {};

  const api = {
    register(def) {
      if (!def || !def.id) throw new Error('a report needs an id');
      if (byId[def.id]) throw new Error('two reports share the id ' + def.id);
      byId[def.id] = def;
      items.push(def);
      return def;
    },
    all: () => items.slice(),
    get: id => byId[id] || null,
    /* the particle count report existed before the others: it is the fallback for old records */
    idOf(rec) { const t = rec && rec.type; return byId[t] ? t : 'particle'; },
    of(rec) { return byId[api.idOf(rec)]; },
    /* what the records list shows for any kind of report */
    listing(rec) {
      const d = api.of(rec), L = (d && d.list) || {};
      const pick = k => (typeof k === 'function' ? k(rec) : rec[k]);
      return {
        type: d ? d.short : '',
        no: pick(L.no || 'reportNo') || '',
        date: pick(L.date || 'testDate') || '',
        client: pick(L.client || 'client') || '',
        detail: pick(L.detail) || '',
        status: rec.status || '',
        next: pick(L.next || 'nextDate') || '',
        nextStep: rec.nextStep || ''
      };
    }
  };
  root.PPSReports = api;
})(window);
