# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

<!-- graphify:start -->
## Graphify — AI Knowledge Graph

This project uses [Graphify](https://github.com/safishamsi/graphify) to generate a
queryable knowledge graph of the source code. AI coding assistants read the graph
instead of broad file searches, which reduces unnecessary reads and improves accuracy.

The graph is built locally in `graphify-out/` (git-ignored) and regenerates automatically
after each commit.

### Setup (once per machine)

Requires Python 3.12+.

```bash
pip install graphifyy
python -m graphify .
```

> **Windows note:** always use `python -m graphify`, never `graphify` directly — the
> executable may not be on PATH.

### Manual update

```bash
python -m graphify . --update
```

### Query the graph from your assistant

```
python -m graphify query "where is the projects store?"
python -m graphify path "ModuleA" "ModuleB"
python -m graphify explain "concept-name"
```
<!-- graphify:end -->
