#!/usr/bin/env bash
# Convert downloaded Vimeo masters to web-optimized MP4 (H.264) + WebM (VP9), no audio.
# Output: vid/<slug>.mp4 and vid/<slug>.webm
set -u
cd "$(dirname "$0")/.."

# slug|source filename (in vimeo/)
MAP=(
  "ana-animefest-la|ANA-Animefest-LA.mp4"
  "artistexposition-japan|artist_exhibition_in_japan (1080p).mp4"
  "designercon2024|designercon_2024 (1080p).mp4"
  "designercon-3d-models|designercon_2024_(3d_model_graffiti_+_ar_experience) (1080p).mp4"
  "disney-comiccon-toronto|disney_daredevil_at_comiccon_toronto_2025 (1080p).mp4"
  "espolon-la|espolon_la (1080p).mp4"
  "f1-las-vegas-grand-prix|formula_1_las_vegas_grand_prix_2025 (1080p).mp4"
  "ganga-tattoo-spain|ganga_tattoo_academy (1080p).mp4"
  "hyundai-seoul|hyundai_3d_graffiti_wall_at_seoul_mobility_show (1080p).mp4"
  "jabil-ofc-la|jabil_led_graffiti (1080p).mp4"
  "led-reel|graffiti+_led_screen (1080p).mp4"
  "modelo-rolling-loud-miami|modelo_at_rolling_loud_miami_2024 (1080p).mp4"
  "modelo-rolling-loud-miami-timelapse|modelo_at_rolling_loud_miami_2024_-_artist_timelapse (1080p).mp4"
  "nascar-daytona|nascar_daytona_500_2026 (1080p).mp4"
  "outloud-festival-2024|outloud_festival_2024_in_macau (1080p).mp4"
  "porsche-vancouver|porsche_75th_x_graffiti+ (1080p).mp4"
  "samsung-galaxy-z-flip-7-launch-nyc|samsung_nyc (1080p).mp4"
  "samsung-olympics|samsung_olympics_milan_2026 (1080p).mp4"
  "samsung-galaxy-z-flip-7-launch-paris|samsung_paris (1080p).mp4"
  "shift-midtown-nyc|shift_-_full_wall_front_projection_digital_graffiti (1080p).mp4"
  "williams-racing-formula1|williams_racing_-_formula_1_grand_prix_austin_2023 (1080p).mp4"
  "graffiti-workshop-vancouver|graffiti_plus (720p).mp4"
  "lululemon-vancouver|lululemon (1080p).mp4"
  "miss-dior-nyc|miss_dior_reel,_nyc (540p).mp4"
  "mattel-la|mattel_80th_anniversary_celebration (1080p).mp4"
  "netflix-custom-assets|graffiti_wall_demo__netflix (1080p).mp4"
  "nike-san-francisco|nike,_jordan_brand_pop-up_experience_for_nba_all-star_weekend (1080p).mp4"
  "nike-san-francisco-3d|nike,_jordan_brand_pop-up_experience_for_nba_all-star_weekend_(3d_demo) (1080p).mp4"
  "train-bombing-vancouver|graffiti+_train_bombing (1080p).mp4"
  "veecon-starry|veecon_2023_graffiti+_and_starry (1080p).mp4"
  "urbanbreak|urban_break (1080p).mp4"
  "modelo-nacs|modelo_@_nacs_v2 (1080p).mp4"
)

total=${#MAP[@]}
i=0
for entry in "${MAP[@]}"; do
  i=$((i+1))
  slug="${entry%%|*}"
  src="vimeo/${entry#*|}"
  mp4="vid/${slug}.mp4"
  webm="vid/${slug}.webm"

  if [ ! -f "$src" ]; then
    echo "[$i/$total] MISSING SOURCE: $src" >&2
    continue
  fi

  echo "[$i/$total] $slug"

  if [ ! -f "$mp4" ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$src" \
      -vf "scale='min(1440,iw)':'-2'" \
      -c:v libx264 -crf 28 -preset slow -profile:v high -pix_fmt yuv420p \
      -maxrate 2200k -bufsize 4400k \
      -movflags +faststart -an "$mp4"
    echo "  mp4 done: $(du -h "$mp4" | cut -f1)"
  else
    echo "  mp4 cached"
  fi

  # WebM disabled: VP9 outputs were larger than the H.264 MP4 for this content.
done

echo "ALL DONE"
