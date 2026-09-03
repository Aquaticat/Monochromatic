# Music player README and current-state gallery

Status:
capture collection in progress.

Last updated:
2026-09-03.

## Goal

Write `package/music-player/README.md` as a comprehensive product and contributor entry point.
Build a gallery from the current committed applications across desktop and Android layouts,
including foldable postures.
Keep implemented behavior visibly separate from the UI and UX direction being explored in Claude Design.

Update this handover after each decision,
capture step,
verification result,
or blocker.

## Confirmed decisions

- README length is not constrained at this stage.
  Prospective-user,
  builder,
  contributor,
  and architecture-reader needs are additive rather than competing.
- Use a layered document.
  The package README owns the product story,
  library UX,
  platform overview,
  behavior summary,
  architecture overview,
  component map,
  build entry points,
  status,
  and license.
  Component READMEs retain exhaustive commands and implementation detail.
- Write a durable package overview for the current Monochromatic repository.
  It may be adapted after the approved repository extraction,
  but it must not imply that extraction has happened.
- Lead with navigation of very large local music libraries.
  True-peak protection remains a major product capability,
  not the opening product promise.
- Use explicit `Works today` and `Design direction` sections.
  Never present Claude Design work as implemented behavior.
- Keep the library filesystem-first.
  Folders and filenames remain canonical;
  metadata browsing and album art stay out of scope.
- The design direction includes track-only global search opened by pressing Control twice.
  It searches the complete loaded tree even when another page is visible.
  Folder results and app-command providers are not part of this requirement.
- Target scale is:
  - up to 1,000 immediate subdirectories in one opened directory;
  - up to 1,000 tracks in one subdirectory;
  - up to 100,000 tracks in the complete opened tree.
- Use current application screenshots,
  not a Claude Design export.
  Capture all agreed user-visible states of the current app.
- Required form-factor examples named by the user include Android,
  Pixel 9 Pro Fold unfolded,
  Pixel 9 Pro Fold tabletop,
  desktop narrow,
  and desktop wide.
  The Pixel 9 Pro Fold cover display in `CLOSED` state is the ordinary Android capture.
- Use a state-covering gallery matrix.
  Every discrete user-visible branch must appear in at least one image,
  but equivalent dimensions do not require every Cartesian combination.
- State the current availability as `Under active development; build from source`.
- The scale values are independent maxima under the 100,000-track total cap.
  A root may have 1,000 immediate subdirectories,
  and any one subdirectory may contain 1,000 tracks,
  without requiring every subdirectory to hit that maximum simultaneously.
- Use the existing `Music Player` name and a concise,
  plain-spoken voice unless later grilling establishes a conflict.
- The available foldable emulator is Pixel 9 Pro Fold,
  not Pixel 6 Fold.
  The user warned that this AVD has startup and usability quirks.

## Current repository evidence

`package/music-player/` has no package-level README.
It contains four documented components:

- `desktop-app/`:
  Rust,
  Slint,
  PipeWire on Linux,
  CoreAudio on macOS,
  and WASAPI on Windows.
- `android-app/`:
  Jetpack Compose and Android platform integration over a Rust audio engine.
- `truepeak-core/`:
  shared true-peak metering,
  normalization gain,
  policy identity,
  and optional decision-cache service.
- `truepeak-core.bench/`:
  corpus evaluation and true-peak policy search.

The desktop and Android applications report version `0.1.0`.
No music-player GitHub release exists.
The current honest availability is source-build development software unless a later decision changes the wording.

The approved extraction plan is
[`doc/planning/music-player-repository-extraction.md`](../planning/music-player-repository-extraction.md).
It has not been executed.
The package README must not claim that `Aquaticat/music-player` exists or is authoritative.

## Implemented library experience

Both applications use one Source Root and derive the queue from current storage instead of persisting a frozen queue.
The source is scanned recursively.
Rows show filesystem-derived relative paths rather than parsed tags or album art.

The current page model is:

- one page per immediate subdirectory under the Source Root;
- A to Z pages for tracks directly under the Source Root;
- a `#` catch-all page for other initial characters.

The apps restore the selected track,
position,
volume,
playback mode,
and page-control preference.
They reconcile added,
removed,
and renamed files through rescans.
Android cold start emits sorted growing batches rather than waiting for the complete scan before displaying rows.

Existing evidence covers an Android library of about 3,600 tracks.
The earlier blocking scan took several seconds.
No current benchmark proves the newly selected 100,000-track target,
so the README must label that scale as a design and verification target until measured.

## Search reference clarification

JetBrains IntelliJ IDEA 2026.2 documentation distinguishes two interactions:

- pressing Control twice opens `Run Anything`;
- pressing Shift twice opens `Search Everywhere`.

The requested music-player shortcut combines the Control-twice invocation with global track search.
The overlay is track-only,
not a Run Anything-style command palette and not a mixed folder-and-track provider.
Detailed matching,
ranking,
and selection behavior are delegated design choices for implementation work;
the README must not invent them before code or an accepted design specifies them.

