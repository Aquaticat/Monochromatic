# Beachball bounce animation

Proof-of-concept for programmatic animation using [Motion Canvas](https://motioncanvas.io/), a TypeScript library for creating vector animations.
Built to evaluate whether Motion Canvas can replace After Effects for motion graphics work -- specifically around AMD compatibility and resource usage.

## What it does

A striped beachball enters from offscreen left in a high arc, bounces four times with physically-plausible damping, then rolls to a stop.

Each bounce demonstrates:

- **Parabolic arcs** via chained `easeOutQuad` / `easeInQuad` tweens on the Y axis
- **Squash and stretch** on impact, with diminishing intensity per bounce
- **Continuous rotation** that slows as energy dissipates
- **Ground shadow** that scales and fades based on ball height

The ball itself is a circle node with six colored vertical stripes (red, white, blue, white, amber, white) clipped inside it.

## Animation parameters

All physics-like behavior is controlled by constants at the top of `src/scenes/beachball.tsx`:

| Parameter | Default | Purpose |
| --- | --- | --- |
| `BOUNCE_DAMPING` | 0.55 | Energy retained per bounce (affects arc height, distance, and duration) |
| `BOUNCE_COUNT` | 4 | Number of bounces before the rolling phase |
| `SQUASH_SCALE_X` / `Y` | 1.35 / 0.7 | Deformation on impact |
| `ROTATION_SPEED` | 1080 deg/s | Base rotation rate during flight |
| `SHADOW_SCALE_AIR` | 0.5 | Shadow shrinks at peak height |
| `SHADOW_OPACITY_AIR` | 0.1 | Shadow fades at peak height |

## Running

Start the Motion Canvas editor:

```bash
npx vite
```

Open `http://localhost:9000/` and press play to preview.

## Rendering to video

The FFmpeg exporter is configured in `vite.config.ts`.
Open the editor, click the **Render** button, and the output will be written to `./output/`.

FFmpeg is bundled by `@motion-canvas/ffmpeg` -- no system-level install required.

## Vite 8 compatibility

The Motion Canvas vite-plugin declares support for Vite 4-5.
It works with Vite 8 beta with two caveats:

1.  A deprecation warning about esbuild vs oxc (cosmetic, non-blocking).
2.  CJS default exports need manual unwrapping in `vite.config.ts` because Vite 8 changed CJS interop behavior.

## Project structure

```
src/
  project.ts          Motion Canvas project entry point
  scenes/
    beachball.tsx      Animation scene (all logic in one file)
vite.config.ts        Vite + Motion Canvas + FFmpeg plugin config
```
