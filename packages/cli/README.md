# @talkform/cli

Talkform config tools plus a safe installer for the Talkform skill and local MCP server.

```bash
npx --yes @talkform/cli@latest install --all
npx --yes @talkform/cli@latest templates
npx --yes @talkform/cli@latest init
npx --yes @talkform/cli@latest validate talkform.config.json
```

The installer configures Claude, Codex, and Cursor to run an exact version of `@talkform/mcp`. It preserves unrelated MCP configuration and refuses to replace malformed or unmanaged files unless the user resolves the conflict.
