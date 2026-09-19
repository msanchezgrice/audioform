# CLAUDE.md

See `AGENTS.md` for Talkform product context, routes, and guardrails.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Testing

Run `pnpm test` from the repo root. It builds `@talkform/core` and `@talkform/mcp`, then runs the workspace `tsx --test` suite listed in `package.json`. Also use `pnpm typecheck` before shipping.

When writing new functions, add a corresponding test. When fixing a bug, add a regression test. Never commit code that makes existing tests fail.
