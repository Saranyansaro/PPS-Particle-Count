# PPS Particle Count Report (local app)

Enter particle counter results, get the PPS-F-05 report as a PDF, and keep every test in a local database with a searchable records list.

## Start

1. Install Python 3.9+ from python.org (Windows: tick **Add python.exe to PATH**).
2. Double-click `start.bat` (Mac: `start.command`),
   or in VS Code: Terminal → New Terminal → `python server.py`.
3. The browser opens http://localhost:8765. Keep the black window open while you work.

## Where your data is

- Database: `data/pps_records.db`
- Automatic daily backups: `data/backups/` (last 60 kept)
- Copy the `data` folder to Google Drive or a pen drive every Friday.

Full manual: open `static/manual.html`, or click **Help** in the app.

## Files

| File | What it is |
|---|---|
| `server.py` | Local server and database (Python standard library only) |
| `static/index.html` | The app |
| `static/manual.html` | User manual |
| `static/lib/` | PDF libraries, so the app works without internet |
| `start.bat` / `start_lan.bat` / `start.command` | Double-click launchers |
