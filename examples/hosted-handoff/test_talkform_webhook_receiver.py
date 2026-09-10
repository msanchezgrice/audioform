from __future__ import annotations

import hashlib
import hmac
import importlib.util
import json
import os
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


SCRIPT = Path(__file__).with_name("talkform_webhook_receiver.py")
SPEC = importlib.util.spec_from_file_location("talkform_webhook_receiver", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class WebhookReceiverTests(unittest.TestCase):
    def test_verifies_exact_raw_body_and_timestamp(self) -> None:
        body = json.dumps({"id": "event-1", "type": "handoff.completed"}, separators=(",", ":")).encode()
        secret = "tfwh_fixture_secret"
        timestamp = 1_800_000_000
        digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
        self.assertEqual(MODULE.verify_signature(body, f"t={timestamp},v1={digest}", secret, now=timestamp), digest)
        with self.assertRaises(ValueError):
            MODULE.verify_signature(body + b" ", f"t={timestamp},v1={digest}", secret, now=timestamp)

    def test_rejects_stale_and_wrong_secret_signatures(self) -> None:
        body = b'{"id":"event-1"}'
        timestamp = 1_800_000_000
        digest = hmac.new(b"secret", f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
        with self.assertRaisesRegex(ValueError, "stale"):
            MODULE.verify_signature(body, f"t={timestamp},v1={digest}", "secret", now=timestamp + MODULE.SIGNATURE_TOLERANCE_SECONDS + 1)
        with self.assertRaisesRegex(ValueError, "invalid"):
            MODULE.verify_signature(body, f"t={timestamp},v1={digest}", "wrong", now=timestamp)

    def test_result_url_is_matching_talkform_endpoint(self) -> None:
        handoff_id = "22222222-2222-4222-8222-222222222222"
        MODULE.validate_result_url(f"https://www.talkform.ai/api/v1/handoffs/{handoff_id}/result", handoff_id)
        with self.assertRaisesRegex(ValueError, "outside"):
            MODULE.validate_result_url(f"https://evil.example/api/v1/handoffs/{handoff_id}/result", handoff_id)
        with self.assertRaisesRegex(ValueError, "does not match"):
            MODULE.validate_result_url(f"https://www.talkform.ai/api/v1/handoffs/33333333-3333-4333-8333-333333333333/result", handoff_id)

    def test_result_fetch_refuses_redirects(self) -> None:
        class RedirectOpener:
            def open(self, request: Request, timeout: int) -> None:
                raise HTTPError(request.full_url, 302, "redirect", {}, None)

        original = MODULE.build_opener
        MODULE.build_opener = lambda *handlers: RedirectOpener()
        try:
            with self.assertRaisesRegex(RuntimeError, "result fetch failed"):
                MODULE.fetch_result("https://www.talkform.ai/api/v1/handoffs/22222222-2222-4222-8222-222222222222/result", "tfk_secret", handoff_id="22222222-2222-4222-8222-222222222222")
        finally:
            MODULE.build_opener = original

    def test_inbox_persists_result_and_deduplicates_concurrent_delivery(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "inbox.sqlite3")
            inbox = MODULE.WebhookInbox(path)
            event_id = "11111111-1111-4111-8111-111111111111"
            handoff_id = "22222222-2222-4222-8222-222222222222"
            result = {"status": "completed", "fields": {"priority": "reliability"}}
            with ThreadPoolExecutor(max_workers=8) as pool:
                outcomes = list(pool.map(lambda _: inbox.store_if_new(event_id, handoff_id, result), range(8)))
            self.assertEqual(sum(outcomes), 1)
            self.assertTrue(inbox.contains(event_id))
            with sqlite3.connect(path) as connection:
                row = connection.execute("SELECT handoff_id, result_json FROM events WHERE event_id = ?", (event_id,)).fetchone()
            self.assertEqual(row[0], handoff_id)
            self.assertEqual(json.loads(row[1]), result)
            self.assertEqual(MODULE.WebhookInbox(path).store_if_new(event_id, handoff_id, result), False)

    def test_delivery_fetch_failure_returns_503_and_does_not_ack(self) -> None:
        previous = {key: os.environ.get(key) for key in ("TALKFORM_WEBHOOK_SECRET", "TALKFORM_PROJECT_KEY", "TALKFORM_API_ORIGIN")}
        original_fetch = MODULE.fetch_result
        with tempfile.TemporaryDirectory() as directory:
            os.environ.update({"TALKFORM_WEBHOOK_SECRET": "tfwh_fixture_secret", "TALKFORM_PROJECT_KEY": "tfk_fixture_secret", "TALKFORM_API_ORIGIN": "http://127.0.0.1"})
            MODULE.fetch_result = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("result fetch failed"))
            MODULE.WebhookHandler.inbox = MODULE.WebhookInbox(Path(directory, "inbox.sqlite3"))
            server = ThreadingHTTPServer(("127.0.0.1", 0), MODULE.WebhookHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                event_id = "11111111-1111-4111-8111-111111111111"
                handoff_id = "22222222-2222-4222-8222-222222222222"
                payload = {"id": event_id, "type": "handoff.completed", "createdAt": "2026-09-10T18:04:00.000Z", "data": {"handoffId": handoff_id, "projectId": "33333333-3333-4333-8333-333333333333", "status": "completed", "resultUrl": f"http://127.0.0.1/api/v1/handoffs/{handoff_id}/result", "resultExpiresAt": "2026-09-17T18:04:00.000Z"}}
                body = json.dumps(payload, separators=(",", ":")).encode()
                timestamp = int(__import__("time").time())
                digest = hmac.new(b"tfwh_fixture_secret", f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
                request = Request(f"http://127.0.0.1:{server.server_port}", data=body, headers={"Content-Type": "application/json", "X-Talkform-Signature": f"t={timestamp},v1={digest}"}, method="POST")
                with self.assertRaises(HTTPError) as error:
                    urlopen(request, timeout=3)
                self.assertEqual(error.exception.code, 503)
                error.exception.close()
                self.assertFalse(MODULE.WebhookHandler.inbox.contains(event_id))
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)
        MODULE.fetch_result = original_fetch
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


if __name__ == "__main__":
    unittest.main()
