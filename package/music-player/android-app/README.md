# Music player Android app

Android music-player client implemented with Jetpack Compose and the shared native Rust audio engine.
Build,
test,
and lint commands are defined in `mise.toml`.

## Custom control sizing

A requested minimum control size applies to both the visible control face and its owned layout target unless the
requirement explicitly says touch-target-only.
Transparent hit padding does not satisfy a requested visible minimum.

Custom interactive Compose controls reserve at least `48dp` by `48dp` inside layout.
Do not rely on Compose expanding touch targets outside undersized bounds,
because adjacent expanded targets can overlap.

## Connected wrapped LED plates

Super fun LED segmented buttons use one connected machined backplate even when controls wrap.
Compose packs content-width rows,
then builds one `GenericShape` path from every measured row extent.
Rounded width transitions cross each 8-unit cap-to-cap channel without stacking independent row plates.
Each row still ends at its final content-width control.
RTL mirrors the complete silhouette so shorter rows stay anchored to the physical right edge.
Active-cap legend text is always white,
independent of runtime accent or ambient scene.
