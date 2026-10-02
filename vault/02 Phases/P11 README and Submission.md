---
type: phase
id: P11
status: not-started
estimate: 2h
target: CP6 Sun 4 Oct 22:30 IST (hard deadline 23:59)
---

# P11: README and submission

**Goal:** the README answers everything the brief asks; the repo is clean; the form is submitted with margin; the live link stays up for two weeks.

Specs: brief §6, §8 · [[README Outline]] · [[Prioritisation Notes]] · [[Submission Checklist]]

## Tasks

- [ ] **T-1101** Write `README.md` from [[README Outline]]: local setup, architecture overview + data model diagram (Mermaid ERD from `docs/DATABASE_MODELS.md`), key decisions and trade-offs (ADR summary), **dashboard definitions** (PRD §8), **prioritisation** (built / skipped / why / next), ambiguities (PRD §10), time zone statement, billing policy, test accounts, live links.
- [ ] **T-1102** Quality gate: `pnpm lint typecheck test build` clean; CI green; review the commit history (meaningful messages, no secrets, no generated files); tag `v1.0.0`.
- [ ] **T-1103** Submit the **Google Form** (live link + public repo) **before 23:59 IST Sun 4 Oct**. Record the time submitted in [[STATUS]].
- [ ] **T-1104** Post-submission: keep the UptimeRobot monitor on; check Neon/Render usage on days 3 and 7; no risky pushes for 2 weeks.

## Exit criteria

- [ ] Form submitted; links verified in a private window
- [ ] README renders correctly on GitHub (Mermaid diagrams included)

## Log

## Outcome
