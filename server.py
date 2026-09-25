"""
PPS Particle Count Report - local server
Runs on your computer with Python only (no extra installs). Python 3.9 or newer.
Data is stored in data/pps_records.db (SQLite). A dated backup copy is made every day.

Start:    python server.py                 (this computer only)
          python server.py --lan           (also phones on the same Wi-Fi, with an access key)
Restore:  python server.py --restore data/backups/pps_records_2026-09-25.db
Options:  --port 8765   --no-browser   --data <folder>
"""
import argparse
import hmac
import json
import mimetypes
import os
import re
import secrets
import socket
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from contextlib import contextmanager
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

APP_ID = "pps-pc"
VERSION = "2.0.0"
PORT = 8765
BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")
KEEP_BACKUPS = 60
MAX_BODY = 2 * 1024 * 1024          # one record or the settings
MAX_IMPORT = 50 * 1024 * 1024       # a whole backup file
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
LOOPBACK = ("127.0.0.1", "::1", "::ffff:127.0.0.1")

# Windows sometimes maps .js to text/plain in the registry, which breaks the app: set the types explicitly
for ext, kind in ((".js", "text/javascript"), (".mjs", "text/javascript"), (".css", "text/css"),
                  (".html", "text/html"), (".json", "application/json"),
                  (".webmanifest", "application/manifest+json"), (".png", "image/png"), (".svg", "image/svg+xml")):
    mimetypes.add_type(kind, ext)

LOCK = threading.Lock()
DATA = DB_PATH = BACKUPS = ""
LAN_KEY = ""   # set in --lan mode; phones must present it, this computer never needs it


def set_data_dir(path):
    global DATA, DB_PATH, BACKUPS
    DATA = os.path.abspath(path)
    DB_PATH = os.path.join(DATA, "pps_records.db")
    BACKUPS = os.path.join(DATA, "backups")
    os.makedirs(BACKUPS, exist_ok=True)


def stamp():
    return datetime.now().isoformat(timespec="seconds")


@contextmanager
def connect():
    """One SQLite connection: commits on success, rolls back on error, always closes."""
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def init_db():
    with LOCK, connect() as con:
        # Plain rollback journal: everything lives in the one .db file, so copying or restoring it is safe.
        # (This also converts a database made by an older version that used WAL mode.)
        con.execute("PRAGMA journal_mode=DELETE")
        con.execute(
            """CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                report_no TEXT, client TEXT, test_date TEXT, status TEXT,
                next_date TEXT, created_at TEXT, updated_at TEXT, data TEXT NOT NULL)"""
        )
        con.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
        con.execute("CREATE INDEX IF NOT EXISTS records_updated ON records(updated_at)")


def copy_db(src_path, dst_path):
    """Consistent copy of a database (safe while the app is running)."""
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dst_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def prune_backups():
    files = sorted(f for f in os.listdir(BACKUPS) if f.startswith("pps_records_") and f.endswith(".db"))
    for old in files[:-KEEP_BACKUPS]:
        try:
            os.remove(os.path.join(BACKUPS, old))
        except OSError:
            pass


def daily_backup():
    if not os.path.exists(DB_PATH):
        return
    target = os.path.join(BACKUPS, f"pps_records_{date.today().isoformat()}.db")
    if not os.path.exists(target):
        with LOCK:
            copy_db(DB_PATH, target)
    prune_backups()


def backup_loop():
    """Keep making the daily backup while the app is left running for days."""
    while True:
        time.sleep(3600)
        try:
            daily_backup()
        except Exception:
            pass


def backup_now(tag):
    if not os.path.exists(DB_PATH):
        return None
    path = os.path.join(BACKUPS, f"pps_records_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}_{tag}.db")
    with LOCK:
        copy_db(DB_PATH, path)
    prune_backups()
    return path


