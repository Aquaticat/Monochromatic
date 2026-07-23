# @monochromatic-dev/web-demo-glass

Glass corridor demo:
walk forward at constant speed,
throw balls,
crack and then shatter physically staged glass panes
on the three.js WebGPU renderer
(automatic WebGL2 fallback).

## Status: paused (2026-07-22)

Development is paused.
The demo runs,
passes its gates,
and stages breakage in the Smash Hit mold,
but it still does not feel like real glass.
Recorded problems,
in the maintainer's order:

1.  No momentum calculations.
    The dynamics are tuned heuristics,
    not conservation:
    balls are massless,
    punch-through keeps a fixed speed fraction regardless of how much
    glass broke,
    shard launch speeds are hand-tuned factors
    (`punchTransfer`, `radialBurst`)
    rather than momentum shared between ball and shard mass,
    and balls, shards, and walls never collide with each other.
    Smash Hit ran a real impulse solver with capped impulses;
    this demo fakes the aggregate look of one.
2.  Glass panes aren't thick.
    Panes and shards read paper-thin:
    a single 0.012 m thickness everywhere,
    no visible edge faces at eye level,
    no green edge tint,
    no refraction offset through the sheet,
    so nothing sells mass.
3.  There's only one type of glass.
    One material and one break behavior for every pane.
    Real corridors mix annealed
    (spider web, daggers),
    tempered
    (dices into small cubes),
    laminated
    (web that holds and sags on its interlayer),
    and frosted;
    variety is itself a realism cue.
4.  Further problems the maintainer has seen but not yet named;
    this list is known to be incomplete.

Known gaps already deferred by decision or left unbuilt:

- Audio was explicitly deferred:
  no reverb bus,
  thin procedural synthesis,
  no per-room acoustics.
- The rim collapses in one wave;
  no distance-ordered peeling cascade.
- Shards never re-break,
  and debris interacts only with the floor.
- The crack web is an additive glow texture,
  not refracting crack geometry.
- Manifestation bands vanish with the sheet on the first hit.
- WebGPU-backend visuals were never spot-checked on real hardware;
  all verification ran on the WebGL2 fallback under software
  rendering.

The package lives in `package-paused/`,
outside the `package/*/*` workspace and mise config-root globs,
so no gates run for it
(all were green at pause time).

## What it demonstrates

Breaking glass reads as real through five things this demo stages
explicitly,
in order of importance:

1.  The spider-web crack pattern.
    A strike computes an impact-centered Voronoi fracture:
    seeds on jittered polar rings around the impact,
    shared spoke angles across rings,
    geometric ring growth.
    That gives radial spokes crossed by concentric rings,
    with cells growing with distance,
    which is the pattern humans recognize instantly.
2.  Instant localized breakage,
    the Smash Hit lesson
    ("objects always break where they get hit").
    A strike blasts the cells around the impact out as shards
    immediately and the ball punches through with most of its speed;
    the surviving rim stands as real geometry around a real hole,
    cracked along the same cell lines,
    and collapses on a short hold or the next hit.
    Later balls fly through the hole untouched.
3.  Real dynamics.
    Earth gravity,
    ball momentum transfer falling off with distance from the impact,
    floor bounce with restitution and friction,
    shards settling flat and staying down until they fall behind the
    camera;
    debris never evaporates in view.
4.  Reflections.
    A procedural equirect environment full of bright strips gives the
    transmission glass something to reflect;
    frosted manifestation bands carry head-on visibility,
    where Fresnel reflectance is physically near zero.
5.  One draw call for all debris.
    Every shard lives in a single BatchedMesh with one shared material,
    so nothing compiles pipelines at the impact frame.

Walking into unbroken gate glass smashes through it bodily.

## Layout

- `src/client/fracture.ts`, `fracture-partition.ts`:
  pure impact-centered Voronoi math
  (polar seeds, half-plane clipping),
  and the hole/rim split with point-in-cell tests.
- `src/client/prism.ts`, `rim-mesh.ts`:
  pure convex-cell to prism-mesh arrays,
  and the merged pane-local rim mesh built from them.
- `src/client/physics.ts`:
  pure ball flight, shard ground contact, pane-plane sweep test.
- `src/client/shard-launch.ts`:
  pure shard launch velocities and spin.
- `src/client/crack-texture.ts`:
  paints the fracture cells as the crack-web canvas.
- `src/client/pane-model.ts`, `pane-assembly.ts`, `pane-strike.ts`,
  `pane-rim.ts`, `crack-overlay.ts`, `pane.ts`:
  pane tuning and types,
  assembly from shared unit geometry,
  the instant-hole strike,
  the surviving-rim mesh and crack overlay,
  and the spawn/collapse/recycle system.
- `src/client/debris.ts`, `debris-model.ts`, `shard-alloc.ts`:
  the batched shard pool, its contracts, and its slot allocator.
- `src/client/prewarm.ts`:
  startup pipeline compilation off the first impact frame.
- `src/client/ball.ts`, `ball-sweep.ts`, `ball-tuning.ts`:
  the ball pool and the swept-segment collider.
- `src/client/scene.ts`, `environment-paint.ts`, `corridor.ts`:
  renderer bootstrap,
  procedural environment,
  corridor furniture recycling.
- `src/client/fx.ts`, `audio.ts`:
  spark bursts, camera shake, procedural WebAudio.
- `src/client/main.ts`:
  wiring and the walk loop.
- `src/build.ts`, `src/page.ts`, `src/styles.ts`:
  self-contained HTML generation.

## Commands

```sh
# Build the self-contained demo page at dist/final/index.html
mise run //package/web-demo/glass:build

# Unit tests for the pure math modules
mise run //package/web-demo/glass:test:unit

# Lint
mise run //package/web-demo/glass:lint
```

Open `dist/final/index.html` in any browser;
WebGPU is used when available and WebGL2 otherwise.
Click or tap to throw.

## Verification probe

The page exposes `glassDemoProbe()` on `globalThis`,
returning backend, shattered count, walk position,
and live pane counts,
for automated smoke tests.
