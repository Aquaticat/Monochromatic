# Music player page-control styles

Status:
 in progress,
 updated 2026-08-13.

This handover tracks the selectable page-control styles in both music-player apps:
`package/music-player/desktop-app` (Rust plus Slint) and
`package/music-player/android-app` (Kotlin plus Jetpack Compose).
Keep this file current after each implementation or visual-verification step.

## Product requirements

- Radio controls remain the first-install default.
- Settings appears immediately before Open.
- A settings selection applies immediately and persists.
- Available styles are radio controls,
  multi-row MD1 tabs,
  legacy rounded buttons,
  segmented buttons,
  Chromium-like tabs,
  and Super fun LED segmented buttons.
- Labels stay on one line and ellipsize when available width is insufficient.
- Controls use content width.
  Wrapping occurs between whole controls rather than within a control.
- Segmented controls neither paint nor reserve unused row width.
- Chromium inactive tabs and their backplate inherit the page background.
  Active fill is accent-derived.
  Browser favicon,
  music,
  and close affordances are omitted.
- Chromium geometry uses Chromium logical metrics rather than screenshot device pixels.
- Chromium active-tab shoulders must visibly extend outside the active tab's content container.
- LED hardware supports distinct dark and light scenes while retaining identical inactive-cap pigments.
- Selected LED color is derived from the runtime accent.
  The reference purple demonstrates state and material behavior,
  not a literal pigment.
- Android's largest dark-mode background is always `#000000`,
  independent of page-control style.
- Screenshot-driven corrections require measured,
  matching-scale side-by-side renders.
- Final interactive launches are limited to this machine and Pixel 6 serial `1C171FDF600KWW`.
  The requester performs final visual approval.

## Stable persisted mapping

- `0`:
   radio controls
- `1`:
   MD1 tabs
- `2`:
   legacy rounded buttons
- `3`:
   segmented buttons
- `4`:
   Chromium-like tabs
- `5`:
   Super fun LED segmented buttons

Unknown persisted values decode to radio controls on both platforms.
Do not reorder or reuse values.

## Implemented state

Both platforms implement all styles,
settings UI,
immediate application,
persistence,
and unknown-value fallback.
Android also handles system Back from Settings.
Desktop Settings radio sizing is isolated from the smaller shuffle radios.

MD1 controls use content-width labels with whole-control wrapping.
Android uses `IntrinsicSize.Max`,
`maxLines = 1`,
and `TextOverflow.Ellipsis`.
Segment borders are attached to content-sized controls rather than the full wrapping row.

Chromium controls implement transparent inactive tabs,
an accent-derived active tab,
logical source metrics,
upper rounded corners,
outward lower shoulders,
baseline and divider adjacency,
capped long labels,
and Android's visible `48dp` minimum.
First,
middle,
last,
and wrapped-row shoulders have been verified.

LED code exists on both platforms but is not accepted.
The requester rejected the current rendering as visually unlike the reference.
The prior matching-scale desktop comparison was insufficient because it did not drive correction of obvious structural mismatches,
and the Android capture exposed them more clearly.
Current defects include separately pill-shaped plate tiles instead of one machined row plate,
uniform pill cap corners instead of 9-unit end and 2-unit inner-facing corners,
oversized center radial hot spots,
device-scaled typography that does not retain the 15-unit hardware legend,
a literal purple active pigment,
and non-LED Android dark backgrounds that are not true black.

## Authoritative references

### LED hardware

The updated archive is authoritative over all earlier loose downloads:

- Source archive:
   `/var/home/user/Downloads/files.zip`
- Extracted working copy:
   `/var/home/user/temp/agent/led-buttons-updated/`
- Geometry and scene authority:
  `/var/home/user/temp/agent/led-buttons-updated/led-buttons-generator.py`
- Dark hero:
  `/var/home/user/temp/agent/led-buttons-updated/led-buttons-hero.svg`
- Light hero:
  `/var/home/user/temp/agent/led-buttons-updated/led-buttons-hero-light.svg`
- Supporting HTML and conventions SVGs are in the same extracted directory.

Required source values include dark ground `#000000`,
dark plate `#111111`,
light ground `#eceef1`,
light plate `#c4c6ca`,
1 logical-unit selected clearance,
a 44-unit cap,
an 8-unit plate margin and channel,
9-unit outer cap corners,
2-unit inner-facing corners,
and a 15-unit hardware legend.
Scene-specific void,
contact,
shadow,
bloom,
and occlusion treatments must follow `led-buttons-generator.py`.
The active hue must be derived from runtime accent while preserving those material relationships.

### Chromium tabs

`doc/troubleshooting/chromium-tab-raster-scale.md` records the Chromium source audit and citations.
The source checkout used during research has been removed.
Implemented logical dimensions are a 41-unit row,
35-unit tab,
10-unit and 12-unit radii,
20-unit text inset without browser icons,
a 2 by 16-unit divider,
and a 1-unit contour.

### Layout investigations