def upsert(con, rec, created, updated):
    rec.pop("_base", None)
    rec["createdAt"], rec["updatedAt"] = created, updated

    def text(k):
        v = rec.get(k, "")
        return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)

    con.execute(
        """INSERT INTO records (id, report_no, client, test_date, status, next_date, created_at, updated_at, data)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET report_no=excluded.report_no, client=excluded.client,
           test_date=excluded.test_date, status=excluded.status, next_date=excluded.next_date,
           created_at=excluded.created_at, updated_at=excluded.updated_at, data=excluded.data""",
        (rec["id"], text("reportNo"), text("client"), text("testDate"), text("status"), text("nextDate"),
         created, updated, json.dumps(rec, ensure_ascii=False)),
    )


def _no_constants(name):
    raise ValueError("NaN/Infinity are not allowed")


class BadRequest(Exception):
    def __init__(self, msg, code=400, extra=None):
        super().__init__(msg)
        self.code = code
        self.extra = extra or {}


class Handler(SimpleHTTPRequestHandler):
    server_version = "PPS/" + VERSION
    sys_version = ""

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

    def read_json(self, limit=MAX_BODY):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise BadRequest("bad Content-Length")
        if n < 0 or n > limit:
            raise BadRequest("request too large", 413)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode("utf-8") or "null", parse_constant=_no_constants)
        except (UnicodeDecodeError, ValueError):
            raise BadRequest("body is not valid JSON")

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        super().end_headers()

    def host_ok(self):
        """Only answer the data API for names that mean this computer or the local network.
        This stops a web page on the internet from reading the database through DNS tricks."""
        host = (self.headers.get("Host") or "").strip().lower()
        if not host:
            return True
        name = host.split("]")[0] + "]" if host.startswith("[") else host.rsplit(":", 1)[0]
        if name in ("localhost", "127.0.0.1", "[::1]") or name.endswith(".localhost") or name.endswith(".local"):
            return True
        if IPV4_RE.match(name):
            return True
        try:
            return name == socket.gethostname().lower()
        except OSError:
            return False

    def origin_ok(self):
        """Changes must come from the app's own page, not from another website open in the same browser."""
        origin = self.headers.get("Origin")
        if origin is None:
            return True
        return urlparse(origin).netloc.lower() == (self.headers.get("Host") or "").lower()

    def key_ok(self):
        """In --lan mode other devices must show the access key (this computer itself never needs it)."""
        if not LAN_KEY or self.client_address[0] in LOOPBACK:
            return True
        given = self.headers.get("X-PPS-Key") or (parse_qs(urlparse(self.path).query).get("key") or [""])[0]
        return hmac.compare_digest(given.encode(), LAN_KEY.encode())

    def api(self, method):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return False
        try:
            if not self.host_ok():
                raise BadRequest("forbidden host", 403)
            if method != "GET" and not self.origin_ok():
                raise BadRequest("forbidden origin", 403)
            if path == "/api/ping":
                if method != "GET":
                    raise BadRequest("not found", 404)
                return self.send_json({"ok": True, "app": APP_ID, "version": VERSION, "auth": self.key_ok()}) or True
            if not self.key_ok():
                raise BadRequest("this device needs the access link shown on the laptop", 401)
            getattr(self, "api_" + method.lower())(path)
        except BadRequest as e:
            self.send_json(dict({"error": str(e)}, **e.extra), e.code)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # never leave the page hanging
            try:
                self.send_json({"error": "server error: " + type(e).__name__}, 500)
            except OSError:
                pass
        return True

    @staticmethod
    def record_id(path):
        rid = unquote(path.split("/api/records/", 1)[1])
        if not ID_RE.match(rid):
            raise BadRequest("bad record id")
        return rid

    # ---------- routes ----------
    def do_GET(self):
        if self.api("GET"):
            return
        if urlparse(self.path).path == "/":
            self.path = "/index.html" + ("?" + urlparse(self.path).query if urlparse(self.path).query else "")
        return super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path.startswith("/api/"):
            self.send_error(405)
            return
        return super().do_HEAD()

    def do_PUT(self):
        if not self.api("PUT"):
            self.send_error(405)

    def do_POST(self):
        if not self.api("POST"):
            self.send_error(405)

    def do_DELETE(self):
        if not self.api("DELETE"):
            self.send_error(405)

    def list_directory(self, path):  # no folder listings
        self.send_error(404)
        return None

    def api_get(self, path):
        if path == "/api/records":
            with LOCK, connect() as con:
                rows = con.execute("SELECT data FROM records ORDER BY updated_at DESC").fetchall()
            return self.send_json([json.loads(r["data"]) for r in rows])
        if path.startswith("/api/records/"):
            rid = self.record_id(path)
            with LOCK, connect() as con:
                r = con.execute("SELECT data FROM records WHERE id=?", (rid,)).fetchone()
            if not r:
                raise BadRequest("not found", 404)
            return self.send_json(json.loads(r["data"]))
        if path == "/api/settings":
            with LOCK, connect() as con:
                rows = con.execute("SELECT key, value FROM settings").fetchall()
            return self.send_json({r["key"]: json.loads(r["value"]) for r in rows})
        if path == "/api/backup":
            fd, tmp = tempfile.mkstemp(prefix="_download_", suffix=".db", dir=DATA)
            os.close(fd)
            try:
                with LOCK:
                    copy_db(DB_PATH, tmp)
                with open(tmp, "rb") as f:
                    body = f.read()
            finally:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
            name = f"pps_records_backup_{date.today().isoformat()}.db"
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        raise BadRequest("not found", 404)

    def api_put(self, path):
        if path.startswith("/api/records/"):
            rid = self.record_id(path)
            rec = self.read_json()
            if not isinstance(rec, dict):
                raise BadRequest("a record must be a JSON object")
            rec["id"] = rid
            base = rec.pop("_base", None)
            now = stamp()
            with LOCK, connect() as con:
                old = con.execute("SELECT created_at, data FROM records WHERE id=?", (rid,)).fetchone()
                # "_base" lists the revisions the sender last knew; anything else means it changed elsewhere
                if isinstance(base, list):
                    if old:
                        current = json.loads(old["data"])
                        if current.get("rev") not in base:
                            raise BadRequest("changed elsewhere", 409, {"reason": "changed", "current": current})
                    elif any(b is not None for b in base):
                        raise BadRequest("deleted elsewhere", 409, {"reason": "deleted", "current": None})
                created = (old["created_at"] if old else None) or now
                upsert(con, rec, created, now)
            return self.send_json({"ok": True, "createdAt": created, "updatedAt": now, "rev": rec.get("rev")})
        if path == "/api/settings":
            data = self.read_json()
            if not isinstance(data, dict) or len(data) > 200:
                raise BadRequest("settings must be a JSON object")
            with LOCK, connect() as con:
                for k, v in data.items():
                    con.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                                (str(k)[:100], json.dumps(v, ensure_ascii=False)))
            return self.send_json({"ok": True})
        raise BadRequest("not found", 404)

    def api_post(self, path):
        if path != "/api/import":
            raise BadRequest("not found", 404)
        data = self.read_json(MAX_IMPORT)
        if isinstance(data, list):
            data = {"records": data}
        if not isinstance(data, dict) or not isinstance(data.get("records"), list):
            raise BadRequest("not a PPS backup (no records list)")
        backup_now("before_import")
        res = {"ok": True, "added": 0, "updated": 0, "skipped": 0, "invalid": 0}
        with LOCK, connect() as con:
            for rec in data["records"]:
                if not isinstance(rec, dict) or not isinstance(rec.get("id"), str) or not ID_RE.match(rec["id"]):
                    res["invalid"] += 1
                    continue
                old = con.execute("SELECT created_at, updated_at FROM records WHERE id=?", (rec["id"],)).fetchone()
                incoming = str(rec.get("updatedAt") or "")
                if old and not incoming > (old["updated_at"] or ""):
                    res["skipped"] += 1
                    continue
                now = stamp()
                created = str(rec.get("createdAt") or (old["created_at"] if old else "") or now)
                upsert(con, rec, created, incoming or now)
                res["updated" if old else "added"] += 1
            settings = data.get("settings")
            if isinstance(settings, dict):
                for k, v in list(settings.items())[:200]:
                    cur = con.execute("SELECT value FROM settings WHERE key=?", (str(k)[:100],)).fetchone()
                    if cur is None or json.loads(cur["value"]) in ("", None):
                        con.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                                    (str(k)[:100], json.dumps(v, ensure_ascii=False)))
        return self.send_json(res)

    def api_delete(self, path):
        if path.startswith("/api/records/"):
            rid = self.record_id(path)
            with LOCK, connect() as con:
                n = con.execute("DELETE FROM records WHERE id=?", (rid,)).rowcount
            return self.send_json({"ok": True, "deleted": n})
        raise BadRequest("not found", 404)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows, SO_REUSEADDR would let a second copy of the app bind the same port unnoticed
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def already_running(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=1.5) as r:
            return json.loads(r.read().decode()).get("app") == APP_ID
    except Exception:
        return False


