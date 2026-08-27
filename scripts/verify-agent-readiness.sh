#!/usr/bin/env bash
#
# verify-agent-readiness.sh
# Regression checks for the "Is Agentic" readiness fixes.
#
#   Local checks   (always): validate the committed files are correct.
#   Live checks    (HTTP):   validate the deployed site. Set BASE_URL to test
#                            a preview; defaults to the production domain.
#
# Usage:
#   scripts/verify-agent-readiness.sh                     # local + live(prod)
#   BASE_URL=http://localhost:8775 scripts/verify-agent-readiness.sh
#   scripts/verify-agent-readiness.sh --local-only
#
set -uo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-https://graffitiplus.io}"
PASS=0; FAIL=0; SKIP=0
ok()   { printf "  \033[32mPASS\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31mFAIL\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
skip() { printf "  \033[33mSKIP\033[0m %s\n" "$1"; SKIP=$((SKIP+1)); }

echo "== Local file checks =="

# 1. 404 recovery body: real recovery links to sitemap + llms.txt, and noindex.
grep -q 'href="/sitemap.xml"' 404.html && grep -q 'href="/llms.txt"' 404.html \
  && ok "404.html links to sitemap.xml and llms.txt" \
  || bad "404.html missing sitemap/llms recovery links"
grep -qi 'name="robots" content="noindex' 404.html \
  && ok "404.html is noindex" || bad "404.html not noindex"

# 3. Agent when-to-use guidance in llms.txt.
grep -qi 'When to use' llms.txt \
  && ok "llms.txt has a 'When to use' section" \
  || bad "llms.txt missing when-to-use guidance"

# 4. Organization schema: contactPoint required; postal address intentionally
#    omitted by the site owner (does not want to publish an address).
grep -q '"contactPoint"' index.html \
  && ok "index.html Organization schema has contactPoint (email/phone/type)" \
  || bad "index.html Organization schema missing contactPoint"
grep -q '"PostalAddress"' index.html \
  && bad "PostalAddress present — owner opted out of publishing an address" \
  || skip "PostalAddress intentionally omitted (owner decision — keeps #4 at Partial)"

# 5. Privacy page exists with >= 500 chars of visible text.
if [ -f privacy.html ]; then
  CHARS=$(sed -e 's/<[^>]*>//g' privacy.html | tr -s ' \n\t' ' ' | wc -c | tr -d ' ')
  [ "$CHARS" -ge 500 ] && ok "privacy.html has $CHARS chars of text (>=500)" \
    || bad "privacy.html only $CHARS chars (<500)"
else
  bad "privacy.html does not exist"
fi
grep -q '<loc>https://graffitiplus.io/privacy</loc>' sitemap.xml \
  && ok "sitemap.xml lists /privacy" || bad "sitemap.xml missing /privacy"
grep -q 'href="/privacy"' index.html \
  && ok "footer links to /privacy" || bad "footer missing /privacy link"

# JSON-LD sanity: every inline ld+json block in the touched pages parses.
if command -v python3 >/dev/null; then
  for f in index.html wall.html privacy.html; do
    python3 - "$f" <<'PY' && ok "JSON-LD valid in $f" || bad "JSON-LD invalid in $f"
import re,sys,json
html=open(sys.argv[1],encoding='utf-8').read()
blocks=re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)
[json.loads(b) for b in blocks]
PY
  done
fi

echo ""
echo "== Live checks ($BASE_URL) =="
if [ "${1:-}" = "--local-only" ]; then
  skip "live checks skipped (--local-only)"
else
  # 1. Nonexistent path returns a real 404 (not a 200 app shell).
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/some-path-that-does-not-exist-$(date +%s)")
  [ "$CODE" = "404" ] && ok "unknown path returns HTTP 404 (got $CODE)" \
    || bad "unknown path returned $CODE (must be 404)"

  # 1b. The 404 body carries recovery links agents can follow.
  BODY=$(curl -s "$BASE_URL/some-path-that-does-not-exist-$(date +%s)")
  echo "$BODY" | grep -q '/sitemap.xml' && echo "$BODY" | grep -q '/llms.txt' \
    && ok "404 body points to sitemap + llms.txt" \
    || bad "404 body missing recovery links (may be pre-deploy)"

  # 5. Privacy page is reachable.
  PCODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/privacy")
  [ "$PCODE" = "200" ] && ok "/privacy returns 200" \
    || bad "/privacy returned $PCODE (may be pre-deploy)"

  # 2. Markdown negotiation — KNOWN LIMITATION on GitHub Pages (see MARKDOWN-NEGOTIATION.md).
  VARY=$(curl -sI -H "Accept: text/markdown" "$BASE_URL/" | grep -i '^vary:' | tr -d '\r')
  echo "$VARY" | grep -qi 'accept[^-]' \
    && ok "Vary includes Accept ($VARY)" \
    || skip "Vary lacks Accept — blocked by GitHub Pages, see MARKDOWN-NEGOTIATION.md"
fi

echo ""
printf "== %d passed, %d failed, %d skipped ==\n" "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
