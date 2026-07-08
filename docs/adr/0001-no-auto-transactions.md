# ADR-0001: No automatic transaction wrapping in SQLito v1.x

- **Status:** accepted
- **Date:** 2026-07-08

## Context

SQLito currently runs every SQL statement in its own implicit
transaction (SQLite default: autocommit). If a user pastes a
multi-statement script with a typo at statement 5, statements
1–4 silently commit while statement 5 errors. The user sees an
"error" outcome for the last statement but no signal that
earlier statements already landed.

The natural fix — auto-wrap each submit in `BEGIN ... COMMIT` and
surface a rollback path — was considered while redesigning the
write-query feedback loop (PRD #TBD). It is being **deferred**.

## Decision

Stay on per-statement autocommit for v1.x. Improve write-query
feedback (READ/WRITE/DDL tags, no-op footer, error code, recall
hint) so the user *sees* what ran. Defer transactional wrapping
to a later PRD.

## Rationale

Auto-wrapping requires:

1. **Robust SQL splitter** that respects `'strings'`, `"strings"`,
   `--line comments`, and `/*block comments*/` while splitting on
   `;`. Non-trivial; not in the codebase today.
2. **New dot-command surface** — at minimum `.begin` / `.commit`
   / `.rollback`, plus an explicit "atomic" mode for paste.
3. **New failure modes** — mid-transaction errors, partial
   success, manual rollback, nested transactions (forbidden),
   conflict with current `RunInfo` model that returns per
   statement.

All three expand surface without solving the user's *primary*
pain, which is "did it run?". That pain lives in the rendering
and reducer layers, not in transaction semantics.

The WRITE-tag work in this PRD addresses the primary pain
*without* the transactional change; if users still hit partial-write
scenarios in practice, ADR-0001 is reopened.

## Consequences

- Per-statement autocommit remains the default.
- The visual feedback MUST make each statement's success/failure
  unambiguous (this is what the current PRD guarantees).
- A future transactional mode MUST keep single-statement behavior
  identical (no observable change for `SELECT 1`).
- A future `outcomeToHistory` revision MUST distinguish `error`
  from `ok` — current code collapses the two and that bug is fixed
  in the parent PRD.
