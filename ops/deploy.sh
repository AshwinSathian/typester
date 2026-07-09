#!/usr/bin/env bash
# Builds the app and publishes it as a new timestamped release under
# ~/.typester/releases, then atomically flips the `current` symlink that
# Caddy serves from. Keeps the last 5 releases so a bad deploy can be rolled
# back by re-pointing the symlink — no rebuild required.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASES_DIR="$HOME/.typester/releases"
KEEP=5
STAMP="$(date +%Y%m%d%H%M%S)"
TARGET="$RELEASES_DIR/$STAMP"

npm ci
npm run build

mkdir -p "$TARGET"
cp -R dist/typester/browser "$TARGET/browser"

ln -sfn "$TARGET" "$RELEASES_DIR/current"

echo "Released $STAMP -> $RELEASES_DIR/current"

# Keep the deployed Caddyfile in sync with the repo's copy, so an edit to
# ops/Caddyfile actually takes effect on the next deploy instead of silently
# requiring a separate manual `cp` step.
cp "$SCRIPT_DIR/Caddyfile" "$HOME/.typester/Caddyfile"

# Prune old releases, keeping the newest $KEEP.
cd "$RELEASES_DIR"
ls -1t | grep -v '^current$' | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "Reloading Caddy..."
if ! caddy reload --config "$HOME/.typester/Caddyfile" --adapter caddyfile 2>/dev/null; then
  echo "Caddy isn't running yet as a service - it'll pick up this release on first start (see ops/README.md)."
fi

echo "Done. Rollback: ln -sfn $RELEASES_DIR/<previous-stamp> $RELEASES_DIR/current && caddy reload --config $HOME/.typester/Caddyfile --adapter caddyfile"
