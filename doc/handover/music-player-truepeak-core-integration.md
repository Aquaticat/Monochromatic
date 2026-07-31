# Music player: wiring the shared true-peak core into both apps

Status:
 in progress,
 started 2026-07-01.
Owner-of-record for this handover:
 whoever picks up the next stage.

This handover tracks the work of making `package/music-player/truepeak-core` an actually
consumed shared crate,
 rather than a built-but-unwired one.
 It is the living record the
requester asked to be updated as the migration proceeds;
 the progress log at the bottom is
the part that changes each session.

## Why this exists

The repo ships the music player twice:
 a Rust plus Slint desktop app (`desktop-app`) and a
Kotlin plus Jetpack Compose Android app over a Rust engine (`android-app`).
 The true-peak
measurement and normalization gain were implemented separately in each app's Rust,
 and the
two copies drifted (the two `truepeak.rs` files differ by hundreds of lines).
 The shared
crate `truepeak-core` was built to be the single owner of that logic:
 the Catmull-Rom
meter,
 the attenuate-only gain math,
 the decoded-audio source contract,
 the
window-placement math,
 and the versioned policy identity that keys the cache.

The gap this handover closes:
 the crate existed and was tested,
 but nothing consumed it.
Neither `desktop-app/Cargo.toml` nor `android-app/rust/Cargo.toml` depended on it,
 and both
apps still ran their own drifted `truepeak.rs`.
 The crate README and `Cargo.toml` header
had also drifted into a present-tense claim that both apps already depended on it,
 which
was untrue;
 those were corrected to describe the staged reality before this work began.

## Design reference

- Plan:
   `doc/planning/music-player-shared-truepeak-core.md` (the authoritative staging is
  its "Revised staging" section).
- Broader vision:
   `package/music-player/PROPOSAL.shared-core.md` (one shared core plus a
  future cross-platform UI package).
   That is a separate,
   larger effort;
   this handover is
  scoped to the true-peak slice only.
- Crate surface:
   `package/music-player/truepeak-core/README.md` and `src/lib.rs`.

## Where the plan stands

Against the plan's revised staging:

- Stage zero,
   platform viability (Turso on Android,
   both ABIs):
   done before this work.
- Stage one,
   shared meter crate:
   done before this work.
   `truepeak-core` ships the meter,
  gain,
   source contract,
   window placement,
   and policy identity,
   with tests and clean lint.
- Stage two,
   durable evidence (`truepeak-core.bench`):
   engine done,
   corpus search ongoing.
- Stage three onward (full shared service with Turso,
   desktop migration,
   Android
  migration,
   cleanup):
   not started before this work.

The shared crate today ships only the pure math (meter,
 gain,
 window,
 policy identity).
 The
classifier,
 the Turso cache I/O,
 and the warming engine are explicitly later stages and are
not in the crate yet.
 That bounds what can be shared right now.

## What this work does

The available,
 low-risk,
 verifiable slice is to make each app consume the shared meter and
gain math,
 deleting its own copy of that DSP,
 while each app keeps its existing higher-level
