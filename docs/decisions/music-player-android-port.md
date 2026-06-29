# Porting the music-player desktop app to Android

Status:
 decisions accepted;
 build not yet started.
 Date:
 2026-06-12.

## Context

The `packages/music-player/desktop-app` app is a Rust plus Slint native music player (symphonia plus libopus
decode,
 always-on true-peak normalization with an on-disk peak cache,
 an ad-hoc folder-scanned queue with
two-axis pagination,
 session persistence,
 PipeWire/cpal output).
 This records the decisions for porting it to
Android with Jetpack Compose and Kotlin,
 targeting the owner's Pixel 6 (oriole,
 GrapheneOS,
 Android 16 / API 36,
arm64-v8a).

Every capability claim below was verified against primary sources (the androidx/media source for Media3 codec and
audio-pipeline support,
 the connected device for API level and library contents,
 the prior on-device vet in
`kotlin-android-kopia-pcloud-stack.md` for the GrapheneOS and runtime behavior),
 not from web summaries.

## The UI framework is forced, not chosen

Jetpack Compose,
 because Slint cannot run on this device.
 The prior kopia vet verified on this exact Pixel 6 that
Slint's Android backend crashes at startup:
 it loads its Java activity helper via `InMemoryDexClassLoader`
(dynamic code loading),
 which GrapheneOS blocks by default,
 raising a `SecurityException` before any UI renders.
Native Jetpack Compose was verified running on the same device.
 The Slint UI therefore cannot be reused at all
here,
 independent of preference.
 A Rust `.so` loaded via JNI is not affected by the dynamic-code-loading block
(the prior vet ran native Rust on the device),
 so reusing the Rust audio core stays viable even though the Slint
UI does not.

## Codec coverage is a non-issue

The owner's real library (measured on the host:
 3857 files,
 67% Opus,
 22% FLAC,
 the rest AAC,
 MP3,
 Vorbis) is
fully decodable by Media3 with no native extensions.
 This is now verified on the device,
 not just from the source
audit:
 with ExoPlayer's default renderers and zero `media3-decoder-*` dependency,
 the skeleton played a real Opus
and a real FLAC file on the Pixel 6,
 and logcat showed the platform Codec2 decoders doing the work
