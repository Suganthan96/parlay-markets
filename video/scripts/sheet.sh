#!/usr/bin/env bash
# Usage: scripts/sheet.sh <outdir> <name> frame frame ...  -> renders half-res stills and tiles them.
OUT=$1; NAME=$2; shift 2; rm -rf "$OUT/$NAME"; mkdir -p "$OUT/$NAME"
npx remotion bundle src/index.ts --out-dir=build --log=error >/dev/null || exit 1
printf '%s\n' "$@" | xargs -P 4 -I{} sh -c "npx remotion still build ParlayMarkets '$OUT/$NAME/'\$(printf '%05d' {}).png --frame={} --scale=0.4 --log=error >/dev/null"
ls "$OUT/$NAME"/*.png | wc -l
ffmpeg -y -loglevel error -pattern_type glob -i "$OUT/$NAME/*.png" -vf "tile=4x4:padding=6:color=red" -frames:v 1 "$OUT/$NAME.png"
