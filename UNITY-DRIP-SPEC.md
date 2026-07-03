# GRFT+ Spray Drip System — Unity Implementation Spec

**Version 1.0 · 2026-07-03 · spray can only (no mop/marker)**

Reference implementation: `paint-engine.js` + `test-drip-system.html` in this repo.
Open `test-drip-system.html` on a local server to feel the target behavior — the
shipped defaults there ARE the approved look. This spec freezes that tuning.
The rig's "Copy config" button exports the same resolved values as JSON.

---

## 1. Design intent

Spray paint on a wall drips when paint pools — not everywhere, and not constantly.
The approved feel:

- **Normal-speed strokes almost never drip.** Clean writing stays clean.
- **Dwelling or moving slowly makes drips likely.** Holding the can on one spot
  pools paint and produces a few thin drips.
- **Drips are thin, short, and subtle.** They fall gently, slow down as they run
  out of paint, and settle into a tiny bead — never a hard visual "pop-off."
- **Drips are always crisp** (hard-edged, opaque), while the spray paint itself
  is soft/fuzzy. These are deliberately different materials: mist vs. wet bead.
- **Drip size changes continuously** — no visible steps as a drip thins.

## 2. Architecture: 2 layers

**Layer 1 — six designer knobs** (the only runtime controls to expose):

| Knob | Range | Default | Feel |
|---|---|---|---|
| `amount` | 0–3 | **1.0** | how many drips spawn overall |
| `accumulation` | 0–3 | **1.0** | how fast a spot becomes "wet enough" |
| `slowDripBoost` | 0–3 | **3.0** | how strongly slow painting raises drip probability (0 = off) |
| `runLength` | 0–3 | **1.0** | how far drips travel before drying |
| `thickness` | 0–3 | **1.0** | drip width |
| `wildness` | 0–3 | **1.0** | sideways wander + sway |

**Layer 2 — frozen internal constants** (§4). All defaults at knob values above
reproduce the approved behavior exactly. Knob → constant mapping is in §5.

## 3. Units, coordinates, scaling

- Reference space: **wall-texture pixels**, +y is DOWN (screen space).
  The reference rig runs at roughly 1000–1600 px wall width with **brush
  diameter D ≈ 22 px** (D is an input; drip thickness scales with D).
- All other absolute constants (cell size, gravity, velocities, jitter, sway)
  are in reference pixels. **If your wall texture is at a different scale,
  multiply every absolute px constant by the same factor** (e.g. wall texture
  2× denser → cell 24 px, gravity 340 px/s², etc.). Ratios are what matter.
- Time: seconds. All formulas below are frame-rate independent.

## 4. Frozen constants (at default knobs)

| Constant | Value | Notes |
|---|---|---|
| `CELL_SIZE` | 12 px | wetness grid resolution |
| `WETNESS_PER_STAMP` | 0.3242 | added to the cell under each stamp |
| `WETNESS_THRESHOLD` | 0.1908 | cell must reach this before it can drip |
| `WETNESS_RETAIN_PER_SEC` | 0.25 | grid decay: `w *= 0.25^dt` (paint dries) |
| `WETNESS_RELEASE` | 0.3 | on spawn: `w = min(w, THRESHOLD) * 0.3` |
| `SPAWN_PROB` | 2.73e-5 | flat per-stamp probability once above threshold |
| `SPEED_REF` | 0.5 px/ms | pen speed that counts as "normal" (×1) |
| `SPEED_BOOST_MAX` | 8.0 | probability multiplier cap when barely moving |
| `SPEED_BOOST_MIN` | 0.05 | probability multiplier floor when fast |
| `GRAVITY` | 170 px/s² | |
| `DRAG` | `vy *= exp(-0.907·dt)` | reference impl: `vy *= 0.985^(60·dt)` — same |
| `INIT_VY` | 4 px/s | × rand(0.7–1.3) |
| `INIT_PAINT` | 0.54 | drip's paint budget, × rand(0.7–1.3) |
| `PAINT_DRAIN` | 2.85 /s | linear: `paint -= 2.85·dt` |
| `END_SLOWDOWN` | 0.5 | paint level below which motion eases out (§7) |
| `INIT_THICK_FRAC` | 0.0613 | drip thickness = D × frac × rand(0.8–1.2) |
| `MIN_THICK_FRAC` | 0.0245 | floor on thickness as it thins |
| `THICK_DECAY` | `t *= (1 − 0.3·dt)` | floored at min thickness |
| `TRAIL_SPACING` | 0.18 × thickness | dab spacing along the fall path (min 0.5 px) |
| `SPAWN_JITTER_X` | ±3 px | uniform |
| `WANDER_CHANCE` | 0.0832 | fraction of drips with any lateral motion |
| `DRIFT_MAX` | 0.756 px/s | constant sideways velocity, random sign |
| `SWAY_AMP_MAX` | 1.06 px | sinusoidal sway amplitude |
| `SWAY_FREQ` | 0.25–0.65 Hz | uniform |
| `STAMP_SPACING` | 0.06 × D | brush stamps along the stroke path |
| `HOLD_EMIT_RATE` | 60 stamps/s | while spraying without moving |
| `KILL_MARGIN` | 40 px | below wall bottom |
| `PAINT_SOFTNESS` | 0.88 | spray stamp edge softness (§9), 1 = fully fuzzy |

