# Changelog

## v0.1.1 — 2026-09-06

- **Manager:** rejection recovery now distinguishes behavioral vs. documentary
  defects — documentary issues (wrong prose, comments, coverage descriptions)
  correct forward instead of reverting verified-correct code.
- **Planner:** plans now describe what a test does and asserts, not what it
  would catch — coverage claims belong to Reviewer, who runs the suite.

## v0.1 — 2026-09-04

- Initial release.