def lan_key():
    """A stable key saved in the data folder, so the phone's link keeps working after a restart."""
    path = os.path.join(DATA, "lan_key.txt")
    try:
        with open(path, encoding="utf-8") as f:
            k = f.read().strip()
        if re.match(r"^[A-Za-z0-9_-]{16,}$", k):
            return k
    except OSError:
        pass
    k = secrets.token_urlsafe(18)
    with open(path, "w", encoding="utf-8") as f:
        f.write(k)
    return k


def restore(path, port):
    """Put a backup file back as the live database (the app must be closed)."""
    if already_running(port):
        print("\n  The app is running. Close its window first, then run the restore again.\n")
        return 1
    try:
        con = sqlite3.connect(f"file:{os.path.abspath(path)}?mode=ro", uri=True)
        n = con.execute("SELECT COUNT(*) FROM records").fetchone()[0]
        con.close()
    except Exception as e:
        print(f"\n  That file is not a PPS database ({e}).\n")
        return 1
    saved = backup_now("before_restore")
    for extra in ("-wal", "-shm", "-journal"):
        try:
            os.remove(DB_PATH + extra)
        except OSError:
            pass
    copy_db(os.path.abspath(path), DB_PATH)
    init_db()
    print(f"\n  Restored {n} records from {path}.")
    if saved:
        print(f"  The database you had before is kept as {saved}")
    print()
    return 0


