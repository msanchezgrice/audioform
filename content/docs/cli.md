# CLI

Talkform ships with a small CLI for agent-friendly workflows.

## Commands

### `audioform templates`

List bundled templates.

### `audioform init`

Write a starter `talkform.config.json` into the current directory.

### `audioform validate <config>`

Validate a JSON config file.

### `audioform dev`

Run the local hosted app via the workspace web package.

### `audioform export --session <id> --format json|markdown`

Fetch an exported session result from the running Talkform app.

## Base URL

The CLI uses `AUDIOFORM_BASE_URL` if set, otherwise `http://localhost:3000`.

## Machine authentication

Set `AUDIOFORM_API_TOKEN` in the trusted CLI environment. The CLI sends it as a bearer credential on API requests. Its value must match the server-only `TALKFORM_API_TOKEN` configured on the Talkform web service.

Do not put either token in browser code. Hosted production session endpoints remain disabled until the operator configures durable storage, distributed rate limiting, server authentication, and the explicit server opt-in.
