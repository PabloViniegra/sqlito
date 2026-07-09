# Packaging and versioning research

Fact-finding only — no recommendation or decision is made in this document. It exists to
brief a human decision-making session about how to package and distribute `sqlito`
(a TypeScript CLI/TUI built with ink, commander, and the native addon `better-sqlite3`).
Every claim below is sourced from a primary source (official docs, the owning project's
own repo/CI/release assets, or a first-party spec) or from an empirical test run directly
against this repository during this research session. Secondary write-ups (blog posts,
tutorials) were deliberately not used as sources of fact, only as pointers to find the
primary source faster.

Local repo state confirmed before starting: `package.json` has no `bin` field, no
`engines` field, `"version": "0.0.0"`, and depends on `better-sqlite3@^12.11.1` (installed:
`12.11.1`). `node_modules/better-sqlite3` has no `prebuilds/` directory but does have
`build/Release/obj.target/**/*.o` object files, confirming the dev machine (Linux, Node
24.14.0) compiled the addon locally via `node-gyp` rather than fetching a prebuilt
`.node` file.

---

## 1. better-sqlite3 prebuilt binary coverage

**Scope:** what OS × arch × libc × Node-ABI combinations get a prebuilt binary for
`better-sqlite3@12.11.1` (the version this repo depends on), per the project's own
`binding.gyp`, CI workflow, and published GitHub Release assets.

### It is not a Node-API (N-API) addon

`better-sqlite3`'s `binding.gyp` (source:
https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/binding.gyp) declares no
`NAPI_VERSION` define and links directly against SQLite compiled from source
(`deps/sqlite3.gyp:sqlite3`). Its C++ source confirms this directly — the top of
`src/better_sqlite3.cpp` includes `<node.h>` and `<node_object_wrap.h>` (source:
https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/src/better_sqlite3.cpp),
which are Node's internal V8/libuv headers, not `<node_api.h>`/`<napi.h>`. This means the
addon is **not ABI-stable across Node versions** the way an N-API addon would be — every
Node major version that bumps `NODE_MODULE_VERSION` needs its own separately-built
prebuilt binary. This single fact explains both the release-asset matrix below and (see
§2) why Bun's Node-API compatibility layer does not help it.

### CI build matrix

`.github/workflows/build.yml` (source:
https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml) runs
tests on `ubuntu-22.04`, `macos-15`, `macos-15-intel`, and `windows-2022` against Node
22/24/25/26, and on release events runs dedicated prebuild jobs: `prebuild` (macOS +
Windows, including Windows `ia32`/`arm64`), `prebuild-linux-x64` (glibc, via a
`node:20-bullseye` container for older-glibc compatibility), `prebuild-linux-arm`
(arm/arm64), `prebuild-alpine` and `prebuild-alpine-arm` (musl), then a `publish` job that
runs `npm publish --provenance`.

### What's actually attached to the v12.11.1 / v12.11.2 GitHub Releases

Queried directly via the GitHub API (`gh api repos/WiseLibs/better-sqlite3/releases/tags/v12.11.1`
and `.../v12.11.2`, the latter being the current `latest` release as of this research).
Filtering the 138 assets down to the non-Electron ("node") ones and de-duplicating by
`NODE_MODULE_VERSION`, both releases ship exactly this matrix, for every one of
**darwin-arm64, darwin-x64, linux-arm, linux-arm64, linux-x64, linuxmusl-arm,
linuxmusl-arm64, linuxmusl-x64, win32-arm64, win32-x64**:

