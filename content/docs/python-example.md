# Python example

Create a hosted interview and retrieve reviewed structured values with one Python 3.10+ file. The example uses only the standard library; it does not require `pip install`.

## Download

- [Read the source and fixture tests on GitHub](https://github.com/msanchezgrice/audioform/tree/main/examples/hosted-handoff)
- [Download `talkform_handoff.py`](https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_handoff.py)

From a terminal:

```bash
curl --fail --location --proto '=https' --tlsv1.2 \
  --output talkform_handoff.py \
  https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_handoff.py
```

Read the file before running it. Create a project and API key in the [Talkform dashboard](/dashboard), then provide that key only through `TAPK`:

```bash
export TAPK='tfk_...'
python3 talkform_handoff.py --wait-seconds 300 > result.json
```

Progress and the private respondent link are flushed to stderr, so they remain visible while stdout is redirected. A successful stdout stream contains only the formatted JSON result. The API key is never printed or written to disk.

Send the respondent link only to the intended person. The link contains a private token after `#token=`. The person answers, reviews the structured values, and explicitly submits. The script checks status and polls no more often than every 10 seconds. It stops after the configured wait instead of polling forever.

## Safe retries and cleanup

Before creating the handoff, the example creates `~/.talkform/hosted-handoff-python.json` with private `0600` permissions. It stores only an idempotency key and a fingerprint of the checked-in config. It does not store the project key or respondent link. Rerun the same command with the same state file to retry the same creation safely:

```bash
python3 talkform_handoff.py --wait-seconds 600 > result.json
```

Use a separate state path when you intend to create a different handoff:

```bash
python3 talkform_handoff.py --state ~/.talkform/customer-b.json > customer-b.json
```

By default, a timeout leaves the handoff available for the respondent. Cleanup is deliberately explicit:

```bash
python3 talkform_handoff.py --cleanup
```

`--cleanup` permanently deletes the hosted config and any submitted values whenever the command exits, including on timeout. Use it for disposable tests after you have copied any result you need.

## Bounded failures

The example treats these responses explicitly:

- `401 Unauthorized`: `TAPK` is missing, invalid, or revoked. Replace it with a project key from the dashboard.
- `409 Conflict`: the result is still pending. The example waits at least 10 seconds before another attempt and stops at its deadline.
- `410 Gone`: the invite or completed result expired. Create a new handoff with a new state path.
- `429 Too Many Requests`: the example honors `Retry-After` when it fits within the remaining wait; otherwise it exits and reports the delay.

Each HTTP request has a timeout capped by the overall polling deadline. Redirects are refused so the Authorization header cannot be forwarded to another origin. The production destination is fixed to `https://www.talkform.ai`; localhost overrides exist only for the checked-in fixture tests.
