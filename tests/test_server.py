"""Server tests. Run with:  python -m unittest discover -s tests -v"""
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import server  # noqa: E402


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="pps_test_")
        server.set_data_dir(cls.tmp)
        server.init_db()
        cls.httpd = server.Server(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def call(self, method, path, body=None, headers=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers or {})
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read()

    def json_call(self, *a, **kw):
        code, _, body = self.call(*a, **kw)
        return code, json.loads(body.decode() or "null")

    def test_ping(self):
        code, j = self.json_call("GET", "/api/ping")
        self.assertEqual(code, 200)
        self.assertEqual(j["app"], "pps-pc")

    def test_record_round_trip(self):
        code, j = self.json_call("PUT", "/api/records/rtrip1", {"client": "Acme", "reportNo": "PPS/PC/26-27/001"})
        self.assertEqual(code, 200)
        created = j["createdAt"]
        code, rec = self.json_call("GET", "/api/records/rtrip1")
        self.assertEqual(rec["client"], "Acme")
        self.assertEqual(rec["id"], "rtrip1")
        code, j2 = self.json_call("PUT", "/api/records/rtrip1", {"client": "Acme 2", "createdAt": "1999-01-01T00:00:00"})
        self.assertEqual(j2["createdAt"], created, "createdAt is kept from the first save")
        code, lst = self.json_call("GET", "/api/records")
        self.assertIn("Acme 2", [r["client"] for r in lst])
        code, _ = self.json_call("DELETE", "/api/records/rtrip1")
        self.assertEqual(code, 200)
        code, _ = self.json_call("GET", "/api/records/rtrip1")
        self.assertEqual(code, 404)

    def test_bad_input_is_rejected_cleanly(self):
        self.assertEqual(self.call("PUT", "/api/records/rbad", raw=b"{not json")[0], 400)
        self.assertEqual(self.call("PUT", "/api/records/rbad", body=[1, 2])[0], 400)
        self.assertEqual(self.call("PUT", "/api/records/", body={})[0], 400)
        self.assertEqual(self.call("PUT", "/api/records/..%2Fetc", body={})[0], 400)
        self.assertEqual(self.call("PUT", "/api/settings", body=["x"])[0], 400)
        self.assertEqual(self.call("GET", "/api/nothing")[0], 404)
        self.assertEqual(self.call("POST", "/api/import", body={"x": 1})[0], 400)

    def test_oversized_body(self):
        # the server refuses from the declared length alone, without reading the body
        code, _, _ = self.call("PUT", "/api/records/rbig", raw=b"{}", headers={"Content-Length": str(server.MAX_BODY + 10)})
        self.assertEqual(code, 413)

    def test_foreign_host_and_origin_blocked(self):
        self.assertEqual(self.call("GET", "/api/records", headers={"Host": "evil.example.com"})[0], 403)
        self.assertEqual(self.call("DELETE", "/api/records/rx", headers={"Origin": "http://evil.example.com"})[0], 403)
        host = self.base.split("//")[1]
        self.assertEqual(self.call("PUT", "/api/records/rsame", body={"client": "x"}, headers={"Origin": "http://" + host})[0], 200)
        self.assertEqual(self.call("GET", "/api/ping", headers={"Host": "192.168.1.25:8765"})[0], 200)
        self.assertEqual(self.call("GET", "/api/ping", headers={"Host": "my-laptop.local:8765"})[0], 200)

    def test_conflicting_saves_are_refused(self):
        self.json_call("PUT", "/api/records/rcon", {"client": "A", "rev": "v1", "_base": [None]})
        # a second device that last saw v1 saves v2: fine
        code, j = self.json_call("PUT", "/api/records/rcon", {"client": "B", "rev": "v2", "_base": ["v1"]})
        self.assertEqual((code, j["rev"]), (200, "v2"))
        # a stale tab that still thinks v1 is current is refused, and told what is there now
        code, j = self.json_call("PUT", "/api/records/rcon", {"client": "stale", "rev": "v3", "_base": ["v1"]})
        self.assertEqual(code, 409)
        self.assertEqual((j["reason"], j["current"]["client"]), ("changed", "B"))
        # a retry of a save whose reply was lost still goes through (v2 is in the list)
        code, _ = self.json_call("PUT", "/api/records/rcon", {"client": "C", "rev": "v4", "_base": ["v1", "v2"]})
        self.assertEqual(code, 200)
        stored = self.json_call("GET", "/api/records/rcon")[1]
        self.assertNotIn("_base", stored)
        # deleted elsewhere: an old tab can't bring it back silently
        self.json_call("DELETE", "/api/records/rcon")
        code, j = self.json_call("PUT", "/api/records/rcon", {"client": "ghost", "rev": "v5", "_base": ["v4"]})
        self.assertEqual((code, j["reason"]), (409, "deleted"))
        # "keep my version" (no _base) saves on purpose
        self.assertEqual(self.json_call("PUT", "/api/records/rcon", {"client": "mine", "rev": "v6"})[0], 200)

    def test_nan_rejected(self):
        self.assertEqual(self.call("PUT", "/api/settings", raw=b'{"testedBy": NaN}')[0], 400)

    def test_frame_and_hardening_headers(self):
        _, headers, _ = self.call("GET", "/")
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])

    def test_database_is_one_file(self):
        self.json_call("PUT", "/api/records/rjm", {"client": "journal"})
        import sqlite3
        con = sqlite3.connect(server.DB_PATH)
        mode = con.execute("PRAGMA journal_mode").fetchone()[0]
        con.close()
        self.assertEqual(mode, "delete")
        self.assertFalse(os.path.exists(server.DB_PATH + "-wal"))

    def test_settings(self):
        self.json_call("PUT", "/api/settings", {"testedBy": "Saranyan", "iso11171": True})
        code, s = self.json_call("GET", "/api/settings")
        self.assertEqual(s["testedBy"], "Saranyan")
        self.assertIs(s["iso11171"], True)

    def test_import_merges_by_newest(self):
        self.json_call("PUT", "/api/records/rimp1", {"client": "Current"})
        code, res = self.json_call("POST", "/api/import", {"records": [
            {"id": "rimp1", "client": "Old copy", "updatedAt": "2000-01-01T00:00:00"},
            {"id": "rimp2", "client": "New one", "updatedAt": "2026-01-01T10:00:00", "createdAt": "2026-01-01T09:00:00"},
            {"id": "rimp1", "client": "Future copy", "updatedAt": "2999-01-01T00:00:00"},
            {"id": "bad id!"}, "not a record"]})
        self.assertEqual(code, 200)
        self.assertEqual((res["added"], res["updated"], res["skipped"], res["invalid"]), (1, 1, 1, 2))
        self.assertEqual(self.json_call("GET", "/api/records/rimp1")[1]["client"], "Future copy")
        new = self.json_call("GET", "/api/records/rimp2")[1]
        self.assertEqual((new["createdAt"], new["updatedAt"]), ("2026-01-01T09:00:00", "2026-01-01T10:00:00"))
        backups = os.listdir(os.path.join(self.tmp, "backups"))
        self.assertTrue(any("before_import" in b for b in backups))

    def test_backup_download_is_a_database(self):
        self.json_call("PUT", "/api/records/rbk", {"client": "Backup me"})
        code, headers, body = self.call("GET", "/api/backup")
        self.assertEqual(code, 200)
        self.assertTrue(body.startswith(b"SQLite format 3"))
        self.assertIn("attachment", headers["Content-Disposition"])
        self.assertFalse([f for f in os.listdir(self.tmp) if f.startswith("_download_")], "temp file removed")

    def test_static_files_and_types(self):
        for path, kind in (("/", "text/html"), ("/js/app.js", "text/javascript"), ("/sw.js", "text/javascript"),
                           ("/manifest.webmanifest", "application/manifest+json"), ("/icons/apple-touch-icon.png", "image/png")):
            code, headers, _ = self.call("GET", path)
            self.assertEqual(code, 200, path)
            self.assertIn(kind, headers["Content-Type"], path)
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(self.call("GET", "/lib/")[0], 404, "no folder listing")

    def test_concurrent_saves(self):
        errors = []

        def worker(n):
            try:
                for i in range(15):
                    code, _ = self.json_call("PUT", f"/api/records/rc{n}_{i}", {"client": f"C{n}", "i": i})
                    if code != 200:
                        errors.append(code)
            except Exception as e:  # pragma: no cover
                errors.append(repr(e))

        threads = [threading.Thread(target=worker, args=(n,)) for n in range(6)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        code, lst = self.json_call("GET", "/api/records")
        self.assertEqual(len([r for r in lst if r["id"].startswith("rc")]), 90)


class LanKeyTest(unittest.TestCase):
    """In --lan mode other devices need the key; this computer never does."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="pps_lan_")
        server.set_data_dir(self.tmp)
        server.init_db()
        server.LAN_KEY = "k" * 24
        self.httpd = server.Server(("127.0.0.1", 0), server.Handler)
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        server.LAN_KEY = ""
        self.httpd.shutdown()
        self.httpd.server_close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def status(self, path, key=None, client="127.0.0.1"):
        req = urllib.request.Request(self.base + path, headers={"X-PPS-Key": key} if key else {})
        orig = server.Handler.key_ok
        if client != "127.0.0.1":
            # pretend the request came from a phone on the Wi-Fi
            def key_ok(h):
                h.client_address = (client, 1234)
                return orig(h)
            server.Handler.key_ok = key_ok
        def parse(resp, body):
            return json.loads(body or b"null") if "json" in (resp.headers.get("Content-Type") or "") else body
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, parse(r, r.read())
        except urllib.error.HTTPError as e:
            return e.code, parse(e, e.read())
        finally:
            server.Handler.key_ok = orig

    def test_key_rules(self):
        self.assertEqual(self.status("/api/records")[0], 200)                         # the laptop itself
        self.assertEqual(self.status("/api/records", client="192.168.1.9")[0], 401)   # phone without key
        self.assertEqual(self.status("/api/records", "wrong", client="192.168.1.9")[0], 401)
        self.assertEqual(self.status("/api/records", "k" * 24, client="192.168.1.9")[0], 200)
        code, j = self.status("/api/ping", client="192.168.1.9")
        self.assertEqual((code, j["auth"]), (200, False))
        self.assertEqual(self.status("/api/backup?key=" + "k" * 24, client="192.168.1.9")[0], 200)


class RestoreTest(unittest.TestCase):
    def test_restore_replaces_database_and_keeps_old_copy(self):
        tmp = tempfile.mkdtemp(prefix="pps_rs_")
        try:
            server.set_data_dir(tmp)
            server.init_db()
            import sqlite3
            with server.connect() as con:
                server.upsert(con, {"id": "rnow", "client": "Current"}, "2026-01-01T00:00:00", "2026-01-01T00:00:00")
            snap = os.path.join(tmp, "snap.db")
            server.copy_db(server.DB_PATH, snap)
            with server.connect() as con:
                con.execute("DELETE FROM records")
            self.assertEqual(server.restore(snap, 1), 0)   # port 1: nothing is running there
            con = sqlite3.connect(server.DB_PATH)
            self.assertEqual(con.execute("SELECT client FROM records").fetchone()[0], "Current")
            con.close()
            self.assertTrue(any("before_restore" in f for f in os.listdir(os.path.join(tmp, "backups"))))
            bad = os.path.join(tmp, "bad.db")
            open(bad, "w").write("not a database")
            self.assertEqual(server.restore(bad, 1), 1)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class BackupRetentionTest(unittest.TestCase):
    def test_old_backups_pruned(self):
        tmp = tempfile.mkdtemp(prefix="pps_bk_")
        try:
            server.set_data_dir(tmp)
            server.init_db()
            for i in range(server.KEEP_BACKUPS + 5):
                open(os.path.join(tmp, "backups", f"pps_records_2000-01-{i:03d}.db"), "w").close()
            server.daily_backup()
            files = [f for f in os.listdir(os.path.join(tmp, "backups")) if f.endswith(".db")]
            self.assertEqual(len(files), server.KEEP_BACKUPS)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