Primary references:

- [IntelliJ IDEA Run Anything](https://www.jetbrains.com/help/idea/running-anything.html)
- [IntelliJ IDEA Search Everywhere](https://www.jetbrains.com/help/idea/searching-everywhere.html)

## Large-library navigation precedent

Current products treat navigation mechanisms as complementary:

- MusicBee documents A to Z jumping,
  search,
  tree browsing,
  and column filtering in one library UI.
- Roon added folder drilling for large untamed collections whose metadata views were insufficient.
- foobar2000 Facets combines linked filters and search.

The user selected only instant global search as the required new mechanism in the current design direction.
Do not silently add metadata facets,
pins,
or a different hierarchy.

Primary references:

- [MusicBee library navigation elements](https://musicbee.fandom.com/wiki/Library_Navigation_Elements)
- [Roon folder browsing](https://blog.roonlabs.net/folder-browsing/)
- [foobar2000 Facets](https://www.foobar2000.org/components/view/foo_facets)

## Screenshot environment

No Android target was attached when checked on 2026-09-03.
The real SDK lists one AVD:

```text
Pixel_9_Pro_Fold
```

Relevant paths and versions:

```text
/var/home/user/Android/Sdk/emulator/emulator
Android Emulator 37.1.11.0, build 15917651
/var/home/user/.android/avd/Pixel_9_Pro_Fold.ini
/mnt/encrypted/Archive/home-user-offload/.android/avd/Pixel_9_Pro_Fold.avd/
```

The AVD targets Android 37.0 and has fold postures with hinge angles spanning folded,
tabletop,
and fully open ranges.
Its state is stored on the encrypted archive volume.
There is sufficient measured free space on that volume for disposable capture state.

Known emulator behavior is documented in
[`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`](
../troubleshooting/android-emulator-37-software-renderer-sigsegv.md).
Software rendering with Emulator 37.1.11 crashes in packaged SwiftShader during API 37 boot on this host.
A host-GPU,
read-only,
no-snapshot launch reached `sys.boot_completed=1` in the recorded positive control.
Use host GPU rendering and disposable state for captures.
Do not wipe or repurpose the retained AVD data.

The AVD's generated `hardware-qemu.ini` currently records a prior Lavapipe runtime selection.
Do not trust that stale generated file as the next launch configuration.
Pass the verified host-GPU arguments explicitly.

A read-only,
no-snapshot,
headless host-GPU launch is running under Pi process `music-player-pixel9-fold-readonly`
(`proc_c7c1`).
Its retained-AVD files are not writable through this launch.
The emulator reached boot completion in 34,368 ms and is attached as `emulator-5554`.
Android reports the `OPENED` device state on the 2,076 by 2,152 inner display at density 390.
The inactive cover display is 1,080 by 2,424.
The process retains watches for `SIGSEGV` and emulator panic output.

## Approved visible-state inventory

The gallery covers every discrete application-owned branch at least once,
not every combination of dimensions.
Code and existing verification identify these independent dimensions:

- platform and form factor:
  desktop narrow,
  desktop wide,
  Android slab or folded cover display,
  foldable unfolded,
  foldable tabletop;
- ambient theme:
  dark and light;
- primary screen:
  player and settings;
- library state:
  permission gate on Android,
  service connection or loading,
  empty library,
  populated library,
  and selected track;
- playback state:
  paused and playing;
- playback mode:
  repeat,
  in order,
  shuffle current page,
  and shuffle all;
- page navigation state:
  no overflow,
  collapsed overflow,
  expanded overflow,
  selected page outside the initial visible subset,
  and horizontally scrolled collapsed strip;
- page-control style:
  radio,
  Material Design 1 tabs,
  legacy rounded buttons,
  segmented buttons,
  Chromium-like tabs,
  and LED segmented buttons;
- responsive stress state:
  long page labels,
  long track paths,
  wrapped controls,
  and large text scale;
- Android system integration:
  notification and lock-screen playback controls;
- desktop platform integration:
  window title while playing and available taskbar progress treatment.

“All states” cannot mean every Cartesian combination without producing redundant images.
The next grilling round must decide whether the gallery covers every independent state at least once,
or every combination of selected dimensions.

## Privacy and capture rules

- Use generated or committed synthetic audio names,
  never the user's real library.
- Use disposable app state and storage for every capture.
- Inspect every image region before committing it.
- Remove or mask status-bar notifications,
  account names,
  host paths,
  device identifiers,
  unrelated windows,
  and other personal data.
- Strip image metadata.
- Verify the intended rendered state before each capture.
  Input completion alone is not frame-settlement evidence.
- Do not capture audio.
- End desktop browser or MCP sessions and Android emulator processes after capture.

## Delegated implementation choices

The user ended grilling after accepting every recommendation and authorized autonomous completion.
Use these defaults unless repository evidence proves one cannot be captured accurately:

- Show each page-control style at least once,
  with the Settings screen also naming every included style.
- Show dark and light themes on both app platforms.
  Do not multiply every style by every form factor and theme.
- Include every app-owned discrete screen branch:
  Android starting,
  permission gate,
  loading,
  empty,
  populated unselected,
  selected paused,
  playing,
  settings,
  playback modes,
  collapsed page overflow,
  expanded page overflow,
  selected-page reveal,
  and a scrolled library;
  desktop empty,
  populated unselected,
  selected paused,
  playing,
  settings,
  narrow collapse and expansion,
  wide split panes,
  and independently scrolled panes.
- Include Android notification and lock-screen playback states,
  plus desktop title and taskbar progress where the isolated environment renders them.
- Exclude operating-system permission prompts,
  folder pickers,
  hover animation samples,
  arbitrary slider values,
  and intermediate animation frames.
  They are OS-owned or continuous states rather than discrete app branches.
- Use synthetic filesystem names and audio fixtures that demonstrate deep paths,
  many pages,
  long labels,
  A to Z ordering,
  the `#` catch-all,
  and current-track highlighting without exposing personal data.
- Store committed gallery media under `package/music-player/asset/readme/`,
  retaining singular directory segments.
- Prefer one contact sheet per coherent state family plus selected full-size hero captures.
  This keeps every state inspectable without forcing readers through a long run of near-duplicate full-size images.

## Progress log

- 2026-09-03,
  10:20 EDT:
  created this handover after the first README grilling decisions and environment inventory.
  Committed it as `9274d9823`.
- 2026-09-03,
  after 10:20 EDT:
  corrected the available target name to Pixel 9 Pro Fold,
  read the existing emulator failure diagnosis,
  inspected the AVD configuration,
  and started a read-only host-GPU boot through process `proc_c7c1`.
  Source inventory confirmed that current Android fold behavior is orientation-based page-control folding;
  no posture-aware app layout API is present.
- 2026-09-03,
  after the emulator start:
  the verified host-GPU workaround succeeded again.
  Emulator 37.1.11 reached boot completion in 34,368 ms without the known SwiftShader crash.
  `cmd device_state` reported supported `CLOSED`,
  `HALF_OPENED`,
  `OPENED`,
  and `REAR_DISPLAY_MODE` states,
  with `OPENED` active.
  Display inspection confirmed separate inner and cover displays.
- 2026-09-03,
  after the final grilling round:
  the user accepted all recommendations,
  ended grilling,
  and authorized autonomous completion.
  Settled track-only Control-twice search,
  independent scale maxima,
  state-covering rather than Cartesian screenshots,
  Fold cover display as ordinary Android,
  and explicit source-build development status.
- 2026-09-03,
  during capture preparation:
  a synthetic FLAC Source Root containing 120 tracks across ten folders was accepted by MediaStore and SAF.
  The Android app renders the populated library after the stale AAC copies were removed.
  Desktop's embedded Slint MCP server is listening on port 9315 with the fixture loaded paused.
  Its screenshot API produced a valid 480 by 600 narrow light capture.
  The direct JSON-RPC client does not receive an `mcp-session-id` header,
  but `tools/call` succeeds after `initialize` because the server accepts stateless loopback requests.
  For timer-driven page-control reveal,
  take a non-retained screenshot before reading geometry,
  as documented in `doc/troubleshooting/slint-embedded-mcp-server.md`.
- 2026-09-03,
  desktop capture:
  captured the empty,
  populated,
  selected paused,
  muted playing,
  settings,
  narrow collapsed and expanded,
  selected-page reveal,
  all six page-control styles,
  all four playback modes,
  dark theme,
  and independently scrolled wide panes.
  The stress-only desktop fixture used 128 synthetic folders and 200 hard-linked FLAC rows in its first folder.
  It remains outside the repository and will not be committed.
- 2026-09-03,
  live-GPU capture:
  Slint MCP returned an opaque-black 1280 by 800 image from the winit FemtoVG OpenGL session,
  while its element tree and the nested compositor's framebuffer capture were populated.
  `doc/troubleshooting/slint-mcp-winit-femtovg-screenshot.md` records the source trace,
  upstream duplicate issue and pull request,
  verified headless and compositor workarounds,
  and the decision not to add an empty upstream comment.
  Use nested-compositor captures for live-GPU gallery media.
  The isolated compositor cannot render KDE taskbar progress or a desktop title bar,
  so those shell-owned states remain unavailable in the disposable capture environment.
- 2026-09-03,
  capture cleanup:
  stopped every nested compositor and embedded MCP instance after the desktop captures.
  `ss` found no listener on ports 9315 through 9321;
  the separately installed user music-player process was left untouched.

## Next actions

1.  Capture and sanitize approved Android states,
    including cover,
    unfolded,
    tabletop,
    system integration,
    and every page-control style.
2.  Place final media in `package/music-player/asset/readme/` and commit it.
3.  Write the layered package README and embed the gallery.
4.  Verify links,
    commands,
    capability claims,
    image privacy,
    and rendered Markdown.
