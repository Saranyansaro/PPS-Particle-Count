/* PPS Field Report Creator – sign by hand.
   A signature is drawn with a finger, a stylus or the mouse, trimmed to what was actually
   drawn and kept in the record as a small transparent PNG, so it prints exactly where the
   dotted signature line is. One signature can also be remembered and reused on later reports. */
(function (root) {
  'use strict';
  const has = v => String(v == null ? '' : v).trim() !== '';
  const INK = '#14235c';           // the dark blue a service engineer signs in
  const MAXW = 1000;               // widest exported signature, in pixels
  const PAD = 6;                   // transparent margin kept around the ink

  let modal = null, canvas = null, ctx = null, dpr = 1;
  let strokes = [], cur = null, base = null;   // base = an image loaded from a stored signature
  let onDone = null, touched = false;

  const cssSize = () => {
    const r = canvas.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };

  /* ---------- drawing ---------- */
  function resize() {
    if (!canvas) return;
    const { w, h } = cssSize();
    dpr = Math.min(3, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    redraw();
  }

  /* a pen line: speed decides the width, so the stroke looks written rather than drawn */
  const widthFor = speed => 2.9 - 1.7 * Math.max(0, Math.min(1, (speed - 0.6) / 2.6));

  function drawBase(w, h) {
    if (!base) return;
    const fit = Math.min(w / base.width, h / base.height, 1);
    const dw = base.width * fit, dh = base.height * fit;
    ctx.drawImage(base, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function redraw() {
    if (!ctx) return;
    const { w, h } = cssSize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawBase(w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    strokes.forEach(st => {
      const p = st.pts;
      if (p.length === 1) {                       // a tap leaves a dot
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, p[0].w / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (let i = 1; i < p.length; i++) {
        ctx.beginPath();
        ctx.lineWidth = (p[i].w + p[i - 1].w) / 2;
        ctx.moveTo(p[i - 1].x, p[i - 1].y);
        const mx = (p[i - 1].x + p[i].x) / 2, my = (p[i - 1].y + p[i].y) / 2;
        ctx.quadraticCurveTo(p[i - 1].x, p[i - 1].y, mx, my);
        ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
      }
    });
  }

  const pointFrom = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    const p = pointFrom(e);
    cur = { pts: [{ x: p.x, y: p.y, w: 2.6, t: p.t }] };
    strokes.push(cur);
    touched = true;
    setButtons();
    e.preventDefault();
    redraw();
  }
  function move(e) {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    evs.forEach(ev => {
      const p = pointFrom(ev), last = cur.pts[cur.pts.length - 1];
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 0.7) return;
      cur.pts.push({ x: p.x, y: p.y, w: widthFor(d / Math.max(1, p.t - last.t)), t: p.t });
    });
    e.preventDefault();
    redraw();
  }
  const up = () => { if (cur) { cur = null; setButtons(); } };

  /* ---------- export ---------- */
  /* Crop away the empty paper so the signature sits neatly on the dotted line. */
  function trimmed() {
    if (!strokes.length && !base) return null;
    const { w, h } = cssSize();
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const t = tmp.getContext('2d');
    t.drawImage(canvas, 0, 0);
    const d = t.getImageData(0, 0, tmp.width, tmp.height).data;
    let x0 = tmp.width, y0 = tmp.height, x1 = -1, y1 = -1;
    for (let y = 0; y < tmp.height; y++) {
      const row = y * tmp.width;
      for (let x = 0; x < tmp.width; x++) {
        if (d[(row + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = Math.round(PAD * dpr);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(tmp.width - 1, x1 + pad); y1 = Math.min(tmp.height - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const scale = cw > MAXW * dpr ? (MAXW * dpr) / cw : 1;
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw * scale));
    out.height = Math.max(1, Math.round(ch * scale));
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(tmp, x0, y0, cw, ch, 0, 0, out.width, out.height);
    void w; void h;
    return out.toDataURL('image/png');
  }

  const filled = () => strokes.length > 0 || !!base;

  function setButtons() {
    if (!modal) return;
    const any = filled();
    modal.querySelector('[data-sigundo]').disabled = !strokes.length;
    modal.querySelector('[data-sigclear]').disabled = !any;
    modal.querySelector('[data-siguse]').disabled = !any;
    modal.querySelector('[data-sigremember]').disabled = !any || !touched;
    modal.querySelector('[data-sigremember]').closest('label').hidden = !touched;
  }

  /* Bring a stored signature back as a background layer, so it can be added to or cleared. */
  function loadBase(dataUrl) {
    base = null;
    if (!has(dataUrl)) return Promise.resolve();
    return new Promise(res => {
      const im = new Image();
      im.onload = () => { base = im; redraw(); setButtons(); res(); };
      im.onerror = () => res();
      im.src = dataUrl;
    });
  }

  /* ---------- the dialog ---------- */
  function build() {
    const el = document.createElement('div');
    el.className = 'sigmodal';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Sign by hand');
    el.innerHTML = `<div class="sigcard">
  <h3 id="sigTitle">Sign here</h3>
  <p class="sighelp">Sign with your finger, a stylus or the mouse. Write inside the box.</p>
  <div class="sigpad"><canvas id="sigCanvas"></canvas><span class="sigbase" aria-hidden="true"></span></div>
  <div class="sigopts">
    <label class="chk" hidden><input type="checkbox" data-sigremember><span>Remember this as my signature</span></label>
    <button type="button" class="linkbtn" data-siguseSaved hidden>Use my saved signature</button>
    <button type="button" class="linkbtn" data-sigforget hidden>Forget my saved signature</button>
  </div>
  <div class="sigbar">
    <button type="button" class="btn btn-ghost" data-sigundo>Undo</button>
    <button type="button" class="btn btn-ghost" data-sigclear>Clear</button>
    <span class="sp"></span>
    <button type="button" class="btn btn-sec" data-sigcancel>Cancel</button>
    <button type="button" class="btn btn-primary" data-siguse>Use this signature</button>
  </div></div>`;
    document.body.appendChild(el);

    canvas = el.querySelector('#sigCanvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);
    el.querySelector('[data-sigundo]').onclick = () => { strokes.pop(); touched = true; setButtons(); redraw(); };
    el.querySelector('[data-sigclear]').onclick = () => { strokes = []; base = null; touched = true; setButtons(); redraw(); };
    el.querySelector('[data-sigcancel]').onclick = close;
    el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
    el.querySelector('[data-siguse]').onclick = () => {
      const data = trimmed();
      if (!data) return;
      const remember = el.querySelector('[data-sigremember]').checked;
      const done = onDone;
      close();
      if (done) done(data, { remember });
    };
    el.querySelector('[data-sigforget]').onclick = () => {
      root.PPSSig.remember('');
      el.querySelector('[data-siguseSaved]').hidden = true;
      el.querySelector('[data-sigforget]').hidden = true;
      setButtons();
    };
    el.querySelector('[data-siguseSaved]').onclick = async () => {
      const saved = root.PPSSig._saved();
      if (!saved) return;
      strokes = []; touched = false;
      await loadBase(saved);
      setButtons();
    };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
    return el;
  }

  function open(opts) {
    const o = opts || {};
    if (!modal) modal = build();
    onDone = o.onDone || null;
    touched = false;
    modal.querySelector('#sigTitle').textContent = o.title || 'Sign here';
    const saved = root.PPSSig._saved();
    modal.querySelector('[data-siguseSaved]').hidden = !saved || has(o.value);
    modal.querySelector('[data-sigforget]').hidden = !saved;
    modal.querySelector('[data-sigremember]').checked = false;
    modal.hidden = false;
    document.body.classList.add('signing');
    strokes = [];
    const restoreBase = has(o.value) ? loadBase(o.value) : Promise.resolve();
    requestAnimationFrame(() => {
      resize();
      restoreBase.then(() => { redraw(); setButtons(); });
    });
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('signing');
    cur = null;
  }

  /* ---------- saved "my signature" ---------- */
  let savedGetter = () => '', savedSetter = null;
  root.PPSSig = {
    open, close,
    isOpen: () => !!modal && !modal.hidden,
    /* app.js supplies where "my signature" is kept (settings) */
    useSaved(get, set) { savedGetter = get || (() => ''); savedSetter = set; },
    _saved: () => savedGetter() || '',
    remember(dataUrl) { if (savedSetter) savedSetter(dataUrl || ''); },
    _export: trimmed,          // tests draw a stroke and export it without a pointer device
    _ink: INK
  };
  root.addEventListener('resize', () => { if (root.PPSSig.isOpen()) resize(); });
})(window);
