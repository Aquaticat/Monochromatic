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
- In the light scene,
  the full-width backplate must be visibly lighter than the `#eceef1` page ground.
- Selected LED color is derived from the runtime accent.
  The reference purple demonstrates state and material behavior,
  not a literal pigment.
- Wrapped LED rows remain one connected machined backplate.
  Caps retain content width and wrap only between whole controls,
  but one rounded plate always fills the complete available width and combined row height.
  Independently rounded,
  overlapping,
  or content-width row-island plates are forbidden.
- Active LED legend text is always white in both ambient scenes.
- Android's largest dark-mode background is always `#000000`,
  independent of page-control style.
- Screenshot-driven corrections require measured,
  matching-scale side-by-side renders.
- Final interactive launches are limited to this machine and the requester-designated Android target.
  Pixel 6 serial `1C171FDF600KWW` is connected and is the current authorized target.
  Do not start an Android emulator for this verification.
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

LED controls have been rebuilt on both platforms but still await requester approval.
Android measures one-line legends first,
greedily packs actual content-width caps,
then draws one rounded plate across the complete available width behind independent 48-unit targets.
Slint paints the same full-width rounded plate directly from control bounds.
It reports final `FlexboxLayout` cap rectangles through `LedRowGeometry` only so Rust can classify measured first and
last caps for exposed 9-unit corners.
No platform stacks,
overlaps,
or ends the plate at a partially filled row.
Both implementations use 8-unit margins and channels,
44-unit caps,
9-unit exposed corners,
2-unit inner corners,
1-unit selected clearance,
15-unit legends,
always-white active text,
subtle dome and shoulder layers,
and accent-derived selection.
Android dark background and surface roles are true black for every style.

The first Android `SubcomposeLayout` probe measured complete targets containing `fillMaxSize()` paint,
which made every cap a full-width row.
Commit `08c131258` corrected the probe to measure only text and derive fixed cap width.
`doc/troubleshooting/segmented-controls-fill-row.md` records the diagnosis.

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
and source light plate `#c4c6ca`.
The requester superseded the source light-plate pigment:
the application uses `#f7f8fa` so the plate is visibly lighter than the ground.
Other required source values include
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
- `package/music-player/desktop-app/src/ui_led_rows.rs`
- `package/music-player/desktop-app/src/ui_led_rows_tests.rs`
- `package/music-player/desktop-app/src/ui_binding_tests.rs`
- `package/music-player/desktop-app/src/ui_page_style.rs`
- `package/music-player/desktop-app/src/session.rs`
- `package/music-player/desktop-app/src/session_tests.rs`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/LedPageControls.kt`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PageControlStyle.kt`
- `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/SessionStore.kt`
- `package/music-player/android-app/app/src/test/kotlin/dev/monochromatic/musicplayer/PageControlStyleTest.kt`
- `package/music-player/android-app/app/src/test/kotlin/dev/monochromatic/musicplayer/LedPageControlsTest.kt`

The principal symbols for the remaining Chromium work are `ChromiumTab`,
`ChromiumControls`,
`chromiumTabShape`,
and `chromiumPageTab`.
The principal LED symbols include `LedSegmentButton`,
`LedSegmentControls`,
`LedLine`,
`LedPackingOptions`,
`LedCapOptions`,
`packLedLines`,
`ledCapWidth`,
`ledPlateModifier`,
`ledFaceModifier`,
`ledHardwareCap`,
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
- `5b54692cc`:
   dedicated Android LED renderer,
   runtime dynamic accent,
   and true-black dark theme surfaces
- `3fd1aec8a`:
   extracted Android LED layout and material helpers
- `b495108be`:
   prior Slint per-row plate materials,
   source corner geometry,
   runtime accent,
   and revised material layers
- `08c131258`:
   content-width Android text probe and regression tests
- `b42adecd4`:
   measured stepped one-piece backplates,
   now superseded by the full-width requirement
- `b848c7c60`,
  `3ce02afcf`,
  and `75dbe0c2d`:
   deferred desktop row reporting and resize lifecycle guards
- `f17745ec2` and `19a0bdf63`:
   full-width rounded backplates on Android and desktop,
   with measured row reports retained only for cap corners

Current scoped Chromium implementation commit is
`95dcbff91`.
The rebuilt full-width LED implementation awaits requester approval.
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

