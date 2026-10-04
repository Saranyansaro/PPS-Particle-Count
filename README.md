# PPS Field Report Creator

Fill in a Prime Power Systems field form, sign it by hand on the screen, and get the **finished report as a PDF** — then keep every job in a searchable records list (search, filter by status, follow-up dates, Excel export). Works offline on a phone.

| Form | Report | Page |
|---|---|---|
| PPS-F-01 | Equipment Commissioning & Acceptance (ELC) | A4 portrait |
| PPS-F-02 | ELC Test Report for Oil Purity | A4 portrait |
| PPS-F-03 | LVDH Test Report for Moisture Removal | A4 portrait |
| PPS-F-04 | PHE Service Report | A4 portrait |
| PPS-F-05 | Oil Analysis – Particle Count | A4 portrait |
| PPS-F-06 | Field Service Report (ELC / oil purification equipment) | **A4 landscape** |
| — | Oil Condition Report – Hot-Plate Crackle Test | A4 portrait |
| — | Oil Cleanliness Test Report (ELC patch test, NAS 1638) | A4 portrait |

**Open on iPhone:** https://saranyansaro.github.io/PPS-Particle-Count/

## Two ways to use it

| | iPhone / any phone (hosted) | Laptop (`python server.py`) |
|---|---|---|
| Where records are kept | On the phone itself (nothing is uploaded) | `data/pps_records.db` on the laptop |
| Internet needed | Only the first time; then works offline | No |
| PDF | **Share PDF** → WhatsApp, Mail, Save to Files | **Save PDF** → Downloads folder |
| Backups | Records → **Backup file** (weekly reminder) | Automatic daily copies in `data/backups/` + Backup file |

Move records between them with **Records → Backup file** on one and **Records → Restore / import** on the other. Records are merged by newest edit and nothing is deleted.

### Install on iPhone
1. Open https://saranyansaro.github.io/PPS-Particle-Count/ in **Safari**.
2. Share button → **Add to Home Screen** → Add.
3. Always open it from the **PPS Reports** icon (Safari tabs keep separate records).

### Run on the laptop
1. Install Python 3.9+ from python.org (Windows: tick **Add python.exe to PATH**).
2. Double-click `start.bat` (Mac: `start.command`), or run `python server.py`.
3. The browser opens http://localhost:8765. Keep the black window open while you work.

For a phone on the same Wi-Fi: `start_lan.bat` / `start_lan.command` (or `python server.py --lan`), then open the exact link it prints (it ends in `?key=…`).

Restore a database copy (app closed): `python server.py --restore data/backups/pps_records_2026-09-25.db`

The full manual is in `static/manual.html` (the **Help** link in the app).

## Starting a report
**New report** opens a chooser with a card for each form. Pick one, fill it in, and it saves by itself — same as the particle count report always did. The report kind is remembered, so the next new report starts on the form you used last. Old records (made before the other forms existed) are still particle counts and open exactly as before.

## Signing by hand
Every signature line on a form is a **signature pad**:

- Tap the signature box (or **Sign**) and write with a finger, a stylus or the mouse.
- The stroke thins as you write faster, so it looks written rather than drawn.
- **Undo** removes the last stroke, **Clear** starts again, **Use this signature** places it.
- Tick **Remember this as my signature** once and later reports offer **Use my saved signature** — the same hand on every form without signing again. It is kept with your other settings, travels in a backup file, and **Forget my saved signature** removes it from the device.
- The signature is trimmed to what you actually drew and stored as a small transparent PNG, so it prints on the dotted line where a wet signature would go.

## Photographs
Membrane patches, crackle-test plates and sample photos attach straight from the phone camera (**Photo** on any picture box). Camera pictures are several megabytes, so each one is shrunk to 1400 px on its longest side before it is stored — a 130 KB test photo becomes about 22 KB. **Remove** takes it off again.

## What makes it safe to rely on
- **Nothing typed is lost:** every change is journaled on the device, so a killed app, a reload or a server outage keeps it. Unsaved changes are recovered and saved automatically. Pictures and signatures are journaled separately so typing stays fast.
- **No silent overwrites:** if the same report was changed in another tab or on another device, the app asks before saving over it.
- **Deletes:** need a deliberate second tap and can be undone.
- **Laptop server:** it only answers this computer and the local network. Phones need an access key in `--lan` mode. Other websites can't read or change the data. Input is validated and a backup is taken before every import or restore.
- **Verdict (particle count):** covers ISO 4406, NAS 1638, SAE AS4059 and water saturation, and never rounds a result up to "100% removed" or "1× allowed".