def main(argv=None):
    global LAN_KEY
    ap = argparse.ArgumentParser(description="PPS Particle Count Report - local server")
    ap.add_argument("--lan", action="store_true", help="also allow phones on the same Wi-Fi (with an access key)")
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--no-browser", action="store_true", help="don't open the browser")
    ap.add_argument("--data", default=os.environ.get("PPS_DATA_DIR") or os.path.join(BASE, "data"),
                    help="folder for the database and backups")
    ap.add_argument("--restore", metavar="BACKUP.db", help="replace the database with a backup file, then exit")
    args = ap.parse_args(argv)

    set_data_dir(args.data)
    if args.restore:
        return restore(args.restore, args.port)
    url = f"http://localhost:{args.port}"
    if already_running(args.port):
        print(f"\n  The app is already running. Opening {url}\n")
        if not args.no_browser:
            webbrowser.open(url)
        time.sleep(2)
        return 0
    init_db()
    daily_backup()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    try:
        server = Server((host, args.port), Handler)
    except OSError:
        print(f"\n  Port {args.port} is used by another program. Close it, or start with --port 8766\n")
        time.sleep(3)
        return 1
    threading.Thread(target=backup_loop, daemon=True).start()
    print("\n  PPS Particle Count Report is running.")
    print(f"  Open: {url}")
    if args.lan:
        LAN_KEY = lan_key()
        ip = lan_ip()
        print(f"  On your phone (same Wi-Fi), open this exact link:\n    http://{ip or '<this-computer-ip>'}:{args.port}/?key={LAN_KEY}")
        print("  Only share this link with people who may see all records.")
    print(f"  Database: {DB_PATH}")
    print("  Keep this window open while you work. Press Ctrl+C to stop.\n")
    sys.stdout.flush()
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped. Your data is saved.\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
