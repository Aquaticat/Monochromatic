# Music player Android app

Android music-player client implemented with Jetpack Compose and the shared native Rust audio engine.
Build,
test,
and lint commands are defined in `mise.toml`.

## Page-control default

Chromium-like tabs are the first-install page-control style.
Their labels use `10dp` inline padding on each side,
half the earlier `20dp` inset.
Persisted style integers retain their stable mapping,
and unknown values still fall back to radio controls.
Each style has one centralized `includedInBuild` toggle on its enum line in `PageControlStyle.kt`.
Settings lists only included styles,
and disabled persisted selections resolve safely without renumbering values.
`../../../doc/runbook/music-player-page-control-styles.md` documents matching Android and desktop changes.

## Custom control sizing

A requested minimum control size applies to both the visible control face and its owned layout target unless the
requirement explicitly says touch-target-only.
Transparent hit padding does not satisfy a requested visible minimum.

Custom interactive Compose controls reserve at least `48dp` by `48dp` inside layout.
Do not rely on Compose expanding touch targets outside undersized bounds,
because adjacent expanded targets can overlap.

## Full-width wrapped LED plate

Super fun LED segmented buttons use one connected machined backplate even when controls wrap.
Compose packs content-width caps into rows,
but one rounded plate always fills the complete available width and combined row height.
Unused row width remains plate material rather than becoming control width or a separate row island.
In light mode,
the `#f7f8fa` plate remains visibly lighter than the `#eceef1` page ground.
Cap end-corner ownership still follows each packed row,
and `placeRelative` preserves cap order in RTL.
LED legends use `MaterialTheme.typography.bodyLarge`,
matching ordinary body labels such as Volume while retaining semibold weight.
Active-cap legend text is always white,
independent of runtime accent or ambient scene.
Every application color operation uses OKLCH,
including Chromium colors and alpha changes outside LED controls.
The selected fill remains dark enough to contrast clearly with its white legend,
even when the runtime Material accent is very light.
Independent OKLCH lightness and chroma mixing retains most available accent chroma,
keeping the selected background vibrant instead of muddy.
