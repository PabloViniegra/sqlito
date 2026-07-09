# ADR-0003: REPL layout with an analytic height budget

- **Status:** accepted
- **Date:** 2026-07-09

## Context

Large SELECTs rendered one `<Text>` per row with no height cap; when the
Ink frame exceeded the terminal rows, physical scroll destroyed the
layout. The newest-on-top render order (PR #56) was a workaround for
that overflow, and it placed results — including write feedback — at the
top of the screen while the user watches the prompt at the bottom.

## Decision

REPL layout: the newest result renders at the bottom, directly above the
prompt; older visible entries collapse to one-line summaries above it.
Frame height is guaranteed by an analytic line budget
(`rows − header − prompt − status − palette`, computed in `App.tsx` and
split by `resultsLayout.ts`), not by measuring rendered output: every
card body is already produced as plain string lines, so counts are exact
before render. `ResultsTable` clamps its own body to the `maxLines` it
receives (`… +N more rows (M total)`).

## Consequences

- The frame can never exceed the terminal; `App.frameHeight.test.tsx`
  asserts this invariant end-to-end.
- PgUp/PgDn shifts the viewport window; the bottom-most visible entry is
  always the expanded one, so scrolling doubles as re-inspecting an old
  result full-size with no extra state.
- Any new bottom-area component must be added to the budget arithmetic
  in `App.tsx`, or it will silently shrink the results area (safe) —
  forgetting it in the other direction (adding height without counting
  it) is caught by the frame-height test.
