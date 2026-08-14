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
- LED hardware supports distinct dark and light scenes while retaining identical cap pigments.
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
lower shoulders,
baseline and divider adjacency,
and capped long labels.
The remaining Chromium defect is that both active shoulders are currently clipped by the tab's own layout bounds.
The fix must preserve wrapping and hit-target bounds while letting the silhouette protrude.

LED controls implement joined plate tiles,
cap depth,
selected clearance,
emissive selected caps,
label glow,
and scene-specific light transport.
Adjacent plate margins overlap by 8 logical units so independently wrapping controls read as one plate when adjacent.
The final visual comparison against both updated reference SVGs and the final Android install remain outstanding.

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

Implemented source values include dark ground `#000000`,
dark plate `#111111`,
light ground `#eceef1`,
light plate `#c4c6ca`,
1 logical-unit selected clearance,
a 44-unit cap,
and an 8-unit plate margin.
Scene-specific void,
contact,
shadow,
bloom,
and occlusion treatments follow `led-buttons-generator.py`.

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
   cap widths match the authoritative `56`,
   `104`,
   and `200`-unit reference geometry

Current scoped implementation commit is
`72881bd1b`.
Unrelated commits are interleaved in history,
so inspect scoped paths rather than assuming a contiguous feature branch.

## Verification completed

The final committed LED implementation passed:

- desktop Slint lint
- desktop Rust lint
- all 79 desktop tests
- Android Detekt
- Android lint
- Android unit tests

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

Updated LED desktop renders were inspected in a detached render worktree.
Useful artifacts include:

- `/var/home/user/temp/agent/music-player-led-render/package/music-player/desktop-app/target/led-revised-dark.png`
- `/var/home/user/temp/agent/music-player-led-render/package/music-player/desktop-app/target/led-revised-light-scene.png`
- `/var/home/user/temp/agent/led-buttons-updated/dark-reference.png`
- `/var/home/user/temp/agent/led-buttons-updated/light-reference.png`
- `/var/home/user/temp/agent/music-player-led-comparison.html`
- `/var/home/user/temp/agent/music-player-chromium-feet-render/package/music-player/desktop-app/target/led-buttons-reference-side-by-side.png`
- `/var/home/user/temp/agent/music-player-android-led-final.png`

The final checks pass:

- desktop Slint lint
- desktop Rust check and Rust lint
- all 79 desktop tests
- Android release build
- Android Detekt
- Android lint
- Android unit tests

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

The final desktop app is running for requester verification in `proc_bcef`.
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

1.  Requester visually verifies the already launched desktop app and installed Pixel 6 release.
2.  Apply any visual corrections reported by the requester,
    then repeat the matching state probe before recapturing.

## Risks and guardrails

- Drawing shoulders inside the current tab bounds recreates the clipping defect.
  Increasing nominal control width can instead break content-width wrapping,
  so keep visual overflow distinct from layout width when the toolkit permits it.
- Android's `48dp` requirement applies to both the visible face and owned target for this package.
  Transparent target padding is insufficient.
- The first and last active Chromium tabs need explicit edge inspection.
  A middle-tab screenshot alone cannot prove both feet survive row clipping.
- Do not infer visual fidelity from successful compilation.
  Use measured,
  matching-scale captures.
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
