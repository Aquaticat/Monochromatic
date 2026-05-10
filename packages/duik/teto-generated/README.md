# @monochromatic-dev/duik-teto-generated

Auto-generated Kasane Teto SV character SVG parts, traced from the official 3-view reference sheet.

Unlike the hand-crafted `duik-teto` package, this one derives all geometry programmatically
through a multi-step image processing pipeline.

## Pipeline

```
reference.jpg → crop → segment → trace → assemble → composite
```

1. **crop**: extract the front view from the 3-view reference sheet using ImageMagick
2. **segment**: generate per-part binary masks via color matching + spatial bounding boxes
3. **trace**: convert masks to SVG paths with potrace (runs in a container)
4. **assemble**: transform traced paths into the 800x1200 viewBox, apply fill colors
5. **composite**: stack all parts in layer order into a single preview SVG

## Usage

Run the full pipeline:

```sh
mise run //packages/duik/teto-generated:generate
```

Or run individual steps:

```sh
mise run //packages/duik/teto-generated:crop
mise run //packages/duik/teto-generated:segment
mise run //packages/duik/teto-generated:trace
mise run //packages/duik/teto-generated:assemble
mise run //packages/duik/teto-generated:composite
mise run //packages/duik/teto-generated:compare
```

## Dependencies

- **ImageMagick** -- color masking, morphological operations, image comparison (host)
- **potrace** -- bitmap-to-SVG tracing (containerized via podman)

The tracer container builds automatically on first run via `prepare:tracer`.

## Tuning

Part definitions live in `src/parts.ts`. Each part specifies:

- **bbox** -- spatial bounding box as fraction of the cropped front view `[x, y, width, height]`
- **colors** -- target RGB colors with Euclidean distance tolerances
- **excludeColors** -- colors to reject even if they match an include color
- **morphClose / morphOpen** -- morphological cleanup kernel sizes
- **fill** -- SVG fill color for the output

Adjust these values and re-run the pipeline to improve extraction quality.

## Output structure

Generated parts go to `parts/` with the same naming convention as `duik-teto`:

- 26 body part SVGs (hair, face, eyes, mouth, torso, arms, legs, boots, skirt)
- `_composite_inline.svg` -- all layers stacked with joint markers
- `_composite.png` -- rasterized preview

Intermediate artifacts in `tmp/` (gitignored):

- `front.png` -- cropped front view
- `masks/*.pgm` -- binary segmentation masks
- `traced/*.svg` -- raw potrace output
- `work/*.pgm` -- intermediate mask processing files

## Reference

Based on the official Kasane Teto SV (Synthesizer V) character design by Sakauchi Waka,
published by TwinDrill.

## License

CC BY-NC-SA 4.0. See `LICENSE`.
