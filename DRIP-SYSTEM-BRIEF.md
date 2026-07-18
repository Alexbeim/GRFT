# Graffiti Wall — Drip System Brief

A drip is a small trail of paint that runs down the wall after a spot has
been sprayed. This doc describes the *behavior* we want — not exact numbers,
those are up to you to tune once it's running.

## Core rules

1. **Accumulation comes from a section, not a single point.** Track wetness
   over a small *area* of the wall (a grid of small cells, not per-pixel).
   Once a section crosses a threshold, it can drip. This also sets the
   drip's starting width — see #8.

2. **Drip marks are permanent.** Once a drip is painted onto the wall, it's
   part of the same paint layer as everything else — it doesn't fade on its
   own or disappear after some time.

3. **Wet spots dry out over time.** If the user stops painting a spot, its
   accumulated wetness should fade. Otherwise a spot painted once stays
   primed forever, and returning to it minutes later behaves like it's still
   fresh. (This is about the *invisible* wetness tracking that decides when
   a new drip can spawn — separate from #2, which is about the drip marks
   themselves once they exist.)

4. **Slower movement = more likely to drip.** Dwelling on a spot should
   raise drip probability. Fast strokes should rarely drip at all.

5. **One drip resets that spot's saturation.** The moment a spot actually
   drips, knock its wetness back down. Otherwise a single saturated spot
   chain-fires a cluster of drips at once instead of just one.

6. **Cap pressure gates the *rate* of accumulation, not whether a drip can
   happen.** Light pressure = slow buildup = rarely enough to cross the
   threshold in normal use. But if a spot has genuinely accumulated enough
   (from dwelling, or from earlier heavy passes), a drip should still be
   able to happen even under light current pressure.

7. **Drips fall straight down.** No need to wander side to side — keep it
   simple. (A tiny bit of randomness in the fall, below, is enough to avoid
   looking mechanical.)

8. **A drip's shape follows its paint budget, start to finish:**
   - **starts wide** — as wide as the wet section it drew from (#1), not a
     thin pinpoint
   - **thins as it falls**, narrowing as the budget depletes
   - **ends on a small blob, not a point** — even as it runs out, a little
     extra paint still collects at the very tip before the drip stops, the
     same reason it *slows down* rather than cutting off abruptly. Motion
     and shape should ease together, driven by the same "paint remaining"
     value — not fade to nothing or end in a sharp taper.

9. **Drip width (both the wide start and the end blob) stays in a
   consistent, capped range** across all brush sizes. Don't let a giant
   brush spawn a giant drip and a tiny brush spawn a tiny one — but don't
   force literally identical sizes either, since that looks wrong at the
   extremes. A narrow, capped range across all brush sizes.

## Rendering

- **Drips need hard, well-defined edges** — even if the main spray/paint is
  soft or fuzzy, a drip is a coherent blob of wet paint, not mist. A blurry
  drip reads as a bug, not paint.
- **Small random variation per drip** — slightly different fall speed,
  thickness, and spawn position. Identical drips in a row look stamped.
- **Color locks in at spawn.** If the wall's paint color changes after a
  drip starts falling, that drip keeps its original color.

## Guardrails

- **Define wall-bottom behavior.** A drip that reaches the bottom of the
  paintable area should just stop *falling* there — the mark it already
  painted stays (see #2), it just stops simulating further instead of
  running forever.
- **Cap the max number of active drips at once.** This is a live
  installation running all day — needs a hard performance ceiling, not just
  a nice-to-have.

## Reference

We already have a tuned, working version of almost exactly this system:
`paint-engine.js` (GRFT+ website) plus a full algorithmic spec with exact
formulas and constants in `UNITY-DRIP-SPEC.md`. Worth handing the coder that
spec alongside this brief, even on a different tech stack — saves
re-deriving tuning that's already dialed in.