## 5. Knob → constant mapping

Applied to the §4 defaults (`base`). Knob = default ⇒ multiplier = 1 exactly.

```
amount        a: SPAWN_PROB        = base × a^1.6
accumulation  c: WETNESS_PER_STAMP = base × max(0.15, c^1.3)
                 WETNESS_THRESHOLD = base / max(0.15, c)
slowDripBoost b: enabled           = (b > 0)
                 SPEED_BOOST_MAX   = 2^b            // b=3 → 8
                 SPEED_BOOST_MIN   = clamp(0.1^b, 0.05, 1)
runLength     r: INIT_PAINT        = base × max(0.05, r)
                 PAINT_DRAIN       = base / max(0.2, r)
thickness     t: INIT_THICK_FRAC   = base × max(0.1, t)
                 MIN_THICK_FRAC    = base × max(0.1, t)
wildness      w: WANDER_CHANCE     = base × w
                 DRIFT_MAX         = base × w
                 SWAY_AMP_MAX      = base × w
```

## 6. Emission + spawn (per stamp)

**Emission.** While spraying:
- Moving: stamp every `max(1, 0.06·D)` px along the interpolated path from the
  previous nozzle position to the current one.
- Not moving: keep emitting ~60 stamps/s at the nozzle. **Time-based emission is
  required** — a held, motionless can must pool paint and drip.

**Pen speed.** Track px/ms between stamps, refreshed only when ≥4 ms of real
time has passed since the last measurement (burst stamps inside one frame reuse
the previous value). Before the first measurement of a stroke: neutral (×1).

**Wetness field.** One float per 12 px cell, covering the paintable surface.
Decay the whole field by `w *= WETNESS_RETAIN_PER_SEC^dt` (lazily on stamp or
per-frame — equivalent). **The field must track surface size** — if the render
target resizes, re-dimension it (a bug we hit: stamps landing outside a
stale-sized grid silently kill all dripping).

**Spawn roll, per stamp at (x, y):**

```
cell = grid[floor(x/12), floor(y/12)]
cell.w += WETNESS_PER_STAMP
if cell.w < WETNESS_THRESHOLD: return            // not wet enough yet

speedMult = 1
if slowDripBoost on AND penSpeed measured:
    speedMult = clamp(SPEED_REF / max(0.05, penPxPerMs),
                      SPEED_BOOST_MIN, SPEED_BOOST_MAX)

if random() < SPAWN_PROB × speedMult:
    cell.w = min(cell.w, WETNESS_THRESHOLD) × WETNESS_RELEASE   // drip carries the puddle away
    spawnDrip(x + rand(-3, 3), y)
```

Reference probabilities (defaults) for unit tests:

| Pen speed | speedMult | per-stamp spawn prob |
|---|---|---|
| held / ≤0.0625 px/ms | 8.0 (cap) | 2.18e-4 |
| 0.1 px/ms | 5.0 | 1.37e-4 |
| 0.5 px/ms (normal) | 1.0 | 2.73e-5 |
| 2 px/ms | 0.25 | 6.8e-6 |
| ≥10 px/ms | 0.05 (floor) | 1.4e-6 |

Yes — these are intentionally tiny. Drips are rare accents; the dwell boost is
what makes them appear where a hand lingers.

## 7. Drip simulation (per drip, per frame)

