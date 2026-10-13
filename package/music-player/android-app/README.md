# Music player Android app

Android music-player client implemented with Jetpack Compose and a native Rust audio engine.
This package is a Gradle island with a nested Rust `cdylib` crate.
Mise owns tool provisioning and every supported build,
test,
install,
run,
and lint command.

## Architecture

Kotlin owns the Android application shell:
Compose UI,
permissions,
content URIs,
services,
media-session integration,
persistence,
and background work.
Rust owns decoding,
true-peak analysis,
the playback worker,
and the realtime AAudio output path.
Kotlin opens Android-managed media and passes file descriptors and coarse commands across JNI;
decoded samples and realtime buffers stay in Rust.

Application and native entry points:

- [`MainActivity.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt) is the launcher activity and
  Compose UI root.
- [`PlaybackService.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt) owns the media session
  and service-backed player controller so playback survives activity recreation.
- [`NativeBridge.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/NativeBridge.kt) declares the Kotlin JNI
  surface loaded from `libmusicplayer_native.so`.
- [`rust/src/lib.rs`](rust/src/lib.rs) is the nested Rust crate root and exports the JNI entry points.
- [`rust/Cargo.toml`](rust/Cargo.toml) defines the standalone `musicplayer-native` `cdylib` crate.

[`mise.toml`](mise.toml) is the command interface for the package.
Its native build uses `cargo-ndk` to compile `arm64-v8a` for physical devices and `x86_64` for emulators,
then places both shared libraries under `app/src/main/jniLibs` for Gradle packaging.
[`app/build.gradle.kts`](app/build.gradle.kts) defines the single Android application module and its debug and
release variants.

## Prepare the Android toolchain

Run commands from the repository root.
Install the repo-managed JDK,
Android command-line tools,
Rust toolchain,
and `cargo-ndk`,
then install this app's SDK and NDK components:

```bash
mise install
mise run prepare:android
```

`prepare:android` accepts Android licenses and installs platform `android-37.0`,
build tools `37.0.0`,
NDK `29.0.13846066`,
platform tools,
and the `aarch64-linux-android` and `x86_64-linux-android` Rust targets.
The root `prepare` task also runs `prepare:android`,
but includes unrelated workspace preparation.
Mise exports `ANDROID_HOME` and `ANDROID_SDK_ROOT`,
so no machine-local `local.properties` is required.

## Build, install, and run

```bash
mise run //package/music-player/android-app:build:native
mise run //package/music-player/android-app:build
mise run //package/music-player/android-app:build:release
mise run //package/music-player/android-app:install
mise run //package/music-player/android-app:run:release
```

- `build:native` compiles only the release-mode Rust shared libraries for both supported ABIs.
- `build` rebuilds the native libraries and assembles the debug APK.
- `build:release` rebuilds the native libraries and assembles the optimized,
  non-debuggable release APK.
  The release variant uses the debug signing key so it can be installed without a separate keystore.
- `install` rebuilds the native libraries and installs the debug APK on a connected device.
- `run:release` builds the release APK,
  installs it on every attached device,
  and launches `MainActivity` on each device.

## Test

```bash
mise run //package/music-player/android-app:test:unit
mise run //package/music-player/android-app:test:instrumented:build
mise run //package/music-player/android-app:test:instrumented
mise run //package/music-player/android-app:test:instrumented:device
```

- `test:unit` runs the pure-logic JVM tests without a device or native build.
- `test:instrumented:build` builds the app and instrumented-test APKs without running them.
- `test:instrumented` rebuilds the native libraries and runs all instrumented tests on a connected device.
  Set `ANDROID_SERIAL` when more than one device is attached.
  Gradle's connected-test flow reinstalls the app and can clear its persisted SAF grant and warm peak cache.
- `test:instrumented:device` installs both APKs with `adb install -r` and runs the silent
  `PeakSweepWorkerTest` class while retaining app data and grants.
  Android's `am instrument` can exit successfully when a test fails,
  so verify that its output reports `OK (` rather than `FAILURES!!!`.

## Lint and clean

```bash
mise run //package/music-player/android-app:lint
mise run //package/music-player/android-app:lint:detekt
mise run //package/music-player/android-app:clean
```

- `lint` runs Android Lint against the debug variant.
- `lint:detekt` enforces the repository's Kotlin documentation rules.
- The root `mise run lint` runs the repository's Rust line-budget and rustdoc checks over the nested crate.
- `clean` removes Gradle build outputs.
  It does not remove the Rust target directory or generated JNI libraries.

## Design records

Use durable decisions for architecture and maintenance context:

- [Android port decision](../../../doc/decision/music-player-android-port.md)
- [Source Root session decision](../../../doc/decision/music-player-session-source-root.md)
- [Live-update rescan decision](../../../doc/decision/music-player-live-update-rescan.md)
- [Just-in-time shuffle decision](../../../doc/decision/music-player-jit-shuffle.md)
- [Peak-sweep parallelism decision](DECISION.peak-sweep-parallelism.md)

## Settings icons

The Settings rows carry the Material Symbols `queue_music` and `play_circle` icons,
embedded as vector path data in [`SettingsIcons.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/SettingsIcons.kt).
The icons are Apache License 2.0 material from `google/material-design-icons`,
and the license text is `LICENSES/Apache-2.0.txt` at the repository root.
The source files, commit and style are named in the [package README](../README.md#third-party-icons).

## Custom control sizing

A requested minimum control size applies to both the visible control face and its owned layout target unless the
requirement explicitly says touch-target-only.
Transparent hit padding does not satisfy a requested visible minimum.

Custom interactive Compose controls reserve at least `48dp` by `48dp` inside layout.
Do not rely on Compose expanding touch targets outside undersized bounds,
because adjacent expanded targets can overlap.

## Theme and crease

The theme follows the system accent as its only platform color (A3, D108).
On API 31 and later the root is the middle tone of the system accent palette, `android.R.color.system_accent1_500`,
and below that it is the Fold baseline `#4E5E8B`.
Every role is then derived from the root in OKLCH by
[`core/ThemeRoles.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/ThemeRoles.kt),
using the one OKLCH implementation in
[`core/OklchColor.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/OklchColor.kt).
Both are ports of the desktop's `oklch.rs` and `theme_roles.rs`,
and `app/src/test/resources/theme-roles-vector.txt` (written by the Rust code, with its source hashes in the header)
proves that the same root gives the same sRGB roles in Kotlin and Rust.
[`PlayerTheme.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/PlayerTheme.kt) maps the roles onto every
Material 3 slot,
so the platform's `dynamicLightColorScheme` and `dynamicDarkColorScheme` are not used,
and carries the roles Material has no slot for (the Search match fill) in `LocalThemeRoles`.
Dark keeps a pure-black canvas and the `#0A0A0D` deck (D41),
light keeps a white canvas (D34),
and every text role is fitted to WCAG AA on the surfaces it is drawn on, for any root.
The app draws no gradient.
A future one must interpolate in OKLCH (D108), because Android blends gradient stops in sRGB.

The crease comes from Jetpack WindowManager (D110, E2):
[`CreaseDetection.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/CreaseDetection.kt) reads the window's
`FoldingFeature` list through `WindowInfoTracker`,
and [`core/CreaseReading.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/CreaseReading.kt) decides:
a vertical fold is a crease,
its reported width is the width of its bounds,
and the clearance is `max(7.5 mm, reported width)`.
Until the first layout report the `android.hardware.sensor.hinge_angle` system feature stands in.
The player, Settings and Search read the same answer.

On the unfolded player each pane provides its own clearance
([`PaneClearanceLocals.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/PaneClearanceLocals.kt),
rule in [`core/PaneClearance.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/PaneClearance.kt)):
text in the left pane (folder names, the deck, the undo toast) ends half of `max(7.5 mm, crease width)` before the
shared edge,
text in the right pane (header, track rows, subfolder headers, the empty notice, the first-run text) starts that far
after it,
and backgrounds and containers still span the band.
A window with no crease keeps the ordinary insets.

## Keyboard and focus

An attached keyboard gets the D106 map.
[`core/KeyBindings.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/KeyBindings.kt) is the table, one row per
chord with its scope, and `KeyBindingsTest` has one test per chord.
The older D102 chords stay in `core/KeyboardMap.kt`; `core/HostKeyboardModel.kt` asks the table first, then the older
classifier.
Implemented: `Alt+Left` and `Alt+Right` seek 10 seconds (60 with `Shift`), `Ctrl+Home` restarts,
`Ctrl+Shift+1` to `Ctrl+Shift+4` pick the mode, `Alt+Up` and `Alt+Down` pick the previous and next folder,
`Ctrl+Shift+G` shows the playing track's folder, `Alt+1` and `Alt+2` focus the folder names and the track list,
`Ctrl+Shift+O` opens the system folder chooser, `Escape` closes the cover's folder picker,
inside a focused list the arrows, `Home`, `End`, `PageUp`, `PageDown` and `Enter`
(a letter jumps in the rail and the names),
and on a track row `Menu` or `Alt+Enter` open its menu (D114), and `Delete`, `Ctrl+Shift+C` and `Ctrl+Shift+E`
trash it, copy its file name and show it in the file manager (also from the open menu).
There is no rescan or re-analysis key (D113) and no `Shift+F10`.
Left out on Android: the key hint badges, tooltips, `Ctrl+Q` and double `Shift`.

The folder rail, the folder names and the track list are each one focus stop (`Tab` passes them in one step) with their
own focus ring, moved by the arrow keys; their entries take no focus of their own,
so TalkBack still reads every entry through its semantics.
The focus indicator is a 2 dp ring in the primary role over a ten percent state layer
([`FocusRing.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/FocusRing.kt));
`FocusRingContrastTest` checks the ring at 3 to 1 or better on every surface in both appearances.

## Playback modes and the track menu

`In order` plays to the end of the folder on screen and then stops,
with the first track of that folder loaded and paused (D2);
`Next` still wraps around,
and `Repeat` replays the one track.
`core/Queue.kt` returns no next track for a natural end in `In order`,
and `PlayerController.handleNaturalEnd` turns that into the stop.
Every entry of the system playlist has its own id (`core/PlaybackEntryIds.kt`),
so a short folder in a shuffle mode can queue the same file again without the duplicate-id crash of the first review.

The track menu has six rows,
and each has one access key taken from its own words
(`core/TrackMenuAction.kt`, one table):
`P` for Play, `S` for Start shuffle from here, `D` for File details, `F` for Show in file manager, `C` for Copy filename
and `T` for Move to trash.
The letter is underlined in the label,
and pressing it with a hardware keyboard while the menu is open runs the row and closes the menu.
File details has no key of its own outside the menu.

## The library and the analysis follow the files

There is no rescan or re-analysis action (D113).
The system library follows a `ContentObserver` on the MediaStore audio collection,
and a library from a folder grant is read again when the app returns to the front;
both go through one debounced rescan in `PlaybackService`,
and a change that arrives while a load runs is answered once the load ends (`core/RescanPlan.kt`).

The analysis service decides what to measure from a ledger of the files it has swept
(`core/SweepLedger.kt`, stored in `sweep-ledger.bin`).
A file is new work when its address is unknown or when its size or modification time changed
(`core/TrackSignatures.kt`, read with the rows of the scan),
so a replaced or edited file is measured again.
A file that could not be decoded is tried again at the next start and whenever the library gains new work,
and it is reported once, in plain words, with no retry button
(`AnalysisFailures.kt`, shown by `PlayerHost.kt`).
The measures that the open page shows are read again when the analysis measured their tracks (`MeasureInvalidation`).

## Search and a library of a million tracks

Search answers from an in-memory index (D112), never from composition.
[`core/SearchService.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/core/SearchService.kt) owns the index and a
worker thread that answers each query,
and [`SearchHost.kt`](app/src/main/kotlin/dev/monochromatic/musicplayer/SearchHost.kt) hands the newest answer to the
Search page.
The index keeps the normalized track and top-level folder names in one array,
buckets of word starts by their first, first two and first three UTF-16 units,
and a cached best-500 list per first character (`core/SearchIndex*.kt`).
A term of up to three units is answered from the buckets alone,
and a longer term is verified on the narrowed candidates.
Answers equal the old matcher's (tier, kind, name, library index, count, truncated flag and highlight ranges):
the old implementation is kept as a test oracle in `src/test/.../core/ReferenceSearch.kt`,
and `SearchIndexParityTest` and `ScaleSearchTest` compare the two on randomized and synthetic libraries up to 1,000,000
tracks.

A scan never blocks the screen (D111).
`LibraryScanner` hands each batch of found tracks to `LibraryIngest`, which sorts, derives the pages and builds the
Search index on its own thread, then gives the main thread a finished `BuiltLibrary` to swap in.
Search receives the new tracks after the player shows them and signals the open Search page,
which re-answers in place:
the query, the caret and the scroll position stay,
and results are keyed by track so a row the user is about to tap does not move.
While a scan runs an empty answer reads "Still looking through your library" and the Search button stays enabled.

`./gradlew :app:testDebugUnitTest` includes the 1,000,000-track cases, so its test JVM runs with a 3 GiB heap and the
serial collector (`app/build.gradle.kts`): G1's loop strip mining made short counted loops about twenty times slower on
the development host, which made timings measure the collector.
