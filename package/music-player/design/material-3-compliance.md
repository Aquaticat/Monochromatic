# Material 3 compliance for the theme questionnaire

## Source and scope

The source is the user-supplied SingleFile archive at
`/var/home/user/Downloads/m3.material.io/`.
Its `manifest.json` identifies `https://m3.material.io/` as the original URL and
records an archive time of 2026-09-03T12:22:11.605Z.
The archive is a primary Google source.

This audit covers every guideline applicable to the UI visible in the six theme
questionnaire captures: adaptive layout, panes, app bars, lists, buttons, icon buttons,
segmented buttons, sliders, icons, color, type, spacing, bidirectionality, system safety
regions, touch targets, focus, labels, text resizing, and truncation.
Guidance for components absent from the captures does not apply to this round.

The project stays on baseline Material 3 under decision A2.
The archive explicitly says baseline lists, app bars, icon buttons, and segmented
buttons remain available even where Material 3 Expressive recommends newer variants.
The questionnaire must therefore satisfy baseline component guidance without silently
switching the product to Material 3 Expressive.

## Violations in prototype commit `6e8f248c5`

### Adaptive layout and scaffold

- `FullUnfoldedStudy` uses a 16dp pane spacer. The archived expanded-breakpoint page
  specifies 24dp leading and trailing margins and a 24dp spacer between panes at
  widths from 840dp to 1199dp:
  `foundations/layout/breakpoints/expanded/index.html`.
- The screen width is 852dp, so it is expanded and should use a two-pane layout.
  The two-pane choice is correct, but its geometry is not:
  `foundations/layout/canonical-examples/list-detail/index.html` and
  `foundations/layout/scaffold/panes/index.html`.
- The pane backgrounds may remain full bleed. Actionable content must align to a
  margin or safety ruler, and system UI must not cover it:
  `foundations/layout/grids-spacing/grids/index.html` and
  `foundations/layout/scaffold/bars/index.html`.

Correction: use a centered 24dp split-pane spacer, keep section backgrounds full bleed,
and keep actionable content after the measured system-gesture and system-bar insets.
Use 24dp screen-edge content alignment wherever the larger measured safety inset does
not already exceed it.

### App bars and page identity

- Neither pane has a real app bar. Both use hand-built 56dp rows.
- The right row presents `Camellia` as a button rather than as the page title.
- The three-dot glyph is text in a passive `Box`, not an icon button.
- The archive requires app bars at the top of a page, a contextual title, straight
  corners, the default height, full pane or window width, and no more than one action
  unless a second is necessary:
  `components/app-bars/guidelines/index.html` and
  `foundations/layout/scaffold/bars/index.html`.

Correction: use Compose `TopAppBar` in both panes. Label the list pane `Folders` and
the detail pane `Camellia`. Keep one contextual action in each bar. Use the real app
bar height, color roles, typography, insets, and icon-button behavior supplied by the
Material component.

### Buttons and folder selection

- The prototype uses `Button` with manually supplied tonal colors for both `Open` and
  the current folder.
- `Open` contains a Unicode block instead of an icon.
- A single persistent current-folder control must not be styled as a chip. The archive
  says chips appear as a set of contextual options and explicitly says not to display
  a single chip by itself:
  `components/chips/guidelines/index.html`.
- Button labels must remain visible on one line, use sentence case, and describe the
  action. Leading icons must communicate the action:
  `components/buttons/guidelines/index.html`.

Correction: use real `FilledTonalButton` and `OutlinedButton` components for current
folder and `Open`, with official Material icons. Keep them together as the settled
folder-source action group and expose at least 48dp targets.

### Iconography and icon buttons

- `▰`, `⋮`, `◀`, `Ⅱ`, `▶`, and the selected-row triangle are font glyphs, not
  Material icons.
- The transport faces are passive `Surface` nodes, not icon buttons. They therefore do
  not inherit Material target, state, ripple, focus, role, or label behavior.
- Google specifies 24dp as the standard icon size, a 48dp default target around it,
  consistent icon weight, and action-based accessibility labels:
  `styles/icons/designing-icons/index.html`,
  `styles/icons/applying-icons/index.html`, and
  `components/icon-buttons/accessibility/index.html`.

Correction: use official Material icons in `Icon`, `IconButton`,
`FilledIconButton`, and `FilledTonalIconButton`. Supply action labels such as
`Previous track`, `Pause`, `Next track`, and `Settings`. Keep media controls and their
progress direction left-to-right even in an RTL locale, as required by
`foundations/layout/bidirectionality-rtl/index.html`.

### Segmented playback mode

- The four choices are drawn as bordered boxes rather than the Compose Material
  component.
- The control wraps into two rows. The archive explicitly says segments must not wrap,
  should remain between two and five choices, use a 40dp visual container inside a
  48dp target, and indicate selection with both color and a checkmark:
  `components/segmented-buttons/guidelines/index.html`,
  `components/segmented-buttons/specs/index.html`, and
  `components/segmented-buttons/accessibility/index.html`.

Correction: use one `SingleChoiceSegmentedButtonRow` with four `SegmentedButton`
children on one line. Keep all labels visible and let the Material component provide
outline, selected color, checkmark, semantics, and interaction states.

### Slider

