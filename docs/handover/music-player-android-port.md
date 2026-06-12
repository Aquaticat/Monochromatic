# Handover: porting music-player to Android (Jetpack Compose + Kotlin)

Working state for porting `packages/desktop-app/music-player` (Rust + Slint) to Android, targeting the connected
Pixel 6. Invoked via `/grill-with-docs`. The grilling (design interview) is COMPLETE; no Android code is written
yet. The authoritative decision record is `docs/decisions/music-player-android-port.md`; read it first. This
handover adds the working state, measured facts, and exact next steps.

## Status

- All product forks are resolved (see the ADR). The design tree is fully walked.
- Identity unified to `dev.monochromatic.musicplayer` and committed.
- Nothing built yet. The next phase is building all three engine variants on the Pixel 6.
- The user is still in the grilling/planning posture: do NOT auto-start the build. Building is a separate phase
  the user must move into. The user runs with `ultracode` on (use workflows for substantive build phases).

## Committed work (on main)

- `7ea4ad07` refactor(music-player): unify identity to dev.monochromatic.musicplayer. Touched `src/identity.rs`,
  `src/peakcache.rs` (routed through the identity constants instead of a hardcoded triple), `src/session.rs`,
  `macos/Info.plist`, `README.md`. `cargo check` passes on the host (3.88s).
- `44b4affe` docs(decisions): record the music-player Android port plan.

## Resolved decisions (do not relitigate; rationale in the ADR)

- UI: Jetpack Compose. Forced, not chosen: Slint's Android backend crashes on this GrapheneOS device (dynamic
  code loading via `InMemoryDexClassLoader` is blocked), verified on-device by the prior kopia vet.
- Engine: build all three variants behind one `AudioEngine` interface: pure Kotlin + Media3; hybrid (Rust
  true-peak `.so` via UniFFI, Media3 plays); full Rust reuse (whole engine `.so`). Pick by measuring everything on
  device (size, cold-start, latency, battery, memory, build/FFI complexity, maintainability, desktop-sharing, CI
  robustness, and anything else relevant). Instrument metrics from the start.
- Distribution: plan for Play Store, so scoped storage, no `MANAGE_EXTERNAL_STORAGE`.
- Storage: SAF folder tree (`ACTION_OPEN_DOCUMENT_TREE`) for explicit Open; MediaStore (`READ_MEDIA_AUDIO`) for the
  default library. MediaStore is rootless, so its pagination is rebuilt from `RELATIVE_PATH`, not tags. Files are
  `content://` URIs; Media3 reads them directly; the Rust variants open an fd via
  `ContentResolver.openFileDescriptor`.
- Media: standard media app. `MediaSessionService` hosts the player; Compose UI is a `MediaController` client.
  Background playback via `mediaPlayback` foreground service, notification, lockscreen, audio focus, headset.
- UX: tap-to-play only (tap loads+plays, tap the playing row pauses); phone-first single column (drop the desktop
  900px two-pane).
- True-peak: keep the eager whole-library sweep but run it via WorkManager constrained to charging + idle; measure
  the loading track synchronously on a cache miss. The DSP and cache are unchanged.
- Placement: `packages/android-app/music-player/` (new category). Identity: `dev.monochromatic.musicplayer`.
- minSdk 26, compileSdk/targetSdk 36 (37 also fine per the kopia jetpack vet), JDK 21, AGP 9.x, Gradle 9.x, latest
  Compose BOM and Media3.

## Measured hard facts (verified this session; do not re-research)

- Device: Pixel 6 (oriole), GrapheneOS, Android 16 / API 36, arm64-v8a, security patch 2026-06-01. adb serial
  `1C171FDF600KWW`. The build fingerprint spoofs stock Google (GrapheneOS behavior). Other sessions may attach
  devices: guard adb with `flock /tmp/agent/adb-phone.lock` and target `-s 1C171FDF600KWW`.
- Library (host `/home/user/Seafile/Plain/Music`, 3857 files): Opus 2584, FLAC 852, AAC 16 (m4a/mp4), MP3 13, plus
  a few Vorbis and Opus-in-webm/mkv. No ALAC, AIFF, or ADPCM. Every file is Media3-native. The phone itself has no
  music library yet (only a `.thumbnails` dir under `/sdcard/Music`).
- Media3 codec coverage (audited from the androidx/media source clone at `/tmp/agent/media3-20260612`, may be
  reaped): Opus and FLAC via bundled software decoders (`decoder_opus`, `decoder_flac`); AAC, MP3, Vorbis via the
  platform; WAV IMA-ADPCM in `WavExtractor`; ALAC demuxed by the MP4 `BoxParser` but decoding needs the FFmpeg NDK
  extension or a device codec; AIFF has no extractor at all. `content://` is read via
  `DefaultDataSource` to `ContentDataSource` (`openAssetFileDescriptor`). `DefaultAudioSink.Builder.setAudioProcessors`
  and a built-in `GainProcessor` exist (true-peak gain as a custom AudioProcessor is viable).
- `mediaPlayback` foreground service is exempt from the 6h/24h cap (that cap is `dataSync` and `mediaProcessing`
  only), so background playback is uncapped.
- Compose instrumented tests must pin `androidx.test >= 3.7.0` / `runner 1.7.0` on Android 15/16, or the Compose
  BOM's transitive Espresso 3.5.0 crashes (`InputManager.getInstance` removed). Maestro drives black-box E2E via
  `testTag`.

## Build environment (host, as of this session)

