#!/usr/bin/env bash
# Builds the app and publishes it as a new timestamped release under
# /opt/typester/releases, then atomically flips the `current` symlink that
# Caddy serves from. Keeps the last 5 releases so a bad deploy can be rolled
# back by re-pointing the symlink — no rebuild required.
set -euo pipefail

RELEASES_DIR="/opt/typester/releases"
KEEP=5
STAMP="$(date +%Y%m%d%H%M%S)"
TARGET="$RELEASES_DIR/$STAMP"

npm ci
npm run build

mkdir -p "$TARGET"
cp -R dist/typester/browser "$TARGET/browser"

ln -sfn "$TARGET" "$RELEASES_DIR/current"

echo "Released $STAMP -> $RELEASES_DIR/current"

# Prune old releases, keeping the newest $KEEP.
cd "$RELEASES_DIR"
ls -1t | grep -v '^current$' | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "Reloading Caddy..."
caddy reload --config /opt/typester/Caddyfile --adapter caddyfile

echo "Done. Rollback: ln -sfn $RELEASES_DIR/<previous-stamp> $RELEASES_DIR/current && caddy reload ..."
