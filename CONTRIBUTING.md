# Contributing to SQLito

Thank you for your interest in SQLito. This document explains the only
accepted workflow for contributing, the quality gates every change has to
clear, and the conventions you must follow.

By participating in this project you agree to the [MIT License](LICENSE).

## Table of contents

- [Workflow](#workflow)
- [Local setup](#local-setup)
- [Branching and commits](#branching-and-commits)
- [Quality gates](#quality-gates)
- [Pull request rules](#pull-request-rules)
- [Coding conventions](#coding-conventions)
- [Reporting issues](#reporting-issues)

## Workflow

Contributions are accepted **exclusively through the fork and pull request
flow**. Direct pushes to the upstream repository are not permitted under any
circumstance, including for maintainers working from a local clone. The one
exception is the automated release commit created by CI (`semantic-release`),
which updates `package.json`'s version and `CHANGELOG.md` and pushes directly
to `main` as part of the release pipeline.

The end-to-end process is:

1. **Fork** the repository to your own GitHub account from
   `github.com/PabloViniegra/sqlito`.
2. **Clone** your fork locally:
   ```bash
   git clone git@github.com:<your-username>/sqlito.git
   cd sqlito
   ```
3. **Add the upstream remote** so you can stay in sync:
   ```bash
   git remote add upstream git@github.com:PabloViniegra/sqlito.git
   git fetch upstream
   ```
4. **Create a topic branch** from `main` (see [Branching and commits](#branching-and-commits)).
5. **Make your changes** locally, following the
   [Coding conventions](#coding-conventions) and the project rules in
   [`AGENTS.md`](AGENTS.md).
6. **Run the local quality gates** (see [Quality gates](#quality-gates)). All
   of them must pass before you open the pull request.
7. **Push** your branch to your fork:
   ```bash
   git push origin <branch-name>
   ```
8. **Open a pull request** against `PabloViniegra/sqlito:main` from your
   fork's branch. The pull request is **mandatory**; it is the only entry
   point for changes and the unit at which review happens.

If you already cloned the upstream repository by mistake, the supported
remedy is to push that branch into your fork (`git push origin <branch>`)
and open the pull request from there.

## Local setup

Requirements:

- Node.js 22 or later
- pnpm 9 or later
- A C toolchain capable of building native modules (for `better-sqlite3`)

Install dependencies and the pre-commit hooks:

```bash
pnpm install
pnpm prepare
```

The `prepare` script wires Husky and `lint-staged`, so every commit will
run oxlint, Prettier, the TypeScript build and Vitest on staged files.

## Branching and commits

- Branch off `main`. Use a short, kebab-cased name that describes the
  work, for example `fix/prompt-clear-after-execute` or
  `feat/command-palette`.
- Keep branches focused on a single concern. Tracer-bullet slices are
  preferred over large, multi-day branches.
- Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/)
  specification. Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`,
  `docs`, `build`, `ci`, `chore`, `style`.
- Commit bodies, when present, explain **why**, not **what**.
- Do not add `Co-Authored-By` lines or any other AI attribution footer.

## Quality gates

Before pushing, run all of these and confirm they succeed:

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm format
```

`pnpm format` only formats files in `src/`, so it is safe to run at any
time. The other three are blocking.

The Husky pre-commit hook will run the same checks on staged files
automatically. If the hook rejects your commit, fix the issues and create
a new commit; do not bypass it and do not amend a rejected commit.

## Pull request rules

A pull request is the contract for review. It must:

- **Target `main`** of `PabloViniegra/sqlito`. PRs to other branches will be
  redirected or closed.
- **Reference an issue** in the description using `Closes #<id>`,
  `Fixes #<id>` or `Refs #<id>`. PRs without an associated issue will be
  asked to open one first unless the change is documentation-only.
- **Describe the change** with: the problem, the approach, the
  alternatives considered (when relevant), and the verification steps
  you ran.
- **Stay in scope.** Unrelated refactors, formatting sweeps or drive-by
  cleanup belong in a separate PR.
- **Pass the quality gates** listed above. The CI will run them again;
  a red CI blocks merge.
- **Keep a clean history.** Squash or rebase local fixup commits so the
  PR lands as a coherent sequence of logical commits.
- **Be reviewable.** Large PRs will be asked to be split following the
  chained-PR convention.

Reviewer requests are binding until explicitly resolved. A pull request
that has not received approval cannot be merged, including by the author.

## Coding conventions

The full rules live in [`AGENTS.md`](AGENTS.md). The most important ones
to internalize before you write code:

- **Architecture.** Screaming Architecture on top of Clean Architecture.
  New behaviour lands in `application/`, `domain/` or `infrastructure/`
  before it touches `presentation/`. The dependency rule is
  Presentation → Application → Domain ← Infrastructure.
- **Strict TypeScript.** `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`. No `any` unless the
  surrounding contract forces it, and even then with a justification.
- **Components.** Container-presentational pattern. A component file must
  not exceed 250 lines of code.
- **No comments unless the WHY is non-obvious.** Self-documenting code
  over commented code. Bad code is refactored, not annotated.
- **Oxidation over ESLint.** Lint with oxlint. The `react/rules-of-hooks`
  rule is an error.
- **Naming.** Top-level folders name the domain, not the framework.

## Reporting issues

Bugs and feature requests are tracked through GitHub Issues on
`PabloViniegra/sqlito`. Before opening a new issue:

1. Search existing issues to avoid duplicates.
2. Pick the right template (bug report or feature request).
3. Fill in the reproduction steps, expected and actual behaviour, and
   the environment (OS, Node version, SQLite file size or shape).

Issues are triaged by maintainers. Triage labels (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) describe
the current state of an issue; please respect them.

---

This document is normative. If something here conflicts with information
elsewhere, this document wins unless a maintainer says otherwise in the
relevant pull request.
