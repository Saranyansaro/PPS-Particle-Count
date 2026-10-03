/* PPS Field Report Creator – attach a photograph to a report.
   Phones give full-size camera pictures (several MB); a report has to stay small enough to
   save and share, so every picture is shrunk to a sensible size before it is stored. */
(function (root) {
  'use strict';
  const MAXPX = 1400;      // longest side kept, in pixels
  const QUALITY = 0.72;

  let input = null, pending = null;

  function pick(title) {
    return new Promise((resolve, reject) => {
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.hidden = true;
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          const f = input.files && input.files[0];
          input.value = '';
          const p = pending; pending = null;
          if (!p) return;
          if (!f) { p.reject(new Error('no file')); return; }
          shrink(f).then(p.resolve, p.reject);
        });
      }
      input.setAttribute('aria-label', title || 'Choose a photograph');
      pending = { resolve, reject };
      input.click();
    });
  }

  /* A file (or a data URL) in, a small JPEG data URL out. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a picture.')); };
      im.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const scale = Math.min(1, MAXPX / Math.max(im.naturalWidth, im.naturalHeight));
          const w = Math.max(1, Math.round(im.naturalWidth * scale));
          const h = Math.max(1, Math.round(im.naturalHeight * scale));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const g = c.getContext('2d');
          g.fillStyle = '#fff';                    // membrane patches are photographed on white paper
          g.fillRect(0, 0, w, h);
          g.imageSmoothingQuality = 'high';
          g.drawImage(im, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', QUALITY));
        } catch (e) { reject(e); }
      };
      im.src = url;
    });
  }

  /* Rough size of a stored picture, for the "storage is filling up" warning. */
  const bytes = dataUrl => (String(dataUrl || '').length * 3) / 4;

  root.PPSPhoto = { pick, shrink, bytes, MAXPX, QUALITY };
})(window);
