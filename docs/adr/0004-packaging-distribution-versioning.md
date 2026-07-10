# ADR-0004: Packaging, distribution, and versioning strategy

- **Status:** accepted
- **Date:** 2026-07-09

## Context

SQLito needs to be installable on Linux, macOS, and Windows so that
`sqlito --help` / `sqlito <database.db>` works after install.
`package.json` currently has no `bin` field, no `engines` field,
`"version": "0.0.0"`, `"private": true`, no CI/CD, and no versioning
tool — despite the app itself already having shipped past its own
PRD.md roadmap's v1.0 milestone (feat/v1.0/slice-1..5, merged).

The dependency that shapes every option here is `better-sqlite3`: it
is a raw V8 addon, not a Node-API (N-API) addon (confirmed by reading
its `binding.gyp` and `src/better_sqlite3.cpp`), so its prebuilt
binaries are **Node-ABI-locked**, not platform-locked. Its published
release assets (v12.11.1/v12.11.2) cover darwin-arm64/x64,
linux-arm/arm64/x64, linuxmusl-arm/arm64/x64, and win32-arm64/x64 —
full platform/arch/libc coverage — but only for `NODE_MODULE_VERSION`
127/137/141/147 (Node 22/24/25/26). There is no prebuild for Node 20.x
or 23.x on any platform; those fall back to `node-gyp rebuild`, which
needs a C/C++ toolchain. Node 20 is already past its EOL (2026-04-30).

Single-executable (no-Node-required) distribution was also evaluated:
Node.js SEA (Stability 1.1, native addons need fully manual `dlopen`
wiring, and macOS x64/Alpine are explicitly excluded from Node's own
tested/supported platform list today), `pkg` (vercel/pkg is archived;
`yao-pkg/pkg` is the maintained fork and does support native addons on
every needed target except musl), `nexe` (no stable release since
2020), and Bun's `bun build --compile` (empirically tested against
this exact repo: fails on ink's optional `react-devtools-core`
resolution, and fails outright on `better-sqlite3` — a non-N-API
addon Bun's compatibility layer doesn't cover, tracked upstream at
`oven-sh/bun#4290`).

Full sourced detail: `docs/research/packaging-and-versioning.md`.

Separately, `npm view sqlito` confirms the unscoped name is already
published by an unrelated maintainer (a ~220-byte placeholder-looking
package, v1.0.0, over a year old) — publishing as bare `sqlito` is not
available.

## Decision

- **Distribute via the npm registry only**, under the scoped package
  name **`@pablo-v/sqlito`** (the bare name is taken — see
  above). The `bin` field name stays `sqlito` regardless of the
  package's scope — package name and command name are independent, so
  `npm i -g @pablo-v/sqlito` still exposes the `sqlito` command
  unchanged. Flip `"private"` to `false` and publish. No standalone
  binaries (`yao-pkg/pkg` or otherwise) in this iteration.
- **`engines.node: ">=22"`.** Corrects the README/CONTRIBUTING's
  current "Node 20 or later" claim, which was already false
  independent of this decision.
- **No Homebrew/Scoop/winget** in this iteration.
- **Adopt semantic-release** for versioning: the existing Conventional
  Commits (`feat`/`fix`/`refactor(scope):`, already 100% of this
  repo's history) drive version bump, changelog, npm publish, and a
  GitHub Release automatically on every push to `main`.
- **First published version: `1.0.0`** — semantic-release's own
  hardcoded first-release default when no tags exist (confirmed via
  its FAQ: not configurable to a `0.x` start). Matches PRD.md's
  roadmap, which already reached v1.0.

## Rationale

- `better-sqlite3`'s `prebuild-install` mechanism already solves
  cross-platform native-binary resolution for every Node ABI it
  covers, and npm's own `bin` mechanism already solves "the command is
  on PATH after install" on all three OSes (POSIX symlinks; `.cmd`/
  `.ps1` shims on Windows). Together they satisfy the literal
  requirement with zero new CI/build-matrix engineering.
- Every standalone-binary option carries cost or gaps disproportionate
  to what was asked: SEA is experimental and excludes Intel Mac;
  yao-pkg needs a per-target native-addon build matrix maintained
  indefinitely; Bun is outright broken for this repo today. None
  justified for a first release — revisit only if real demand for a
  no-Node install path shows up.
- semantic-release fits this repo's existing discipline with no new
  authoring habit, unlike Changesets (a separate changeset-file step
  decoupled from the commit message the author already writes). Its
  lack of an official GitHub Action is a one-line CI cost
  (`npx semantic-release`), smaller than release-please's structural
  mismatch — a second release-PR review step for a maintainer who
  already gates every change at PR-merge time.

## Consequences

- Users on Node 20/23, or without a C/C++ toolchain on those
  versions, get a failed or degraded install. This is a documented
  requirement, not silently handled.
- No no-Node-required install path exists yet. Cheap, already-scoped
  fallback if needed later: `yao-pkg/pkg` (see
  `docs/research/packaging-and-versioning.md` for its exact
  constraints).
- Every `main` push containing a `feat`/`fix` commit auto-publishes to
  npm and cuts a GitHub Release — there is no manual "cut a release"
  step anymore. If that cadence proves too aggressive, this ADR is the
  place to revisit (e.g. a release branch with manual promotion).
- Discovery relies on the npm registry, README, and GitHub — no
  Homebrew/Scoop/winget listing yet. Accepted for this iteration.
