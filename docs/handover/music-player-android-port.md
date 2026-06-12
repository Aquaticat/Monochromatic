# Handover: porting music-player to Android (Jetpack Compose + Kotlin)

Working state for porting `packages/desktop-app/music-player` (Rust + Slint) to Android, targeting the connected
Pixel 6. Invoked via `/grill-with-docs`. The grilling (design interview) is COMPLETE; no Android code is written
yet. The authoritative decision record is `docs/decisions/music-player-android-port.md`; read it first. This
handover adds the working state, measured facts, and exact next steps.

## Status

- All product forks are resolved (see the ADR). The design tree is fully walked.
- Identity unified to `dev.monochromatic.musicplayer` and committed.
- The user said "Go": the build phase has started. The derisking milestone (toolchain + scaffold + Media3
  skeleton playing real audio on the Pixel 6) is DONE and committed. See "Build progress" below.
- The real Media3 variant is well underway: the pure logic is ported to Kotlin (52 tests), the real Compose UI is
  built, and the library now reads the device's real MediaStore audio library (verified on device). Remaining for
  this variant: a SAF chosen-root source (the desktop's "point at one folder" model), a `MediaSessionService` for
  background/lockscreen, and true-peak as a Media3 `AudioProcessor`. See "Build progress" and "Next steps".

## Build progress (this session)

Milestone 1, the derisk, is complete and verified at the user boundary:

- `929789f1e` feat(music-player-android): scaffold. `packages/android-app/music-player/` is a Gradle island (AGP
  9.2.1 / Gradle 9.5.1 / Kotlin 2.2.10 / Compose BOM 2026.05.01 / Media3 1.10.1), one `:app` with three product
  flavors on the `engine` dimension (`media3`, `hybrid`, `rust`), each with its own `applicationIdSuffix`
  (`.media3` etc.) so all three install side by side. The engine sits behind an `AudioEngine` interface; each
  flavor supplies its own `createAudioEngine` factory. `media3` is the real Media3/ExoPlayer engine; `hybrid` and
  `rust` are throwing stubs so the flavor architecture compiles before the NDK work. All three flavors build green.
  mise tasks (`build:media3`, `build`, `install:media3`, `lint`, `clean`) shell to the committed Gradle wrapper.
- On-device verification (Pixel 6, flock-guarded): the `media3` APK installs, launches, renders the Compose UI,
  lists files, and PLAYS. Tapping a real Opus and a real FLAC drove ExoPlayer through the platform Codec2 decoders
  (`c2.android.opus.decoder`, `c2.android.flac.decoder`) to a live `AudioTrack`. Confirmed finding: no
  `media3-decoder-*` dependency is needed; the platform decodes Opus and FLAC. The ADR codec section is corrected
  to match.
- Measured already: APK sizes media3 14.97 MB vs the stub flavors 11.53 MB, so Media3 + ExoPlayer adds ~3.4 MB.
- AGP 9 gotchas hit and fixed: `core-ktx 1.19.0` (and the current Compose BOM) require `compileSdk 37`, so AGP 9
  rejects compiling against 36 (the exact rejection the runtime vet documented); bumped to compileSdk 37, targetSdk
  stays 36. `BuildConfig` is off by default in AGP 9; enabled `buildFeatures { buildConfig = true }`.
- Getting test audio onto the device: `adb push` into the app's external files dir
  (`/sdcard/Android/data/<appId>/files/`) works on Android 16 / GrapheneOS and creates the dir; the skeleton reads
  that dir (no storage permission needed), which isolates "does Media3 decode" from "does SAF/MediaStore work".
  Clean-named fixtures staged at `/tmp/agent/musictest/` (test1.opus, test2.flac, test3.m4a, test4.mp3).
- Milestone 1.5, the pure-logic Kotlin port, is DONE (a 6-agent workflow, then central verification). The
  platform-independent `core` package now holds faithful ports of relpath, pagination, queue, true-peak, peak
  cache, session, and the audio-extension allowlist, against a fixed contract (ShuffleMode, Page/PageEntry). 52
  host JVM JUnit tests pass via `mise run //packages/android-app/music-player:test:unit` (no device). True-peak
  was verified line-for-line against `truepeak.rs`. Each port was driven by the Rust module plus its `_tests.rs`
  as the test oracle; deferrals are listed under "Integration seams left by the port" below.
- Milestone 2 (in progress), the real player UI, is DONE and verified on device. The debug skeleton is replaced by
  the desktop's narrow single-column layout in Compose (`MainActivity.kt`): seek bar, volume, a wrapping control
  row (3-state shuffle radios, prev/play-next, repeat-track checkbox), the page-tab grid, and the selected page's
  track list with tap-to-play (tap plays; tap the current row toggles pause). New `PlayerController` wires the
  ported `Queue` + `paginate` over the current local-files source and drives the engine, following the playing
  track's page; `AudioEngine` was expanded to load/play/pause/seek/volume/position + a track-ended callback, and
  `Media3Engine` implements it on ExoPlayer. Verified: tapping a row loaded+played via the platform decoder, the
  highlight moved, the seek bar advanced (0:24/0:35), and Play flipped to Pause. Two deliberate platform-idiom
  choices to revisit if the owner wants exact desktop fidelity: the controls use Material3 RadioButton/Checkbox/
  Slider/Button (not the desktop's plain-HTML-styled customs), and the page tabs use filled vs OutlinedButton (not
  the desktop's primary flag); the custom VScrollBar is dropped in favor of LazyColumn's native scroll. Earlier
  this milestone, a real defect was fixed: the skeleton drew under the status bar (edge-to-edge with no insets),
  now handled by `enableEdgeToEdge()` + a Scaffold, plus a system-following dark/light theme.
- Milestone 2 (cont.), the real library source, is DONE and verified on device. `MediaStoreSource.query` reads the
  device audio collection filtered to `IS_MUSIC != 0` (SDK-branched collection URI; `RELATIVE_PATH` projection
  guarded behind API 29, `DATA` fallback below; codepoint-sorted by display path via the core's `compareByCodePoint`).
  A new `Track(uri, displayPath)` splits the playback `content://` URI from the display path: the display paths feed
  the unchanged ported queue/pagination (so the desktop common-prefix trim and folder grouping apply as-is), and
  `PlayerController` keeps a parallel `uris` list it plays by load-order index (`openLibrary` replaces `openTracks`).
  `MainActivity` requests `READ_MEDIA_AUDIO` (33+) / `READ_EXTERNAL_STORAGE` (<=32) behind a permission gate, then
  queries on grant. Verified on device (API 36): the real 3617-track library lists with two folder pages (`Plain`,
  `2025MAR26`), Unicode display paths intact; tapping an opus row loaded the exact `content://` id and played
  (`3LAU Emma Hewitt - Alive Again.opus`, duration 3:40, position ticking, Pause shown); a short WAV ended and
  auto-advanced. A background research workflow corroborated every recall-prone fact against primary docs
  (content:// plays via `ContentDataSource`, no custom DataSource; audio is all-or-nothing, no partial tier;
  `RELATIVE_PATH` carries the documented trailing slash). Honest divergence (advisor-flagged): MediaStore is the
  device-wide library behind the `IS_MUSIC` heuristic, NOT the desktop's single chosen root; the SAF chosen-root
  source (next) is what restores that semantic.
- Device state to resume from: the latest `media3` debug APK (commit `f22f97d0`) is installed on the Pixel 6
  (`dev.monochromatic.musicplayer.media3`) with `READ_MEDIA_AUDIO` granted; it reads the phone's real MediaStore
  library (3617 `IS_MUSIC` tracks under `relative_path=Plain/Music/` and `2025MAR26/...`), NOT the old files-dir
  fixtures. Rebuild + reinstall with `mise run //packages/android-app/music-player:build:media3` then
  `adb -s 1C171FDF600KWW install -r app/build/outputs/apk/media3/debug/app-media3-debug.apk`; re-grant with
  `adb -s 1C171FDF600KWW shell pm grant dev.monochromatic.musicplayer.media3 android.permission.READ_MEDIA_AUDIO`.
  `uiautomator dump` fails on this Compose surface, so drive taps by coordinate (screen is 1080x2400) and read back
  via `screencap` + logcat (`MusicPlayer:I MediaStoreSource:I`). SDK is `local.properties` -> `/var/tmp/vet-jc/android-sdk`.
  adb is flock-guarded on `/tmp/agent/adb-phone.lock`, serial `1C171FDF600KWW`.

## Committed work (on main)

Pre-build (desktop side): `7ea4ad07` unify identity to dev.monochromatic.musicplayer (`src/identity.rs`,
`src/peakcache.rs`, `src/session.rs`, `macos/Info.plist`, `README.md`); `44b4affe` record the Android port ADR.

Android package (`packages/android-app/music-player/`), in order:

- `929789f1e` scaffold: 3-flavor Gradle island, all flavors build green.
- `e7ced156` docs: milestone 1 + codec-claim correction.
- `683da414` port relpath to the Kotlin `core` + host JUnit harness (`testMedia3DebugUnitTest`).
- `ebb5051a` shared core type contract (ShuffleMode, Page/PageEntry).
- `611e03b0` port the pure-logic core (pagination, queue, true-peak, peak cache, session, audio extensions); 52 tests.
- `c70cedee` docs: core port + integration seams.
- `d855776d` fix: edge-to-edge insets, Material3 top bar, system dark/light theme.
- `c87fa94d` real player UI on the ported queue/pagination (narrow layout, tap-to-play), verified on device.
- `c90cd858` docs: real UI milestone + remaining storage/service work.
- `f22f97d0` read the real library from MediaStore (`Track` split, `IS_MUSIC` query, permission gate); verified on device.

Note: concurrent sessions (an iOS vet) interleave their own commits on `main`; those are not part of this work.

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
  a few Vorbis and Opus-in-webm/mkv. No ALAC, AIFF, or ADPCM. Every file is Media3-native. The phone now HAS the
  library on-device (this was synced since the prior session): MediaStore indexes 3633 audio rows, 3617 with
  `IS_MUSIC=1`, the real music under `relative_path=Plain/Music/` (the synced Seafile Plain/Music) plus
  field-recording WAVs under `2025MAR26/...`; the rest is `IS_MUSIC=0` ringtone/notification clutter the source
  filters out. So MediaStore verification runs against the real library, no pushed fixtures or scan trigger needed.
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

Resolved and in use this session (all reused from the prior vets, nothing freshly downloaded except API-37 was
attempted; these `/var/tmp` paths can be reaped, so a future session may need to re-point or re-install):

- Android SDK: `sdk.dir=/var/tmp/vet-jc/android-sdk` (set in the gitignored `local.properties`). It is the jetpack
  vet's SDK and the only one with `platforms/android-37.0` + `build-tools/37.0.0` already present, which
  `compileSdk 37` requires. Note: the tauri vet SDK (`/var/tmp/tauri-vet-work/android-sdk`) has the NDK but its
  cmdline-tools (rev 12.0) cannot fetch `platforms;android-37` (it only parses repo XML up to v3 and skips the v4
  android-37 entry, "Failed to find package"); the vet-jc SDK already had android-37.0 installed, so use it.
- JDK: Temurin 21 via mise (`/home/user/.local/share/mise/installs/java/temurin-21.0.11+10.0.LTS`). The package
  `mise.toml` pins `java = "temurin-21"`, so `mise run //packages/android-app/music-player:<task>` sets JAVA_HOME
  automatically; Gradle reads the SDK from `local.properties`, so no ANDROID_HOME env is needed.
- Gradle: the committed wrapper (9.5.1) drives all builds; it was generated with the standalone
  `/var/tmp/vet-jc/gradle-9.5.1`.
- `cargo-ndk`: installed at `/home/user/.cargo/bin/cargo-ndk` (via `cargo binstall`). NDK for the Rust flavors:
  `/var/tmp/tauri-vet-work/android-sdk/ndk/29.0.13846066` (the vet-jc SDK has none; point `ndk.dir` at it or
  install an NDK into the vet-jc SDK when the Rust flavors start). Rust Android targets are all installed.
- Build matrix in use: AGP 9.2.1, Gradle 9.5.1, Kotlin 2.2.10, Compose BOM 2026.05.01, Media3 1.10.1, compileSdk
  37, targetSdk 36, minSdk 26. Full vet recipe context in
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

Done: step 1 (toolchain), step 2 (scaffold), the skeleton half of step 3 (Media3 plays real audio on device), and
the pure-logic Kotlin port (the `core` package, 52 tests green). Remaining:

1. Finish the real Media3 variant. DONE: the Compose UI (narrow layout, tap-to-play) and the MediaStore library
   source (`openLibrary(List<Track>)`, verified on device). Remaining: (a) a SAF chosen-root source
   (`ACTION_OPEN_DOCUMENT_TREE` + `DocumentsContract`, persisted via `takePersistableUriPermission`) for the
   desktop's "point at one folder" model, feeding the same `openLibrary` with `Track`s whose `displayPath` is the
   tree-relative path (MediaStore and SAF `content://` URIs play identically, per the verified research, so only the
   enumeration differs); its picker is interactive, so it is the one spot that needs a human tap or driven UI, the
   "stop early on a blocker" candidate. (b) Host the player in a `MediaSessionService` (move the engine into the
   service, make the UI a `MediaController` client) for background/lockscreen/notification, fully
   autonomously verifiable. (c) True-peak as a Media3 `AudioProcessor` (the deferred `process_sample` gain stage)
   plus the WorkManager charging/idle sweep. Verify at the user boundary (background/screen-off, notification,
   lockscreen). Instrument metrics from the start.
2. Layer the hybrid and full-Rust variants behind the `AudioEngine` interface (UniFFI + cargo-ndk; mind 16 KB page
   alignment `-Wl,-z,max-page-size=16384`; feed `content://` fds into symphonia via
   `ContentResolver.openFileDescriptor`).
3. Verify each variant on device; Maestro for E2E; `androidx.test` pinned `>= 3.7.0`. Compare all metrics and let
   the user pick the winner.

### Integration seams left by the port (wire these in milestone 2)

The `core` modules are pure; the platform parts were deliberately deferred and injected as parameters so the wiring
is explicit:

- True-peak: `measureTruePeak(channels, chunks: Sequence<FloatArray>)` takes the decoded PCM stream; feed it from
  the platform decoder (an offline ExoPlayer/MediaCodec decode pass for the Media3 variant, symphonia for the Rust
  variants). The gain APPLICATION (`process_sample`, gain-then-clamp, not yet ported) becomes the Media3
  `AudioProcessor`; port it there.
- Peak cache: `core` has FNV-1a fingerprint + in-memory map only. JSON load/save, the atomic write, the
  unsaved-counter batching, and the config-dir path are deferred; back them with Android app-private storage and a
  serialization choice (no library was added). The fingerprint takes `size` + `mtime` as parameters; supply them
  from `DocumentFile`/MediaStore. Cross-language match with the desktop cache is NOT required (Android cache is new).
- Session: `core` has the model + `pruneUnplayable(fileExists predicate)`. `load`/`save`/`session_path` and the
  `ShuffleMode` <-> wire-name mapping (`"Off"`/`"WithinPage"`/`"All"`) are deferred; add them with app-private
  storage. Feed `pruneUnplayable` a SAF/MediaStore existence check.
- Storage walk: `audioFilesSorted` is the pure per-directory filter-then-sort. MediaStore is DONE (`MediaStoreSource`
  returns a flat `IS_MUSIC` query, codepoint-sorted by display path; no recursive walk needed since MediaStore is
  already flat and supplies `RELATIVE_PATH` per row). Still deferred for SAF: the recursive depth-first traversal
  (a folder's own sorted files before its subfolders, subfolders ascending), documented in `AudioExtensions.kt`'s
  KDoc; implement it over `DocumentsContract`.
- Queue: `Queue.new()` seeds from `System.nanoTime()`; `Queue.withRngSeed(Long)` is deterministic for session
  restore and tests. The shuffle uses `kotlin.random.Random`, not the desktop's xorshift64 (sequence not portable).
- Not yet ported (small, port when needed): `frames_to_secs` and `file_name_of` (playback.rs utilities).

GrapheneOS testing notes proven this session: `adb push` into `/sdcard/Android/data/<appId>/files/` works for
fixtures; for the MediaStore default library expect `READ_MEDIA_AUDIO` to be revocable-off by default like INTERNET
was in the vet (grant via `adb shell pm grant <appId> android.permission.READ_MEDIA_AUDIO` for testing); SAF
persistable grants are per-applicationId, so each flavor needs its own grant.

## Gotchas

- GrapheneOS: the player needs no INTERNET permission (offline). Dynamic code loading is blocked (this is what
  kills the Slint UI, but a Rust `.so` loaded via JNI is fine). Avoid All Files Access (scoped storage only).
- The user values faithful porting and corrected under-surveying twice. Survey the desktop source before assuming
  behavior; the MediaStore default library is the one spot that does not map 1:1 to the desktop's folder model.
- Kotlin files do not need the Rust `dum-dum-non-ts` comment convention (that is Rust-file-specific). General repo
  rules apply: run everything through mise tasks, commit eagerly with scoped pathspecs, no AI-attribution trailers.