**State at spawn** (each `rand` sampled once, per drip — this randomness is a
drip's permanent "character," never re-rolled):

```
x = baseX = spawnX;  y = spawnY;  age = 0
vy        = INIT_VY × rand(0.7, 1.3)
paint     = INIT_PAINT × rand(0.7, 1.3)
thickness = D × INIT_THICK_FRAC × rand(0.8, 1.2)
minThick  = D × MIN_THICK_FRAC
wanderer  = rand() < WANDER_CHANCE
if wanderer: 70% chance → vx = rand(-DRIFT_MAX, DRIFT_MAX)   (else 0)
             70% chance → swayAmp  = rand(0, SWAY_AMP_MAX),
                          swayFreq = rand(0.25, 0.65),
                          swayPhase = rand(0, 2π)             (else no sway)
```

**Update (dt seconds).** Constants marked "live" in §10 must be re-read from
the current knob-derived values every frame, not cached at spawn:

```
vy += GRAVITY·dt
vy *= exp(-0.907·dt)

// End-of-life ease: as paint runs out, the drip decelerates smoothly and
// settles into a bead instead of dying mid-fall. Scales DISPLACEMENT only.
life = 1
if paint < END_SLOWDOWN:
    f = max(0, paint / END_SLOWDOWN)
    life = f·f·(3 − 2·f)                         // smoothstep

age  += dt
baseX += vx·dt·life
newX  = baseX + swayAmp·life·sin(2π·swayFreq·age + swayPhase)
newY  = y + vy·dt·life

// Render the trail segment (x,y)→(newX,newY): opaque hard-edged discs of
// radius thickness/2, spaced max(0.5, 0.18·thickness) apart along it.

x = newX;  y = newY
paint     -= PAINT_DRAIN·dt
thickness *= max(0, 1 − 0.3·dt);  thickness = max(thickness, minThick)

if paint ≤ 0 or y > wallBottom + 40: destroy
```

Drips keep simulating after the player stops spraying, until all are dead.

At default knobs a drip lives ~0.13–0.25 s and travels only a few px — a short
dribble easing into a bead. `runLength` extends this quadratically-ish (more
paint AND slower drain), so verify against the rig at 1.0 before judging.

## 8. Drip rendering rules (non-negotiable)

1. **Hard edges, always.** Fully opaque fill, exact circle, only the renderer's
   natural ~1 px antialiasing. Never the spray stamp's soft gradient or grain.
2. **Continuous size.** Draw at the exact float thickness each frame. Do not
   snap to a texture-atlas bucket — visible stepping while shrinking was an
   explicit defect we fixed.
3. Dense trail spacing (0.18 × thickness) so the trail reads as one solid
   stream with straight edges, not a chain of circles.
4. Drips draw into the same paint surface (they are paint) — a fresh opaque dab
   over older semi-transparent paint showing a seam is correct and accepted.

## 9. Spray stamp rendering (visual reference)

Match this look; the exact algorithm is up to you. Radial-gradient disc of
diameter = brush size, at softness 0.88 the alpha stops are:

| position (0=center → 1=edge) | alpha |
|---|---|
| 0.00 | 0.60 |
| 0.40 | 0.26 |
| 0.77 | 0.08 |
| 1.00 | 0.00 |

plus fine per-stamp speckle/grain (~0.5 · r² specks, denser toward center,
sizes ~0.35–1.25 px, alpha ~0.05–0.21) and ±8% random center offset. Softness
is a designer control 0–1: 1 = the original fully-fuzzy anchor, 0 = tightest
allowed (solid core to ~80% radius, short feather) — **never a hard vector
edge on paint**; only drips are hard.

## 10. Live-tunability requirement

Knob changes must affect **drips already falling**, not just new ones:
`GRAVITY`, drag, `PAINT_DRAIN`, `THICK_DECAY`, `TRAIL_SPACING`, `END_SLOWDOWN`,
`minThick` are read live every frame. Spawn-time randomness (initial vy/paint/
thickness rolls, wander character) stays fixed per drip — re-rolling mid-flight
visibly pops.

## 11. Acceptance checks

1. **Fast stroke stays clean:** 1000 stamps at ≥2 px/ms → expect ~0 drips
   (p ≈ 6.8e-6 each).
2. **Dwell drips:** hold 5 s (~300 stamps) with `amount` = 3 → expect ~2–6
   drips (p ≈ 1.6e-3 each); at `amount` = 1 drips are rare by design.
3. **Wetness math:** one stamp puts a cell at 0.3242 (≥ threshold immediately
   at defaults); after 1 s untouched it holds 0.081 (×0.25); the stamp after a
   spawn sees `min(w, 0.1908)×0.3 ≤ 0.057`.
4. **Ease-out:** log per-frame Δy of one drip; the last frames must approach 0
   smoothly (reference measured …0.06, 0.04, 0.02, 0.01, 0 px/frame), never
   ending at peak velocity.
5. **Side-by-side:** run the rig with identical input; `GraffitiPaint._internal
   .stepDrips(dtMs)` steps the reference deterministically frame-by-frame for
   direct comparison (randomness aside, trajectories/lifetimes should match).

## 12. Reference config (resolved, knobs at defaults)

```json
{
  "cellSizePx": 12,
  "wetnessPerStamp": 0.3242,
  "spawnThreshold": 0.1908,
  "wetnessRetainPerSec": 0.25,
  "wetnessReleaseFactor": 0.3,
  "spawnRate": 0.0000273,
  "speedRefPxPerMs": 0.5,
  "speedBoostMax": 8,
  "speedBoostMin": 0.05,
  "gravity": 170,
  "dragPerFrame60": 0.985,
  "initialVelocity": 4,
  "initialWetness": 0.54,
  "wetnessDrainPerFrame60": 0.0475,
  "endSlowdown": 0.5,
  "initialThicknessFrac": 0.0613,
  "minThicknessFrac": 0.0245,
  "thicknessDrainPerFrame60": 0.005,
  "stampSpacingFrac": 0.18,
  "spreadX": 6,
  "wanderChance": 0.0832,
  "vxMax": 0.7563,
  "swayAmpMax": 1.0588,
  "swayFreqMin": 0.25,
  "swayFreqMax": 0.65,
  "paintSoftness": 0.88,
  "brushDiameterReference": 22
}
```

(`*PerFrame60` values are the reference implementation's per-frame-at-60fps
form; §4/§7 give the equivalent per-second math — implement those.)
