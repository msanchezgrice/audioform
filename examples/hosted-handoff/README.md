# Hosted handoff Python example

This no-dependency Python 3.10+ example can register a machine workspace, create one hosted Talkform handoff, print the private respondent link immediately to stderr, poll at a bounded interval, and write only a completed structured result to stdout.

Register an agent workspace without a human account:

```bash
python3 talkform_handoff.py --register --agent-name research-agent > registration.json
```

The response includes a one-time `secret`. Save it in a trusted secret store, then set it as `TAPK`:

```bash
export TAPK='tfk_...'
python3 talkform_handoff.py --wait-seconds 300 > result.json
```

The default API origin is exactly `https://www.talkform.ai`. The hidden localhost flags exist only for the fixture tests; the script refuses arbitrary API origins so a copied command cannot send `TAPK` elsewhere. A machine workspace starts with 10 text handoffs per day and is not voice eligible. An optional signed-in human claim can make the workspace eligible for the human-owned project limits and optional voice.

You can also create a project key in the [Talkform dashboard](https://www.talkform.ai/dashboard) and run the handoff flow directly. The respondent reviews and explicitly submits the fields before the result becomes available.

The private state file defaults to `~/.talkform/hosted-handoff-python.json`, is created with mode `0600`, and contains an idempotency key plus a fingerprint of the example config. It never contains `TAPK` or the respondent token. Reusing the state file safely retries the same create request. Choose a different `--state` path when you intend to create a different handoff.

The respondent URL contains a private token. Share it only with the intended respondent. A timeout leaves the hosted handoff available so the command can be rerun with the same state. Passing `--cleanup` instead permanently deletes the hosted handoff whenever the command exits, including after a timeout.

For push delivery, use [`talkform_webhook_receiver.py`](./talkform_webhook_receiver.py). It verifies signed completion events, fetches the matching reviewed JSON without following redirects, and stores the event and result in a bounded `0600` SQLite inbox before acknowledging delivery. Read the `events.result_json` rows from that inbox and enqueue your own idempotent worker; the example is not a replacement for a production queue.

Run the loopback fixture tests with:

```bash
python3 -m unittest discover -s . -p 'test_*.py' -v
```

- [Browse the example on GitHub](https://github.com/msanchezgrice/audioform/tree/main/examples/hosted-handoff)
- [Download the raw Python file](https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_handoff.py)
- [Download the webhook receiver](https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_webhook_receiver.py)
