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
mise run //package/music-player/android-app:lint:rust
mise run //package/music-player/android-app:clean
```

- `lint` runs Android Lint against the debug variant.
- `lint:detekt` enforces the repository's Kotlin documentation rules.
- `lint:rust` runs the repository's Rust line-budget and rustdoc checks over the nested crate.
- `clean` removes Gradle build outputs.
  It does not remove the Rust target directory or generated JNI libraries.

## Design records and runbooks

Use durable decisions and runbooks for architecture and maintenance context:

- [Android port decision](../../../doc/decision/music-player-android-port.md)
- [Source Root session decision](../../../doc/decision/music-player-session-source-root.md)
- [Live-update rescan decision](../../../doc/decision/music-player-live-update-rescan.md)
- [Just-in-time shuffle decision](../../../doc/decision/music-player-jit-shuffle.md)
- [Peak-sweep parallelism decision](DECISION.peak-sweep-parallelism.md)
- [Page-control style runbook](../../../doc/runbook/music-player-page-control-styles.md)

## Page-control default

Chromium-like tabs are the first-install page-control style.
Their labels use `10dp` inline padding on each side,
half the earlier `20dp` inset.
Persisted style integers retain their stable mapping,
and unknown values still fall back to radio controls.
Each style has one centralized `includedInBuild` toggle on its enum line in `PageControlStyle.kt`.
Settings lists only included styles,
and disabled persisted selections resolve safely without renumbering values.
`../../../doc/runbook/music-player-page-control-styles.md` documents matching Android and desktop changes.

## Custom control sizing

A requested minimum control size applies to both the visible control face and its owned layout target unless the
requirement explicitly says touch-target-only.
Transparent hit padding does not satisfy a requested visible minimum.

Custom interactive Compose controls reserve at least `48dp` by `48dp` inside layout.
Do not rely on Compose expanding touch targets outside undersized bounds,
because adjacent expanded targets can overlap.

## Full-width wrapped LED plate

Super fun LED segmented buttons use one connected machined backplate even when controls wrap.
Compose packs content-width caps into rows,
but one rounded plate always fills the complete available width and combined row height.
Unused row width remains plate material rather than becoming control width or a separate row island.
In light mode,
the `#f7f8fa` plate remains visibly lighter than the `#eceef1` page ground.
Cap end-corner ownership still follows each packed row,
and `placeRelative` preserves cap order in RTL.
LED legends use `MaterialTheme.typography.bodyLarge`,
matching ordinary body labels such as Volume while retaining semibold weight.
Active-cap legend text is always white,
independent of runtime accent or ambient scene.
Every application color operation uses OKLCH,
including Chromium colors and alpha changes outside LED controls.
The selected fill remains dark enough to contrast clearly with its white legend,
even when the runtime Material accent is very light.
Independent OKLCH lightness and chroma mixing retains most available accent chroma,
keeping the selected background vibrant instead of muddy.
