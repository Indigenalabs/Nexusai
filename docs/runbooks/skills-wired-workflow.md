# Skills-Wired Audit/Build Workflow

This project can run a skill-aware audit pipeline that aligns installed Codex skills with engineering checks.

## Commands

- `npm run skills:preflight`
  - Detects installed skills from `%USERPROFILE%\\.codex\\skills`
  - Reports whether required skill groups are present
- `npm run skills:preflight:strict`
  - Same as preflight, but exits non-zero if required groups are missing
- `npm run audit:agents`
  - Runs preflight + lint + build + e2e

## Required Skill Groups

1. Debugging
   - `debugging`
2. Frontend QA
   - `frontend-design` or `ui-ux-pro-max`
3. Security Review
   - `security-best-practices` or `security-threat-model`
4. Code Review
   - `requesting-code-review`

## Optional Skill Groups

1. Framework Best Practices
   - `next-best-practices` or `vercel-react-best-practices`

## Recommended Usage During Agent Audits

1. Run `npm run skills:preflight` before page/tab audits.
2. Run `npm run audit:agents` for full validation pass.
3. If regressions are found, use debugging/security/code-review skill groups for targeted fixes.

