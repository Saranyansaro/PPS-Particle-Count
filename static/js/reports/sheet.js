/* PPS Field Report Creator – shared building blocks for every report sheet.
   A report template is a function that returns HTML built from these helpers, so the
   letterhead, tables, tick boxes and signature blocks look the same on screen and in the PDF.
   Nothing here touches the screen or the network: it is pure text in, text out (easy to test). */
(function (root) {
  'use strict';
  const C = root.PPSCalc;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const has = v => String(v == null ? '' : v).trim() !== '';
  /* a value, or a blank dotted space so the printed page can also be filled in by hand */
  const val = (x, d) => (has(x) ? esc(x) : (d === undefined ? '&nbsp;' : esc(d)));
  /* a date written 05-09-2026 (the app's house style, so no reader sees an ambiguous day/month) */
  const day = x => (has(x) ? esc(C.dmy ? C.dmy(x) : x) : '&nbsp;');

  /* Pieces of markup produced by these helpers are marked as Raw: they behave like plain
     strings everywhere (so they drop straight into a template literal) but a table cell can
     tell them apart from a value the user typed, which must always be escaped. */
  function Raw(html) { this.h = String(html); }
  Raw.prototype.toString = function () { return this.h; };
  const raw = html => (html instanceof Raw ? html : new Raw(html));
  const isRaw = c => c instanceof Raw || (!!c && typeof c === 'object' && typeof c.h === 'string');

  const TICK = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5.2 4 7.6 8.6 2.2" fill="none" stroke="#111" stroke-width="1.9"/></svg>';
  /* a printed check box: ticked, or empty for filling in by hand */
  const cb = (on, label, cls) => raw(`<span class="cb${cls ? ' ' + cls : ''}"><i>${on ? TICK : ''}</i>${label === undefined || label === null ? '' : esc(label)}</span>`);

  /* ---------- letterhead ---------- */
  /* The standard Prime Power Systems heading used by Form PPS-F-01 … PPS-F-06. */
  function head(opts) {
    const o = opts || {};
    return raw(`<div class="sh-hd"><img class="lg" src="${esc(o.logo || 'logo.png')}" alt="Prime Power Systems">
  <div class="co"><h2>${esc(o.name || 'PRIME POWER SYSTEMS')}</h2>
    <div class="tg">${esc(o.tag || 'Industrial Oil Purification & Reliability Services')}</div>
    <div class="ad">18, 2nd Street, MGR Nagar, Rathinapuri, Sanganoor, Coimbatore - 641 027, Tamil Nadu</div>
    <div class="ad">+91 93639 36420 | info@ppsystemss.com | www.primepowersystems.co | GSTIN: 33AAFFP5686C1Z9</div>
  </div></div>`);
  }
  /* the gold rule under the letterhead (two tones, as on the printed forms) */
  const rule = (split) => raw(`<div class="sh-rule"${split ? ` style="--split:${split}"` : ''}></div>`);

  /* the dark title band: PPS-F-0x forms */
  function band(title, sub, form) {
    return raw(`<div class="sh-band"><div><h3>${esc(title)}</h3>${has(sub) ? `<div class="sub">${esc(sub)}</div>` : ''}</div>${has(form) ? `<div class="fm">Form ${esc(form)}</div>` : ''}</div>`);
  }

  /* up to four grey boxes under the band: [[label, value], …] */
  function meta(pairs) {
    const items = (pairs || []).filter(Boolean);
    return raw(`<div class="sh-meta" style="grid-template-columns:repeat(${Math.max(1, items.length)},1fr)">${items
      .map(([l, v, d]) => `<div><b>${esc(l)}</b><span>${d ? day(v) : val(v)}</span></div>`).join('')}</div>`);
  }

  /* numbered section heading, e.g. 01 CLIENT DETAILS */
  function sec(n, title) {
    return raw(`<div class="sh-sec"><em>${esc(n)}</em>${esc(title)}</div>`);
  }

  /* ---------- key / value fields ---------- */
  /* One grey-less 4-column grid. Each entry is {k: label, v: value, full: true|false, d: true(date)}.
     Two consecutive normal entries share a row; a "full" entry gets its own row with a wide value. */
  function kv(entries) {
    const rows = [];
    let pending = null;
    const push = (...cells) => rows.push(`<div class="sh-kvr">${cells.join('')}</div>`);
    const pair = e => `<span class="k">${esc(e.k)}</span><span class="v${e.full ? ' wide' : ''}">${e.d ? day(e.v) : val(e.v, e.blank)}</span>`;
    (entries || []).forEach(e => {
      if (!e) return;
      if (e.full) { if (pending) { push(pair(pending)); pending = null; } push(pair(e)); return; }
      if (pending) { push(pair(pending), pair(e)); pending = null; } else { pending = e; }
    });
    if (pending) push(pair(pending));
    return raw(`<div class="sh-kv">${rows.join('')}</div>`);
  }

  /* ---------- tables ---------- */
  /* cells: a string (escaped) or raw(html) for a tick box / photo. */
  function table(o) {
    const head = o.head || [];
    const align = o.align || [];
    const cls = ['sh-t'].concat(o.cls ? [o.cls] : []).join(' ');
    const cg = o.widths ? `<colgroup>${o.widths.map(w => `<col style="width:${typeof w === 'number' ? w + '%' : w}">`).join('')}</colgroup>` : '';
    const cell = (c, i, tag) => {
      const a = align[i] === 'l' ? '' : ` class="c${align[i] === 'r' ? ' r' : ''}"`;
      const inner = isRaw(c) ? raw(c).h : val(c);
      return `<${tag}${a}>${inner}</${tag}>`;
    };
    const thead = head.length ? `<thead><tr>${head.map((h, i) => `<th${align[i] === 'l' ? ' class="l"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>` : '';
    const body = (o.rows || []).map(r => `<tr${r.tr ? ' ' + r.tr : ''}>${(r.cells || r).map((c, i) => cell(c, i, 'td')).join('')}</tr>`).join('');
    return raw(`<table class="${cls}">${cg}${thead}<tbody>${body}</tbody></table>`);
  }

  /* a bordered box with a small heading, used for IMPRESSION / REMARKS / findings */
  const box = (title, html, o) => raw(`<div class="sh-box${o && o.accent ? ' accent' : ''}"${o && o.min ? ` style="min-height:${o.min}px"` : ''}>${has(title) ? `<b>${esc(title)}</b>` : ''}<div class="bd">${html || ''}</div></div>`);

  /* a paragraph of body text with a pre-wrap value (observations, findings…) */
  const text = v => raw(`<div class="sh-txt">${has(v) ? esc(v) : '&nbsp;'}</div>`);

  /* ---------- photographs and membrane patches ---------- */
  /* Shown as the picture when attached, otherwise as a dashed "affix patch / photo" space. */
  function photo(src, caption, o) {
    const styles = [];
    if (o && o.w) styles.push(`width:${o.w}`);
    if (o && o.h) styles.push(`height:${o.h}px`);
    if (o && o.min) styles.push(`min-height:${o.min}px`);
    const st = styles.length ? ` style="${styles.join(';')}"` : '';
    if (has(src)) {
      return raw(`<figure class="sh-ph has"${st}><img src="${esc(src)}" alt="${esc(caption || 'Photograph')}">${has(caption) ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`);
    }
    return raw(`<figure class="sh-ph empty"${st}><span>${esc(caption || 'Affix photo')}</span></figure>`);
  }

  /* ---------- signatures ---------- */
  /* blocks: [{title, rows:[[label, value]…], sign: dataURL, hint}] – the signature image sits above
     the dotted line, exactly where a wet signature would go. */
  function sig(blocks, o) {
    const n = (blocks || []).length || 1;
    return raw(`<div class="sh-sig" style="grid-template-columns:repeat(${n},1fr)${o && o.gap ? `;gap:${o.gap}px` : ''}">${(blocks || []).map(b => `<div>
  <b>${esc(b.title)}</b>
  ${(b.rows || []).map(([l, v, d]) => `<div class="rw"><span>${esc(l)}</span><span>${d ? day(v) : val(v)}</span></div>`).join('')}
  <div class="sg">${has(b.sign) ? `<img src="${esc(b.sign)}" alt="Signature">` : `<span class="ph">${esc(b.hint || 'Sign here')}</span>`}</div>
  <div class="sl">${esc(b.signLabel || 'Signature')}</div>
</div>`).join('')}</div>`);
  }

  const foot = t => raw(`<div class="sh-foot">${esc(t || 'Prime Power Systems | 18, 2nd Street, MGR Nagar, Sanganoor, Coimbatore - 641 027 | +91 93639 36420 | info@ppsystemss.com')}</div>`);

  /* two side-by-side blocks that stay level (checklists, patch rows…) */
  const cols = (a, b, gap) => raw(`<div class="sh-cols"${gap ? ` style="gap:${gap}px"` : ''}><div>${a}</div><div>${b}</div></div>`);

  /* a small note line under a table */
  const note = t => raw(`<div class="sh-note">${t}</div>`);

  root.PPSSheet = { esc, has, val, day, raw, isRaw, cb, TICK, head, rule, band, meta, sec, kv, table, box, text, photo, sig, foot, cols, note };
})(window);
