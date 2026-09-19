# Changelog

## [0.1.2.0] - 2026-09-19

### Changed
- Agent and machine workspaces can mint voice interviews. Voice stays under shared realtime caps.
- Omitted `config.mode` is voice. Set `mode: "text"` only for a written interview.
- Typed replies are interpreted as unstructured language. Common yes/no phrasing binds locally; hosted interviews can ask a model when the local map misses.

### Removed
- The claim-for-voice gate on machine workspaces.

## [0.1.1.0] - 2026-09-19

### Added
- Agent-created interviews can pass product name, purpose, logo, favicon, font, and hex theme so the shared page belongs to the inviting product.
- Create-handoff responses now include `shareText`, `mode`, `voiceEligible`, and `claimUrl` when voice is not available yet.

### Changed
- Hosted `/respond` pages hide Talkform marketing chrome and the Twelve Tools badge.
- Machine workspaces stay honestly text-only. Omitted `mode` no longer upgrades to voice after a later claim.
- Field questions prefer `promptTitle` over a label copied into `visualTitle`.
- The hosted review rail is a calm Review step, not an export/debug pane.

### Fixed
- Theme colors that were stored but unused now apply as CSS variables.
- Voice is not teased on workspaces that cannot run it.
