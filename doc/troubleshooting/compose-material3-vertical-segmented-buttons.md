# Compose Material 3 1.5.0-alpha27 exposes row-only segmented layout for a vertical large-text control

## Symptom

The music-player mode selector must remain a segmented button at 200% Android text
scale. Four full labels no longer fit in the 414dp pane's horizontal segmented row.
The installed Compose Material 3 API exposes `SingleChoiceSegmentedButtonRow`, but no
vertical segmented wrapper.

There is no compiler diagnostic for the missing orientation. The failed designs are
visible instead:

- Keeping the row at 200% clips or crowds labels.
- Replacing it with radio rows loses the settled segmented-button component.
- Making the row horizontally scrollable contradicts the required purely vertical
  presentation.

## Root cause

The project pins `androidx.compose.material3:material3:1.5.0-alpha27` in
`package/music-player/android-app/app/build.gradle.kts:82`.

AndroidX source commit `4e931c638cc2fca0f2326b9806a09e9f9d511175` defines the
single-choice segmented element only as an extension on a row scope. In
`compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/SegmentedButton.kt:210-219`:

```kotlin
public fun SingleChoiceSegmentedButtonRowScope.SegmentedButton(
    selected: Boolean,
    onClick: () -> Unit,
    shape: Shape,
    modifier: Modifier = Modifier,
```

The supplied group is explicitly a `Row`. The same source at lines 328 to 340 says:

```kotlin
public fun SingleChoiceSegmentedButtonRow(
    modifier: Modifier = Modifier,
    space: Dp = SegmentedButtonDefaults.BorderWidth,
    content: @Composable SingleChoiceSegmentedButtonRowScope.() -> Unit,
) {
    Row(
        modifier =
            modifier
                .selectableGroup()
                .defaultMinSize(minHeight = OutlinedSegmentedButtonTokens.ContainerHeight)
                .width(IntrinsicSize.Min),
        horizontalArrangement = Arrangement.spacedBy(-space),
```

The public scope itself extends `RowScope` at line 482:

```kotlin
public interface SingleChoiceSegmentedButtonRowScope : RowScope
```

The library therefore supplies horizontal sizing, overlap, and group semantics, but no
parallel column layout. This is an API-shape limitation, not evidence that a vertical
segmented control is invalid as a product design.

## Verification

The AndroidX source was read from the immutable Gitiles commit named in the root-cause
section. The installed binary API was also inspected directly:

```console
jar tf ~/.gradle/caches/9.5.1/transforms/5482783770c2ea5cd3ac7fbc2b7c0ebd/transformed/material3-api.jar \
  | grep -i SegmentedButton
javap -classpath ~/.gradle/caches/9.5.1/transforms/5482783770c2ea5cd3ac7fbc2b7c0ebd/transformed/material3-api.jar \
  -public androidx.compose.material3.SegmentedButtonKt
```

### Cleanly supported cases

- One horizontal `SingleChoiceSegmentedButtonRow` at default text scale.
- Two to five real `SegmentedButton` elements inside that row.
- Selected fill, checkmark, outline, and radio role from the Material component.

### Unsupported wrapper case

- No `SingleChoiceSegmentedButtonColumn`, vertical orientation parameter, or other
  public vertical group appears in the installed jar or current AndroidX source.

### Consumer-side prototype

Prototype commit `bf6830f4f` builds and Android lint passes. At 200% text, the native
capture is 2076 × 2152px and shows four connected full-label vertical segments. After
the transport scrolls vertically, the outer segmented outline spans x=73 through x=935
and y=1517 through y=2034, leaving 39 physical pixels before the navigation inset at
y=2074. UI Automator exposes all labels and a checked mode.

## Verified workaround

The debug-only visual prototype stacks four real one-item
`SingleChoiceSegmentedButtonRow` instances inside one outer selectable column. It uses
custom top, rectangular middle, and bottom shapes, with a negative 1dp gap to overlap
shared outlines. The implementation is in
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/DesignCandidateActivity.kt:861-897`.

```kotlin
Column(
    modifier = Modifier.fillMaxWidth().selectableGroup(),
    verticalArrangement = Arrangement.spacedBy((-1).dp),
) {
    // Each row contains one real SegmentedButton with a position-specific shape.
}
```

This preserves the required visual component, full labels, selected fill, checkmark,
and per-segment radio role without horizontal scrolling. Tradeoff: each segment is
hosted by a one-item row because the library's segmented element is row-scoped. The
production implementation must verify that assistive technology announces the outer
mutually exclusive group rather than four unrelated one-item groups.

## What does not work

- Plain radio rows fit the labels but violate settled component identity.
- A horizontally scrolling segmented row preserves component identity but violates the
  required purely vertical presentation.
- A 2 by 2 arrangement is not purely vertical and wraps the set into another line.
- One constrained horizontal row cannot preserve all four full labels at 200% text.
- `gh repo clone` could not run because `gh` is absent in this environment. The
  investigation used immutable Gitiles source, installed bytecode, and the real build
  instead.

## Upstream filing decision

No `.out-of-scope/` entry covers AndroidX segmented buttons. Web searches of AndroidX
GitHub results and Google's issue tracker found no trustworthy matching vertical-group
request. No issue should be filed.

1. **Upstream fault:** No. AndroidX names and documents a row component; it does not
   promise a vertical wrapper.
2. **Upstream can change it:** Yes, by adding a column scope and vertical overlap
   layout.
3. **Supported use case:** No evidence says the Compose component supports vertical
   orientation.
4. **Contribution policy:** Not evaluated further because the supported-use-case gate
   fails. The unavailable `gh` executable also prevents the repository-policy path
   required for a filing decision.
5. **Likely upstream action:** Unknown; no matching maintained issue was verified.
6. **Compatible minimal fix:** Not prototyped upstream because constraints one and
   three fail. The consumer-side visual workaround is sufficient for this design
   prototype but is not an upstream API proposal.

There is no fileable upstream issue or additive comment.
