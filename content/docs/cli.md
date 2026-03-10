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

