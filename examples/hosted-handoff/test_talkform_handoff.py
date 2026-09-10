from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


SCRIPT = Path(__file__).with_name("talkform_handoff.py")
SPEC = importlib.util.spec_from_file_location("talkform_handoff", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FixtureHandler(BaseHTTPRequestHandler):
    requests: list[dict[str, Any]] = []
    api_key = "tfk_fixture_prefix_fixture-secret-never-print"
    get_mode = "completed"

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _record(self) -> dict[str, Any] | None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        payload = json.loads(body) if body else None
        self.requests.append({"method": self.command, "path": self.path, "headers": dict(self.headers), "json": payload})
        return payload

    def _json(self, status: int, payload: dict[str, Any], headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        payload = self._record()
        assert payload
        self._json(201, {
            "id": "11111111-1111-4111-8111-111111111111",
            "respondentUrl": "https://www.talkform.ai/respond/11111111-1111-4111-8111-111111111111#token=private-respondent-token",
            "status": "pending",
            "expiresAt": "2026-09-17T00:00:00.000Z",
        })

    def do_GET(self) -> None:
        self._record()
        if self.get_mode == "gone":
            self._json(410, {"error": {"code": "expired", "message": "Handoff result has expired."}})
            return
        if self.get_mode == "rate_limited":
            self._json(429, {"error": {"code": "rate_limited", "message": "Too many requests."}}, {"Retry-After": "17"})
            return
        if self.get_mode == "pending":
            self._json(200, {
                "id": "11111111-1111-4111-8111-111111111111",
                "projectId": "22222222-2222-4222-8222-222222222222",
                "status": "pending", "createdAt": "2026-09-10T00:00:00.000Z",
                "expiresAt": "2026-09-17T00:00:00.000Z", "completedAt": None, "resultExpiresAt": None,
            })
            return
        if self.path.endswith("/result"):
            self._json(200, {
                "schemaVersion": "1.0",
                "formId": "python-product-feedback",
                "sessionId": "11111111-1111-4111-8111-111111111111",
                "status": "completed",
                "completion": {"required": 2, "captured": 2, "percent": 100, "missingFieldIds": []},
                "currentPrompt": None,
                "fields": {"desiredOutcome": "Fewer manual steps", "priority": "ease-of-use"},
                "transcript": [],
                "summary": "",
                "metadata": {"model": "local-text", "voice": "none", "startedAt": "2026-09-10T00:00:00.000Z", "completedAt": "2026-09-10T00:01:00.000Z", "mode": "text"},
            })
        else:
            self._json(200, {
                "id": "11111111-1111-4111-8111-111111111111",
                "projectId": "22222222-2222-4222-8222-222222222222",
                "status": "completed",
                "createdAt": "2026-09-10T00:00:00.000Z",
                "expiresAt": "2026-09-17T00:00:00.000Z",
                "completedAt": "2026-09-10T00:01:00.000Z",
                "resultExpiresAt": "2026-09-17T00:01:00.000Z",
            })

    def do_DELETE(self) -> None:
        self._record()
        self._json(200, {"id": "11111111-1111-4111-8111-111111111111", "deleted": True})


class HostedHandoffExampleTests(unittest.TestCase):
    def setUp(self) -> None:
        FixtureHandler.requests = []
        FixtureHandler.get_mode = "completed"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_cli_executes_create_status_result_and_explicit_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory, "state.json")
            environment = {**os.environ, "TAPK": FixtureHandler.api_key}
            completed = subprocess.run([
                sys.executable, str(SCRIPT),
                "--base-url", f"http://127.0.0.1:{self.server.server_port}",
                "--allow-localhost", "--state", str(state), "--wait-seconds", "10", "--cleanup",
            ], text=True, capture_output=True, env=environment, timeout=10, check=False)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("Share this private link only with the intended respondent", completed.stderr)
            self.assertIn('"desiredOutcome": "Fewer manual steps"', completed.stdout)
            self.assertNotIn(FixtureHandler.api_key, completed.stdout + completed.stderr)
            self.assertEqual(state.stat().st_mode & 0o777, 0o600)
            self.assertNotIn(FixtureHandler.api_key, state.read_text())
            self.assertEqual([item["method"] for item in FixtureHandler.requests], ["POST", "GET", "GET", "DELETE"])
            for item in FixtureHandler.requests:
                headers = {key.lower(): value for key, value in item["headers"].items()}
                self.assertEqual(headers["authorization"], f"Bearer {FixtureHandler.api_key}")
                self.assertEqual(headers["x-talkform-sdk"], MODULE.SDK_NAME)
                self.assertEqual(headers["x-talkform-sdk-version"], MODULE.SDK_VERSION)
            created = FixtureHandler.requests[0]
            self.assertEqual(created["json"]["idempotencyKey"], json.loads(state.read_text())["idempotencyKey"])
            self.assertEqual({key.lower(): value for key, value in created["headers"].items()}["idempotency-key"], created["json"]["idempotencyKey"])
            self.assertEqual(created["json"]["config"], MODULE.CONFIG)

    def test_polling_retries_409_at_ten_second_intervals_and_stops(self) -> None:
        class Clock:
            value = 0.0
            sleeps: list[float] = []

            def monotonic(self) -> float:
                return self.value

            def sleep(self, seconds: float) -> None:
                self.sleeps.append(seconds)
                self.value += seconds

        class Api:
            result_attempts = 0

            def request(self, method: str, path: str, *, timeout: float | None = None) -> dict[str, Any]:
                assert timeout is not None and timeout <= 25
                if path.endswith("/result"):
                    self.result_attempts += 1
                    if self.result_attempts < 3:
                        raise MODULE.TalkformApiError(409, "pending", "pending")
                    return {"status": "completed", "fields": {"ok": True}}
                return {"status": "completed"}

        clock = Clock()
        result = MODULE.poll_for_result(Api(), "handoff", 25, 10, monotonic=clock.monotonic, sleep=clock.sleep)
        self.assertEqual(result["fields"], {"ok": True})
        self.assertEqual(clock.sleeps, [10, 10])

    def test_http_error_redacts_key_and_preserves_retry_after(self) -> None:
        original = FixtureHandler.do_POST

        def rejected(handler: FixtureHandler) -> None:
            handler._record()
            handler._json(429, {"error": {"code": "rate_limited", "message": f"do not echo {FixtureHandler.api_key}"}}, {"Retry-After": "17"})

        FixtureHandler.do_POST = rejected
        try:
            client = MODULE.TalkformClient(f"http://127.0.0.1:{self.server.server_port}", FixtureHandler.api_key)
            with self.assertRaises(MODULE.TalkformApiError) as caught:
                client.request("POST", "/api/v1/handoffs", {"config": MODULE.CONFIG, "idempotencyKey": "fixture-key"})
            self.assertEqual(caught.exception.status, 429)
            self.assertEqual(caught.exception.retry_after, 17)
            self.assertNotIn(FixtureHandler.api_key, str(caught.exception))
        finally:
            FixtureHandler.do_POST = original

    def test_same_private_state_reuses_the_idempotency_key(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory, "state.json")
            command = [sys.executable, str(SCRIPT), "--base-url", f"http://127.0.0.1:{self.server.server_port}", "--allow-localhost", "--state", str(state), "--wait-seconds", "10"]
            environment = {**os.environ, "TAPK": FixtureHandler.api_key}
            for _ in range(2):
                completed = subprocess.run(command, text=True, capture_output=True, env=environment, timeout=10, check=False)
                self.assertEqual(completed.returncode, 0, completed.stderr)
            posts = [item for item in FixtureHandler.requests if item["method"] == "POST"]
            self.assertEqual(len(posts), 2)
            self.assertEqual(posts[0]["json"]["idempotencyKey"], posts[1]["json"]["idempotencyKey"])
            self.assertEqual(posts[0]["headers"]["Idempotency-Key"], posts[1]["headers"]["Idempotency-Key"])

    def test_401_and_410_are_terminal_and_never_echo_tapk(self) -> None:
        original_post = FixtureHandler.do_POST

        def unauthorized(handler: FixtureHandler) -> None:
            handler._record()
            handler._json(401, {"error": {"code": "invalid_api_key", "message": f"rejected {FixtureHandler.api_key}"}})

        try:
            with tempfile.TemporaryDirectory() as directory:
                environment = {**os.environ, "TAPK": FixtureHandler.api_key}
                FixtureHandler.do_POST = unauthorized
                first = subprocess.run([sys.executable, str(SCRIPT), "--base-url", f"http://127.0.0.1:{self.server.server_port}", "--allow-localhost", "--state", str(Path(directory, "401.json")), "--wait-seconds", "10"], text=True, capture_output=True, env=environment, timeout=10, check=False)
                self.assertEqual(first.returncode, 1)
                self.assertIn("Authentication failed (401)", first.stderr)
                self.assertNotIn(FixtureHandler.api_key, first.stdout + first.stderr)
                FixtureHandler.do_POST = original_post
                FixtureHandler.get_mode = "gone"
                second = subprocess.run([sys.executable, str(SCRIPT), "--base-url", f"http://127.0.0.1:{self.server.server_port}", "--allow-localhost", "--state", str(Path(directory, "410.json")), "--wait-seconds", "10"], text=True, capture_output=True, env=environment, timeout=10, check=False)
                self.assertEqual(second.returncode, 1)
                self.assertIn("410 Gone", second.stderr)
                self.assertNotIn(FixtureHandler.api_key, second.stdout + second.stderr)
        finally:
            FixtureHandler.do_POST = original_post

    def test_poll_rate_limit_honors_retry_after_without_crossing_deadline(self) -> None:
        FixtureHandler.get_mode = "rate_limited"
        with tempfile.TemporaryDirectory() as directory:
            completed = subprocess.run([sys.executable, str(SCRIPT), "--base-url", f"http://127.0.0.1:{self.server.server_port}", "--allow-localhost", "--state", str(Path(directory, "state.json")), "--wait-seconds", "10"], text=True, capture_output=True, env={**os.environ, "TAPK": FixtureHandler.api_key}, timeout=10, check=False)
        self.assertEqual(completed.returncode, 1)
        self.assertIn("Retry after 17 seconds", completed.stderr)

    def test_cleanup_timeout_message_matches_destructive_result(self) -> None:
        FixtureHandler.get_mode = "pending"
        with tempfile.TemporaryDirectory() as directory:
            completed = subprocess.run([sys.executable, str(SCRIPT), "--base-url", f"http://127.0.0.1:{self.server.server_port}", "--allow-localhost", "--state", str(Path(directory, "state.json")), "--wait-seconds", "10", "--cleanup"], text=True, capture_output=True, env={**os.environ, "TAPK": FixtureHandler.api_key}, timeout=10, check=False)
        self.assertEqual(completed.returncode, 2)
        self.assertIn("will now be deleted", completed.stderr)
        self.assertNotIn("remains available", completed.stderr)
        self.assertEqual(FixtureHandler.requests[-1]["method"], "DELETE")

    def test_redirect_is_not_followed_with_authorization(self) -> None:
        received: list[str | None] = []

        class Receiver(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: Any) -> None:
                pass

            def do_POST(self) -> None:
                received.append(self.headers.get("Authorization"))
                self.send_response(204)
                self.end_headers()

        receiver = ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
        thread = threading.Thread(target=receiver.serve_forever, daemon=True)
        thread.start()
        original_post = FixtureHandler.do_POST

        def redirect(handler: FixtureHandler) -> None:
            handler._record()
            handler.send_response(307)
            handler.send_header("Location", f"http://127.0.0.1:{receiver.server_port}/steal")
            handler.end_headers()

        FixtureHandler.do_POST = redirect
        try:
            client = MODULE.TalkformClient(f"http://127.0.0.1:{self.server.server_port}", FixtureHandler.api_key)
            with self.assertRaises(MODULE.TalkformApiError):
                client.request("POST", "/api/v1/handoffs", {"config": MODULE.CONFIG, "idempotencyKey": "fixture-key"})
            self.assertEqual(received, [])
        finally:
            FixtureHandler.do_POST = original_post
            receiver.shutdown()
            receiver.server_close()
            thread.join(timeout=2)

    def test_refuses_arbitrary_key_destination(self) -> None:
        with self.assertRaisesRegex(ValueError, "Refusing to send TAPK"):
            MODULE.validate_base_url("https://example.com", allow_localhost=False)


if __name__ == "__main__":
    unittest.main()
