#!/usr/bin/env bash
# Nano Banana (Gemini 2.5 Flash Image) — quick CLI for generating images.
#
# Usage:
#   tools/nano-banana.sh "a 5m graffiti wall lit at dusk, photorealistic" [output-name]
#
# Output goes to images/<name>.png (defaults to images/nano-<timestamp>.png).
# Requires GEMINI_API_KEY in .env at repo root.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env in repo root (needs GEMINI_API_KEY=...)" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$ROOT/.env"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "GEMINI_API_KEY not set in .env" >&2
  exit 1
fi

PROMPT="${1:-}"
if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 \"prompt text\" [output-name]" >&2
  exit 1
fi

NAME="${2:-nano-$(date +%Y%m%d-%H%M%S)}"
OUT="$ROOT/images/${NAME}.png"

MODEL="gemini-2.5-flash-image"
URL="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent"

# Build request body with prompt + image response config.
BODY=$(jq -n --arg p "$PROMPT" '{
  contents: [{ parts: [{ text: $p }] }],
  generationConfig: { responseModalities: ["IMAGE"] }
}')

RESPONSE=$(curl -sS -X POST "$URL" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Extract base64 image data from the first inlineData part.
B64=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[]? | select(.inlineData) | .inlineData.data' | head -n1)

if [[ -z "$B64" || "$B64" == "null" ]]; then
  echo "No image returned. Raw response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "$B64" | base64 -d > "$OUT"
echo "✓ Saved $OUT"