- The real Compose `Slider` is the correct component, but the design gives it no
  adjacent time labels and no semantics label.
- The archive says text or icons outside a slider can make its range understandable,
  and its accessibility label should match adjacent UI text:
  `components/sliders/guidelines/index.html` and
  `components/sliders/accessibility/index.html`.

Correction: keep the Material slider, add elapsed and duration labels with tabular
figures, and label it `Track position`. Keep the current 16dp track and 4 × 44dp
handle supplied by the current Material component.

### Lists and selection

- Track rows use the correct 72dp baseline height, but they are custom passive
  containers rather than selectable list items.
- The selected row uses `secondaryContainer` with default `onSurface` text. The
  archived list mapping uses `primaryContainer` with `onPrimaryContainer` for
  selection.
- Folder choices and rail letters have visual 48dp boxes but no selectable behavior,
  role, ripple, or state semantics.
- Selection is shown by color and weight or shape in some places, but the selected
  track's fake play glyph is not a proper icon.
- Track titles are truncated without an available way to reveal the omitted text.
- The archive requires at least 48dp targets, ripple and focus behavior, a non-color
  selection cue, aligned content, and accessible label and role behavior. It also says
  information must remain available when text is truncated:
  `components/lists/guidelines/index.html`,
  `components/lists/specs/index.html`,
  `components/lists/accessibility/index.html`, and
  `foundations/writing/text-truncation/index.html`.

Correction: use selectable Material surfaces with proper roles for folder and letter
choices, use a clickable list row with a Material play icon plus container change for
the current track, pair `primaryContainer` with `onPrimaryContainer`, and use a 72dp
minimum rather than a fixed height so enlarged or long text can grow instead of being
lost.

### Color roles

- Most literals happen to resemble baseline colors, but the implementation bypasses
  the Android runtime scheme and includes an incorrect hand-entered `#DED8E0` value.
- Selected containers and text use unmatched role pairs.
- The flat candidate uses the important-boundary `outline` role in contexts where the
  archive requires decorative `outlineVariant` dividers.
- The archive requires custom components to map to standard roles, preserve intended
  role pairs, and keep mappings stable across breakpoints:
  `styles/color/roles/index.html`.
- Project decision A3 requires the Android system accent. The archive identifies a
  wallpaper-derived dynamic scheme as the user-generated source and recommends first
  checking role mappings against the baseline scheme:
  `styles/color/choosing-a-scheme/index.html` and
  `styles/color/dynamic/index.html`.

Correction: derive the light scheme from Android dynamic color on Android 12 and
newer, with the baseline light scheme as fallback. Express every candidate difference
through `ColorScheme` roles. Use only valid paired foreground and container roles.
Use `outlineVariant` for decorative rail, row, and pane dividers.

### Type, spacing, resizing, and writing direction

- The prototype manually repeats font sizes and weights rather than applying Material
  typography roles.
- Several text containers have fixed heights that cannot accommodate 200% type.
- Hand-built physical placement makes RTL support accidental, while the folder library
  explicitly includes non-Latin writing systems.
- The archive requires type roles, approximately 1.5 line height for body and label
  styles, a 200% text increase without lost content, leading/trailing mirroring, and
  spacing selected from the Compose spacing tokens:
  `styles/typography/applying-type/index.html`,
  `styles/typography/type-scale-tokens/index.html`,
  `foundations/writing/text-resizing/index.html`,
  `foundations/layout/bidirectionality-rtl/index.html`, and
  `styles/spacing/tokens/index.html`.

Correction: use `MaterialTheme.typography` roles, logical start/end insets, flexible
minimum heights, vertical scrolling, and Material components whose RTL, focus, and
state behavior is built in. Retain fixed left-to-right direction only for media time
and transport controls, where the archive explicitly requires it.

## Candidate boundary

Every repaired Q1 option must use valid Material surface roles:

- `1a`: tonal hierarchy with `surface`, `surfaceContainerLow`,
  `surfaceContainer`, and `surfaceContainerHigh`.
- `1b`: flat `surface` regions separated only by decorative
  `outlineVariant` dividers.
- `1c`: `surfaceDim` ground with `surfaceContainerLowest` content and
  `surfaceContainerLow` transport.

Every repaired Q2 option keeps the same compliant list structure, selected-state role
pair, type roles, icons, and targets. Only the treatment of the true-peak supporting
value may differ. No option may remove required accessibility information or alter the
component structure.

## Acceptance boundary

Before reopening the questionnaire:

- Build the debug prototype through its `mise` task.
- Install and capture all six candidates from the unfolded Pixel 9 Pro Fold emulator.
- Confirm native system bars, exact source dimensions, opacity, full-bleed pane
  backgrounds, a centered 24dp spacer, default-height app bars, Material icons, one-row
  segmented control, 48dp targets, and valid selected-state role pairs.
- Inspect all captures at panel resolution and in the measured questionnaire frame.
- Rebuild the self-contained form and rerun package lint and unit contracts.
- Prove each new regression guard with a failing throwaway positive control.
- Exercise all previews, scaling controls, form paths, responsive scrollers, offline
  loading, forced-light presentation, and accessibility checks in Helium.
- Clear the form and reopen that exact corrected file in the user's normal Helium
  session.
