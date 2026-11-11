# CLAUDE.md

## Design philosophy & architecture

Read `docs/mahjong-project-summary.md` before making design or architecture decisions on this project. It covers:

- The core design philosophy (automate setup/bookkeeping, never validate or block play, cheating is a permanent feature)
- Near-term vs. stretch scope
- Tech stack and data layer
- Component architecture and the vueuse `containerElement` workaround
- Key architectural decisions and the bugs that motivated them
- Known open items

When a change made in this repo adds, revises, or invalidates something that doc claims — a new architectural decision, a scope item moving from open to implemented, a stack change — update `mahjong-project-summary.md` in the same session, rather than letting it drift out of sync with the code.
