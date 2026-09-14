#!/usr/bin/env bash
# Regenerates the macOS template tray icons from src-tauri/icons/tray/tray.svg.
# Requires rsvg-convert (brew install librsvg).
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/icons/tray"
rsvg-convert -w 18 -h 18 "$dir/tray.svg" -o "$dir/trayTemplate.png"
rsvg-convert -w 36 -h 36 "$dir/tray.svg" -o "$dir/trayTemplate@2x.png"