## Files

| Path | What it is |
|---|---|
| `static/index.html` | The app screen (markup and styles), including the hand-written particle count form |
| `static/js/calc.js` | ISO 4406 codes, target checks, recommendations, drafted observations (no screen code; unit-tested) |
| `static/js/store.js` | Saving: laptop database or on-device storage |
| `static/js/app.js` | Screen logic, PDF, backup/import, records list |
| `static/js/reports/registry.js` | The report catalogue the rest of the app asks for a form by id |
| `static/js/reports/sheet.js` | Shared sheet builders (letterhead, tables, tick boxes, signature blocks) |
| `static/js/reports/form.js` | Turns a report's field list into its entry screen |
| `static/js/reports/sig.js` | Sign by hand: the pad, trimming, and the remembered signature |
| `static/js/reports/photo.js` | Attaching and shrinking a photograph |
| `static/js/reports/particle.js` | PPS-F-05 metadata (its screen and sheet are written by hand in `index.html` + `app.js`) |
| `static/js/reports/*.js` | One file per form: its fields, its sheet, its styling |
| `static/sw.js`, `static/manifest.webmanifest`, `static/icons/` | Offline support and home-screen app |
| `static/lib/` | PDF libraries (html2canvas 1.4.1, jsPDF), bundled so it works offline |
| `server.py` | Local server and SQLite database (Python standard library only) |
| `tests/` | `node --test tests/calc.test.js tests/reports.test.mjs tests/workflow.test.mjs` and `python -m unittest discover -s tests` |
| `tests/render.mjs` | Draws any report sheet outside the browser: `node tests/render.mjs <id>` / `--list` |
| `tests/e2e/` | Browser tests as an iPhone (WebKit) and a laptop (Chromium): `cd tests/e2e && npm install && npx playwright install webkit chromium && npm test` |
| `tests/workflow.test.mjs` | Checks `.github/workflows/pages.yml` can still run. **Run it before pushing a workflow change** — a YAML mistake there makes GitHub refuse the whole file, no job starts, and the published app quietly stays on the old version. |
| `tools/make_icons.py` | Rebuilds the app icons from `static/logo.png` |
| `.github/workflows/pages.yml` | Runs the tests, then publishes `static/` to GitHub Pages on every push to `main` |

## Adding another report form
1. Copy the closest file in `static/js/reports/` (for example `lvdh.js`).
2. Change `id`, `name`, `short`, `form`, `orientation`, `title`, `sub`, `about`, `list`, `sections` and `render`.
   - `sections` is the entry screen: `{k, l, t, w}` with `t` one of
     `text | num | date | area | select | check | group | radios | grid | sig | img | note`, and `w` 1, 2 or 4 columns.
     `sig` gives a signature pad, `img` a photo box, `grid` a checklist table.
   - `render(d)` returns the sheet as HTML, built from the `Sh.*` helpers.
   - Extra styling goes in the definition's `css` string, with every class prefixed so forms never clash.
3. Add the file to `static/index.html` and `static/sw.js`.
4. `node --test tests/reports.test.mjs` checks it registers, draws, escapes properly and that every field on the screen has a key in the record.
5. `node tests/render.mjs <id>` prints the sheet so you can look at it without opening the app.

## Updating the app
Edit, run the tests, commit and push to `main`. If you touched `.github/workflows/pages.yml`, run
`node --test tests/workflow.test.mjs` first: GitHub will not report a broken workflow file as a failed
step, it simply refuses to run it, so nothing is tested and nothing is published.

After a push, check the **Actions** tab. The app is only published when the `test` job passes; if it
fails, the live site keeps serving the previous version. An installed iPhone then shows
**"A new version of the app is ready – Update now"** — tap it, or close the app completely (swipe it
away) and open it again. GitHub runs the tests and, if they pass, publishes the new version. Installed iPhones show **"A new version of the app is ready – Update now"**. Records are never touched by an update.