The full-width desktop redesign passes Slint lint,
Rust lint,
Cargo check,
and all 86 desktop tests.
Its row tests cover incomplete reports,
callback reordering,
stale same-count generations,
empty generations,
shifted origins,
measured edge ownership,
and full-width plate size before and after resize.
The full-width Android redesign passes unit tests,
Detekt,
Android lint,
and release assembly.
Its pure tests cover row packing,
content-width caps,
and complete multi-row plate height.

The release was installed only on connected Pixel 6 serial `1C171FDF600KWW`.
The dark capture shows one plate spanning approximately `x=27` to `x=1052` on the `1080px` display while shorter
cap rows remain content-width.
The screen corner is exactly `#000000`.
The first light full-width capture exposed a darker-than-ground plate and is rejected before-state evidence.
Current accepted Android geometry artifact is:

- `/home/user/temp/agent/music-player-pixel6-led-full-width-dark.png`

A new light capture with `#f7f8fa` plate paint remains pending.
Earlier AVD and stepped-outline captures are superseded before-state evidence only.
Desktop release capture and requester visual approval remain pending.

## Working-tree and process state

Main worktree contains the scoped one-piece plate redesign pending commit.
Concurrent unrelated modifications currently include `.serena/project.yml` and troubleshooting documents outside this task.
Do not stage or alter those unrelated paths.

Current detached render worktree:
`/var/home/user/temp/agent/music-player-led-shared-plate-render`.
It is based on `b495108be` and has fixture-only changes to
`package/music-player/desktop-app/ui/app.slint`.
Treat that worktree and its target images as disposable visual-analysis material,
not source to merge wholesale.
The older `/var/home/user/temp/agent/music-player-led-render` worktree remains rejected before-state material.

The current desktop release runs in `proc_4e50`.
The `Pixel_9_Pro_Fold` AVD runs in `proc_fd67` with `-no-snapshot-save`.
Android Emulator 37.1.11 emitted `bad color buffer handle 388` once after boot,
but subsequent explicit-display screenshots rendered the app.
Do not infer emulator stability from that single capture.
Completed process records still available in the harness include:

- `proc_d7a6`:
   desktop compact Chromium run,
  exited successfully after the user closed it
- `proc_441e`:
   Android compact Chromium release install and launch,
  exited successfully

The current Android release runs on AVD serial `emulator-5554`.
The Pixel 6 is disconnected.
Re-enumerate devices before any future install.

`doc/troubleshooting/README.md` indexes troubleshooting categories,
not every standalone report.
The Chromium raster-scale report therefore needs no explicit entry under the current index policy.

## Remaining work

1.  Complete platform checks for connected wrapped rows.
2.  Rebuild desktop and Android releases.
3.  Reinstall on `emulator-5554` and verify the connected wrapped state through UI Automator.
4.  Capture dark and light connected-row scenes with an explicit display ID.
5.  Relaunch the desktop release and obtain requester visual approval.
6.  Restore the AVD display override after verification.

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
- Current Android verification is authorized only on local AVD serial `emulator-5554` while the Pixel is disconnected.
  Reconfirm the target when the requester reconnects hardware.

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
- 2026-08-13,
  22:10 EDT:
  Rebuilt LED controls in commits `5b54692cc`,
  `3fd1aec8a`,
  `b495108be`,
  `08c131258`,
  `3d2077390`,
  and `044e70ea6`.
  The AVD exposed and drove correction of a greedy full-row Compose measurement probe.
  Matching-scale desktop crops compare source and accent-derived hardware at one logical unit per pixel.
  The subsequent overlapping-row approach was rejected because it did not model one continuous backplate.
- 2026-08-13,
  22:37 EDT:
  Replaced overlapping row plates with one explicit multi-line silhouette on both platforms.
  Compose now builds one direction-aware `GenericShape` from packed row widths.
  Slint reports actual cap rectangles to a Rust adapter that generates one SVG outline,
  including transitions on unequal right or left row edges.
  A generation token rejects stale same-count reports,
  and measured row membership controls cap-end corners.
  Active legend ink remains white.
  Focused checks pass through desktop tests and Android lint.
  Next action:
  commit the scoped redesign,
  build both releases,
  and capture measured dark and light wrapped scenes.
