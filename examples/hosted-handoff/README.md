# Hosted handoff Python example

This no-dependency Python 3.10+ example creates one hosted Talkform handoff, prints the private respondent link immediately to stderr, polls at a bounded interval, and writes only a completed structured result to stdout.

Create a project key at [talkform.ai/dashboard](https://www.talkform.ai/dashboard), then run:

```bash
export TAPK='tfk_...'
python3 talkform_handoff.py --wait-seconds 300 > result.json
```

The default API origin is exactly `https://www.talkform.ai`. The hidden localhost flags exist only for the fixture tests; the script refuses arbitrary API origins so a copied command cannot send `TAPK` elsewhere.

The private state file defaults to `~/.talkform/hosted-handoff-python.json`, is created with mode `0600`, and contains an idempotency key plus a fingerprint of the example config. It never contains `TAPK` or the respondent token. Reusing the state file safely retries the same create request. Choose a different `--state` path when you intend to create a different handoff.

The respondent URL contains a private token. Share it only with the intended respondent. A timeout leaves the hosted handoff available so the command can be rerun with the same state. Passing `--cleanup` instead permanently deletes the hosted handoff whenever the command exits, including after a timeout.

Run the loopback fixture tests with:

```bash
python3 -m unittest discover -s . -p 'test_*.py' -v
```

- [Browse the example on GitHub](https://github.com/msanchezgrice/audioform/tree/main/examples/hosted-handoff)
- [Download the raw Python file](https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_handoff.py)
