---
name: talkform
description: Build and validate Talkform interview configs, discover bundled templates, and use the local Talkform MCP server.
---

# Talkform

Use Talkform when a user wants to turn a structured form into a guided browser voice or text interview.

## Safe workflow

1. Start from a bundled template or create `talkform.config.json`.
2. Run `talkform validate talkform.config.json` before presenting or embedding it.
3. Send the participant to the Talkform browser experience and let them review structured answers before export.
4. Treat the current MCP package as local schema, template, and validation tooling only.

## Commands

- `talkform templates`
- `talkform init`
- `talkform validate talkform.config.json`
- `npx -y @talkform/mcp`

## Boundaries

- Do not claim the local MCP server creates hosted interviews or retrieves browser results.
- Do not put answers, transcripts, secrets, or personal data in analytics or logs.
- Do not infer protected traits, emotion, honesty, or suitability from a person’s voice.
- Require explicit confirmation before ending a live session or discarding captured answers.