(`c2.android.opus.decoder` reporting "Configuring decoder:
 48000 Hz,
 2 channels",
 `c2.android.flac.decoder`
reporting "44100 Hz,
 2 channels"),
 with decoded PCM delivered to an `AudioTrack`.
 So Opus and FLAC are decoded by
the platform,
 not by any Media3-bundled or extension decoder,
 which removes a whole dependency and APK-size
category from the Media3 variant.
 AAC and MP3 are likewise platform-decoded.
 The source audit found Media3 gaps
only for ALAC (needs the FFmpeg NDK extension or a device codec) and AIFF (no Media3 extractor at all),
 and neither
format appears in the library.
 The desktop's symphonia
`features = ["all"]` coverage of ALAC/ADPCM/AIFF is over-provisioned in practice.
 The Rust engine paths cover
everything via symphonia regardless.

## Engine approach: explore all three, then pick

The reuse fork reduces to one question (codecs are moot,
 the pure logic ports trivially):
 is the true-peak
normalization engine worth a cross-language Rust/NDK build,
 or reimplemented in Kotlin?
 Rather than decide up
front,
 build all three and choose from working artifacts:

- Pure Kotlin plus Media3:
   rewrite the engine in Kotlin;
   true-peak gain as a Media3 `AudioProcessor`
  (`DefaultAudioSink.Builder.setAudioProcessors` and a built-in `GainProcessor` confirmed in source),
   measurement
  as an offline Kotlin decode pass.
   One language,
   one Gradle build,
   no FFI.
- Hybrid:
   keep only the true-peak measurement DSP as a small `.so` via UniFFI;
   Media3 plays and applies the gain.
- Full Rust reuse:
   the whole engine (symphonia,
   opus,
   truepeak,
   queue,
   pagination,
   relpath,
   session) as a `.so`
  via UniFFI;
   Kotlin does only Compose UI,
   audio output,
   and file access.

The three share roughly 90% (the Compose UI,
 the MediaSessionService,
 the SAF/MediaStore source,
 the session
store,
 and the ported pure logic),
 differing only at the engine layer,
 so they are realized as one app with the
engine behind an `AudioEngine` interface and three implementations.
 Build the Media3 variant end to end first (it
is lowest risk and proves the whole device pipeline),
 then layer the two Rust variants.
 Stop an approach early
only on a blocker that cannot be worked around.

The winner is chosen by measuring every built variant on the device,
 weighing all the factors the owner named (and
any others that prove relevant):
 APK size,
 cold-start time,
 seek and track-change latency,
 battery during the
charging/idle sweep,
 memory,
 build and FFI complexity,
 maintainability,
 desktop-engine-sharing,
 and CI robustness.
The build is instrumented to emit this evidence from the start,
 so the pick does not require rebuilding to measure.

## Distribution and storage: plan for Play Store

Plan for Play Store policy even though distribution is currently personal sideload,
 because Android's trajectory is
to force scoped storage and tighten sideloading (the developer-verification mandate lands 2026 to 2027) regardless.
So:
 scoped storage,
 no `MANAGE_EXTERNAL_STORAGE`.

Storage uses both source mechanisms,
 mirroring the desktop's two source modes:

- SAF folder tree (`ACTION_OPEN_DOCUMENT_TREE`) for the explicit Open action:
   the picked folder becomes the queue,
  recursed via `DocumentsContract`,
   with the tree URI persisted via `takePersistableUriPermission` to auto-restore
  on launch.
- MediaStore (`READ_MEDIA_AUDIO`) for the auto-loaded default library (the desktop's launch-time music-directory
  auto-load).
   MediaStore is rootless,
   so unlike the SAF tree it has no single loaded root;
   its pagination is
  rebuilt from the `RELATIVE_PATH` column (the folder hierarchy under the shared collection),
   never from tags,
  which the desktop deliberately refuses to parse.
   This is the one place the desktop's folder-relative model does
  not map 1:1,
   and it was chosen with that tradeoff understood.

Files are `content://` URIs,
 not filesystem paths.
 Media3 reads them directly (`DefaultDataSource` routes
`content://` to `ContentDataSource`,
 confirmed in source).
 The Rust engine paths open an fd from the same URI via
`ContentResolver.openFileDescriptor` and hand it across FFI (symphonia reads any `Read + Seek`).
 The peak-cache
fingerprint,
 which the desktop computes from path plus size plus mtime,
 uses the document URI string plus the
size and modified-time from `DocumentFile`/MediaStore.

## Media-system integration: standard media app

A `MediaSessionService` hosts the player;
 the Compose UI is a `MediaController` client.
 This provides background
playback via a `mediaPlayback` foreground service (verified exempt from the 6h `dataSync`/`mediaProcessing` time
cap),
 a media notification with transport controls,
 lockscreen controls,
 audio focus,
 and headset/Bluetooth
buttons.
 Nearly free from Media3's `MediaSession` in the Media3 and hybrid variants;
 the one piece the full-Rust
variant hand-builds.
 Android Auto,
 Wear,
 and post-reboot resumption are out of scope for now.

## UI adaptations to touch

- Row interaction:
   tap-to-play only.
   A single tap loads and plays the track;
   tapping the playing row pauses or
  resumes.
   This replaces the desktop's mouse idiom (tap selects and loads paused,
   a second tap plays),
   which reads
  as a broken no-op on touch.
   The cue-without-playing capability is dropped.
- Layout:
   phone-first single column.
   Port only the desktop's narrow layout (a `FlowRow` page-tab grid above a
  `LazyColumn` track list in one shared scroll);
   drop the 900px two-pane layout,
   which never triggers on a phone in
  portrait.
   A `WindowSizeClass` two-pane layout can be added later if a tablet or foldable becomes a target.

