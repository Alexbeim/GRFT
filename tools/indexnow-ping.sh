#!/usr/bin/env bash
# Ping IndexNow to tell Bing/Yandex/Seznam your sitemap changed.
# Run after publishing changes. Free, instant, no account required.
#
# Usage:  bash tools/indexnow-ping.sh
#
# IndexNow docs: https://www.indexnow.org

set -euo pipefail

KEY="324f435af9b0468aa120c201fcf0aefd"
HOST="graffitiplus.io"

# Submit the sitemap URL — IndexNow recursively picks up everything in it.
URL="https://${HOST}/sitemap.xml"

response=$(curl -sS -o /dev/null -w "%{http_code}" \
  "https://api.indexnow.org/indexnow?url=${URL}&key=${KEY}")

if [[ "$response" =~ ^(200|202)$ ]]; then
  echo "✓ IndexNow ping accepted (HTTP $response) — Bing/Yandex notified."
else
  echo "✗ IndexNow returned HTTP $response. Check key file is reachable:"
  echo "    https://${HOST}/${KEY}.txt"
  exit 1
fi
