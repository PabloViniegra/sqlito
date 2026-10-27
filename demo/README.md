# SQLito demo

A ~28 s recording of SQLito made with [VHS](https://github.com/charmbracelet/vhs).

| File                     | Use                                  |
| ------------------------ | ------------------------------------ |
| `sqlito.tape`            | The scripted session                 |
| `render.sh`              | Prepares the sandbox and renders     |
| `output/sqlito-demo.mp4` | LinkedIn: 1920×1080, H.264, yuv420p  |
| `output/sqlito-demo.gif` | README: 1280×720, 15 fps, 128 colors |

Walkthrough: launch and header intro → command palette (`Ctrl+P`) running
`.tables` → a query typed with table and column autocompletion (`Tab`) →
an `UPDATE` tagged WRITE → reverse-i-search (`Ctrl+R`) re-runs the first
query showing the new stock → `.explain` shows its query plan.

The data is `fixtures/sample.db` (fictional shop data from `pnpm db:seed`).
`render.sh` copies it to `/tmp/sqlito-demo/shop.db` on every run, so the
`UPDATE` never touches the fixture, and points `XDG_DATA_HOME` /
`XDG_CONFIG_HOME` there so your real history and theme are not used.

## Requirements

- VHS ≥ 0.12, ttyd and FFmpeg: `brew install vhs` installs all three
  (or see the VHS README for apt/dnf/`go install`).
- Node ≥ 22 and pnpm, with dependencies installed (`pnpm install`).
- Fonts: `DankMono Nerd Font Mono` (falls back to the browser's monospace
  font if missing, which changes the look).

## Regenerate

From the repository root:

```bash
demo/render.sh
```

It builds `dist/`, records `sqlito.tape` and converts the raw recording to
the MP4 and GIF in `demo/output/`.

## Look

The tape mirrors a Ghostty setup — Vesper theme and Dank Mono — because VHS
renders through xterm.js in headless Chromium and cannot drive Ghostty
itself. Vesper maps ANSI cyan to pink, which is why SQLito's accent shows
pink. Line height is tighter than Ghostty's `adjust-cell-height = 35%` so
whole result tables fit on screen.
