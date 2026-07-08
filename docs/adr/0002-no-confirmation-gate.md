# ADR-0002: No confirmation gate for destructive writes

- **Status:** accepted
- **Date:** 2026-07-08

## Context

"Destructive writes" (`DELETE FROM x` without `WHERE`, `DROP TABLE`,
`UPDATE x SET ...` without `WHERE`) are the canonical foot-gun for
SQL clients. SQLito is keyboard-first and advertises
"no unnecessary dependencies / decoupled from the mouse". The
question: should we pause and ask "are you sure?" before these?

## Decision

No modal confirmation gate in v1.x. The visual improvements in the
write-feedback PRD — `WRITE` tag, rowid in footer, `0 rows matched`
when nothing changed — are the safety net. If a destructive write
happens by mistake, the user sees it before pressing the next key.

## Rationale

- A confirmation gate breaks the keyboard flow on every large DELETE
  even when the user is intentionally doing a bulk delete.
- "Dangerous" detection is heuristic (`DELETE` without `WHERE` is
  trivially spotted; `DELETE FROM x WHERE id IN (subquery)` is
  equally destructive but pattern-detectable only with parsing).
- The same outcome (preventing regret) is achieved with the
  write-tag + visible changes count, without modal interruption.

## Consequences

- A user CAN accidentally run a destructive write. We accept this
  trade-off; v1.x users are assumed to be SQL-literate
  (the entry point is `sqlito <database.db>`, not a tool for
  first-time SQL users).
- If real users report destructive-write regret, this ADR is
  reopened. Cheap fallback: a `.unsafe on | off` toggle that
  adds a confirmation prompt when ON. Cheap because the
  detection lives in the same `classifySideEffect` pathway.