- No Android SDK installed. No `java` on PATH (mise has `temurin-17`, `temurin-21`). `adb` present at
  `/usr/bin/adb`. Rust Android targets installed (`aarch64-linux-android` etc.). `cargo-ndk` MISSING. No
  `gradle`/`kotlin` on PATH. No existing Kotlin/Gradle/Android code anywhere in the repo.
- Recipe to mirror (the kopia vets built Compose on this exact device): isolated `ANDROID_HOME` under `/var/tmp`,
  `cmdline-tools` + `platform-tools` + an Android platform + `build-tools`, JDK Temurin 21 via mise, a standalone
  Gradle. The jetpack vet used Gradle 9.5.1 / AGP 9.2.1 / compileSdk 37 / minSdk 24 / Compose BOM 2026.05.01 and
  built + installed + ran on the device. Full step-by-step commands in
  `docs/decisions/kotlin-android-kopia-pcloud-vet-reports/vet-jetpack-compose.md` and `vet-android-runtime.md`.

## Reference artifacts

- ADR (authoritative decisions): `docs/decisions/music-player-android-port.md`.
- Desktop behavioral survey (full structured spec of every module + the Slint UI + per-rule Android-port deltas):
  produced by a workflow this session. Output JSON at
  `/tmp/claude-1000/-var-home-user-Monochromatic/17b04683-9e7b-4fa8-84d1-e2c4fc9a363c/tasks/w8cj0v5yb.output` (may
  be reaped). Regenerate by re-running the saved script at
  `/home/user/.claude/projects/-var-home-user-Monochromatic/17b04683-9e7b-4fa8-84d1-e2c4fc9a363c/workflows/scripts/music-player-desktop-survey-wf_e71b903d-8d8.js`.
  The durable source of truth is the desktop source itself.
- Desktop source: `packages/desktop-app/music-player/src/*.rs` and `ui/app.slint`; `README.md` has a
  module-by-module Layout section. Key exact specs already extracted into the survey: the audio-extension
  allowlist (`flac, wav, wave, mp3, ogg, oga, opus, m4a, m4b, mp4, aac, aiff, aif, aifc`), the pagination
  tie-breaks, the true-peak constants (CEILING `0.8912509`, `gain = min(CEILING/peak, 1.0)`, 4x Catmull-Rom), the
  FNV-1a `path+size+mtime` cache fingerprint, and the full Slint UI property/callback surface.
- kopia Android stack decision + vet reports (the GrapheneOS, Compose-on-device, and runtime findings):
  `docs/decisions/kotlin-android-kopia-pcloud-stack.md` and `docs/decisions/kotlin-android-kopia-pcloud-vet-reports/`.

## Open item awaiting the user

- Config-dir migration. The config-triple change moves the Linux config dir from `~/.config/music-player` to
  `~/.config/musicplayer`. The old dir holds `peaks.json` (298 KB, the library's measured true-peaks) and
  `session.json` (392 KB). Offered to `mv ~/.config/music-player ~/.config/musicplayer` to preserve both; awaiting
  the user's yes/no. Do not touch the real config without confirmation.

## Next steps (the build phase, when the user says go)

1. Stand up the Android toolchain mirroring the kopia jetpack vet recipe (isolated `ANDROID_HOME`, cmdline-tools,
   platform-tools, platform android-36, build-tools, JDK 21 via mise, Gradle/AGP 9.x). Add `cargo-ndk` and the NDK
   for the Rust variants.
2. Create `packages/android-app/music-player/`: a Gradle project, `mise.toml` shelling to the Gradle wrapper,
   `applicationId`/namespace `dev.monochromatic.musicplayer`, minSdk 26, compileSdk/targetSdk 36.
3. Build the shared baseline + the Media3 (pure Kotlin) variant FIRST, end to end, deploy to the Pixel 6, and
   verify it plays real audio at the user boundary (transport, queue, background/screen-off, notification,
   lockscreen). This is the lowest-risk path and proves the whole pipeline. Port the pure logic to Kotlin
   (queue/scope/shuffle, pagination, relpath, true-peak math, peak cache, session); build the Compose UI per the
   survey's UI spec (phone-first single column, tap-to-play, custom radio/checkbox/scrollbar); wire SAF +
   MediaStore sources; host the player in a `MediaSessionService` with ExoPlayer; apply true-peak as a Media3
   `AudioProcessor` plus the WorkManager charging/idle sweep. Instrument metrics from the start.
4. Layer the hybrid and full-Rust variants behind the `AudioEngine` interface (UniFFI + cargo-ndk; mind 16 KB page
   alignment `-Wl,-z,max-page-size=16384`; feed `content://` fds into symphonia).
5. Verify each variant on device; Maestro for E2E; `androidx.test` pinned `>= 3.7.0`. Compare all metrics and let
   the user pick the winner.

## Gotchas

- GrapheneOS: the player needs no INTERNET permission (offline). Dynamic code loading is blocked (this is what
  kills the Slint UI, but a Rust `.so` loaded via JNI is fine). Avoid All Files Access (scoped storage only).
- The user values faithful porting and corrected under-surveying twice. Survey the desktop source before assuming
  behavior; the MediaStore default library is the one spot that does not map 1:1 to the desktop's folder model.
- Kotlin files do not need the Rust `dum-dum-non-ts` comment convention (that is Rust-file-specific). General repo
  rules apply: run everything through mise tasks, commit eagerly with scoped pathspecs, no AI-attribution trailers.
