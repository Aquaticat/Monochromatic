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