| Asset `node-vNNN` | `NODE_MODULE_VERSION` | Node.js line (per nodejs/node's own ABI registry) |
| ----------------- | --------------------- | ------------------------------------------------- |
| `node-v127-*`     | 127                   | 22.x                                              |
| `node-v137-*`     | 137                   | 24.x                                              |
| `node-v141-*`     | 141                   | 25.x                                              |
| `node-v147-*`     | 147                   | 26.x                                              |

(Asset list source: `gh api repos/WiseLibs/better-sqlite3/releases/tags/v12.11.1`, cross-checked
against `v12.11.2`; the `NODE_MODULE_VERSION` → Node-line mapping is Node's own primary source,
`https://raw.githubusercontent.com/nodejs/node/main/doc/abi_version_registry.json`, which lists
`{"modules":127,...,"versions":"22.0.0"}`, `{"modules":137,...,"versions":"24.0.0"}`,
`{"modules":141,...,"versions":"25.0.0"}`, `{"modules":147,...,"versions":"26.0.0-pre"}`.)

There is **no `node-v115-*` (Node 20.x) and no `node-v131-*` (Node 23.x) asset in either
release** — confirmed by listing all non-Electron asset names and finding only module
versions 127/137/141/147 present, in both v12.11.1 and the current-latest v12.11.2.

This lines up exactly with Node.js's own release schedule (source:
https://raw.githubusercontent.com/nodejs/Release/main/README.md): Node 20.x's End-of-Life
is **2026-04-30**, and Node 23.x's End-of-Life was **2025-06-01** — both are dead release
lines by the time v12.11.1 (published 2026-06-15) and v12.11.2 (published 2026-07-03) shipped.
Node 25.x also went EOL on 2026-06-01 but still has a prebuild in these releases, apparently
not yet dropped. Node 22.x is in Maintenance LTS until 2027-04-30; Node 24.x is Active LTS
until 2026-10-20.

Note: `better-sqlite3`'s own `package.json` `engines` field
(`"20.x || 22.x || 23.x || 24.x || 25.x || 26.x"`, confirmed by reading
`node_modules/better-sqlite3/package.json` locally) still nominally lists 20.x and 23.x as
supported — that engines range has not been narrowed to match actual prebuilt-asset
coverage.

### Direct answer for the repo's target platforms

| Platform                       | Node 20                                               | Node 22          | Node 24          |
| ------------------------------ | ----------------------------------------------------- | ---------------- | ---------------- |
| Linux x64 (glibc)              | **No prebuild → node-gyp + toolchain required**       | Prebuild fetched | Prebuild fetched |
| Linux x64 (musl/Alpine)        | **No prebuild → toolchain required**                  | Prebuild fetched | Prebuild fetched |
| macOS (Intel or Apple Silicon) | **No prebuild → toolchain required (Xcode CLT)**      | Prebuild fetched | Prebuild fetched |
| Windows x64                    | **No prebuild → toolchain required (VS Build Tools)** | Prebuild fetched | Prebuild fetched |

So: contrary to the commonly-assumed "gaps" (Alpine/musl, Windows arm64) — both are
actually **covered** by dedicated prebuilt assets in this release. The real, verified gap
is **Node-version-based, not platform-based**: any Node 20.x or Node 23.x user, on any of
Linux/macOS/Windows, gets no prebuilt binary from this exact `better-sqlite3` version and
falls back to `node-gyp rebuild --release`, which needs a C/C++ toolchain (Python 3, make,
a compiler) per better-sqlite3's own `install` script
(`"prebuild-install || node-gyp rebuild --release"`, confirmed by reading
`node_modules/better-sqlite3/package.json` locally).

(Aside, not independently re-verified: a `node-v137-linux-x64` asset — the exact combination
matching this dev machine's Linux/Node-24 setup — does exist in the release, so the
node-gyp fallback observed locally is not explained by a genuine coverage gap; it's more
likely caused by something environment-specific to this sandbox, e.g. restricted network
egress to GitHub's release-asset CDN during `npm install`.)

---

## 2. Single-executable / no-Node-required packaging for a CLI with a native addon

**Scope:** current (as of this research) viability of shipping one self-contained binary
per platform — no separate Node.js install required by the end user — for a project
combining a non-N-API native addon (`better-sqlite3`) with React/ink. Node SEA and pkg's
docs were read directly; Bun was additionally tested empirically against this exact repo
during this session (see below), since a live compile is a stronger primary source than
the marketing docs alone.

### Node.js Single Executable Applications (SEA)

Official docs: https://nodejs.org/api/single-executable-applications.html

- **Stability: 1.1 – Active development**, i.e. inside Node's general
  "Stability: 1 – Experimental" band, which Node's own documentation-conventions page
  defines as: _"Non-backward compatible changes or removal may occur in any future
  release. Use of the feature is not recommended in production environments."_ (source:
  https://nodejs.org/api/documentation.html). "1.1 – Active development" is defined as
  _"Experimental features at this stage are nearing minimum viability."_
- Version history (all "Added in" annotations on the SEA docs page, source as above):
  general feature since **v19.7.0** (backported to **v18.16.0**); `useSnapshot` /
  `useCodeCache` since **v20.6.0**; `sea.isSea()`, `sea.getAsset()`,
  `sea.getAssetAsBlob()`, `sea.getRawAsset()` since **v21.7.0** / **v20.12.0**;
  `sea.getAssetKeys()` since **v24.8.0** / **v22.20.0**; a built-in `--build-sea` CLI flag
  since **v25.5.0**.
- **Native addon support exists but is fully manual**, not automatic. The documented
  pattern: embed the `.node` file as a named `assets` entry in the SEA config, then at
  runtime call `getRawAsset()`, `fs.writeFileSync()` it out to a real temp-directory path
  (because, per the docs, native addons cannot be `dlopen`'d from an in-memory buffer),
  and call `process.dlopen()` on that temp path yourself.
- **Documented platform support is the single biggest fact for this decision**: _"Single-executable
  support is tested regularly on CI only on the following platforms: Windows; macOS
  (arm64 only; x64 is not currently supported and is skipped in the tests); Linux (all
  distributions supported by Node.js except Alpine and all architectures... except
  s390x)"_ (quoted verbatim from https://nodejs.org/api/single-executable-applications.html).
  **Intel Macs are explicitly excluded from SEA's own tested/supported platform list
  today.** Alpine/musl Linux is also excluded.
- Known bug, documented on the same page: SEA binaries built inside a Linux arm64 Docker
  container produce an ELF binary with a broken hash table, and `process.dlopen()` crashes
  — the docs point to https://github.com/nodejs/postject/issues/105 and recommend building
  on a non-container Linux arm64 host instead.
- Cross-building for a different platform than the build host is possible in principle
  (you supply the target's own Node binary + your generated blob), but `useCodeCache` and
  `useSnapshot` must both be `false` for cross-platform SEAs, and there is no built-in
  cross-arch/cross-OS "target" flag the way pkg/Bun have — you must obtain a real Node
  binary for each target platform yourself.

### pkg (`vercel/pkg`) and its maintained fork (`yao-pkg/pkg`)

`vercel/pkg` is **archived** (`"archived": true` via the GitHub API,
`pushed_at: 2024-01-03`). Its own README states: _"`pkg` has been deprecated with `5.8.1`
as the last release. There are a number of successful forked versions of `pkg` already...
we're excited about Node.js 21's support for single executable applications... The
repository will remain open and archived."_ (source:
https://raw.githubusercontent.com/vercel/pkg/main/README.md).

`yao-pkg/pkg` is the actively-maintained fork referenced by that notice, published to npm
as `@yao-pkg/pkg`. Confirmed not archived, `pushed_at: 2026-06-30`, latest release
`v6.21.0` (2026-06-30), 901 stars (source: GitHub API on `repos/yao-pkg/pkg`, plus
`.../releases/latest`). Notably, one of that release's own changelog bullets is
_"track supported node majors, drop node20"_ — independent corroboration of the Node-20
End-of-Life pattern found in §1.

Its own native-addons guide (source: https://yao-pkg.github.io/pkg/guide/native-addons)
explains the mechanism directly: `.node` files are packaged as assets, extracted to a
cache directory on first launch (because, as with SEA, "Node.js requires physical disk
files to load native addons"), then `dlopen`'d from that cached path on subsequent runs.
Cross-compiling for a different arch/platform than the host requires you to _"ensure you
install the right prebuilt binary for that target (or rebuild it with `prebuildify` /
`node-gyp` for each target)"_ — i.e., no magic cross-compilation of the native binary
itself, same fundamental constraint as SEA. It also states plainly: _"Native bindings are
not supported on the `linuxstatic` target"_ (Alpine/musl). The project has also grown a
second mode, "SEA mode," that runs on stock unmodified Node.js via Node's own official SEA
feature (as opposed to the older "Standard mode," which patches a `pkg-fetch`-vendored
Node binary); its own docs list native-addon support as supported (✅) in both modes
(source: https://yao-pkg.github.io/pkg/guide/sea-vs-standard).

### nexe

Repo itself is not GitHub-archived, and still receives commits (`pushed_at: 2026-03-05`
via GitHub API), but its real release history tells a different story. Per the **npm
registry itself** (`npm view nexe time --json` / `npm view nexe dist-tags --json`, run
directly during this research): the last non-prerelease version ever published was
`3.3.7` on **2020-06-30**. Every version published since then — `4.0.0-beta.*`,
`4.0.0-rc.*`, `5.0.0-beta.*` — is a beta or release-candidate; the current `latest`
dist-tag is still `5.0.0-beta.4`, published **2025-03-08**, itself over a year old as of
this research. Its own README's "Native Modules" section is a single sentence with no
tooling behind it: _"In order to use native modules, the native binaries must be shipped
alongside the binary generated by nexe."_ (source:
https://raw.githubusercontent.com/nexe/nexe/master/README.md) — i.e., no asset-embedding
mechanism at all, weaker native-addon handling than either SEA or pkg/yao-pkg.

### Bun (`bun build --compile`)

Official docs consulted: https://bun.com/docs/bundler/executables (the `--compile` flag
itself) and https://bun.com/docs/runtime/node-api (Node-API compatibility). The docs state
Bun _"implements [Node-API] from scratch, so most existing Node-API extensions work with
Bun out of the box"_ — but this claim is scoped to **Node-API** addons specifically, and
never mentions raw-V8/NAN-style addons.

Because Bun is already installed in this environment (v1.3.14), it was tested directly
against this exact repository rather than relying on docs alone:

- `bun build ./src/main.tsx --compile --outfile <path>` (run from the repo root, so
  `node_modules` resolves normally) **fails outright**: `error: Could not resolve:
"react-devtools-core". Maybe you need to "bun install"?`, pointing at
  `ink/build/devtools.js`. Reading that file and its caller (`ink/build/reconciler.js`)
  shows the reference is guarded at runtime by `if (process.env['DEV'] === 'true')` plus a
  try/catch around `import.meta.resolve('react-devtools-core')` — `react-devtools-core` is
  declared as an `optional: true` peer dependency in ink's own `package.json` and is
  legitimately not installed here. Bun's bundler for `--compile` does not honor that
  runtime guard when deciding what to statically resolve (its own docs say _"Bun always
  bundles everything into the executable"_ — there is no `--no-bundle` for `--compile`).
  Passing `--external react-devtools-core` makes the build succeed, but the resulting
  binary then fails at **run time** with `error: Cannot find package 'react-devtools-core'
from '/$bunfs/root/...'` even with `DEV` unset — this reproduced identically whether or
  not `DEV=true` was set. This is a real, reproducible packaging problem for ink 7.1.0
  under `bun build --compile`, independent of the native-addon question below.
- Far more decisive: a minimal isolated test project (`ink` + `react` + `better-sqlite3`,
  installed with Bun's own installer, not pnpm, to rule out a package-manager-specific
  cause) fails to even **run** under plain `bun run` (not just `--compile`), with Bun's own
  runtime raising: `error: 'better-sqlite3' is not yet supported in Bun. Track the status
in https://github.com/oven-sh/bun/issues/4290. In the meantime, you could try bun:sqlite
which has a similar API. code: "ERR_DLOPEN_FAILED"`. This is Bun's own first-party error
  message, not a secondary source.
- That issue, `oven-sh/bun#4290` ("Support V8 C++ APIs for 'nan' addons and other packages
  to work"), is **open**, last updated 2026-06-11 (checked via `gh api
repos/oven-sh/bun/issues/4290`), with 87 comments, and its own issue body explicitly
  lists `better-sqlite3` as an unchecked (unsupported) affected package alongside
  `node-canvas@v2`, `libxmljs`, `leveldown`, and others — all native addons that, like
  `better-sqlite3` (see §1), are built against the legacy V8 C++ API rather than N-API.

  This directly explains the failure: Bun's Node-API shim only covers the N-API surface;
  `better-sqlite3` never uses N-API (confirmed in §1 from its own source), so Bun's
  compatibility layer does not apply to it at all, regardless of `--compile` vs. plain
  `bun run`.

### Direct viability verdict per platform, given the `better-sqlite3` dependency

| Tool            | linux-x64                                                                                                                                      | linux-arm64                                                                       | darwin-x64                                                 | darwin-arm64 | win32-x64 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------ | --------- |
| Node SEA        | Viable (manual dlopen wiring)                                                                                                                  | Viable, but avoid building inside a Linux-arm64 Docker container (documented bug) | **Not in Node's own tested/supported platform list today** | Viable       | Viable    |
| pkg (vercel)    | N/A — archived/deprecated, not a live option                                                                                                   |                                                                                   |                                                            |              |           |
| yao-pkg/pkg     | Viable (ship/rebuild the right prebuilt `.node` per target; not for `linuxstatic`/musl)                                                        | Viable (same caveat)                                                              | Viable                                                     | Viable       | Viable    |
| nexe            | Technically possible but tool itself has shipped no stable release since 2020 and has the weakest native-addon story (manual "ship alongside") |                                                                                   |                                                            |              |           |
| Bun `--compile` | **Not viable today** — confirmed failing directly against `better-sqlite3`, tracked as open upstream (`oven-sh/bun#4290`)                      | Same (root cause is the addon, not the platform)                                  | Same                                                       | Same         | Same      |

---

## 3. Versioning/release automation for a Conventional-Commits repo

**Scope:** how Changesets, semantic-release, and release-please each derive a version,
generate a changelog, integrate with GitHub Actions, and whether they publish to npm and
cut GitHub Releases — read from each project's own README/docs/package.json.

|                                         | Changesets                                                                                                                                                                                                                                                                                         | semantic-release                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | release-please                                                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Version bump source**                 | Explicit changeset files contributors add by hand (`changeset` CLI), not commit parsing. Its own README: _"A `changeset` is an intent to release a set of packages at particular semver bump types with a summary of the changes made."_ (source: https://github.com/changesets/changesets README) | Parses commit messages; default is the Angular convention (`fix:`→patch, `feat:`→minor, `BREAKING CHANGE:` footer→major) via the bundled `@semantic-release/commit-analyzer` plugin (source: README, and confirmed as a direct dependency in `package.json` — `@semantic-release/commit-analyzer": "^13.0.1"`)                                                                                                                                                                                                                                                                        | Parses git history for Conventional Commits directly: _"It does so by parsing your git history, looking for Conventional Commit messages, and creating release PRs"_ (source: https://github.com/googleapis/release-please README) |
| **Changelog mechanism**                 | Generated from the changeset files' own summaries at version time                                                                                                                                                                                                                                  | `@semantic-release/release-notes-generator` (bundled default dependency) generates release notes; **not** written to a committed `CHANGELOG.md` file unless `@semantic-release/changelog` is separately added — that plugin is **not** in semantic-release's own default dependency list (verified directly from `package.json`, which only bundles `commit-analyzer`, `release-notes-generator`, `npm`, `github`, `error`)                                                                                                                                                           | Updates `CHANGELOG.md` and language-specific version files (e.g. `package.json`) automatically as part of the release PR                                                                                                           |
| **Official GitHub Action**              | Yes — `changesets/action`, same GitHub org as the core tool (verified via `gh api orgs/changesets/repos`, which lists `action` alongside `changesets`, `bot`, `ghcommit`)                                                                                                                          | **No dedicated first-party action.** The `semantic-release` GitHub org's repo list (`gh api orgs/semantic-release/repos`) contains only plugin repos (`npm`, `github`, `git`, `changelog`, `commit-analyzer`, `release-notes-generator`, `exec`, etc.) and the `cli` — no repo shaped like a runnable `uses: semantic-release/...@version` Action. The project's own documented CI recipe runs `npx semantic-release` as a plain script step inside a normal `actions/checkout` + `actions/setup-node` workflow, not a dedicated Action (source: semantic-release.org and its README) | Yes — `googleapis/release-please-action`, explicitly pointed to from the main README: _"The easiest way to run Release Please is as a GitHub action. Please see googleapis/release-please-action..."_                              |
| **Automates `npm publish`?**            | Yes, optionally — `changesets/action`'s own README: it can _"automate creating versioning pull requests, and optionally publishing packages"_, gated on a `publish-script` input and an `NPM_TOKEN` secret with publish rights and no 2FA-on-publish                                               | Yes, by default — `@semantic-release/npm` is a bundled default plugin; supports npm provenance / OIDC trusted publishing                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **No.** Its own README is explicit: _"It does not handle publication to package managers or handle complex branch management."_ It only prepares/merges the release PR; publishing must be a separate CI step                      |
| **Creates git tags / GitHub Releases?** | Yes, both, and both default to `true` in `changesets/action` (`push-git-tags` and `create-github-releases` inputs)                                                                                                                                                                                 | Yes — a "Create Git tag" step, plus GitHub Release creation via the bundled `@semantic-release/github` default plugin                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Yes — its own README: on merge it _"Tags the commit with the version number"_ and _"Creates a GitHub Release based on the tag"_                                                                                                    |

Additional notes relevant to fit:

- Changesets originates from monorepo tooling (Bolt) — its own intro doc says _"changesets
  were originally designed for implementation in bolt monorepos"_ — and several config
  options (`linked`, `fixed`, `updateInternalDependencies`,
  `bumpVersionsWithWorkspaceProtocolOnly`, `ignore`) are explicitly scoped in its own docs
  as _"only for behaviour in monorepos"_ (source:
  https://github.com/changesets/changesets/blob/main/docs/config-file-options.md),
  implying the rest of the tool is monorepo-agnostic, but neither its intro doc nor its
  FAQ (`common-questions.md`) explicitly states single-package-repo support one way or
  the other — this was not found confirmed in the project's own docs either way.
- Changesets requires an extra authoring step per PR (a contributor/maintainer runs
  `changeset` or `npx @changesets/cli` to add a changeset file) that is independent of
  the commit message — it does not read Conventional Commits at all, so adopting it here
  would run in parallel with, not derived from, this repo's existing Conventional Commits
  discipline.
- semantic-release and release-please both consume Conventional Commits directly, fitting
  this repo's existing merge-via-PR convention without adding an authoring step, but
  release-please's PR-based flow (it opens/updates a standing "release PR" that
  accumulates pending changes, merged by a human to cut the release) versus
  semantic-release's flow (fully automated on every push to the release branch, no
  human-facing release PR) are structurally different release cadences.

---

## 4. Secondary distribution channels on top of an npm-published CLI

**Scope:** minimal requirements, per each platform's own docs/schema, to distribute a
Node-based CLI via Homebrew, Scoop, and winget — and whether any of them can just wrap
`npm install -g` rather than requiring a standalone binary artifact.

### Homebrew (docs.brew.sh)

A Homebrew formula for a Node CLI is a thin wrapper, **not** a standalone binary — per
Homebrew's own `Node-for-Formula-Authors` doc
(https://docs.brew.sh/Node-for-Formula-Authors), the canonical pattern is:

```ruby
class Foo < Formula
  url "https://registry.npmjs.org/foo/-/foo-1.4.2.tgz"
  depends_on "node"
  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end
end
```

i.e., `depends_on "node"`, download the **npm registry tarball** (Homebrew's own docs
state a preference: _"we prefer npm-hosted release tarballs over GitHub (or elsewhere)
hosted source tarballs"_), and run `npm install` via the `std_npm_args` helper. For a
package with a native addon needing compilation, the same doc shows adding
`depends_on "python" => :build` (node-gyp's build-time Python dependency) — directly
relevant to `better-sqlite3`, given §1's finding that Node 20/23 users get no prebuilt
binary and would compile from source even on macOS/Linuxbrew.

Getting into **homebrew-core** (the main first-party repo, giving a bare `brew install
sqlito`) has a notability bar, per
https://docs.brew.sh/Acceptable-Formulae: _"≥30 forks, ≥30 watchers or ≥75 stars"_ for a
third-party submission (a higher bar, _"≥90 forks, ≥90 watchers, or ≥225 stars"_, applies
to self-submissions by the software's own author). Below that bar, Homebrew's own docs
point to maintaining a personal tap instead, with no such requirement: _"Don't forget
Homebrew is all Git underneath! Maintain your own tap if you have to!"_ — a tap is just a
separate git repo of formula files, installable immediately via `brew tap <user>/<repo>`.

### Scoop (Windows)

Scoop's manifest JSON schema (source:
https://raw.githubusercontent.com/ScoopInstaller/Scoop/master/schema.json) technically
permits a manifest with no `url` at all, using `depends` (e.g. a `nodejs` bucket package)
plus a `post_install`/`installer.script` field to run arbitrary install commands — so an
`npm install -g`-style wrapper is schema-legal. **However, no such manifest was found in
Scoop's own first-party `Main` bucket** (a GitHub code search for `"npm install -g"`
scoped to `repo:ScoopInstaller/Main` returned zero results). Checking a real, comparable
npm-ecosystem CLI that Scoop does ship — `pnpm` — shows the actual pattern used instead:
the manifest (https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/pnpm.json)
declares no Node dependency at all and instead points `64bit`/`arm64` architecture blocks
directly at pnpm's own standalone-binary release zips
(`pnpm-win32-x64.zip`/`pnpm-win32-arm64.zip`, downloaded from pnpm's GitHub Releases), with
a plain `bin` entry. So: schema-legal to wrap npm, but not the pattern actually used for a
real published npm-ecosystem CLI in Scoop's own bucket — the observed practice is
"package the standalone binary," which only exists as an option if a SEA/pkg-style build
(§2) is available.

### winget (Microsoft)

Per Microsoft's own manifest docs (https://learn.microsoft.com/en-us/windows/package-manager/package/manifest),
the minimal required manifest schema is fundamentally artifact-based — every installer
entry requires an `InstallerType` from a fixed enum (`exe, msi, msix, inno, wix, nullsoft,
appx, font`; `zip`/`portable` also appear in the fuller schema, as seen below), an
`InstallerUrl`, and an `InstallerSha256`. There is no "run a package-manager install
command" installer type. The same docs add a hard requirement: _"All tools must support a
silent install. If you have an executable that does not support a silent install, then we
cannot provide that tool at this time."_ Checked against the same real-world comparison,
`pnpm`'s actual winget manifest
(https://raw.githubusercontent.com/microsoft/winget-pkgs/master/manifests/p/pnpm/pnpm/11.3.0/pnpm.pnpm.installer.yaml)
uses `InstallerType: zip` with `NestedInstallerType: portable`, pointing at the identical
`pnpm-win32-x64.zip`/`pnpm-win32-arm64.zip` GitHub Release assets Scoop's manifest also
uses — confirming the same standalone-binary-artifact pattern is what's actually
published, on both Windows package managers, for a real npm-ecosystem CLI.

**Net finding for §4:** Homebrew is the one channel among the three whose own first-party,
documented pattern is to wrap `npm install` directly (no standalone binary needed) — a
personal tap has no notability gate. Scoop and winget are schema-flexible enough to
theoretically wrap an npm install, but the actual first-party-published examples checked
(`pnpm`, on both) use a standalone per-architecture binary archive instead, which
presupposes a working answer to §2.

---

## Sources checked

- https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/binding.gyp
- https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/src/better_sqlite3.cpp
- https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml
- https://github.com/WiseLibs/better-sqlite3/releases
- https://api.github.com/repos/WiseLibs/better-sqlite3/releases/tags/v12.11.1
- https://api.github.com/repos/WiseLibs/better-sqlite3/releases/tags/v12.11.2
- https://api.github.com/repos/WiseLibs/better-sqlite3/releases/latest
- https://raw.githubusercontent.com/nodejs/node/main/doc/abi_version_registry.json
- https://raw.githubusercontent.com/nodejs/Release/main/README.md
- `node_modules/better-sqlite3/package.json` (local, this repo)
- https://nodejs.org/api/single-executable-applications.html
- https://nodejs.org/api/documentation.html
- https://raw.githubusercontent.com/vercel/pkg/main/README.md
- https://api.github.com/repos/vercel/pkg
- https://api.github.com/repos/yao-pkg/pkg
- https://api.github.com/repos/yao-pkg/pkg/releases/latest
- https://yao-pkg.github.io/pkg/guide/native-addons
- https://yao-pkg.github.io/pkg/guide/sea-vs-standard
- https://raw.githubusercontent.com/nexe/nexe/master/README.md
- https://api.github.com/repos/nexe/nexe
- npm registry via `npm view nexe time --json` and `npm view nexe dist-tags --json`
- https://bun.com/docs/bundler/executables
- https://bun.com/docs/runtime/node-api
- https://api.github.com/repos/oven-sh/bun/issues/4290
- Empirical test, this session: `bun build ./src/main.tsx --compile` against this repo;
  isolated `bun install` + `bun run` smoke test of `ink` + `react` + `better-sqlite3`
  (Bun v1.3.14, Linux x64)
- https://raw.githubusercontent.com/changesets/changesets/main/README.md
- https://raw.githubusercontent.com/changesets/changesets/main/docs/intro-to-using-changesets.md
- https://raw.githubusercontent.com/changesets/changesets/main/docs/common-questions.md
- https://raw.githubusercontent.com/changesets/changesets/main/docs/config-file-options.md
- https://raw.githubusercontent.com/changesets/action/main/README.md
- https://api.github.com/orgs/changesets/repos
- https://raw.githubusercontent.com/semantic-release/semantic-release/master/README.md
- https://raw.githubusercontent.com/semantic-release/semantic-release/master/package.json
- https://semantic-release.org/
- https://api.github.com/orgs/semantic-release/repos
- https://raw.githubusercontent.com/googleapis/release-please/main/README.md
- https://docs.brew.sh/Adding-Software-to-Homebrew
- https://docs.brew.sh/Formula-Cookbook
- https://docs.brew.sh/Node-for-Formula-Authors
- https://docs.brew.sh/Acceptable-Formulae
- https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
- https://raw.githubusercontent.com/ScoopInstaller/Scoop/master/schema.json
- https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/pnpm.json
- GitHub code search: `"npm install -g" repo:ScoopInstaller/Main`
- https://learn.microsoft.com/en-us/windows/package-manager/package/manifest
- https://api.github.com/repos/microsoft/winget-pkgs (manifests/p/pnpm/pnpm directory listing)
- https://raw.githubusercontent.com/microsoft/winget-pkgs/master/manifests/p/pnpm/pnpm/11.3.0/pnpm.pnpm.installer.yaml