measurement policy for now (desktop's full scan,
 Android's windowed scan).
 This ends the
proven meter-and-gain duplication without waiting on the Turso-service redesign.
 The
adaptive classifier that unifies the two measurement policies is a later stage,
 because the
crate does not ship it yet.

Order of execution,
 most-verifiable first:

1.  Desktop migration.
     Add `truepeak-core` as a path dependency,
     route
    `desktop-app/src/truepeak.rs` through `truepeak_core::TruePeakMeter` and
    `truepeak_core::normalization_gain`,
     delete the duplicated meter and gain,
     keep the
    desktop-specific decode opener.
     Fully verifiable on this Linux host (build plus tests).
2.  Android native migration.
     The analogous swap in `android-app/rust/src/truepeak.rs`,
    verified by cross-compiling the `.so` for both ABIs with `mise run
    //package/music-player/android-app:build:native`.
     Requires reading the Android meter
    first to confirm the swap is a refactor and not a hidden behavior change (its file
    carries a windowed scan and a `1.26` safety factor the shared crate does not ship).
3.  Later stages (not in this work):
     the shared Turso service,
     deleting the Kotlin
    re-implementations,
     unifying the two measurement policies behind the shared classifier.

## Parity findings that make the meter swap safe

- `truepeak_core::normalization_gain` is byte-identical to the desktop copy:
   same
  `CEILING = 0.891_250_9`,
   same non-positive-peak guard returning `1.0`,
   same
  `(CEILING / true_peak).min(1.0)` clamp.
- `truepeak_core::TruePeakMeter` uses the identical Catmull-Rom interpolation,
   the same
  quarter,
   half,
   three-quarter interior sample positions,
   and the same "interpolate only
  once four real samples are buffered" gate.
   The one difference is a persistent channel
  cursor that keeps routing correct when a decoded chunk ends mid-frame;
   the old per-app
  meters recomputed `index % channels` per chunk,
   silently assuming whole-frame chunks.
- Symphonia decodes whole packets,
   so the desktop decoder emits whole-frame chunks,
   so the
  shared meter and the old desktop meter produce identical peaks on real input.
   Where they
  could differ (a mid-frame chunk seam),
   the shared meter is the correct one.
- Consequence for the desktop peak cache:
   no reset is needed for the meter-only swap,
  because measured values do not change on whole-frame input.
   The cache also self-heals on
  a miss,
   so even a re-measure would be harmless.

## Verification

- Desktop:
   `mise run //package/music-player/desktop-app:lint` (cargo check),
   then
  `:test` (nextest),
   then `:lint:clippy` and `:lint:rust`.
   A user-boundary playback check
  is the ideal,
   but the meter-only swap is value-preserving on whole-frame input,
   so the
  fixture decode test plus the shared crate's own meter and gain tests cover it.
- Android native:
   `mise run //package/music-player/android-app:build:native` cross-compiles
  and links the `.so` for `arm64-v8a` and `x86_64`.
   Full APK assembly and on-device
  playback need a device and are out of scope for this host;
   note that in the log.
- Shared crate itself:
   `mise run //package/music-player/truepeak-core:test`,
   `:lint:clippy`,
  `:lint:rust`.

## Remaining after this work

- On-device Android playback verification (real audio through AAudio with the shared meter,
  plus lockscreen and background controls).
   The synthetic on-device true-peak check already
  passed on a Pixel 6;
   a full audible playback pass is the remaining device check.
- The shared Turso service (plan stage three) and moving both apps' persistence onto it.
- Deleting the Kotlin re-implementations of the pure logic (queue,
   pagination,
   session,
  and so on) once the wider `music-player-core` exists;
   that is the `PROPOSAL.shared-core.md`
  effort,
   not this handover.
- Unifying desktop's full-scan and Android's windowed policies behind the shared adaptive
  classifier,
   which lands with the classifier in the crate.

## Progress log

- 2026-07-01,
   15:15:
   Corrected the stale present-tense sharing claim in
  `truepeak-core/README.md` and `truepeak-core/Cargo.toml`.
   Wrote this handover.
   Confirmed
  the NDK is present (`ndk/29.0.13846066` under the mise android-sdk),
   so the Android native
  cross-compile is viable on this host.
   Next:
   desktop migration.
- 2026-07-01,
   15:30:
   Desktop migration landed (commit `refactor(music-player): migrate
  desktop true-peak onto shared truepeak-core`).
   Added the `truepeak-core` path dependency,
  routed `desktop-app/src/truepeak.rs` through `truepeak_core::TruePeakMeter` and re-exported
  `truepeak_core::normalization_gain`,
   deleted the duplicated meter and gain,
   and slimmed
  `truepeak_tests.rs` to the fixture decode test (gain and spline tests now live in the
  shared crate).
   Net about 346 lines of duplication removed.
   Verified:
   `cargo check`,
   76
  nextest tests (including `truepeak::tests::measure_true_peak_of_fixture_is_sane`),
   clippy,
  and `lint:rust` all green.
   Marked desktop as migrated in the crate README.
   Next:
   read the
  Android `truepeak.rs` to decide whether its meter swap is a clean refactor or a behavior
  change before touching it.
- 2026-07-01,
   15:35:
   Android native migration landed (commit `refactor(music-player):
  migrate Android native true-peak onto shared truepeak-core`).
   Confirmed the Android meter
  matched the desktop's old per-chunk meter,
   so the swap is a refactor on whole-frame chunks.
  Added the `truepeak-core` path dependency (`../../truepeak-core`),
   routed
  `android-app/rust/src/truepeak.rs` through `truepeak_core::TruePeakMeter`,
   re-exported
  `truepeak_core::true_peak_interleaved`,
   deleted the duplicated meter,
   and kept Android's own
  full-scan and windowed policy (the `1.26` safety factor stays until the shared classifier
  lands).
   Net about 436 lines of duplication removed.
   Verified:
   cross-compiles and links for
  arm64-v8a and x86_64 via `build:native`,
   and `lint:rust` passes.
- 2026-07-01,
   15:40:
   On-device verification on the connected Pixel 6 (arm64-v8a).
   Ran the
  `NativeBridgeTest` class non-destructively (`test:instrumented:device`,
   which installs with
  `-r` and keeps the SAF grant and warm cache):
   OK,
   9 tests,
   including
  `nativeTruePeakInterpolatesInterSamplePeaks`,
   which feeds synthetic PCM through
  `nativeTruePeakSynthetic` into the shared `true_peak_interleaved`.
   This proves the shared
  meter runs correctly on the real arm64 target.
   Both apps now consume `truepeak-core`;
   the
  meter-and-gain duplication is gone.
   Remaining stages (policy unification behind the shared
  classifier,
   the Turso service,
   deleting the Kotlin re-implementations) are unchanged above.
- 2026-07-01,
   15:45:
   Stage-two policy decided,
   which supersedes the "shared adaptive
  classifier" framing in the remaining items above.
   The corpus evidence (see the plan's
  Stage-two section) shows no probe-feature or metadata classifier can route the hard tracks,
  because their peaks hide in unsampled gaps,
   so the shared policy is classifier-free:
   full-scan
  short tracks,
   probe a fifth of each long track in short evenly-placed windows,
   and apply a
  fixed `0.8 dB` margin.
   About ninety-nine percent of tracks land within `-0.8 dB` too-quiet;
  the rest clamp on cold start until warming full-scans them.
   `truepeak-core`'s `default_policy`
  now carries these constants (the old `window_count` parameters are gone),
   and the bench's
  committed `--proportional` evaluation reproduces the numbers.
   The policy-unification remaining
  item is therefore "build the proportional probe plus fixed margin into the Stage-three service
  and replace both apps' current policies with it",
   not "build a classifier".
- 2026-07-01,
   16:10:
   Stage-three shared service surface landed in `truepeak-core`.
  `resolve_decision(policy, source)` drives a `TruePeakSource` through the proportional policy
  to a `Decision` (short and unknown-length tracks full-scan;
   long tracks probe at proportional
  coverage with the fixed margin).
   `DecisionCache` (open/get/put) persists one decision per
  `(fingerprint + policy_id + meter_id + decoder_stack_id + schema_version)`,
   never downgrading
  an exact row to a probe.
   `cached_or_resolve` composes them,
   opening the source only on a miss.
  The cache and compose are behind an optional `service` feature,
   so the apps keep their
  dependency-free meter usage and the Android crate is not forced to compile Turso before it
  adopts the cache;
   enabling the feature is part of each app's service adoption (desktop already
  carries `turso`/`tokio`;
   Android's cross-compile was proven by the Stage-zero spike).
   The
  crate's own tasks now run `--all-features`;
   43 tests,
   clippy and lint green.
   What remains for
  the platforms:
   enable the `service` feature,
   supply each app's `decoder_stack_id` and an
  app-private database path,
   feed decoded chunks through a `TruePeakSource` adapter,
   call
  `cached_or_resolve` on the current track and in the warming loop,
   and delete each app's old
  measurement policy (desktop full-scan,
   Android windowed) and the Kotlin peak-cache once the
  Android service handle is wired.
- 2026-07-01,
   17:35:
   Both platform integrations landed;
   the true-peak slice is done.
   First,
  two small shared-crate additions the platforms needed:
   `resolve_full_scan` (an always-exact
  resolver,
   the warming-upgrade primitive the probe policy lacked) and
  `DecisionCache::exact_fingerprints` (the bulk skip-snapshot a warming sweep uses to re-scan
  only tracks with no decision or a mere probe).
   46 crate tests,
   clippy and lint green.
  Desktop (commit `refactor(music-player): migrate desktop true-peak onto shared decision
  service`):
   the peak-cache actor now owns a `DecisionCache` instead of a hand-rolled `peaks`
  table (all SQL,
   schema,
   and exact-over-probe precedence live in the shared crate);
   the sync
  `CacheHandle` carries `u64` fingerprints and `Decision`s;
   a `DesktopSource` adapts
  `decode::Source` to the shared `TruePeakSource` (seconds seek to frame seek);
   `resolve_current`
  (probe-or-full) drives the foreground current-track path and `resolve_full` (always exact)
  drives the background warming sweep,
   which now upgrades probe estimates to exact over idle time.
  The db is `decisions.db` (fresh schema,
   legacy `peaks.db` orphaned;
   no legacy rows imported).
  78 desktop tests,
   clippy and `lint:rust` green on this host.
   Android (commits `refactor(...):
  migrate Android native true-peak onto shared decision service` and `refactor(...): move Android
  peak cache and gain math into native decision service`):
   the windowed policy (four windows,
   the
  `1.26` safety factor) is gone;
   a new native `TruePeakService` handle (`rust/src/service.rs`)
  owns a dedicated thread running a Tokio runtime plus `DecisionCache`,
   reached over mpsc/oneshot
  channels so the Turso connection never crosses threads and the handle is `Send + Sync`,
   while
  the blocking decode runs on the JNI thread.
   New JNI:
   `nativeTruePeakServiceCreate`/`Release`,
  `nativeResolveGain` (foreground,
   cache-aware probe-or-full),
   `nativeWarmTrack` (background exact
  upgrade,
   skip-if-exact);
   `nativeMeasureTruePeak` removed;
   `nativeFingerprint` now returns the
  raw `u64` as a `Long`.
   On the Kotlin side the JSON peak cache (`PeakCacheStore`,
   `core/PeakCache`)
  and the gain math are gone:
   a `TruePeakGain` singleton owns the one process-wide service handle
  (one Turso connection at `filesDir/decisions.db`,
   shared by playback and the sweep);
  `RustEngine.resolveNormalizationGain` calls `nativeResolveGain`;
   the sweep calls `nativeWarmTrack`.
  The native `.so` cross-compiles for `arm64-v8a` and `x86_64` with Turso + Tokio linked;
  `lint:rust` and the KDoc detekt run are green;
   the debug and androidTest APKs assemble.
   On-device
  on the connected Pixel 6:
   `NativeBridgeTest` OK (9 tests,
   including a new
  `truePeakServiceOpensAndResolvesOnDevice` that opens the Turso `decisions.db` in app storage,
  resolves a real track's gain,
   and asserts the cache round-trips) and `PeakSweepWorkerTest` OK
  (2 tests,
   the real warming sweep through `nativeWarmTrack`).
   Follow-ups (non-blocking):
   Kotlin
  `normalizationGain` is now unused in production (verified:
   zero callers in `main/kotlin`,
   only
  `NormalizationTest` calls it) and could be removed with its test;
   the sweep's `measureAndCache`
  no longer returns `SweepOutcome.CACHED` (the native side owns the skip),
   so the coordinator's
  `cached` tally is now always zero,
   though the enum member is still counted in
  `PeakSweepCoordinator`,
   carried in `SweepTally`,
   and exercised by `PeakSweepCoordinatorTest`,
   so
  removing it is a coordinator-and-tally change,
   not a one-line deletion;
   the `ReturnCount` detekt
  rule was disabled repo-wide by maintainer decision;
   the shared
  `resolve_full` upgrade covers every long track,
   which goes beyond the audit's "idle hours
  full-scan the forty-three clipped songs" (a realtime-clamp feedback loop that only re-measures
  clipped tracks remains a possible refinement).
