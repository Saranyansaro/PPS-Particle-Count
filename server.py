"""
PPS Particle Count Report - local server
Runs on your computer with Python only (no extra installs).
Data is stored in data/pps_records.db (SQLite). A dated backup copy is made every day the app starts.

Start:   python server.py          (this computer only)
         python server.py --lan    (also reachable from a phone on the same Wi-Fi)
"""
import json
import os
import shutil
import socket
import sqlite3
import sys
import threading
import time
import webbrowser
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

PORT = 8765
BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")
DATA = os.path.join(BASE, "data")
DB_PATH = os.path.join(DATA, "pps_records.db")
BACKUPS = os.path.join(DATA, "backups")
KEEP_BACKUPS = 60

os.makedirs(DATA, exist_ok=True)
os.makedirs(BACKUPS, exist_ok=True)
LOCK = threading.Lock()


def db():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with LOCK, db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute(
            """CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                report_no TEXT, client TEXT, test_date TEXT, status TEXT,
                next_date TEXT, created_at TEXT, updated_at TEXT, data TEXT NOT NULL)"""
        )
        con.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")


def daily_backup():
    if not os.path.exists(DB_PATH):
        return
    target = os.path.join(BACKUPS, f"pps_records_{date.today().isoformat()}.db")
    if not os.path.exists(target):
        with LOCK:
            src = sqlite3.connect(DB_PATH)
            dst = sqlite3.connect(target)
            src.backup(dst)
            dst.close()
            src.close()
    files = sorted(f for f in os.listdir(BACKUPS) if f.endswith(".db"))
    for old in files[:-KEEP_BACKUPS]:
        try:
            os.remove(os.path.join(BACKUPS, old))
        except OSError:
            pass


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC, **kw)

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    # ---------- helpers ----------
    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---------- routes ----------
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/ping":
            return self.send_json({"ok": True})
        if path == "/api/records":
            with LOCK, db() as con:
                rows = con.execute("SELECT data FROM records ORDER BY updated_at DESC").fetchall()
            return self.send_json([json.loads(r["data"]) for r in rows])
        if path.startswith("/api/records/"):
            rid = unquote(path.split("/api/records/", 1)[1])
            with LOCK, db() as con:
                r = con.execute("SELECT data FROM records WHERE id=?", (rid,)).fetchone()
            return self.send_json(json.loads(r["data"]) if r else {"error": "not found"}, 200 if r else 404)
        if path == "/api/settings":
            with LOCK, db() as con:
                rows = con.execute("SELECT key, value FROM settings").fetchall()
            return self.send_json({r["key"]: json.loads(r["value"]) for r in rows})
        if path == "/api/backup":
            tmp = os.path.join(DATA, "_download_backup.db")
            with LOCK:
                src = sqlite3.connect(DB_PATH)
                dst = sqlite3.connect(tmp)
                src.backup(dst)
                dst.close()
                src.close()
            with open(tmp, "rb") as f:
                body = f.read()
            os.remove(tmp)
            name = f"pps_records_backup_{datetime.now().strftime('%Y-%m-%d_%H%M')}.db"
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        if path.startswith("/api/records/"):
            rid = unquote(path.split("/api/records/", 1)[1])
            rec = self.read_json()
            rec["id"] = rid
            now = datetime.now().isoformat(timespec="seconds")
            with LOCK, db() as con:
                old = con.execute("SELECT created_at FROM records WHERE id=?", (rid,)).fetchone()
                created = old["created_at"] if old else now
                rec["createdAt"], rec["updatedAt"] = created, now
                con.execute(
                    """INSERT INTO records (id, report_no, client, test_date, status, next_date, created_at, updated_at, data)
                       VALUES (?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET report_no=excluded.report_no, client=excluded.client,
                       test_date=excluded.test_date, status=excluded.status, next_date=excluded.next_date,
                       updated_at=excluded.updated_at, data=excluded.data""",
                    (rid, rec.get("reportNo", ""), rec.get("client", ""), rec.get("testDate", ""),
                     rec.get("status", ""), rec.get("nextDate", ""), created, now,
                     json.dumps(rec, ensure_ascii=False)),
                )
            return self.send_json({"ok": True, "updatedAt": now})
        if path == "/api/settings":
            data = self.read_json()
            with LOCK, db() as con:
                for k, v in data.items():
                    con.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                                (k, json.dumps(v, ensure_ascii=False)))
            return self.send_json({"ok": True})
        self.send_json({"error": "not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/records/"):
            rid = unquote(path.split("/api/records/", 1)[1])
            with LOCK, db() as con:
                con.execute("DELETE FROM records WHERE id=?", (rid,))
            return self.send_json({"ok": True})
        self.send_json({"error": "not found"}, 404)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    lan = "--lan" in sys.argv
    init_db()
    daily_backup()
    host = "0.0.0.0" if lan else "127.0.0.1"
    try:
        server = ThreadingHTTPServer((host, PORT), Handler)
    except OSError:
        print(f"\nPort {PORT} is already in use. The app may already be running.")
        print(f"Open http://localhost:{PORT} in your browser, or close the other window and try again.\n")
        webbrowser.open(f"http://localhost:{PORT}")
        time.sleep(3)
        return
    url = f"http://localhost:{PORT}"
    print("\n  PPS Particle Count Report is running.")
    print(f"  Open: {url}")
    if lan:
        ip = lan_ip()
        if ip:
            print(f"  On your phone (same Wi-Fi): http://{ip}:{PORT}")
    print(f"  Database: {DB_PATH}")
    print("  Keep this window open while you work. Press Ctrl+C to stop.\n")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped. Your data is saved.\n")


if __name__ == "__main__":
    main()
