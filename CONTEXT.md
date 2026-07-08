# CONTEXT

Glossary for SQLito's domain vocabulary. Implementation lives in code; this
file captures the language used around that code so docs, PRDs, and tests
speak the same terms.

## Outcomes

- **Query outcome** — discriminated union returned by `ExecuteQuery.execute`
  for any SQL statement (or by `RunExplain` for `EXPLAIN QUERY PLAN`).
  Variants: `rows`, `affected`, `side-effect`, `plan`, `error`.
  Lives in `src/domain/sql/QueryOutcome.ts`.

- **Outcome tag** — short text label (`READ`, `WRITE`, `DDL`, `ERROR`,
  `PLAN`) that classifies an outcome's *intent*. Pairs with the existing
  SQL keyword header; tag is theme-independent so it stays legible in
  black-and-white logs, grep, and screenshots.
  Lives in `src/domain/sql/outcomeTag.ts` (new).

- **Tag-vs-keyword** — the keyword is the first SQL word (`SELECT`,
  `UPDATE`, `VACUUM`); the tag names the *kind of change* in a single
  syllable (`READ` / `WRITE` / `DDL`). They are NOT the same axis:
  keyword answers "what was typed", tag answers "what did it do".

- **Rows outcome** — outcome kind that carries tabular data.
  `kind: "rows"`, has `columns` and `rows`. Always tagged `READ`
  (assuming read-only SQL; see `isReadOnly`).

- **Affected outcome** — outcome kind for data writes.
  `kind: "affected"`, has `changes` and `lastInsertRowid`. Always tagged
  `WRITE`.

- **Side-effect outcome** — outcome kind for DDL / admin.
  `kind: "side-effect"`, no payload. Tagged `DDL`.

- **Plan outcome** — outcome kind for `EXPLAIN QUERY PLAN`.
  `kind: "plan"`, has `nodes`. Tagged `PLAN` (not `READ`).

- **Error outcome** — outcome kind for a failed statement.
  `kind: "error"`, may carry `code` (SQLite error class) and `message`.
  Always tagged `ERROR`.

## Writes

- **Changes** — number of rows a write touched, from
  `better-sqlite3`'s `stmt.run()` result. For `INSERT`, that's the rows
  inserted; for `UPDATE`, rows updated; for `DELETE`, rows deleted.

- **Last insert rowid** — the `rowid` SQLite assigned to the most
  recently inserted row, returned by `stmt.run()`.
  `number | bigint`; rendered as decimal when `> 0`, omitted when `0`.

- **No-op write** — an `affected` outcome with `changes === 0`.
  The SQL ran without error, but matched nothing. Not an error;
  communicated via an explicit footer so the user is not left guessing.

- **Destructive write** — a write with high blast radius
  (`DELETE`/`UPDATE` without `WHERE`, `DROP TABLE`, `TRUNCATE`-like
  patterns). Currently *not* gated by a confirmation prompt;
  visual feedback (tag + footer) is the safety net. See ADR-0002.

## Errors

- **SQLite error code** — machine-readable class on
  `better-sqlite3`'s `SqliteError` (e.g., `SQLITE_CONSTRAINT`,
  `SQLITE_ERROR`). Surfaced as part of the error rendering so the
  user can tell `near "x": syntax error` (`SQLITE_ERROR`) apart from
  `UNIQUE constraint failed: t.id` (`SQLITE_CONSTRAINT`).

- **Recall-and-retry** — error-rendering affordance: pressing `↑`
  while the prompt is empty and the most recent outcome was an error
  rehydrates the failed SQL into the prompt with the cursor at the
  end.

## State

- **Last outcome** — most recent `QueryOutcome` regardless of kind,
  stored in `AppState.lastOutcome`. Drives the StatusBar's
  at-a-glance "what just happened" line. Replaces the
  rows-only `lastRowsOutcome`.
