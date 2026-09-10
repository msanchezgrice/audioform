---
date: 2026-09-10
task: desktop-dashboard-design
status: complete
---

# Desktop dashboard design follow-up

## Design plan

The dashboard is a developer workbench rather than a marketing landing page. The compact header uses the existing ink and teal accent, a 250px project rail keeps project switching and creation in view, and the main column puts project activity, respondent-link creation, and API-key controls in the first desktop viewport. Labels use sentence case and name the user action or outcome. The two action cards collapse to one column at 900px and the project rail becomes a normal flow section on mobile.

## Changes

- `apps/web/src/app/dashboard/project-dashboard.tsx`: replaced the oversized marketing hero with a compact “Build a handoff” header; added an explicit project rail, readable project activity labels (`Created today`, `Awaiting response`, `Submitted`, `Expired`, `Deleted`), side-by-side handoff/key actions, friendly handoff statuses, and clearer empty/success states. Existing API calls, idempotency, secret-once behavior, confirmation attributes, test IDs, and link destinations remain intact.
- `apps/web/src/app/dashboard/workspace.module.css`: added the workbench layout, bounded type scale, visible first-viewport controls, responsive 375px rules, focus states, and explicit respondent `.invite` compatibility rules so the consent card keeps its panel, checkbox, and primary-button styling. The workspace relies on the outer `.workspaceShell` for desktop width and gutters; root owns account/operator styles.
- Shared navigation and operator access markup were intentionally left to root’s coordinated changes.

## Verification

- `node --import tsx --test apps/web/src/lib/platform/ui.contract.test.ts` — 3 passing.
- `git diff --check` — passing.
- `pnpm exec eslint apps/web/src/app/dashboard/project-dashboard.tsx` was unavailable in this checkout (`eslint` command not found); root should include the workspace lint in the final gate.
- Isolated Playwright fixture `/private/tmp/talkform-dashboard-fixture/check.mjs` passed against the real component and CSS. Screenshots: `/private/tmp/talkform-dashboard-desktop-1440x900.png` and `/private/tmp/talkform-dashboard-mobile-375x812.png`.
- Fixture evidence: desktop 1440px had `scrollWidth=1440`, project rail width 250px, key action top 439px, and handoff action top 765px. Mobile 375px had `scrollWidth=375`; the 80-character project name wrapped to 92px high, the long handoff ID stayed within 236px, consent label computed as `flex`, checkbox width `13px`, and primary button background `rgb(18, 61, 71)`. Mobile actions followed the project rail without overlap (key top 1090px; handoff top 1687px).

No build, commit, push, deployment, or auth/security change was performed.
