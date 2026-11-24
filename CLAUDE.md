# CLAUDE.md

## Design philosophy & architecture

Read `docs/mahjong-project-summary.md` before making design or architecture decisions on this project. It covers:

- The core design philosophy (automate setup/bookkeeping, never validate or block play, cheating is a permanent feature)
- Near-term vs. stretch scope
- Tech stack and data layer
- Component architecture and the vueuse `containerElement` workaround
- Key architectural decisions and the bugs that motivated them
- Known open items

Keep `mahjong-project-summary.md` in sync with the code, but only at merge time. While a feature branch is in progress, the doc is allowed to lag behind the code: don't update it, offer to update it, or remind the user about it mid-branch. Update it when the user is getting a branch ready to merge to main (marking its PR ready for review, or asking to merge). At that point, read the branch's diff and spec and update the doc with anything the branch adds, revises or invalidates: a new architectural decision, a scope item moving from open to implemented, a stack change.
