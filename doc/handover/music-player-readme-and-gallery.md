# Music player README and current-state gallery

Status:
grilling and capture inventory in progress.

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
- The design direction includes instant global search opened by pressing Control twice.
  Exact search behavior is still open.
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
Grilling must still settle whether the overlay is track-only search or a broader command palette,
which fields it matches,
how it ranks results,
and what selection does.

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
[`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`](../troubleshooting/android-emulator-37-software-renderer-sigsegv.md).
Software rendering with Emulator 37.1.11 crashes in packaged SwiftShader during API 37 boot on this host.
A host-GPU,
read-only,
no-snapshot launch reached `sys.boot_completed=1` in the recorded positive control.
Use host GPU rendering and disposable state for captures.
Do not wipe or repurpose the retained AVD data.

The AVD's generated `hardware-qemu.ini` currently records a prior Lavapipe runtime selection.
Do not trust that stale generated file as the next launch configuration.
Pass the verified host-GPU arguments explicitly.

## Current visible-state inventory seed

The final matrix is not yet approved.
Code and existing verification reveal these independent dimensions:

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

## Open decisions

- Does Control twice open track-only search,
  or a command palette whose first provider is tracks?
- Which fields does search match in a filesystem-first product:
  filename,
  relative path,
  folder segments,
  or all of them?
- What ranking and tie-breaking rules should search use?
- Does choosing a result select paused,
  start playback,
  or follow a modifier-dependent action?
- Are the three scale limits independent maxima that need not occur simultaneously?
  A directory with 1,000 subdirectories each containing 1,000 tracks would contain 1,000,000 tracks,
  which exceeds the selected 100,000-track total.
- Does “all states” mean each independent user-visible state appears in at least one image,
  or that selected dimensions require a Cartesian capture matrix?
- Must every page-control style appear in the README,
  or may one settings capture enumerate styles while representative player captures use the current default?
- Must both light and dark themes be shown for every form factor,
  or across the gallery as a whole?
- Are transient permission,
  loading,
  empty,
  and system-dialog states part of the public gallery?
- Should the Android slab capture use the Fold cover display,
  a disposable phone AVD,
  or a connected physical device if one appears?
- Should notification and lock-screen states be part of the README gallery or only component documentation?
- Where should committed gallery assets live under `package/music-player/`?
- How should the README phrase source-build availability and unsupported distribution status?

## Next actions

1.  Complete source-driven state inventory for both UI implementations.
2.  Grill the open search,
    scale,
    screenshot-matrix,
    and release-framing decisions.
3.  Start Pixel 9 Pro Fold through the documented host-GPU workaround in disposable state.
4.  Prove folded,
    unfolded,
    and tabletop posture control before building the full capture matrix.
5.  Capture and sanitize the approved Android and desktop states.
6.  Write the layered package README and embed the gallery.
7.  Verify links,
    commands,
    capability claims,
    image privacy,
    and rendered Markdown.
