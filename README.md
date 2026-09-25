# PPS Particle Count Report

Enter oil particle-counter results, get the **PPS-F-05 report as a PDF**, and keep every test in a searchable records list (search, filter by status, follow-up dates, Excel export).

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
3. Always open it from the **PPS Report** icon (Safari tabs keep separate records).

### Run on the laptop
1. Install Python 3.9+ from python.org (Windows: tick **Add python.exe to PATH**).
2. Double-click `start.bat` (Mac: `start.command`), or run `python server.py`.
3. The browser opens http://localhost:8765. Keep the black window open while you work.

For a phone on the same Wi-Fi: `start_lan.bat` / `start_lan.command` (or `python server.py --lan`), then open the exact link it prints (it ends in `?key=…`).

Restore a database copy (app closed): `python server.py --restore data/backups/pps_records_2026-09-25.db`

The full manual is in `static/manual.html` (the **Help** link in the app).

## What makes it safe to rely on
- **Nothing typed is lost:** every change is journaled on the device, so a killed app, a reload or a server outage keeps it. Unsaved changes are recovered and saved automatically.
- **No silent overwrites:** if the same report was changed in another tab or on another device, the app asks before saving over it.
- **Deletes:** need a deliberate second tap and can be undone.
- **Laptop server:** it only answers this computer and the local network. Phones need an access key in `--lan` mode. Other websites can't read or change the data. Input is validated and a backup is taken before every import or restore.
- **Verdict:** covers ISO 4406, NAS 1638, SAE AS4059 and water saturation, and never rounds a result up to "100% removed" or "1× allowed".

## Files

| Path | What it is |
|---|---|
| `static/index.html` | The app screen (markup and styles) |
| `static/js/calc.js` | ISO 4406 codes, target checks, recommendations, drafted observations (no screen code; unit-tested) |
| `static/js/store.js` | Saving: laptop database or on-device storage |
| `static/js/app.js` | Screen logic, PDF, backup/import, records list |
| `static/sw.js`, `static/manifest.webmanifest`, `static/icons/` | Offline support and home-screen app |
| `static/lib/` | PDF libraries (html2canvas 1.4.1, jsPDF), bundled so it works offline |
| `server.py` | Local server and SQLite database (Python standard library only) |
| `tests/` | `node --test tests/` and `python -m unittest discover -s tests` |
| `tools/make_icons.py` | Rebuilds the app icons from `static/logo.png` |
| `.github/workflows/pages.yml` | Runs the tests, then publishes `static/` to GitHub Pages on every push to `main` |

## Updating the app
Edit, run the tests, commit and push to `main`. GitHub runs the tests and, if they pass, publishes the new version. Installed iPhones show **"A new version of the app is ready – Update now"**. Records are never touched by an update.
