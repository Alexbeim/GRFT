#!/usr/bin/env bash
# Re-encode oversized hero/rentals videos to <2.2 Mbps H.264 MP4, no audio.
# Originals are preserved in videos/_orig.
set -u
cd "$(dirname "$0")"

FILES=(hero.mp4 about.mp4 rentals-led.mp4 rentals-lcd.mp4 rentals-projection.mp4)

for src_in in "${FILES[@]}"; do
  src="_orig/$src_in"
  out="$src_in"
  if [ ! -f "$src" ]; then echo "MISSING: $src"; continue; fi
  echo "=== $src_in"
  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -vf "scale='min(1440,iw)':'-2'" \
    -c:v libx264 -crf 28 -preset slow -profile:v high -pix_fmt yuv420p \
    -maxrate 2200k -bufsize 4400k \
    -movflags +faststart -an "$out"
  echo "  $(du -h "$out" | cut -f1) (was $(du -h "$src" | cut -f1))"
done

# Create about.webm so about.html's first <source> resolves instead of 404ing.
if [ -f about.mp4 ] && [ ! -f about.webm ]; then
  echo "=== about.webm (from re-encoded about.mp4)"
  ffmpeg -hide_banner -loglevel error -y -i about.mp4 \
    -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -threads 8 -deadline good -cpu-used 3 \
    -an about.webm
  echo "  about.webm $(du -h about.webm | cut -f1)"
fi

# Re-encode the heavy rentals webms used by rentals.html.
WEBMS=(rentals-led.webm rentals-lcd.webm rentals-projection.webm)
for w in "${WEBMS[@]}"; do
  base="${w%.webm}.mp4"
  if [ ! -f "$base" ]; then echo "skip $w (need re-encoded $base first)"; continue; fi
  echo "=== $w"
  ffmpeg -hide_banner -loglevel error -y -i "$base" \
    -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -threads 8 -deadline good -cpu-used 3 \
    -an "$w"
  echo "  $(du -h "$w" | cut -f1) (was $(du -h "_orig/$w" | cut -f1))"
done

# Remove stray Vimeo download in this folder (not referenced anywhere).
if [ -f "graffiti+_led_screen_v3 (1080p).mp4" ]; then
  rm "graffiti+_led_screen_v3 (1080p).mp4"
  echo "removed stray graffiti+_led_screen_v3 (1080p).mp4"
fi

echo "DONE"
