# Compose can expand an undersized touch target outside its layout bounds

## Symptom

A custom Chromium-like page tab used a `41dp` layout box to preserve Chromium's
`35dp` tab plus `6dp` strip inset.
The tab was selectable,
but adjacent tabs and wrapped rows were laid out only `41dp` apart vertically.

Compose expanded the interactive bounds to Android's `48dp` minimum outside the
layout box.
That met the target dimension in isolation,
but the expanded regions could overlap adjacent controls.

An immediate ADB screenshot after selecting the tab also showed the old visual state.
A later capture,
taken only after the accessibility tree reported the intended selected state,
showed the active contour.

## Root cause

Android's current Compose accessibility guidance requires each interactive element
to have a minimum size of `48dp`.
Material components usually enforce that size internally,
but custom interactive elements must reserve it themselves.

The same guidance says Compose expands an undersized clickable composable's touch
target outside its boundaries.
It explicitly recommends using `sizeIn(minWidth = 48.dp, minHeight = 48.dp)` to avoid
overlap between adjacent expanded touch areas.

The affected component used Foundation `selectable` on a custom `Box` with an exact
height of `41.dp`.
It relied on implicit expansion rather than reserving the target in layout.

The Pixel 6 used an override density of `356dpi`,
which is `2.225` physical pixels per `dp`.
Before the explicit fix,
UI Automator reported the selected tab as `107px` tall,
which is approximately `48.1dp`.
This proved implicit touch expansion was active even though the source layout was
only `41dp` tall.

## Fix

Reserve Android's target inside each custom tab's layout and make the visible
face itself at least `48dp` tall.
Transparent target padding does not satisfy a visible-size requirement.
Scale Chromium's source contour ratios from its `35dp` source height onto the
Android face while preserving the source-derived `6dp` strip inset:

```kotlin
// package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt
private val chromiumTabVisibleHeight: Dp = 48.dp
private val chromiumTabStripInset: Dp = 6.dp
private val chromiumTabShoulder: Dp = chromiumTabVisibleHeight * 12f / 35f

Box(
    modifier = Modifier
        .widthIn(min = chromiumTabVisibleHeight, max = options.maximumWidth)
        .width(IntrinsicSize.Max)
        .height(chromiumTabVisibleHeight + chromiumTabStripInset)
        .selectable(/* ... */),
) {
    Box(
        modifier = Modifier
            .align(Alignment.TopStart)
            .offset(y = chromiumTabStripInset)
            .height(chromiumTabVisibleHeight),
    ) {
        // Visible Chromium tab.
    }
}
```

The outer box owns semantics,
selection,
and a `54dp` layout target.
The inner box is visibly `48dp` tall after the `6dp` strip inset.
Top-corner and shoulder geometry retain Chromium's `10:35` and `12:35` source
ratios.
Visual feet still draw outside horizontal content bounds,
but the target does not depend on paint overflow.

## Verification

Run the host checks:

```sh
mise run //package/music-player/android-app:build:release
mise run //package/music-player/android-app:lint
mise run //package/music-player/android-app:lint:detekt
mise run //package/music-player/android-app:test:unit
```

Install only on the intended device,
then inspect layout bounds:

```sh
adb -s 1C171FDF600KWW install -r \
  package/music-player/android-app/app/build/outputs/apk/release/app-release.apk
adb -s 1C171FDF600KWW shell uiautomator dump /sdcard/music-player.xml
adb -s 1C171FDF600KWW exec-out cat /sdcard/music-player.xml
```

Before visible enlargement,
the Pixel 6 at `356dpi` reported the first row as `107px` tall,
approximately `48.1dp`,
only because Compose expanded the undersized target.

After the final fix,
UI Automator reported the first tab target at `[64,878][247,998]`.
Its `120px` height is approximately `53.9dp`,
which contains the `6dp` strip inset plus the visibly `48dp` tab.
The visible path region measured approximately `106px`,
or `47.6dp` after pixel rounding.
The next wrapped row starts at `y=998`,
so target rows meet without overlap.
The final screenshot was captured only after the UI tree reported
`selected="true"` for the same target bounds.

## Sources

- [Android Compose API defaults][compose-defaults] states that interactive elements
  need a `48dp` minimum and warns that implicit expansion can overlap adjacent targets.
- [Make apps more accessible][android-accessibility] recommends a touch target of at
  least `48dp` by `48dp` and says custom interactive elements must set it themselves.

[compose-defaults]: https://developer.android.com/develop/ui/compose/accessibility/api-defaults#minimum-target-sizes
[android-accessibility]: https://developer.android.com/guide/topics/ui/accessibility/apps#large-controls
