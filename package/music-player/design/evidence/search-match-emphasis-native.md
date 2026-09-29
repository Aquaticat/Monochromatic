# Accent-derived Search match emphasis on the disposable Fold

## User correction and design boundary

The user asked to see every `cam` match,
including `Cam`,
highlighted **in place** before choosing Search result membership or
ordering.
The initial debug implementation painted bold matching letters on
Material `tertiaryContainer`;
on the measured Fold wallpaper this was purple.
The user rejected that hue and directed a color from the selected theme,
adjusted in OKLCH.
The first purple captures remain private scratch evidence,
not a published review direction.
D59 records the corrected visual requirement;
it does not choose Scope D/P,
Order M/F/T,
a matching algorithm or result activation.

## Source and provenance

A3 identifies the OS accent as the shared theme source.
The debug-only `SearchFixtureHighlights.kt` in prototype commit
`b471ec537` takes `MaterialTheme.colorScheme.primary` from the active
candidate theme,
then calls the existing production color utility
`mixOklchWithNeutral` in
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/OklchColor.kt`.
For the light scene,
the prototype mixes OKLCH lightness 0.72 of the way to white and chroma
0.55 toward neutral;
for the dark scene,
lightness mixes 0.62 toward black and chroma 0.35 toward neutral.
These are **prototype blend fractions**,
not fixed RGB swatches or a decision about every wallpaper accent.
`SpanStyle` paints the returned fill behind each non-overlapping literal
query occurrence with bold `onSurface` ink.
Other characters retain their ordinary title or supporting-text style.
The unchanged source text stays in one result text node;
`Cam` within `Camellia` is emphasized in titles and in matching
parent-folder detail.
`Another Xronixle` receives no title highlight,
but its supporting `Track · Camellia` text does.
The upper-left browser is not a Search result and is unchanged.

The color-corrected debug-only APK on the disposable
`Fold_No_Hardware_Probe` hashed to SHA-256
`7195af99031158bfb8efce2abab3c98ebaf17928739c290010bc6dea1317244f`.
The installed `base.apk` independently matched the local build.
The native inner display was 2076 × 2152 physical px,
the cover 1080 × 2424,
at 390dpi.
All published captures are keyboard-closed;
there was no new Gboard or debug-IME experiment.
The [inner light 200% selected result][inner-light],
[inner dark 200% selected result][inner-dark],
[cover light 200% selected result][cover-light] and
[cover dark 200% selected result][cover-dark]
show the actual theme-derived highlight under both app schemes.
Equivalent 100% frames and the complete two-scope by three-order
200% matrix are in `questions/render/` with the
`search-selected-accent-review-` and
`search-rank-accent-review-` prefixes.
The [inner parent-only scrolled result][inner-parent] and
[cover tracks-first parent-only scrolled result][cover-parent]
show a parent-name highlight alongside the other matching titles.
The [separate membership/order review][ranking-review]
embeds only these corrected sanitized captures.

## Bounded after-state checks

At 200% text on the measured light scheme,
the highlight fill sample was RGB `(198, 208, 231)` and solid ink
`(48, 50, 58)`;
the WCAG relative-luminance ratio of those sampled pixels was `8.26:1`.
On the measured dark scheme,
fill RGB `(42, 49, 69)` and solid ink `(228, 229, 240)` yielded
`10.32:1`.
The same two sampled pairs appeared on both measured panels.
The in-place background and bold ink provide separate visible cues;
those samples do **not** certify every antialiased edge,
wallpaper accent or font size.

The UI Automator title start still matched the query start at x `1249`
inner and x `156` cover at 100% and 200% text.
In the same 200% light-scheme captures,
a pixel comparison against the earlier aligned-but-unhighlighted APK
found mean difference `0` over the left player pane below status and
`0` over the cover Search header;
right-side result regions had nonzero differences.
That positive control demonstrates the probe could see the new match paint
without attributing a global page change to it.
The selected A browser and complete deck remain present;
D58's shared columns remain measured,
not inferred from source alone.

The new ranking matrix's private UI Automator hierarchies still exposed
the same ordered title/detail pairs across initial and scrolled frames.
A first cover M/P or T/P swipe left the last supporting line clipped
despite bounds ending before the gesture indicator.
The corrected published scrolled frames follow a second swipe and show
full 182px and 91px lines before that indicator.
The verifier rejected both a swapped expected order and the private
one-swipe clipped detail as positive controls.
This checks fixed fixture order and bounded terminal visibility after
bolding,
not a live ranking algorithm,
scroll restoration,
result action or accessibility.
Sanitization verified each published screenshot has the full status region
replaced by its generic same-panel reference,
identical app pixels below status,
and no PNG metadata.
Raw status-bearing images and hierarchy XML stayed in private scratch.
The host-JVM package task
`mise run //package/music-player/android-app:test:unit` passed with the
debug-only variant tests from prototype commits `12cc19d64` and
`ba9cc6e38` (`app/src/testDebug/`, not shared release tests):
repeated `Cam cam CAM` spans,
parent-only supporting context,
empty/nonmatching queries,
and distinct fills for different theme accents and light/dark scenes.
The tests cover range construction,
not a deployed Search index or rendered accessibility semantics.

## Still open

The fixture displays only the prefilled literal query `cam`.
Its case-insensitive range search is a **visual study helper**,
not a settled rule for Unicode casefolding,
tokens,
path ancestry,
repeated overlapping patterns or query lifecycle.
The existing D56/D57 keyboard overlap captures predate both D58 and D59;
they remain bounded keyboard evidence,
not proof that highlighted rows remain readable with a keyboard.
Other OS accent seeds and scale-dependent paint contrast are untested.
The match spans do not create a click handler.
Scope D/P,
Order M/F/T and #127 through #129 are still separate open design questions.

[inner-light]: ../questions/render/search-selected-accent-review-inner-results-light-s200.png
[inner-dark]: ../questions/render/search-selected-accent-review-inner-results-dark-s200.png
[cover-light]: ../questions/render/search-selected-accent-review-cover-results-light-s200.png
[cover-dark]: ../questions/render/search-selected-accent-review-cover-results-dark-s200.png
[inner-parent]: ../questions/render/search-rank-accent-review-inner-rankmixed-parenthits-end-s200.png
[cover-parent]: ../questions/render/search-rank-accent-review-cover-ranktracks-parenthits-end-s200.png
[ranking-review]: ../questions/ranking-review.html
