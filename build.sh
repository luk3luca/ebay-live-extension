#!/usr/bin/env bash
# Build the distributable packages into dist/
#   ebay-live-clean-chrome-<v>.zip   (unpacked load on Chrome/Edge/Brave)
#   ebay-live-clean-firefox-<v>.xpi  (temporary install on Firefox)
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('chrome/manifest.json'))['version'])")
OUT="dist"
mkdir -p "$OUT"
rm -f "$OUT"/ebay-live-clean-*."${VERSION}"* 2>/dev/null || true

# Chrome: zip the chrome/ folder contents (manifest at zip root)
( cd chrome && zip -qr "../$OUT/ebay-live-clean-chrome-$VERSION.zip" . -x ".DS_Store" )

# Firefox: same content, .xpi extension
( cd firefox && zip -qr "../$OUT/ebay-live-clean-firefox-$VERSION.xpi" . -x ".DS_Store" )

echo "Built:"
ls -lh "$OUT" | awk 'NR>1 {print "  " $9 " (" $5 ")"}'
