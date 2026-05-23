#!/usr/bin/env bash
# Pull missing Vimeo masters using Chrome cookies.
set -u
cd "$(dirname "$0")"

# slug|vimeo_id
ITEMS=(
  "i-light-singapore|889667615"
  "lululemon-vancouver|912783298"
  "miss-dior-nyc|1136588890"
  "mattel-la|1089830515"
  "netflix-custom-assets|1029417276"
  "designercon-ar-characters|1029773323"
  "nike-san-francisco|1065622276"
  "nike-san-francisco-3d|1089826824"
  "train-bombing-vancouver|840607421"
  "veecon-starry|849176817"
  "urbanbreak|989165461"
)

for entry in "${ITEMS[@]}"; do
  slug="${entry%%|*}"
  id="${entry#*|}"
  out="${slug}.mp4"
  if [ -f "$out" ]; then echo "SKIP $slug ($out exists)"; continue; fi
  echo "=== $slug (vimeo $id) ==="
  yt-dlp --cookies-from-browser chrome \
    -f 'best[ext=mp4]/best' \
    -o "$out" \
    --no-progress \
    "https://vimeo.com/${id}" || echo "FAILED $slug"
done
echo "ALL DONE"
