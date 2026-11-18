#!/usr/bin/env bash
# Rebuild the explorer and mirror it into the eethan.com site repo, where it is
# served at /projects/dsa/live/.
#
#   npm run sync:site                      # site at ~/Documents/my_website
#   SITE_DIR=/path/to/my_website npm run sync:site
#
# Runs the tests, builds with the default base (/projects/dsa/live/), then
# replaces public/projects/dsa/live/ in the site with the fresh build. Nothing
# outside that folder is touched, and nothing is committed.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
site="${SITE_DIR:-$HOME/Documents/my_website}"
target="$site/public/projects/dsa/live"
build="$here/dist/projects/dsa/live"

# Guard: only ever write into the my_website repo.
if ! git -C "$site" remote get-url origin 2>/dev/null | grep -q 'ethCS/my_website'; then
  echo "error: $site is not a clone of ethCS/my_website (set SITE_DIR)" >&2
  exit 1
fi
if [[ -n "${BASE_PATH:-}" && "$BASE_PATH" != "/projects/dsa/live/" ]]; then
  echo "error: BASE_PATH=$BASE_PATH; the site serves the explorer at /projects/dsa/live/" >&2
  exit 1
fi

cd "$here"
npm test --silent
rm -rf "$here/dist"   # Vite only empties its own outDir; drop builds for older base paths
npm run build --silent

if [[ ! -f "$build/index.html" ]]; then
  echo "error: build output missing at $build" >&2
  exit 1
fi
if ! grep -q '/projects/dsa/live/assets/' "$build/index.html"; then
  echo "error: built index.html does not reference /projects/dsa/live/assets/" >&2
  exit 1
fi

mkdir -p "$target"
rsync -a --delete "$build/" "$target/"

echo "synced $(find "$target" -type f | wc -l | tr -d ' ') files into $target"
git -C "$site" status --short -- public/projects/dsa/live | head -20
