/* PPS Particle Count – storage.
   Two stores with the same methods:
   - ServerStore: the laptop's SQLite database, used when the app is opened from `python server.py`.
   - LocalStore:  this device's own database (IndexedDB), used when the app is hosted (GitHub Pages / iPhone)
                  or opened without the server. Data never leaves the device unless you export a backup. */
(function (root) {
  'use strict';
  const C = root.PPSCalc;
  const clone = o => JSON.parse(JSON.stringify(o));

  /* Saves carry "_base": the revisions this screen last knew for the record. If the stored copy has a
     different revision, someone else (another tab, phone or laptop) changed it: the save is refused with
     status 409 instead of silently overwriting their work. A record deleted elsewhere is refused the same way. */
  function conflictOf(old, base) {
    if (!Array.isArray(base)) return null;
    if (old) return base.includes(old.rev == null ? null : old.rev) ? null : { reason: 'changed', current: old };
    return base.some(b => b != null) ? { reason: 'deleted', current: null } : null;
  }
  function conflictError(c) {
    const e = new Error(c.reason === 'deleted' ? 'deleted elsewhere' : 'changed elsewhere');
    e.status = 409; e.reason = c.reason; e.current = c.current;
    return e;
  }

  function timedFetch(url, opts, ms) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    return fetch(url, Object.assign({ cache: 'no-store', credentials: 'same-origin' }, opts, ctl ? { signal: ctl.signal } : {}))
      .finally(() => t && clearTimeout(t));
  }

  /* ---------------- laptop server ---------------- */
  const ServerStore = {
    kind: 'server',
    label: 'the laptop (server database)',
    key: '',   // access key for phones in --lan mode
    async req(method, url, body, opt) {
      const init = { method, headers: {} };
      if (this.key) init.headers['X-PPS-Key'] = this.key;
      if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
      if (opt && opt.keepalive && init.body && init.body.length < 60000) init.keepalive = true;
      const r = await timedFetch(url, init, (opt && opt.timeout) || 15000);
      let data = null;
      try { data = await r.json(); } catch (e) { /* not JSON */ }
      if (!r.ok) {
        const err = new Error((data && data.error) || ('HTTP ' + r.status));
        err.status = r.status;
        if (r.status === 409 && data) { err.reason = data.reason; err.current = data.current || null; }
        throw err;
      }
      return data;
    },
    /* Resolves with {auth}: auth is false when this phone still needs the laptop's access link */
    async ping() {
      const r = await timedFetch('api/ping', this.key ? { headers: { 'X-PPS-Key': this.key } } : {}, 4000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j || j.ok !== true) throw new Error('not the PPS server');
      return { auth: j.auth !== false };
    },
    list() { return this.req('GET', 'api/records'); },
    async get(id) {
      try { return await this.req('GET', 'api/records/' + encodeURIComponent(id)); }
      catch (e) { if (e.status === 404) return null; throw e; }
    },
    save(rec, opt) { return this.req('PUT', 'api/records/' + encodeURIComponent(rec.id), rec, opt); },
    del(id) { return this.req('DELETE', 'api/records/' + encodeURIComponent(id)); },
    settings() { return this.req('GET', 'api/settings'); },
    saveSettings(s) { return this.req('PUT', 'api/settings', s); },
    importData(data) { return this.req('POST', 'api/import', data, { timeout: 60000 }); },
    persistStorage() { return Promise.resolve(true); }
  };

  /* ---------------- this device: IndexedDB ---------------- */
  const DB_NAME = 'ppspc', DB_VER = 1;
  function idbOpen() {
    return new Promise((resolve, reject) => {
      let rq;
      try { rq = indexedDB.open(DB_NAME, DB_VER); } catch (e) { reject(e); return; }
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error || new Error('IndexedDB open failed'));
      rq.onblocked = () => reject(new Error('The database is open in another tab that needs closing.'));
    });
  }
  /* Run fn inside one transaction; resolves with box.v once the transaction has committed */
  function tx(db, stores, mode, fn) {
    return new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(stores, mode); } catch (e) { reject(e); return; }
      const box = {};
      t.oncomplete = () => resolve(box.v);
      t.onerror = () => reject(t.error || new Error('Database error'));
      t.onabort = () => reject(t.error || new Error('Database write was cancelled (storage may be full).'));
      try { fn(t, box); } catch (e) { try { t.abort(); } catch (x) { /* already finished */ } reject(e); }
    });
  }

  const LocalStore = {
    kind: 'local',
    label: 'this device',
    db: null,
    async open() {
      this.db = await idbOpen();
      this.db.onversionchange = () => { try { this.db.close(); } catch (e) { /* ignore */ } };
      return this;
    },
    async ping() { return true; },
    async list() {
      const all = await tx(this.db, ['records'], 'readonly', (t, box) => {
        const rq = t.objectStore('records').getAll();
        rq.onsuccess = () => { box.v = rq.result || []; };
      });
      return all.sort((a, b) => C.cmp(String(b.updatedAt || ''), String(a.updatedAt || '')));
    },
    async get(id) {
      return tx(this.db, ['records'], 'readonly', (t, box) => {
        const g = t.objectStore('records').get(id);
        g.onsuccess = () => { box.v = g.result || null; };
      });
    },
    async save(rec) {
      if (!C.validId(rec.id)) throw new Error('Bad record id');
      const now = C.stamp();
      const res = await tx(this.db, ['records'], 'readwrite', (t, box) => {
        const os = t.objectStore('records');
        const g = os.get(rec.id);
        g.onsuccess = () => {
          const c = conflictOf(g.result, rec._base);
          if (c) { box.v = { conflict: c }; return; }
          const r = clone(rec); delete r._base;
          r.createdAt = (g.result && g.result.createdAt) || now;
          r.updatedAt = now;
          os.put(r);
          box.v = { ok: true, createdAt: r.createdAt, updatedAt: now, rev: r.rev };
        };
      });
      if (res && res.conflict) throw conflictError(res.conflict);
      return res;
    },
    async del(id) {
      await tx(this.db, ['records'], 'readwrite', t => { t.objectStore('records').delete(id); });
      return { ok: true };
    },
    async settings() {
      const rows = await tx(this.db, ['settings'], 'readonly', (t, box) => {
        const rq = t.objectStore('settings').getAll();
        rq.onsuccess = () => { box.v = rq.result || []; };
      });
      const out = {};
      rows.forEach(r => { out[r.key] = r.value; });
      return out;
    },
    async saveSettings(s) {
      await tx(this.db, ['settings'], 'readwrite', t => {
        const os = t.objectStore('settings');
        Object.keys(s).forEach(k => os.put({ key: k, value: s[k] }));
      });
      return { ok: true };
    },
    /* Merge a backup: new records are added, a record already here is replaced only if the backup copy is newer */
    async importData(data) {
      const recs = Array.isArray(data.records) ? data.records : [];
      const settings = data.settings || {};
      return tx(this.db, ['records', 'settings'], 'readwrite', (t, box) => {
        const os = t.objectStore('records');
        const res = { ok: true, added: 0, updated: 0, skipped: 0, invalid: 0 };
        box.v = res;
        recs.forEach(inc => {
          if (C.mergeAction(null, inc) === 'invalid') { res.invalid++; return; }
          const g = os.get(inc.id);
          g.onsuccess = () => {
            const act = C.mergeAction(g.result, inc);
            if (act === 'skip') { res.skipped++; return; }
            const r = clone(inc); delete r._base;
            r.createdAt = r.createdAt || (g.result && g.result.createdAt) || C.stamp();
            r.updatedAt = r.updatedAt || C.stamp();
            os.put(r);
            res[act === 'add' ? 'added' : 'updated']++;
          };
        });
        // settings from the backup only fill in what this device doesn't have yet
        const ss = t.objectStore('settings');
        Object.keys(settings).forEach(k => {
          const g = ss.get(k);
          g.onsuccess = () => {
            const cur = g.result && g.result.value;
            if (cur === undefined || cur === '' || cur === null) ss.put({ key: k, value: settings[k] });
          };
        });
      });
    },
    async persistStorage() {
      try {
        if (navigator.storage && navigator.storage.persist) {
          if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
          return await navigator.storage.persist();
        }
      } catch (e) { /* not supported */ }
      return false;
    }
  };

  /* ---------------- this device, fallback when IndexedDB is unavailable ---------------- */
  const LSKEY = 'ppspc.db';
  function lsRead() {
    try { const v = JSON.parse(localStorage.getItem(LSKEY) || 'null'); if (v && v.records && v.settings) return v; } catch (e) { /* ignore */ }
    return { records: {}, settings: {} };
  }
  function lsWrite(v) {
    try { localStorage.setItem(LSKEY, JSON.stringify(v)); }
    catch (e) { throw new Error('Device storage is full. Export a backup and delete old records.'); }
  }
  const FallbackStore = Object.assign({}, LocalStore, {
    kind: 'local',
    fallback: true,
    async open() { lsWrite(lsRead()); return this; },
    async list() { return Object.values(lsRead().records).sort((a, b) => C.cmp(String(b.updatedAt || ''), String(a.updatedAt || ''))); },
    async get(id) { return lsRead().records[id] || null; },
    async save(rec) {
      if (!C.validId(rec.id)) throw new Error('Bad record id');
      const db = lsRead(); const now = C.stamp(); const old = db.records[rec.id];
      const c = conflictOf(old, rec._base);
      if (c) throw conflictError(c);
      const r = clone(rec); delete r._base; r.createdAt = (old && old.createdAt) || now; r.updatedAt = now;
      db.records[rec.id] = r; lsWrite(db);
      return { ok: true, createdAt: r.createdAt, updatedAt: now, rev: r.rev };
    },
    async del(id) { const db = lsRead(); delete db.records[id]; lsWrite(db); return { ok: true }; },
    async settings() { return lsRead().settings; },
    async saveSettings(s) { const db = lsRead(); Object.assign(db.settings, s); lsWrite(db); return { ok: true }; },
    async importData(data) {
      const db = lsRead(); const res = { ok: true, added: 0, updated: 0, skipped: 0, invalid: 0 };
      (data.records || []).forEach(inc => {
        const act = C.mergeAction(C.validId(inc && inc.id) ? db.records[inc.id] : null, inc);
        if (act === 'invalid') { res.invalid++; return; }
        if (act === 'skip') { res.skipped++; return; }
        const r = clone(inc); delete r._base; r.createdAt = r.createdAt || C.stamp(); r.updatedAt = r.updatedAt || C.stamp();
        db.records[r.id] = r; res[act === 'add' ? 'added' : 'updated']++;
      });
      Object.keys(data.settings || {}).forEach(k => { const cur = db.settings[k]; if (cur === undefined || cur === '' || cur === null) db.settings[k] = data.settings[k]; });
      lsWrite(db);
      return res;
    }
  });

  /* Pick the store: the server if this page came from server.py, otherwise the device.
     Once an address has had a server, stay on the server (and show "server down") rather than
     silently saving into a separate device database. */
  async function pickStore(key) {
    ServerStore.key = key || '';
    let serverSeen = false;
    try { serverSeen = localStorage.getItem('ppspc.mode') === 'server'; } catch (e) { /* ignore */ }
    // server.py only ever serves plain http, so an https page (GitHub Pages etc.) or a file never has one:
    // skipping the check there means the phone starts at once, even on a weak signal.
    const noServer = location.protocol === 'file:' || location.protocol === 'https:';
    if (!noServer) {
      try {
        const p = await ServerStore.ping();
        try { localStorage.setItem('ppspc.mode', 'server'); } catch (e) { /* ignore */ }
        return { store: ServerStore, online: p.auth, needKey: !p.auth };
      } catch (e) {
        if (serverSeen) return { store: ServerStore, online: false };
      }
    }
    try {
      if (!('indexedDB' in root) || !root.indexedDB) throw new Error('no IndexedDB');
      return { store: await LocalStore.open(), online: true };
    } catch (e) {
      return { store: await FallbackStore.open(), online: true };
    }
  }

  root.PPSStore = { ServerStore, LocalStore, FallbackStore, pickStore };
})(typeof self !== 'undefined' ? self : this);
