/* PPS Field Report Creator – turns a report's field list into the entry screen.
   Every report describes its fields once; the same list draws the screen form here and the
   report sheet in the report module. Values live in the record under the field key, so the
   existing [data-k] input handling in app.js works unchanged. */
(function (root) {
  'use strict';
  const S = () => root.PPSSheet;
  const esc = s => S().esc(s);
  const has = v => S().has(v);
  const attr = s => esc(s);

  /* grid field keys: kind__row__col – flat, so a record stays a simple JSON object */
  const gk = (k, row, col) => `${k}__${row}__${col}`;

  function label(f) {
    if (!f.l) return '';
    return `<label class="fl" for="f_${attr(f.k)}">${esc(f.l)}</label>`;
  }

  function field(f) {
    const w = f.w || 4;
    const id = f.k ? ` id="f_${attr(f.k)}"` : '';
    const common = `${id} data-k="${attr(f.k)}" autocomplete="off" enterkeyhint="next"`;
    const body = (() => {
      switch (f.t) {
        case 'num':
          return `<input type="text" inputmode="decimal" ${common}${f.ph ? ` placeholder="${attr(f.ph)}"` : ''}>`;
        case 'date':
          return `<input type="date" ${common}>`;
        case 'area':
          return `<textarea ${common} rows="${f.rows || 3}"${f.ph ? ` placeholder="${attr(f.ph)}"` : ''}></textarea>`;
        case 'select':
          return `<select ${common}>${(f.opts || []).map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join('')}</select>`;
        case 'check':
          return `<label class="chk"><input type="checkbox" ${common}><span>${esc(f.cl || f.l)}</span></label>`;
        case 'group':
          return `<div class="grp">${(f.items || []).map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${attr(k)}" autocomplete="off"><span>${esc(l)}</span></label>`).join('')}</div>`;
        case 'radios':
          return `<div class="grp">${(f.opts || []).map(([v, l]) => `<label class="chk"><input type="radio" data-k="${attr(f.k)}" value="${attr(v)}" autocomplete="off"><span>${esc(l)}</span></label>`).join('')}</div>`;
        case 'sig':
          return `<div class="sigslot" data-sigslot="${attr(f.k)}">
            <button type="button" class="sigopen" data-sig="${attr(f.k)}" aria-label="${attr((f.l || 'Signature') + ' – sign by hand')}"><span class="ph">${esc(f.hint || 'Tap to sign')}</span><img alt="" hidden></button>
            <div class="sigrow"><button type="button" class="linkbtn" data-sig="${attr(f.k)}">Sign</button><button type="button" class="linkbtn" data-sigclear="${attr(f.k)}" hidden>Clear</button></div></div>`;
        case 'img':
          return `<div class="imgslot" data-imgslot="${attr(f.k)}">
            <button type="button" class="imgopen" data-img="${attr(f.k)}"><img alt="" hidden><span class="ph">${esc(f.hint || 'Tap to add a photo')}</span></button>
            <div class="sigrow"><button type="button" class="linkbtn" data-img="${attr(f.k)}">Photo</button><button type="button" class="linkbtn" data-imgclear="${attr(f.k)}" hidden>Remove</button></div></div>`;
        case 'note':
          return `<p class="fnote">${esc(f.cl || f.l || '')}</p>`;
        case 'grid': {
          const cols = f.cols || [];
          const rows = f.rows || [];
          const th = cols.map(c => `<th${c.t === 'check' ? ' class="tick"' : ''}>${esc(c.l)}</th>`).join('');
          const body = rows.map(r => {
            const rid = r[0], rl = r[1], ov = r[2] || {};
            return `<tr><th scope="row">${esc(rl)}</th>${cols.map(c => {
              const k = gk(f.k, rid, c.c);
              if ((ov[c.c] || c).t === 'check') return `<td class="tick"><input type="checkbox" data-k="${attr(k)}" autocomplete="off" aria-label="${attr(rl + ' ' + c.l)}"></td>`;
              if ((ov[c.c] || c).t === 'num') return `<td><input type="text" inputmode="decimal" data-k="${attr(k)}" autocomplete="off" aria-label="${attr(rl + ' ' + c.l)}"></td>`;
              return `<td><input type="text" data-k="${attr(k)}" autocomplete="off" aria-label="${attr(rl + ' ' + c.l)}"></td>`;
            }).join('')}</tr>`;
          }).join('');
          const wide = f.wide !== false;
          return `<div class="gridwrap${wide ? ' wide' : ''}"><table class="gin"><thead><tr><th class="rh"></th>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
        }
        default:
          return `<input type="text" ${common}${f.ph ? ` placeholder="${attr(f.ph)}"` : ''}>`;
      }
    })();
    if (f.t === 'check' || f.t === 'group' || f.t === 'note') return `<div class="fld w${w}">${body}</div>`;
    return `<div class="fld w${w}">${label(f)}${body}</div>`;
  }

  /* Build the whole entry screen for a report. */
  function build(report) {
    const secs = report.sections || [];
    return secs.map((s, i) => `<details class="fs"${s.open === false ? '' : ' open'}>
  <summary><em>${esc(s.n || String(i + 1).padStart(2, '0'))}</em>${esc(s.title)}</summary>
  <div class="fgrid">${(s.fields || []).map(field).join('')}</div>
  ${s.note ? `<p class="fnote">${esc(s.note)}</p>` : ''}
</details>`).join('');
  }

  /* ---------- values ---------- */
  /* Every key a report stores, including the grid cells, so normalise() can fill blanks. */
  function keys(report) {
    const out = {};
    const add = (k, bool) => { if (k) out[k] = bool ? false : ''; };
    (report.sections || []).forEach(s => (s.fields || []).forEach(f => {
      if (f.t === 'grid') {
        (f.rows || []).forEach(r => (f.cols || []).forEach(c => {
          const cell = Object.assign({}, c, (r[2] || {})[c.c] || {});
          add(gk(f.k, r[0], c.c), cell.t === 'check');
        }));
      } else if (f.t === 'group') {
        (f.items || []).forEach(([k]) => add(k, true));
      } else if (f.k) {
        add(f.k, f.t === 'check');
      }
    }));
    return out;
  }
  const gridKey = gk;

  /* ---------- signature / photo slots ---------- */
  /* Called after loadInputs(): shows the pictures held in the record and reveals "Clear" buttons. */
  function sync(formEl, rec) {
    if (!formEl || !rec) return;
    formEl.querySelectorAll('[data-sigslot]').forEach(slot => {
      const k = slot.dataset.sigslot, on = has(rec[k]);
      const img = slot.querySelector('img'), ph = slot.querySelector('.ph'), clr = slot.querySelector('[data-sigclear]');
      if (img) { if (on) { img.src = rec[k]; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; } }
      if (ph) ph.hidden = on;
      if (clr) clr.hidden = !on;
      slot.classList.toggle('signed', on);
    });
    formEl.querySelectorAll('[data-imgslot]').forEach(slot => {
      const k = slot.dataset.imgslot, on = has(rec[k]);
      const img = slot.querySelector('img'), ph = slot.querySelector('.ph'), clr = slot.querySelector('[data-imgclear]');
      if (img) { if (on) { img.src = rec[k]; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; } }
      if (ph) ph.hidden = on;
      if (clr) clr.hidden = !on;
      slot.classList.toggle('has', on);
    });
  }

  root.PPSForm = { build, keys, sync, gridKey };
})(window);
