#!/usr/bin/env bash
# Renders demo/output/sqlito-demo.mp4 (LinkedIn) and sqlito-demo.gif (README).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work=/tmp/sqlito-demo
out="$root/demo/output"

for bin in vhs ttyd ffmpeg node pnpm; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done

cd "$root"
pnpm build >/dev/null
[ -f fixtures/sample.db ] || pnpm db:seed

# The tape mutates the database and history, so every run starts from a
# fresh copy; the short path also keeps the header readable.
rm -rf "$work"
mkdir -p "$work/bin" "$work/xdg" "$out"
cp fixtures/sample.db "$work/shop.db"
printf '#!/bin/sh\nexec node "%s/dist/cli.js" "$@"\n' "$root" >"$work/bin/sqlito"
chmod +x "$work/bin/sqlito"

vhs demo/sqlito.tape

# LinkedIn wants H.264 + yuv420p; faststart lets the feed start playback early.
ffmpeg -y -loglevel error -i "$out/sqlito-demo.raw.mp4" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
  "$out/sqlito-demo.mp4"

ffmpeg -y -loglevel error -i "$out/sqlito-demo.raw.mp4" \
  -vf "fps=15,scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  "$out/sqlito-demo.gif"

rm "$out/sqlito-demo.raw.mp4"
ls -lh "$out"
