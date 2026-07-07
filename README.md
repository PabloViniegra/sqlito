<div align="center">
  <img src="docs/assets/logo.svg" alt="SQLito logo" width="120" />
  <h1>SQLito</h1>
  <p><strong>A keyboard-first SQLite client for the terminal.</strong></p>
  <p>Single responsibility: work with SQLite. The SQL is the protagonist; the UI is a header, a results table and a prompt.</p>
  <p>
    <a href="https://github.com/PabloViniegra/sqlito/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
    <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" /></a>
    <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" /></a>
    <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" /></a>
    <a href="https://prettier.io/"><img src="https://img.shields.io/badge/Prettier-F7BA3E?style=for-the-badge&logo=prettier&logoColor=black" alt="Prettier" /></a>
  </p>
</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
  - [Keyboard shortcuts](#keyboard-shortcuts)
  - [Dot-commands](#dot-commands)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Development](#development)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Graphify — AI knowledge graph](#graphify--ai-knowledge-graph)

## Overview

SQLito is a terminal client for SQLite, inspired by Claude Code. The goal
is an extremely fast, clean and keyboard-driven experience for browsing,
querying and editing local SQLite files. SQL is the user interface; the
surrounding chrome exists only to keep you in flow.

The entry point is intentionally narrow:

```bash
sqlito <database.db>
```

Everything else — autocompletion, history, CSV export, schema inspection —
is a layer on top of that one command.

## Features

- Open any local SQLite file from the command line.
- Execute SQL synchronously against the file via `better-sqlite3`.
- Render results in a virtualized, terminal-native table.
- Persistent per-database query history with recall (Up / Down).
- Autocompletion for table and column names.
- CSV export of the current result set.
- Dot-commands for schema introspection: `.tables`, `.schema`, `.indexes`.
- Command palette (Ctrl+P) and mode switch (`.mode`).
- Keyboard-only navigation across the whole interface.
- Takes over the terminal on launch via the alternate screen buffer; the
  previous content is restored when you exit (Ctrl+C, `.quit`, or
  normal exit).
- Cold start under 100 ms on small projects.

## Quick start

Requirements: Node.js 20 or later, pnpm 9 or later, and a C toolchain
able to build native modules (`better-sqlite3`).

```bash
git clone https://github.com/PabloViniegra/sqlito.git
cd sqlito
pnpm install
```

Create a sample database (optional):

```bash
pnpm db:seed
```

Run the TUI against any SQLite file:

```bash
pnpm dev -- ./fixtures/sample.db
```

The `dev` script uses `tsx` to execute `src/main.tsx` directly, so you get
HMR-style reloads on save without an extra bundling step.

## Usage

### Keyboard shortcuts

| Shortcut            | Action                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `Enter`             | Submit the current SQL statement.                                                                   |
| `Tab` / `Esc`       | Open / close the autocomplete popup for the current prefix.                                         |
| `↑` / `↓`           | Move the prompt cursor up/down across visual rows.                                                  |
| `↑` / `↓`           | At the first / last visual row, recall previous / next entry from history.                          |
| `←` / `→`           | Move the cursor one character.                                                                      |
| `Home` / `End`      | Move the cursor to the start / end of the prompt.                                                   |
| `Backspace`         | Delete the character before the cursor.                                                             |
| `Alt+←` / `Alt+→`   | Skip to the previous / next word boundary.                                                          |
| `Ctrl+U`            | Kill from the cursor to the start of the prompt.                                                    |
| `Ctrl+K`            | Kill from the cursor to the end of the prompt.                                                      |
| `Ctrl+W`            | Kill the word before the cursor.                                                                    |
| `Ctrl+A` / `Ctrl+E` | Move the cursor to the start / end (readline aliases).                                              |
| `Ctrl+L`            | Clear the screen and re-anchor the prompt.                                                          |
| `Ctrl+P`            | Open the command palette.                                                                           |
| `Ctrl+R`            | Open reverse-i-search over the history.                                                             |
| `Ctrl+C`            | Cancel the current input or exit.                                                                   |
| Bracketed paste     | Multi-line paste (`ESC[200~ … ESC[201~`) inserts newlines into the prompt without triggering Enter. |

### Dot-commands

| Command        | Description                                |
| -------------- | ------------------------------------------ |
| `.tables`      | List every table in the database.          |
| `.schema`      | Print the schema of every table.           |
| `.schema <t>`  | Print the schema of table `<t>`.           |
| `.indexes`     | List every index in the database.          |
| `.mode <mode>` | Switch the output mode (table, csv, etc.). |
| `.help`        | Show the help overlay.                     |
| `.quit`        | Exit SQLito.                               |

## Architecture

SQLito is built as **Screaming Architecture on top of Clean
Architecture**. The top-level folders name the domain, not the framework,
and the dependency rule is enforced by convention:

```
Presentation  →  Application  →  Domain  ←  Infrastructure
```

- **Domain** has no outward dependencies. It contains the entities
  (`Database`, `Query`, `QueryResult`, `Table`, `Column`, `Index`) and
  pure behaviour.
- **Application** holds use cases: `ExecuteQuery`, `ExportCsv`,
  `ListTables`, `DescribeTable`, `LoadHistory`, `SaveHistory`,
  `GetAutocompleteSuggestions`.
- **Infrastructure** adapts the outside world to the domain:
  `BetterSqliteDatabase`, `SqliteSchemaRepository`, `HistoryRepository`,
  `KeyboardAdapter`.
- **Presentation** is the Ink / React TUI: `App`, `Header`, `Prompt`,
  `ResultsTable`, `CommandPalette`, `StatusBar`, `HelpOverlay`.

Components follow the container-presentational pattern and must not
exceed 250 lines of code. Strict TypeScript is enforced: `verbatimModuleSyntax`,
`erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`.

## Project layout

```
src/
├── application/
│   ├── commands/         # ExecuteQuery, ExportCsv, ListTables, ListIndexes
│   ├── queries/          # DescribeTable, LoadHistory
│   ├── autocomplete/     # GetAutocompleteSuggestions
│   └── history/          # SaveHistory
├── domain/
│   ├── database/         # Database
│   ├── schema/           # Table, Column, Index
│   └── sql/              # Query, QueryResult
├── infrastructure/
│   ├── sqlite/           # BetterSqliteDatabase, SqliteSchemaRepository
│   ├── filesystem/       # HistoryRepository
│   └── terminal/         # KeyboardAdapter
├── presentation/
│   ├── app/              # App
│   ├── screens/          # Header, StatusBar, HelpOverlay
│   ├── components/       # Prompt, ResultsTable, CommandPalette, AutocompletePopup
│   └── hooks/
├── shared/               # constants, types, utils
├── cli.tsx               # Commander entry point
└── main.tsx              # process argv bootstrap
```

## Development

Common scripts, run from the project root:

| Command          | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Start the Ink entry via `tsx watch src/main.tsx`.                  |
| `pnpm build`     | Type-check the project with `tsc -b`.                              |
| `pnpm typecheck` | Same as `build`, split out for pre-commit hooks.                   |
| `pnpm lint`      | Run oxlint with the project rules.                                 |
| `pnpm test`      | Run Vitest in watch mode.                                          |
| `pnpm test:run`  | Run Vitest once (used by pre-commit).                              |
| `pnpm format`    | Format `src/**/*.{ts,tsx,json,md}` with Prettier.                  |
| `pnpm db:seed`   | Generate the sample SQLite database in `fixtures/`.                |
| `pnpm bench`     | Measure cold-start time of the CLI. Budget: 1500 ms (source-mode). |
| `pnpm gate`      | Run `lint-staged` → `tsc -b` → `vitest run` → `pnpm bench`.        |
| `pnpm doctor`    | Run `react-doctor` against the presentation layer.                 |

A Husky pre-commit hook runs `lint-staged` (oxlint + Prettier on staged
files), then `tsc -b`, then `vitest run`. The hook is installed by
`pnpm prepare` and runs on every commit.

## Testing

The test split mirrors the architecture:

- **Unit tests** target the domain. They are pure, fast and free of I/O.
- **Integration tests** exercise use cases against an in-memory
  `better-sqlite3` database.
- **UI tests** are Ink snapshots that render components in a virtual
  frame (`presentation/components/renderInkFrame.ts`).

Run them locally with:

```bash
pnpm test:run
```

## Roadmap

- **v0.1** — CLI, SQL execution, results table.
- **v0.2** — Persistent history, autocompletion, CSV export.
- **v0.3** — Variables, `EXPLAIN` view, favourites.
- **v1.0** — Command palette, plugins, themes, configuration file.
- **v1.1** — Fluidity: alternate-screen, viewport-aware prompt, readline
  reducer, multi-line wrap, kill / word-skip, history recall at edit
  boundary, screen clear, autocomplete / palette precedence, memoised
  frames, and a cold-start bench gate (`pnpm bench`).

## Contributing

Contributions are welcome and go through a single, mandatory workflow:
**fork the repository and open a pull request**. Direct pushes are not
accepted under any circumstance.

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full process, the
quality gates every PR has to clear, the branching and commit
conventions, and the coding rules derived from
[`AGENTS.md`](AGENTS.md). The fork and pull request flow described there
is the only path for changes to land.

## License

SQLito is released under the [MIT License](LICENSE). Copyright (c) 2026
Pablo Viniegra.

<!-- graphify:start -->

## Graphify — AI knowledge graph

This project uses [Graphify](https://github.com/safishamsi/graphify) to
generate a queryable knowledge graph of the source code. AI coding
assistants read the graph instead of broad file searches, which reduces
unnecessary reads and improves accuracy.

The graph is built locally in `graphify-out/` (git-ignored) and
regenerates automatically after each commit.

### Setup (once per machine)

Requires Python 3.12+.

```bash
pip install graphifyy
python -m graphify .
```

> **Windows note:** always use `python -m graphify`, never `graphify`
> directly — the executable may not be on PATH.

### Manual update

```bash
python -m graphify . --update
```

### Query the graph from your assistant

```bash
python -m graphify query "where is the projects store?"
python -m graphify path "ModuleA" "ModuleB"
python -m graphify explain "concept-name"
```

<!-- graphify:end -->