- `doc/troubleshooting/segmented-controls-fill-row.md`
- `doc/troubleshooting/compose-intrinsic-min-wraps-tab-labels.md`
- `doc/troubleshooting/chromium-tab-raster-scale.md`
- `doc/handover/slint-app-testing.md`

## Main implementation files

- `package/music-player/desktop-app/ui/app.slint`
- `package/music-player/desktop-app/src/ui_page_style.rs`
- `package/music-player/desktop-app/src/session.rs`
- `package/music-player/desktop-app/src/session_tests.rs`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PageControlStyle.kt`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/SessionStore.kt`
- `package/music-player/android-app/app/src/test/kotlin/dev/monochromatic/musicplayer/PageControlStyleTest.kt`

The principal symbols for the remaining Chromium work are `ChromiumTab`,
`ChromiumControls`,
`chromiumTabShape`,
and `chromiumPageTab`.
The principal LED symbols include `LedSegmentButton`,
`LedSegmentControls`,
`LedPlateOptions`,
`LedFaceOptions`,
`LedCapOptions`,
`ledPlateModifier`,
`ledFaceModifier`,
`ledHardwareCap`,
`ledHardwarePageButton`,
`ledPageControls`,
and `pageSceneColor`.

## Relevant commits

Chromium implementation and source analysis culminate in:

- `61d01c4c9` through `f8baee4a5`:
   initial style and successive contour corrections
- `2757bfc51`:
   compact Chromium logical source metrics
- `7cdef5304`:
   Chromium metric and raster-scale investigation
- `9e19e347f`:
   active Chromium feet paint outside content and hit bounds;
   edge gutters preserve first and last feet
- `7acb783d1`:
   inactive Slint baselines leave room for selected-foot overlap
- `3858a0802`:
   Android targets reserve the platform minimum inside layout
- `72881bd1b`:
   Android visible faces grow to `48dp` and scale Chromium's contour ratios

LED implementation and reference corrections are:

- `45db486f9`
- `c7be63eec`
- `71e23d33f`
- `02101d810`
- `2d2a1e2a3`
- `a56c8025c`
- `abd8faff0`:
   final committed LED scene-fidelity pass
- `999599d77`:
   prior cap-width correction;
   still part of the requester-rejected LED rendering

Current scoped Chromium implementation commit is
`95dcbff91`.
No LED commit is accepted as final.
Unrelated commits are interleaved in history,
so inspect scoped paths rather than assuming a contiguous feature branch.

## Verification completed

Final Chromium-foot desktop renders cover dark and light scenes,
first,
middle,
row-end,
wrapped-start,
last,
and pathological ellipsis states.
A matching-scale shoulder comparison was made against the supplied Chromium screenshot.
The final Android release was installed only on Pixel 6 `1C171FDF600KWW`.
Its visible tab is `48dp`,
its outer target is `54dp`,
and UI Automator measured `[64,878][247,998]` at the device's `356dpi` override.
Useful artifacts include:

- `package/music-player/desktop-app/target/chromium-tabs-logical-dark.png`
- `package/music-player/desktop-app/target/chromium-tabs-logical-light.png`
- `package/music-player/desktop-app/target/chromium-tabs-logical-side-by-side.png`
- `/var/home/user/temp/agent/chromium-tabs-android-logical.png`
- `/var/home/user/temp/agent/chromium-tabs-android-logical-crop.png`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/chromium-feet-first-dark.png`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/chromium-feet-last-light.png`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/chromium-feet-long-ellipsis-dark.png`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/chromium-feet-reference-side-by-side.png`
- `/var/home/user/temp/agent/music-player-android-chromium-visible-48dp.png`
- `/var/home/user/temp/agent/music-player-android-chromium-visible-48dp-crop.png`

Rejected LED captures and comparisons remain useful as before-state evidence:

- `/var/home/user/temp/agent/music-player-led-render/package/music-player/desktop-app/target/led-revised-dark.png`
- `/var/home/user/temp/agent/music-player-led-render/package/music-player/desktop-app/target/led-revised-light-scene.png`
- `/var/home/user/temp/agent/led-buttons-updated/dark-reference.png`
- `/var/home/user/temp/agent/led-buttons-updated/light-reference.png`
- `/var/home/user/temp/agent/music-player-led-comparison.html`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/led-buttons-reference-side-by-side.png`
- `/var/home/user/temp/agent/music-player-android-led-final.png`

Host and Android checks passed for the current code,
but they do not establish LED visual fidelity.
The LED style remains incomplete until corrected captures match the authoritative geometry and scene model.

## Working-tree and process state

Main worktree is clean for music-player files.
`.serena/project.yml` is the only current unrelated modification.
Do not stage or alter it for this work.

Detached render worktree:
`/var/home/user/temp/agent/music-player-led-render`.
It is based on `a56c8025c` and has a scratch modification to
`package/music-player/desktop-app/ui/app.slint`.
Treat that worktree and its target images as disposable visual-analysis material,
not source to merge wholesale.

A desktop app built before the reopened LED corrections is running in `proc_bcef`.
It is useful only as before-state evidence and must not be presented as final.
Completed process records still available in the harness include:

- `proc_d7a6`:
   desktop compact Chromium run,
  exited successfully after the user closed it
- `proc_441e`:
   Android compact Chromium release install and launch,
  exited successfully

The current Android app runs the final release on Pixel 6 process PID `16662` when last observed.
Re-measure rather than assuming that PID remains current.

`doc/troubleshooting/README.md` indexes troubleshooting categories,
not every standalone report.
The Chromium raster-scale report therefore needs no explicit entry under the current index policy.

## Remaining work

1.  Rebuild LED row geometry around one shared machined plate per wrapped row on Android.
    Give caps 9-unit exposed end corners and 2-unit inner-facing corners,
    with uniform 8-unit margin and channel.
2.  Bring Slint plate and cap silhouettes to the same source geometry within its wrapping constraints.
3.  Replace oversized radial hot spots with the source's near-flat plateau,
    outer-15-percent dome falloff,
    clipped directional shoulder,
    selected hot layer,
    and scene-specific shadows.
4.  Keep hardware legend geometry at 15 logical units and preserve single-line ellipsis.
5.  Derive selected fill,
bloom,
edge shade,
label ink,
and label glow from each platform's runtime accent.
6.  Make Android's largest dark-mode background `#000000` for every style.
7.  Render dark and light desktop fixtures with the reference labels at matching scale.
    Build equivalent Android evidence,
    then compare silhouettes,
    row plate continuity,
    dimensions,
    corners,
    spacing,
    gradients,
    shadows,
    selected depth,
    and typography.
8.  Run all host checks,
    install only on Pixel 6 `1C171FDF600KWW`,
    verify rendered state before capture,
    and launch a new final desktop build.

## Risks and guardrails

- Drawing shoulders inside the current tab bounds recreates the clipping defect.
  Increasing nominal control width can instead break content-width wrapping,
  so keep visual overflow distinct from layout width when the toolkit permits it.
- Android's `48dp` requirement applies to both the visible face and owned target for this package.
  Transparent target padding is insufficient.
- The first and last active Chromium tabs need explicit edge inspection.
  A middle-tab screenshot alone cannot prove both feet survive row clipping.
- Do not infer visual fidelity from successful compilation or a side-by-side image that has not been analyzed feature by feature.
  Use measured,
  matching-scale captures and correct every material or geometry mismatch they expose.
- Treat purple in the LED reference as an accent-derived placeholder,
  never a fixed application color.
- Android dark-mode page ground and full-screen surface must both be `#000000`.
- Preserve the stable persisted integer mapping.
- Do not reintroduce full-row segment decoration.
- Do not add package-specific segmented sizing policy to `AGENTS.md`.
- Do not include `.serena/project.yml` or detached-worktree scratch changes in commits.
- Do not launch on an emulator or another attached Android target.
  Always pass `-s 1C171FDF600KWW` or use the serial-pinned mise task.

## Progress log

- 2026-08-13,
  20:23 EDT:
  Created this handover at main `HEAD` `abd8faff0`.
  Recorded implemented styles,
  authoritative references,
  stable persistence values,
  completed verification,
  scratch state,
  active risks,
  and remaining user-boundary checks.
  Next action:
  inspect both Chromium tab implementations and change their active silhouette paint bounds.
- 2026-08-13,
  20:31 EDT:
  Implemented active-foot overflow in commit `9e19e347f`.
  Slint paths now paint 12 logical units past each tab body inside strip-edge gutters.
  Compose now uses an unclipped draw-phase path,
  selected-tab sibling elevation,
  and matching FlowRow gutters without enlarging content or hit bounds.
  Desktop Slint lint and Android Detekt pass.
  Next action:
  complete platform builds and tests,
  then render dark,
  light,
  edge,
  and wrapped positions.
- 2026-08-13,
  21:06 EDT:
  Completed host and Pixel verification after requester corrections.
  Android Chromium tabs now have a visibly `48dp` face inside a `54dp` row,
  with source corner and shoulder ratios scaled proportionally.
  UI Automator confirmed a `120px` target at `356dpi`,
  consecutive rows do not overlap,
  and the state-verified screenshot is
  `/var/home/user/temp/agent/music-player-android-chromium-visible-48dp.png`.
  LED cap widths now match the authoritative reference and were compared at matching scale in both scenes.
  The final Pixel release is installed,
  and the final desktop app is running in `proc_bcef` for requester inspection.
- 2026-08-13,
  21:13 EDT:
  Reopened LED implementation after requester rejection.
  The earlier comparison did not justify the claim of fidelity.
  Recorded the authoritative mismatches:
  one shared row plate,
  9-unit end and 2-unit inner corners,
  subtle offset dome rather than center spotlights,
  15-unit legends,
  and accent-derived selected light.
  Added the Android requirement that the largest dark-mode background is always true black.
  Chromium remains verified;
  `95dcbff91` also makes one-character Android faces fill their 48dp minimum width.
  Next action:
  rebuild Android LED row composition and material layers from the generator,
  then apply the same measured geometry to Slint.
