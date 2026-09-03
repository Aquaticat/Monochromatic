# Music Player

Music Player is a native,
 local-first player for people whose music library is already organised in folders.
It treats the directory tree and filenames as the library,
 so a large collection stays navigable without
requiring tags,
 albums,
 artwork,
 a server,
 or an import step.

**Under active development;
 build from source.**

Version `0.1.0` builds a Slint desktop application and a Jetpack Compose Android application.
They provide corresponding product behaviour through separate platform implementations and share true-peak
metering.
 Their platform UIs,
 storage access,
 and audio output remain native to each platform.

## Contents

- [What works today](#what-works-today)
- [Gallery](#gallery)
- [Design direction](#design-direction)
- [Build from source](#build-from-source)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Related documentation](#related-documentation)

## What works today

### Local-library navigation

A desktop library is a source root and the audio files beneath it.
Desktop recursively enumerates that root and derives each displayed row from its relative path.

An Android library is either a selected Storage Access Framework tree or the device-wide MediaStore collection.
The selected tree is recursive.
 MediaStore queries the operating system's indexed collection rather than walking
one source-root directory.

Both interfaces group tracks into pages:

- A top-level directory becomes one page.
- Tracks directly in the root become `A` through `Z` and `#` pages,
   based on the filename.
- Folder pages sort before letter pages,
   while each page retains load order.
- Deeper directories remain visible in a track's relative path.

Desktop watches its selected source root and performs a debounced rescan after files are added,
 removed,
 or
renamed.
 A relaunch rebuilds the queue from disk rather than restoring a stale saved queue.

Android can read the device-wide MediaStore collection after audio permission is granted.
Choosing a folder through the Storage Access Framework gives that persisted folder grant priority,
 including
when that folder is empty.
 Both Android sources preserve source-relative display paths while using opaque
content URIs for playback.

The MediaStore source admits only rows Android marks as music.
An audio-looking file whose MediaStore row lacks that classification is not part of this source,
 even if its
filename has an otherwise accepted extension.
 Choosing a Storage Access Framework tree instead filters by the
player's extension allowlist.

The current UI has no metadata browser,
 tag parsing,
 facets,
 artist view,
 album view,
 or album art.
Folder names and filenames are the visible library data.

### Playback

Both applications provide selection,
 play and pause,
 previous and next,
 seeking,
 volume,
 page navigation,
light and dark appearance,
 and configurable page-control treatments.
A selected track is the current track.
 On desktop,
 clicking an unselected row selects it paused and clicking
it again toggles playback.
 On Android,
 tapping another row starts it and tapping the current row toggles it.

Desktop supports an in-order page scope,
 page shuffle,
 whole-library shuffle,
 and an independent repeat-track
toggle.
 Android presents the equivalent completion and transport choices as one persisted mode:
repeat,
 in order within the selected page,
 shuffle the selected page,
 or shuffle the complete library.

A Storage Access Framework tree accepts FLAC, WAV and PCM, MP3, Vorbis in Ogg, Opus, AAC-LC and ALAC in
MP4, and AIFF filename extensions. The MediaStore source relies on Android's music classification instead.
Desktop decodes those formats, plus ADPCM, and opens each track at its native sample rate. Desktop leaves
device resampling to PipeWire, CoreAudio, or WASAPI.

### Audio safety

Playback uses attenuate-only true-peak normalisation with a `-1 dBTP` ceiling.
A track that already fits under that ceiling is not boosted.
 The shared [`truepeak-core`](truepeak-core)
crate owns the meter and gain math used by both applications.

Desktop stores opaque peak-cache fingerprints rather than filenames,
 paths,
 or tags.
It measures non-current tracks in a background sweep and uses a bounded current-track measurement path.

### Platform integration

The desktop build uses Slint with winit on every desktop target.
Linux is Wayland-only and uses PipeWire,
 with no X11,
 ALSA,
 or PulseAudio fallback.
 macOS targets Apple
Silicon and uses CoreAudio.
 Windows targets `x86_64` and uses WASAPI through cpal.

The desktop source implements LauncherEntry D-Bus taskbar progress on Linux and native taskbar progress on
Windows.
 These shell integrations are best-effort and were not verified in the isolated gallery environment,
so the gallery does not demonstrate them.

Android supports API 26 and later and targets API 36. Its Kotlin layer owns permissions, MediaStore and
Storage Access Framework access, persistence, a MediaSession, audio focus, and foreground-service lifecycle.
 Its Rust engine decodes,
measures true peak,
 and drives AAudio.
 Background playback is available through Android media controls,
including the notification and lock screen.

## Gallery

Every image in this gallery is a capture of the current application using synthetic music folders and filenames.
The source PNGs were stripped of capture metadata.
 Android application captures exclude system bars,
 and
notification and lock-screen captures are cropped to the Music Player media card.

### Desktop

Wide desktop playback shows the source actions,
 transport,
 page grid,
 selected-page rows,
 and progress.

![Wide desktop playback with a selected track](asset/readme/desktop-wide-playing.png)

Wide layout keeps the page grid and selected-page rows in independent scroll containers.

![Wide desktop with independently scrolled page and track panes](asset/readme/desktop-wide-independent-scroll.png)

A synthetic stress fixture shows a visible 128-folder page grid.
 Its first folder has 200 hard-linked FLAC rows,
which demonstrates navigation density rather than a performance limit.

![Wide desktop with a 128-folder page grid](asset/readme/desktop-stress-pages.png)

An empty source root has an explicit empty-library state.

![Wide desktop empty-library state](asset/readme/desktop-wide-empty.png)

The desktop app follows dark appearance.

![Wide desktop in dark appearance](asset/readme/desktop-wide-dark.png)

Narrow windows fold page controls behind a disclosure while retaining the selected page.

![Narrow desktop with collapsed page controls](asset/readme/desktop-narrow-collapsed.png)

![Narrow desktop with revealed page controls](asset/readme/desktop-narrow-revealed.png)

The completion control exposes repeat,
 in-order,
 shuffle-page,
 and shuffle-all states.

![Desktop completion-mode states](asset/readme/desktop-playback-modes.png)

The volume control includes a muted state.

![Desktop muted playback](asset/readme/desktop-muted.png)

All available page-control treatments are represented in the current desktop build.

![Desktop page-control treatments: radio, MD1 tabs, rounded buttons, segmented buttons, Chromium tabs, and LED segmented buttons](asset/readme/desktop-page-controls.png)

Settings switches the page-control treatment and returns to the library without changing its source.

![Desktop page-control settings](asset/readme/desktop-settings.png)

### Android library and navigation

Audio access is requested before an Android library is read.

![Android audio-permission gate](asset/readme/android-permission-gate.png)

The Android library can be empty or populated.

![Android empty and populated library states](asset/readme/android-library-states.png)

The unfolded empty-library state keeps the same explicit no-tracks outcome.

![Android unfolded empty-library state](asset/readme/android-empty-library.png)

The folded cover display is the ordinary Android layout in this gallery.
A selected paused track remains visible in the selected page.

![Android cover display with a paused selected track](asset/readme/android-cover-paused.png)

The selected-page disclosure expands page controls on the cover display.

![Android cover display with expanded page controls](asset/readme/android-cover-expanded.png)

Selecting another page changes the visible track list while retaining the player controls.

![Android cover display after page navigation](asset/readme/android-cover-navigation.png)

The Android app follows dark appearance during playback.

![Android cover display in dark appearance while playing](asset/readme/android-cover-dark-playing.png)

Settings exposes the available page-control treatments.

![Android page-control settings](asset/readme/android-settings.png)

All six Android page-control rendering paths are covered below,
 in this order:
 radio controls,
 multi-row MD1
 tabs,
 rounded buttons,
 segmented buttons,
 Chromium-like tabs,
 and LED segmented buttons.

![Android page-control treatments](asset/readme/android-page-controls.png)

### Android foldable postures

The capture device is a Pixel 9 Pro Fold.
 Cover,
 unfolded,
 and tabletop postures are represented below.
The current application is responsive to available orientation and size rather than posture-aware,
 so its
unfolded and tabletop application layouts are presently the same.

![Android cover, unfolded, and tabletop posture comparison](asset/readme/android-fold-postures.png)

![Android unfolded populated library](asset/readme/android-unfolded-library.png)

![Android tabletop populated library](asset/readme/android-tabletop-library.png)

### Android media controls

An active MediaSession creates system media controls while playback continues outside the activity.

![Android notification media card](asset/readme/android-notification.png)

![Android lock-screen media card](asset/readme/android-lockscreen.png)

## Design direction

This section is intentionally separate from the implemented behaviour above.
It records the active product direction,
 not a claim that these features have shipped.

### Huge local libraries

The intended experience is immediate navigation through a huge local collection without abandoning the
filesystem-first model.
 Folders and filenames remain canonical.
 Metadata browsing,
 tag-derived facets,
 and
album art remain outside the product direction.

The next navigation primitive is a global,
 track-only search over the already loaded tree.
Pressing `Control` twice will invoke it.
 Search is not implemented in the current interfaces.

The scale targets are independent maxima,
 not one combined fixture:

- Up to 1,000 immediate subdirectories under a source root.
- Up to 1,000 tracks in one subdirectory.
- Up to 100,000 tracks across one loaded source root.

These are design targets rather than current performance claims.
The gallery fixture contains 120 Android tracks,
 and an earlier local desktop exercise measured approximately
3,600 tracks.
 Neither exercise establishes support at the target limits.

### Shared core direction

[`PROPOSAL.shared-core.md`](PROPOSAL.shared-core.md) describes the proposed migration to a shared Rust domain
core with thin desktop and Android adapters.
 Only the shared true-peak meter and gain math have migrated so
far.
 Queueing,
 pagination,
 session handling,
 decoding,
 output,
 and platform integration still have
platform-specific implementations.

## Build from source

[Mise](https://mise.jdx.dev/) owns the supported build,
 test,
 lint,
 install,
 and run commands.
Run these commands from the repository root.

### Desktop

```bash
# Build a release binary.
mise run //package/music-player/desktop-app:build

# Run against a folder, which becomes the source root.
mise run //package/music-player/desktop-app:run -- path/to/music-folder

# Run desktop unit and UI-binding tests.
mise run //package/music-player/desktop-app:test
```

Linux builds use host development libraries when available and otherwise use the package's Fedora container.
The application itself runs on the host session.
 Linux requires Wayland and PipeWire.
 macOS builds target Apple
Silicon,
 and Windows builds target `x86_64`;
 both build natively.
The desktop application accepts one optional file or directory path;
 a file selects its parent directory.
Pass `--start-playing` only when automatic playback on launch is required.

See [`desktop-app/README.md`](desktop-app/README.md) for platform prerequisites,
 codecs,
 container behaviour,
session locations,
 build verification,
 and signing work.

### Android

```bash
# Provision the repository-managed Android tools and required SDK components.
mise install
mise run prepare:android

# Assemble and install the debug app on a connected device or emulator.
mise run //package/music-player/android-app:install

# Run pure Kotlin unit tests.
mise run //package/music-player/android-app:test:unit
```

The Android build produces `arm64-v8a` and `x86_64` native libraries.
Use an API 26 or later device or emulator.
 The first application launch requests audio-library permission.

See [`android-app/README.md`](android-app/README.md) for native-build details,
 release builds,
 instrumented
tests,
 non-destructive device testing,
 lint commands,
 and page-control guidance.

### Shared true-peak core

```bash
mise run //package/music-player/truepeak-core:test
mise run //package/music-player/truepeak-core:lint:clippy
```

[`truepeak-core/README.md`](truepeak-core/README.md) explains its policy identity,
 cache boundary,
 public
surface,
 and staged migration status.
 [`truepeak-core.bench/README.md`](truepeak-core.bench/README.md) documents
the corpus evaluation used to choose the current shared policy.

## Architecture

### Desktop application

[`desktop-app`](desktop-app) is a Rust library plus a thin binary.
The Slint UI sends commands to an engine worker thread,
 which owns queue state,
 decoding,
 output,
 session
reconciliation,
 and peak-cache interaction.
 A single-producer,
 single-consumer ring buffer separates that
worker from the audio callback.

The desktop Source Root is recursive and watched.
 Pagination is derived at the UI boundary,
 which keeps the
queue and engine independent of the page-control presentation.

### Android application

[`android-app`](android-app) is a Gradle application with a nested Rust `cdylib`.
Jetpack Compose renders the interface.
 Kotlin owns Android-specific file access,
 persisted folder grants,
MediaSession integration,
 activity and service lifecycle,
 background work,
 and user preferences.
 Kotlin passes
media file descriptors and coarse commands across JNI;
 decoded audio and realtime buffers stay in Rust.

`PlaybackService` owns the player controller,
 so audio can continue when the activity is recreated or
backgrounded.
 `LibrarySource` selects a live persisted Storage Access Framework tree before falling back to
MediaStore,
 ensuring foreground playback and background peak work see the same library identity.

### Shared true-peak core

[`truepeak-core`](truepeak-core) holds the streaming true-peak meter,
 gain math,
 source contract,
window-placement math,
 and versioned policy identity.
 The shared core avoids divergent measurements while
leaving platform source access and higher-level playback policy at their appropriate boundaries.

## Contributing

Start with the child README for the component you are changing,
 then run its narrow test and lint tasks through
Mise.
 The package boundaries are deliberate:

- Change desktop UI,
   filesystem watching,
   desktop output,
   or desktop session behaviour in
  [`desktop-app`](desktop-app).
- Change Android Compose UI,
   Android services,
   media sources,
   permissions,
   or Kotlin queue behaviour in
  [`android-app`](android-app).
- Change shared peak measurement or gain math in [`truepeak-core`](truepeak-core),
   with its tests and corpus
  evaluation considered together.
- Keep platform behaviour distinct until the shared-core migration explicitly moves ownership.

Use synthetic audio and folder names when creating visual fixtures.
 The capture inventory,
 sanitation method,
and emulator constraints are retained in
[`doc/handover/music-player-readme-and-gallery.md`](../../doc/handover/music-player-readme-and-gallery.md).

## Related documentation

- [Android port decision](../../doc/decision/music-player-android-port.md)
- [Source Root session decision](../../doc/decision/music-player-session-source-root.md)
- [Live-update rescan decision](../../doc/decision/music-player-live-update-rescan.md)
- [Just-in-time shuffle decision](../../doc/decision/music-player-jit-shuffle.md)
- [Shared true-peak planning](../../doc/planning/music-player-shared-truepeak-core.md)
- [True-peak integration handover](../../doc/handover/music-player-truepeak-core-integration.md)
- [Page-control style runbook](../../doc/runbook/music-player-page-control-styles.md)
- [Shared-core proposal](PROPOSAL.shared-core.md)

## License

Music Player is licensed under the [GNU Lesser General Public License, version 3 or later](../../LICENSE).
