# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- The **vault is the project memory**. Write project state, decisions, bugs and handoffs to `vault/` (per `vault/AGENT PROTOCOL.md`), not only to Claude's own memory, so other agents can continue.
- Start every session by reading `vault/STATUS.md`. End every session by writing a session note (`vault/_templates/Session Template.md`) and updating STATUS.
- Plan before coding. When a decision is genuinely the owner's (scope, accounts, naming, trade-offs with evaluation impact), ask. Otherwise decide, record an ADR or assumption, and continue.
