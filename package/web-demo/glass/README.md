# @monochromatic-dev/web-demo-glass

Glass corridor demo:
walk forward at constant speed,
throw balls,
crack and then shatter physically staged glass panes
on the three.js WebGPU renderer
(automatic WebGL2 fallback).

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
2.  The two-stage break.
    The pane cracks and holds for a beat
    (or until a second hit),
    then the web collapses into shards cut along the exact crack lines,
    because the same cells drive both the crack texture and the debris.
3.  Real dynamics.
    Earth gravity,
    ball momentum transfer falling off with distance from the impact,
    floor bounce with restitution and friction,
    shards settling flat and persisting on the floor.
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

- `src/client/fracture.ts`:
  pure impact-centered Voronoi math
  (polar seeds, half-plane clipping).
- `src/client/prism.ts`:
  pure convex-cell to prism-mesh arrays.
- `src/client/physics.ts`:
  pure ball flight, shard ground contact, pane-plane sweep test.
- `src/client/shard-launch.ts`:
  pure shard launch velocities and spin.
- `src/client/crack-texture.ts`:
  paints the fracture cells as the crack-web canvas.
- `src/client/pane-model.ts`, `pane-assembly.ts`, `pane-strike.ts`, `pane.ts`:
  pane tuning and types,
  assembly from shared unit geometry,
  the crack stage,
  and the spawn/collapse/recycle system.
- `src/client/debris.ts`, `shard-alloc.ts`:
  the batched shard pool and its slot allocator.
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
