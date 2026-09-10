#!/usr/bin/env python3
"""Register an agent or create one hosted Talkform handoff and wait for its result.

This example uses only the Python standard library. Use --register to create a
machine workspace without a human account, then save its one-time secret as
TAPK before creating a handoff. TAPK is sent only in the Authorization header
and is never written to the state file or printed by the handoff flow.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


DEFAULT_BASE_URL = "https://www.talkform.ai"
DEFAULT_STATE_PATH = Path("~/.talkform/hosted-handoff-python.json").expanduser()
SDK_NAME = "talkform-python-example"
SDK_VERSION = "1.0.0"
REQUEST_TIMEOUT_SECONDS = 20
MIN_POLL_INTERVAL_SECONDS = 10
MAX_WAIT_SECONDS = 3600

CONFIG: dict[str, Any] = {
    "id": "python-product-feedback",
    "title": "Product feedback",
    "description": "Collect one concrete outcome and the area that matters most.",
    "instructions": "Ask only for the configured fields and let the respondent review before submitting.",
    "fields": [
        {
            "id": "desiredOutcome",
            "label": "Desired outcome",
            "type": "long_text",
            "required": True,
            "promptTitle": "What outcome are you trying to achieve?",
            "promptDetail": "Ask for one concrete outcome in the respondent's own words.",
        },
        {
            "id": "priority",
            "label": "Priority",
            "type": "single_select",
            "required": True,
            "promptTitle": "Which area matters most?",
            "promptDetail": "Ask the respondent to choose the closest option.",
            "options": [
                {"value": "reliability", "label": "Reliability"},
                {"value": "speed", "label": "Speed"},
                {"value": "ease-of-use", "label": "Ease of use"},
                {"value": "other", "label": "Other"},
            ],
        },
    ],
}


@dataclass
class TalkformApiError(RuntimeError):
    status: int
    code: str
    message: str
    retry_after: int | None = None

    def __str__(self) -> str:
        return self.message


class WaitExpired(RuntimeError):
    pass


class _NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


def _retry_after_seconds(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return max(0, min(int(value.strip()), MAX_WAIT_SECONDS))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return max(0, min(int((parsed - datetime.now(timezone.utc)).total_seconds()), MAX_WAIT_SECONDS))
        except (TypeError, ValueError, OverflowError):
            return None


def validate_base_url(value: str, allow_localhost: bool) -> str:
    parsed = urlparse(value)
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("The base URL has an invalid port.") from error
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("The base URL must contain only an origin, without credentials, a path, query, or fragment.")
    host = (parsed.hostname or "").lower()
    production = parsed.scheme == "https" and host == "www.talkform.ai" and port in (None, 443)
    local = allow_localhost and parsed.scheme in ("http", "https") and host in ("localhost", "127.0.0.1", "::1")
    if not production and not local:
        raise ValueError("Refusing to send TAPK to this host. Use https://www.talkform.ai, or pair a localhost URL with --allow-localhost for fixture tests.")
    return value.rstrip("/")


def _config_fingerprint() -> str:
    encoded = json.dumps(CONFIG, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_or_create_state(path: Path) -> dict[str, str | int]:
    path = path.expanduser()
    fingerprint = _config_fingerprint()
    while True:
        if path.is_symlink():
            raise ValueError(f"Refusing to use symlinked state file: {path}")
        try:
            file_stat = path.stat()
        except FileNotFoundError:
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            state: dict[str, str | int] = {
                "version": 1,
                "idempotencyKey": str(uuid.uuid4()),
                "configSha256": fingerprint,
            }
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
            try:
                descriptor = os.open(path, flags, 0o600)
            except FileExistsError:
                continue
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(state, handle, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            return state
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError(f"State path is not a regular file: {path}")
        if stat.S_IMODE(file_stat.st_mode) & 0o077:
            raise ValueError(f"State file must be private. Run: chmod 600 {path}")
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"State file is unreadable or invalid: {path}") from error
        if not isinstance(state, dict) or state.get("version") != 1:
            raise ValueError(f"State file has an unsupported format: {path}")
        key = state.get("idempotencyKey")
        if not isinstance(key, str) or not 8 <= len(key) <= 128 or state.get("configSha256") != fingerprint:
            raise ValueError("The state file does not match this example config. Choose a new --state path instead of reusing its idempotency key.")
        return state


class TalkformClient:
    def __init__(self, base_url: str, api_key: str | None, timeout: int = REQUEST_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.opener = build_opener(_NoRedirects())

    def _redact(self, value: str) -> str:
        return value.replace(self.api_key, "[REDACTED]")[:300] if self.api_key else value[:300]

    def request(self, method: str, path: str, payload: dict[str, Any] | None = None, *, idempotency_key: str | None = None, timeout: float | None = None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {
            "Accept": "application/json",
            "User-Agent": f"{SDK_NAME}/{SDK_VERSION}",
            "X-Talkform-SDK": SDK_NAME,
            "X-Talkform-SDK-Version": SDK_VERSION,
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if body is not None:
            headers["Content-Type"] = "application/json"
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key
        request = Request(f"{self.base_url}{path}", data=body, headers=headers, method=method)
        try:
            request_timeout = max(0.1, min(float(self.timeout), timeout if timeout is not None else float(self.timeout)))
            with self.opener.open(request, timeout=request_timeout) as response:
                raw = response.read(256 * 1024)
        except HTTPError as error:
            try:
                raw = error.read(64 * 1024)
            finally:
                error.close()
            message = error.reason or "Talkform rejected the request."
            code = "http_error"
            try:
                decoded = json.loads(raw.decode("utf-8"))
                detail = decoded.get("error") if isinstance(decoded, dict) else None
                if isinstance(detail, dict):
                    if isinstance(detail.get("message"), str):
                        message = detail["message"]
                    if isinstance(detail.get("code"), str):
                        code = detail["code"]
            except (UnicodeDecodeError, json.JSONDecodeError):
                pass
            raise TalkformApiError(error.code, code, self._redact(str(message)), _retry_after_seconds(error.headers.get("Retry-After"))) from None
        except (URLError, TimeoutError, OSError) as error:
            raise TalkformApiError(0, "network_error", self._redact(f"Could not reach Talkform: {error}")) from None
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TalkformApiError(0, "invalid_response", "Talkform returned invalid JSON.") from error
        if not isinstance(decoded, dict):
            raise TalkformApiError(0, "invalid_response", "Talkform returned an unexpected response shape.")
        return decoded


def _validate_created(value: dict[str, Any]) -> tuple[str, str]:
    handoff_id = value.get("id")
    respondent_url = value.get("respondentUrl")
    if not isinstance(handoff_id, str) or not isinstance(respondent_url, str):
        raise TalkformApiError(0, "invalid_response", "Talkform did not return a handoff ID and respondent URL.")
    return handoff_id, respondent_url


def _validate_registration(value: dict[str, Any]) -> str:
    registration = value.get("registration")
    project = value.get("project")
    key = value.get("key")
    secret = value.get("secret")
    limits = value.get("limits")
    urls = value.get("urls")
    if not isinstance(registration, dict) or not isinstance(project, dict) or not isinstance(key, dict) or registration.get("ownerKind") != "machine" or registration.get("verifiedHuman") is not False:
        raise TalkformApiError(0, "invalid_response", "Talkform did not return a machine registration.")
    if not isinstance(secret, str) or not secret.startswith("tfk_"):
        raise TalkformApiError(0, "invalid_response", "Talkform did not return the one-time project secret.")
    if not isinstance(limits, dict) or limits.get("textHandoffsPerDay") != 10 or limits.get("voiceEligible") is not False:
        raise TalkformApiError(0, "invalid_response", "Talkform returned unexpected machine workspace limits.")
    if not isinstance(urls, dict) or not all(isinstance(urls.get(name), str) for name in ("handoffs", "mcp", "claim", "keys")):
        raise TalkformApiError(0, "invalid_response", "Talkform did not return hosted API URLs.")
    return secret


def poll_for_result(
    client: TalkformClient,
    handoff_id: str,
    wait_seconds: int,
    poll_interval: int,
    *,
    monotonic: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    deadline = monotonic() + wait_seconds
    while True:
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise WaitExpired(f"No reviewed result arrived within {wait_seconds} seconds.")
        retry_after: int | None = None
        rate_limit_error: TalkformApiError | None = None
        try:
            status = client.request("GET", f"/api/v1/handoffs/{handoff_id}", timeout=remaining)
            state = status.get("status")
            if state in ("expired", "deleted"):
                raise TalkformApiError(410, "gone", f"The handoff is {state}.")
            if state == "completed":
                try:
                    remaining = deadline - monotonic()
                    if remaining <= 0:
                        raise WaitExpired(f"No reviewed result arrived within {wait_seconds} seconds.")
                    return client.request("GET", f"/api/v1/handoffs/{handoff_id}/result", timeout=remaining)
                except TalkformApiError as error:
                    if error.status != 409:
                        raise
                    retry_after = error.retry_after
            elif state != "pending":
                raise TalkformApiError(0, "invalid_response", "Talkform returned an unknown handoff status.")
        except TalkformApiError as error:
            if error.status not in (409, 429):
                raise
            retry_after = error.retry_after
            if error.status == 429:
                rate_limit_error = error
        remaining = deadline - monotonic()
        delay = max(poll_interval, retry_after or 0)
        if remaining <= 0 or delay > remaining:
            if rate_limit_error is not None:
                raise rate_limit_error
            raise WaitExpired(f"No reviewed result arrived within {wait_seconds} seconds.")
        sleep(delay)


def _friendly_api_error(error: TalkformApiError) -> str:
    if error.code == "registration_exists":
        return "That agent registration already exists (409). Use the saved project secret, or choose a fresh idempotency key for a new registration."
    if error.status == 401:
        return "Authentication failed (401): TAPK was rejected. Create or replace the project key in the Talkform dashboard."
    if error.status == 410:
        return "The handoff or result is no longer available (410 Gone). Create a new handoff with a new state file."
    if error.status == 429:
        suffix = f" Retry after {error.retry_after} seconds." if error.retry_after is not None else " Retry later."
        return f"Talkform rate limit reached (429).{suffix}"
    if error.status == 409:
        return "The handoff is still pending (409 Conflict). Wait at least 10 seconds before polling again."
    return f"Talkform request failed{f' ({error.status})' if error.status else ''}: {error.message}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=argparse.SUPPRESS)
    parser.add_argument("--allow-localhost", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--register", action="store_true", help="Register a machine workspace and print its one-time secret")
    parser.add_argument("--agent-name", default="python-example-agent", help="Machine workspace name used with --register")
    parser.add_argument("--registration-idempotency-key", help="UUIDv4 key used with --register (a fresh UUID is generated by default)")
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE_PATH, help="Private idempotency state file (default: %(default)s)")
    parser.add_argument("--wait-seconds", type=int, default=300, help="Bounded wait for respondent submission, 10-3600 seconds (default: %(default)s)")
    parser.add_argument("--poll-interval", type=int, default=10, help="Polling interval, at least 10 seconds (default: %(default)s)")
    parser.add_argument("--cleanup", action="store_true", help="Permanently delete the hosted handoff when this command exits")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not 10 <= args.wait_seconds <= MAX_WAIT_SECONDS:
        parser.error(f"--wait-seconds must be between 10 and {MAX_WAIT_SECONDS}")
    if not MIN_POLL_INTERVAL_SECONDS <= args.poll_interval <= 300:
        parser.error("--poll-interval must be between 10 and 300 seconds")
    try:
        base_url = validate_base_url(args.base_url, args.allow_localhost)
    except ValueError as error:
        parser.error(str(error))
    if args.register:
        registration_key = args.registration_idempotency_key or str(uuid.uuid4())
        try:
            parsed_registration_key = uuid.UUID(registration_key)
        except ValueError:
            parser.error("--registration-idempotency-key must be a UUIDv4")
        if parsed_registration_key.version != 4:
            parser.error("--registration-idempotency-key must be a UUIDv4")
        try:
            registration = TalkformClient(base_url, None).request(
                "POST",
                "/api/v1/agents/register",
                {"name": args.agent_name, "idempotencyKey": registration_key},
                idempotency_key=registration_key,
            )
            _validate_registration(registration)
        except TalkformApiError as error:
            parser.error(_friendly_api_error(error))
        print(json.dumps(registration, indent=2, sort_keys=True), flush=True)
        print("Save the returned secret in a trusted secret store, then set TAPK before creating a handoff.", file=sys.stderr, flush=True)
        return 0

    api_key = os.environ.get("TAPK", "").strip()
    if not api_key:
        parser.error("Set TAPK to a Talkform project API key, or use --register first. The example does not accept keys on the command line.")
    try:
        state = load_or_create_state(args.state)
    except ValueError as error:
        parser.error(str(error))
    client = TalkformClient(base_url, api_key)
    handoff_id: str | None = None
    exit_code = 0
    try:
        created = client.request("POST", "/api/v1/handoffs", {
            "config": CONFIG,
            "idempotencyKey": state["idempotencyKey"],
        }, idempotency_key=str(state["idempotencyKey"]))
        handoff_id, respondent_url = _validate_created(created)
        print(f"Handoff: {handoff_id}", file=sys.stderr, flush=True)
        print("Share this private link only with the intended respondent:", file=sys.stderr, flush=True)
        print(respondent_url, file=sys.stderr, flush=True)
        print(f"Waiting up to {args.wait_seconds} seconds; polling no more often than every {args.poll_interval} seconds.", file=sys.stderr, flush=True)
        result = poll_for_result(client, handoff_id, args.wait_seconds, args.poll_interval)
        print(json.dumps(result, indent=2, sort_keys=True), flush=True)
    except WaitExpired as error:
        exit_code = 2
        disposition = "Cleanup was requested, so the handoff will now be deleted." if args.cleanup else "The handoff remains available; rerun with the same --state file to continue safely."
        print(f"{error} {disposition}", file=sys.stderr, flush=True)
    except TalkformApiError as error:
        exit_code = 1
        print(_friendly_api_error(error), file=sys.stderr)
    finally:
        if args.cleanup and handoff_id:
            try:
                client.request("DELETE", f"/api/v1/handoffs/{handoff_id}")
                print(f"Deleted hosted handoff {handoff_id}.", file=sys.stderr, flush=True)
            except TalkformApiError as error:
                exit_code = 1
                print(f"Cleanup failed: {_friendly_api_error(error)}", file=sys.stderr)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
