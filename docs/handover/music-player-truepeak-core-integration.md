# Music player: wiring the shared true-peak core into both apps

Status: in progress, started 2026-07-01.
Owner-of-record for this handover: whoever picks up the next stage.

This handover tracks the work of making `packages/music-player/truepeak-core` an actually
consumed shared crate, rather than a built-but-unwired one. It is the living record the
requester asked to be updated as the migration proceeds; the progress log at the bottom is
the part that changes each session.

## Why this exists

The repo ships the music player twice: a Rust plus Slint desktop app (`desktop-app`) and a
Kotlin plus Jetpack Compose Android app over a Rust engine (`android-app`). The true-peak
measurement and normalization gain were implemented separately in each app's Rust, and the
two copies drifted (the two `truepeak.rs` files differ by hundreds of lines). The shared
crate `truepeak-core` was built to be the single owner of that logic: the Catmull-Rom
meter, the attenuate-only gain math, the decoded-audio source contract, the
window-placement math, and the versioned policy identity that keys the cache.

The gap this handover closes: the crate existed and was tested, but nothing consumed it.
Neither `desktop-app/Cargo.toml` nor `android-app/rust/Cargo.toml` depended on it, and both
apps still ran their own drifted `truepeak.rs`. The crate README and `Cargo.toml` header
had also drifted into a present-tense claim that both apps already depended on it, which
was untrue; those were corrected to describe the staged reality before this work began.

## Design reference

- Plan: `docs/planning/music-player-shared-truepeak-core.md` (the authoritative staging is
  its "Revised staging" section).
- Broader vision: `packages/music-player/PROPOSAL.shared-core.md` (one shared core plus a
  future cross-platform UI package). That is a separate, larger effort; this handover is
  scoped to the true-peak slice only.
- Crate surface: `packages/music-player/truepeak-core/README.md` and `src/lib.rs`.

## Where the plan stands

Against the plan's revised staging:

- Stage zero, platform viability (Turso on Android, both ABIs): done before this work.
- Stage one, shared meter crate: done before this work. `truepeak-core` ships the meter,
  gain, source contract, window placement, and policy identity, with tests and clean lint.
- Stage two, durable evidence (`truepeak-core.bench`): engine done, corpus search ongoing.
- Stage three onward (full shared service with Turso, desktop migration, Android
  migration, cleanup): not started before this work.

The shared crate today ships only the pure math (meter, gain, window, policy identity). The
classifier, the Turso cache I/O, and the warming engine are explicitly later stages and are
not in the crate yet. That bounds what can be shared right now.

## What this work does

The available, low-risk, verifiable slice is to make each app consume the shared meter and
gain math, deleting its own copy of that DSP, while each app keeps its existing higher-level
measurement policy for now (desktop's full scan, Android's windowed scan). This ends the
proven meter-and-gain duplication without waiting on the Turso-service redesign. The
adaptive classifier that unifies the two measurement policies is a later stage, because the
crate does not ship it yet.

Order of execution, most-verifiable first:

1.  Desktop migration. Add `truepeak-core` as a path dependency, route
    `desktop-app/src/truepeak.rs` through `truepeak_core::TruePeakMeter` and
    `truepeak_core::normalization_gain`, delete the duplicated meter and gain, keep the
    desktop-specific decode opener. Fully verifiable on this Linux host (build plus tests).
2.  Android native migration. The analogous swap in `android-app/rust/src/truepeak.rs`,
    verified by cross-compiling the `.so` for both ABIs with `mise run
    //packages/music-player/android-app:build:native`. Requires reading the Android meter
    first to confirm the swap is a refactor and not a hidden behavior change (its file
    carries a windowed scan and a `1.26` safety factor the shared crate does not ship).
3.  Later stages (not in this work): the shared Turso service, deleting the Kotlin
    re-implementations, unifying the two measurement policies behind the shared classifier.

## Parity findings that make the meter swap safe

- `truepeak_core::normalization_gain` is byte-identical to the desktop copy: same
  `CEILING = 0.891_250_9`, same non-positive-peak guard returning `1.0`, same
  `(CEILING / true_peak).min(1.0)` clamp.
- `truepeak_core::TruePeakMeter` uses the identical Catmull-Rom interpolation, the same
  quarter, half, three-quarter interior sample positions, and the same "interpolate only
  once four real samples are buffered" gate. The one difference is a persistent channel
  cursor that keeps routing correct when a decoded chunk ends mid-frame; the old per-app
  meters recomputed `index % channels` per chunk, silently assuming whole-frame chunks.
- Symphonia decodes whole packets, so the desktop decoder emits whole-frame chunks, so the
  shared meter and the old desktop meter produce identical peaks on real input. Where they
  could differ (a mid-frame chunk seam), the shared meter is the correct one.
- Consequence for the desktop peak cache: no reset is needed for the meter-only swap,
  because measured values do not change on whole-frame input. The cache also self-heals on
  a miss, so even a re-measure would be harmless.

## Verification

- Desktop: `mise run //packages/music-player/desktop-app:lint` (cargo check), then
  `:test` (nextest), then `:lint:clippy` and `:lint:rust`. A user-boundary playback check
  is the ideal, but the meter-only swap is value-preserving on whole-frame input, so the
  fixture decode test plus the shared crate's own meter and gain tests cover it.
- Android native: `mise run //packages/music-player/android-app:build:native` cross-compiles
  and links the `.so` for `arm64-v8a` and `x86_64`. Full APK assembly and on-device
  playback need a device and are out of scope for this host; note that in the log.
- Shared crate itself: `mise run //packages/music-player/truepeak-core:test`, `:lint:clippy`,
  `:lint:rust`.

## Remaining after this work

- Android APK assembly and on-device true-peak and playback verification (needs a device).
- The shared Turso service (plan stage three) and moving both apps' persistence onto it.
- Deleting the Kotlin re-implementations of the pure logic (queue, pagination, session,
  and so on) once the wider `music-player-core` exists; that is the `PROPOSAL.shared-core.md`
  effort, not this handover.
- Unifying desktop's full-scan and Android's windowed policies behind the shared adaptive
  classifier, which lands with the classifier in the crate.

## Progress log

- 2026-07-01, 15:15: Corrected the stale present-tense sharing claim in
  `truepeak-core/README.md` and `truepeak-core/Cargo.toml`. Wrote this handover. Confirmed
  the NDK is present (`ndk/29.0.13846066` under the mise android-sdk), so the Android native
  cross-compile is viable on this host. Next: desktop migration.
- 2026-07-01, 15:30: Desktop migration landed (commit `refactor(music-player): migrate
  desktop true-peak onto shared truepeak-core`). Added the `truepeak-core` path dependency,
  routed `desktop-app/src/truepeak.rs` through `truepeak_core::TruePeakMeter` and re-exported
  `truepeak_core::normalization_gain`, deleted the duplicated meter and gain, and slimmed
  `truepeak_tests.rs` to the fixture decode test (gain and spline tests now live in the
  shared crate). Net about 346 lines of duplication removed. Verified: `cargo check`, 76
  nextest tests (including `truepeak::tests::measure_true_peak_of_fixture_is_sane`), clippy,
  and `lint:rust` all green. Marked desktop as migrated in the crate README. Next: read the
  Android `truepeak.rs` to decide whether its meter swap is a clean refactor or a behavior
  change before touching it.