## True-peak measurement: eager sweep, battery-aware

Keep the desktop's pre-measure-the-whole-library behavior,
 but run the sweep via WorkManager constrained to
charging plus idle so it warms the cache without draining battery on the go.
 The loading track is still measured
synchronously on a cache miss so it starts at the correct gain.
 The true-peak math (CEILING `0.8912509` = -1 dBTP,
attenuate-only `gain = min(CEILING / peak, 1.0)`,
 4x Catmull-Rom oversampling) and the FNV-1a peak cache are
unchanged;
 only when measurement runs changes.

## What carries over unchanged

These are pure logic with no platform seam (reimplemented in Kotlin for the Media3 variant,
 reused via FFI for the
Rust variants),
 per the source survey:

- The queue,
   scope,
   and shuffle state machine:
   the three-state shuffle (off / within-page / all),
   the
  page-confined playback scope,
   repeat-track,
   and the deterministic seedable shuffle.
- The two-axis pagination:
   top-level-folder pages for subfolder tracks;
   ASCII-letter A-Z pages plus a `#`
  catch-all for root tracks (non-ASCII letters such as `é` route to `#`);
   folder-pages-first,
   case-folded sort.
  Unchanged for the SAF-tree source,
   which has a loaded root;
   for the MediaStore source the same algorithm runs on
  `RELATIVE_PATH`-derived display strings (see the storage note above).
- The relative-path stripping for display labels.
- The session model (queue,
   cursor,
   position,
   volume,
   shuffle,
   repeat-track),
   persisted to app-private storage;
   the
  saved track list becomes persisted SAF URIs.
- The audio-extension allowlist and the recursive folder expansion (the expansion's I/O retargets to
  `DocumentsContract`;
   the walk and sort logic is unchanged).

## Verification bar

The phone is connected,
 so every variant must build,
 deploy to the Pixel 6,
 and be verified at the user boundary:
real audio plays through the device,
 transport and queue work,
 background playback survives screen-off,
 and the
media notification and lockscreen controls function.
 Compose instrumented tests pin `androidx.test >= 3.7.0 /
runner 1.7.0` (the Compose BOM's transitive Espresso 3.5.0 crashes on Android 15/16).
 Maestro drives black-box
end-to-end via `testTag`.

## Lower-priority defaults

- Placement:
   a new `packages/music-player/android-app/` category alongside `desktop-app` and `desktop-daemon`,
   a
  Gradle project wrapped by mise tasks shelling to the Gradle wrapper (the kopia vet established this island
  pattern;
   there is no shared build graph with pnpm/cargo).
- Identity:
   `applicationId` and namespace `dev.monochromatic.musicplayer`,
   unified with the desktop's macOS bundle
  id and config triple (both changed to `dev.monochromatic.musicplayer`);
   the Linux Wayland `APP_ID` stays
  `monochromatic.music-player` because it is the `.desktop` basename and KDE `WM_CLASS`,
   where renaming breaks.
- minSdk 36,
   compileSdk 37,
   targetSdk 36,
   JDK 21 (mise temurin-21),
   AGP 9.
  x,
   Gradle 9.
  x,
   latest Compose BOM and
  Media3.
   minSdk was raised from 26 to 36 on 2026-06-12 by owner directive:
   this is a single-target app for the
  owner's Pixel 6 (Android 16 / API 36),
   so there is no need to support older releases and modern platform APIs are
  used without compat guards (for example the two-argument `MediaFormat.getInteger(name, default)`,
   API 29).
   The
  Rust variants add the NDK,
   cargo-ndk,
   UniFFI,
   and 16 KB page alignment (`-Wl,-z,max-page-size=16384`).

## Out of scope

Android Auto,
 Wear OS,
 post-reboot playback resumption,
 ALAC/AIFF/ADPCM decoding (absent from the library),
 the
desktop's wide two-pane layout,
 and gapless playback (permanently out of scope on the desktop too).
