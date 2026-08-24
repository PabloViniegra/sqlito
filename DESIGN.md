---
version: alpha
name: SQLito
description: Keyboard-first SQLite client for the terminal. SQL is the protagonist; the UI is a header, a results table, and a prompt.
colors:
  accent: "#00AAAA"
  primary: "#55FFFF"
  muted: "#555555"
  highlight: "#00AAAA"
  error: "#AA0000"
  success: "#00AA00"
  writes: "#AA5500"
  dim: "#AAAAAA"
  border: "#AAAAAA"
typography:
  mono:
    fontFamily: Google Sans Code
---

# SQLito

## Overview

SQLito is a keyboard-first SQLite client for the terminal, inspired by
Claude Code. SQL is the user interface; the surrounding chrome — a header,
a results area, and a prompt — exists only to keep the user in flow. The
design is terminal-native: every color is an ANSI palette role, every
shape a box-drawing glyph, and all typography is monospace.

## Colors

Tokens are ANSI palette roles, not fixed hues: the hex values in the
frontmatter are the standard VGA reference mapping, and the user's
terminal color scheme controls the actual rendering. The default theme
pairs cyan roles (`accent`, `primary`, `highlight`) with semantic status
roles (`error`, `success`, `writes`).

- `accent` — brand moments only: the header mascot and the prompt prefix.
- `primary` — interactive emphasis: the cursor block, SQL keywords in
  result headers, and the selected item in the autocomplete popup and
  command palette.
- `muted` — secondary metadata: row counts, separators, footer hints, and
  the overflow indicator.
- `dim` — tertiary context: the database path and echoed SQL labels.
- `border` — the full-width `─` rules that frame result cards.
- `error`, `success`, `writes` — semantic status: failures, successful
  reads and DDL, and write operations.

## Themes

The installed DESIGN.md specification cannot represent theme modes, so
the frontmatter holds the default theme and the `high-contrast`
alternative is recorded here. Switch with `.theme <name>`; the choice
persists to `~/.config/sqlito/config.json`. Token names are identical in
both themes — only the ANSI roles behind them change.

| Token     | Default (ANSI) | High-contrast (ANSI) |
| --------- | -------------- | -------------------- |
| accent    | cyan           | yellow               |
| primary   | cyanBright     | yellowBright         |
| muted     | gray           | gray                 |
| highlight | cyan           | yellow               |
| error     | red            | redBright            |
| success   | green          | greenBright          |
| writes    | yellow         | yellow               |
| dim       | white          | white                |
| border    | white          | white                |

## Typography

Everything renders in a single monospace face (Google Sans Code) at the
terminal's own size and leading; hierarchy comes from weight and color,
never from size. Bold marks emphasis: the prompt prefix, the project name
in the header, and selected items in popups. Italic marks transient
hints, such as the "no write" notice on write cards.

## Layout

Fixed vertical stack, top to bottom: header → results → prompt. The
newest result renders directly above the prompt; older visible entries
collapse to one-line summaries above it (ADR-0003). Frame height follows
an analytic line budget (`rows − header − prompt − status − palette`)
computed before render, never from measured output. Result cards clamp
their own body to the budgeted `maxLines` and report truncation as
`… +N more rows (M total)`. PgUp/PgDn shifts the results viewport; the
bottom-most visible entry is always the expanded one, and a muted
`↑ N more · PgUp` indicator signals hidden history.

## Shapes

The visual vocabulary is a small set of box-drawing glyphs:

- `▎` — leading marker on result-card headers and footers.
- `▌` — the cursor block in the prompt and the selection bar in popups.
- `─` — full-width rules framing result cards and popups.
- `●` — the connection status dot in the status bar.

## Components

Every query result carries a colored outcome tag: READ and DDL use
`success`, WRITE uses `writes`, ERROR uses `error`, and PLAN uses
`primary`; the same mapping drives the status bar chip. A full result
card is: header line (`▎` marker, tag, SQL keyword, muted metadata, dim
SQL label), top rule, body, optional footer, bottom rule. When the height
budget is tight, the card collapses to its header line alone.

## Do's and Don'ts

- Do add any new bottom-area component to the frame-height arithmetic in
  `App.tsx`; uncounted height silently shrinks the results area
  (ADR-0003).
- Don't add chrome beyond the header, results, and prompt trio — that
  trio is the entire UI.
