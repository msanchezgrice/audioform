#!/usr/bin/env python3
"""Receive signed Talkform completion events and fetch reviewed JSON."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
import sqlite3
import stat
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_BODY_BYTES = 64 * 1024
SIGNATURE_TOLERANCE_SECONDS = 5 * 60
MAX_INBOX_ROWS = 10_000
DEFAULT_API_ORIGIN = "https://www.talkform.ai"
DEFAULT_INBOX_PATH = Path("~/.talkform/webhook-inbox.sqlite3").expanduser()


class _NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


def verify_signature(raw_body: bytes, header: str, secret: str, *, now: int | None = None) -> str:
    values: dict[str, str] = {}
    for item in header.split(","):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        if key in values:
            raise ValueError("malformed webhook signature")
        values[key] = value
    try:
        timestamp = int(values["t"])
    except (KeyError, ValueError):
        raise ValueError("malformed webhook signature") from None
    current = int(time.time()) if now is None else now
    if abs(current - timestamp) > SIGNATURE_TOLERANCE_SECONDS:
        raise ValueError("stale webhook signature")
    supplied = values.get("v1", "")
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
    if set(values) != {"t", "v1"} or not supplied or not hmac.compare_digest(supplied, expected):
        raise ValueError("invalid webhook signature")
    return values.get("v1", "")


def api_origin() -> str:
    value = os.environ.get("TALKFORM_API_ORIGIN", DEFAULT_API_ORIGIN).strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
        raise RuntimeError("TALKFORM_API_ORIGIN must be an origin")
    return value


def _uuid(value: object, label: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a UUID")
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        raise ValueError(f"{label} must be a UUID") from None
    if str(parsed) != value.lower():
        raise ValueError(f"{label} must be a canonical UUID")
    return str(parsed)


def validate_result_url(result_url: str, handoff_id: str, *, origin: str | None = None) -> None:
    expected_origin = api_origin() if origin is None else origin.rstrip("/")
    parsed = urlsplit(result_url)
    if f"{parsed.scheme}://{parsed.netloc}" != expected_origin or parsed.query or parsed.fragment:
        raise ValueError("result URL is outside the configured Talkform origin")
    path_parts = parsed.path.split("/")
    if len(path_parts) != 6 or path_parts[:4] != ["", "api", "v1", "handoffs"] or path_parts[5] != "result":
        raise ValueError("result URL has an unexpected path")
    if _uuid(path_parts[4], "result URL handoff id") != handoff_id:
        raise ValueError("result URL handoff id does not match the event")


def fetch_result(result_url: str, project_key: str, *, handoff_id: str | None = None) -> dict[str, Any]:
    if handoff_id is not None:
        validate_result_url(result_url, handoff_id)
    request = Request(result_url, headers={"Accept": "application/json", "Authorization": f"Bearer {project_key}"}, method="GET")
    try:
        with build_opener(_NoRedirects()).open(request, timeout=20) as response:
            body = response.read(MAX_BODY_BYTES + 1)
            if len(body) > MAX_BODY_BYTES:
                raise RuntimeError("result response was too large")
            result = json.loads(body.decode("utf-8"))
    except HTTPError as error:
        error.close()
        raise RuntimeError("result fetch failed") from error
    except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("result fetch failed") from error
    if not isinstance(result, dict):
        raise RuntimeError("result response was not an object")
    return result


class WebhookInbox:
    """A bounded SQLite inbox: event ID and reviewed JSON commit together before 2xx."""

    def __init__(self, path: str | Path):
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.path.parent, 0o700)
        with self._connection() as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, handoff_id TEXT NOT NULL, received_at INTEGER NOT NULL, result_json TEXT NOT NULL)")
        os.chmod(self.path, stat.S_IRUSR | stat.S_IWUSR)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
        finally:
            connection.close()

    def store_if_new(self, event_id: str, handoff_id: str, result: dict[str, Any]) -> bool:
        serialized = json.dumps(result, separators=(",", ":"), ensure_ascii=False)
        with self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute("SELECT 1 FROM events WHERE event_id = ?", (event_id,)).fetchone()
            if existing:
                connection.rollback()
                return False
            connection.execute("INSERT INTO events(event_id,handoff_id,received_at,result_json) VALUES(?,?,?,?)", (event_id, handoff_id, int(time.time()), serialized))
            connection.execute("DELETE FROM events WHERE event_id IN (SELECT event_id FROM events ORDER BY received_at DESC, rowid DESC LIMIT -1 OFFSET ?)", (MAX_INBOX_ROWS,))
            connection.commit()
        os.chmod(self.path, stat.S_IRUSR | stat.S_IWUSR)
        return True

    def contains(self, event_id: str) -> bool:
        with self._connection() as connection:
            return connection.execute("SELECT 1 FROM events WHERE event_id = ?", (event_id,)).fetchone() is not None


class WebhookHandler(BaseHTTPRequestHandler):
    inbox: WebhookInbox | None = None

    def log_message(self, format: str, *args: Any) -> None:
        return None

    def send_json(self, status: int, payload: dict[str, str]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        raw_length = self.headers.get("Content-Length")
        try:
            length = int(raw_length or "")
        except ValueError:
            self.send_json(400, {"error": "invalid_content_length"})
            return
        if length <= 0:
            self.send_json(400, {"error": "payload_required"})
            return
        if length > MAX_BODY_BYTES:
            self.send_json(413, {"error": "payload_too_large"})
            return
        raw_body = self.rfile.read(length)
        if len(raw_body) != length:
            self.send_json(400, {"error": "incomplete_payload"})
            return
        try:
            verify_signature(raw_body, self.headers.get("X-Talkform-Signature", ""), os.environ["TALKFORM_WEBHOOK_SECRET"])
            payload = json.loads(raw_body.decode("utf-8"))
            if not isinstance(payload, dict) or payload.get("type") != "handoff.completed":
                raise ValueError("unexpected webhook payload")
            event_id = _uuid(payload.get("id"), "event id")
            data = payload.get("data")
            if not isinstance(data, dict) or data.get("status") != "completed":
                raise ValueError("unexpected webhook payload")
            handoff_id = _uuid(data.get("handoffId"), "handoff id")
            result_url = data.get("resultUrl")
            if not isinstance(result_url, str):
                raise ValueError("missing result URL")
            validate_result_url(result_url, handoff_id)
            inbox = self.inbox or WebhookInbox(os.environ.get("TALKFORM_WEBHOOK_INBOX", str(DEFAULT_INBOX_PATH)))
            if inbox.contains(event_id):
                self.send_json(200, {"status": "duplicate"})
                return
            result = fetch_result(result_url, os.environ["TALKFORM_PROJECT_KEY"], handoff_id=handoff_id)
            if not inbox.store_if_new(event_id, handoff_id, result):
                self.send_json(200, {"status": "duplicate"})
                return
        except (KeyError, TypeError, ValueError, RuntimeError, json.JSONDecodeError):
            self.send_json(503, {"error": "webhook_not_accepted"})
            return
        self.send_json(200, {"status": "accepted"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--inbox", type=Path, default=DEFAULT_INBOX_PATH, help="0600 SQLite inbox path")
    args = parser.parse_args()
    if not os.environ.get("TALKFORM_WEBHOOK_SECRET") or not os.environ.get("TALKFORM_PROJECT_KEY"):
        parser.error("Set TALKFORM_WEBHOOK_SECRET and TALKFORM_PROJECT_KEY in the server environment.")
    WebhookHandler.inbox = WebhookInbox(args.inbox)
    ThreadingHTTPServer(("", args.port), WebhookHandler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
