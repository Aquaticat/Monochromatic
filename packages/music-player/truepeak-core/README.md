# truepeak-core

Shared true-peak core for the desktop and Android music players.

The two flavors used to carry separate copies of true-peak measurement,
 gain math,
 and
cache shape,
 so a track normalized on one flavor was not guaranteed to be normalized
under the same policy on the other.
 This crate is the single owner of that behavior:
 the meter,
 the gain math,
 the window-placement math,
 and the versioned policy identity
live here once,
 so both apps can share one measured-and-normalized result.

The platform apps are being migrated onto this crate one at a time,
 not in a single cut,
so the crate can be the source of truth before every caller has moved.
 Until a given app
is wired in,
 it still carries its own copy.
 Current consumers:

- Desktop (`desktop-app`):
   migrated.
   Depends on this crate by path;
   its true-peak metering and normalization gain come from here,
   and its former in-tree copies are gone.
   It keeps only its own decode-loop opener,
   which feeds decoded chunks into the shared meter.
- Android (`android-app/rust`):
   not yet migrated;
   still carries its own `src/truepeak.rs`.

The integration work,
 its staging,
 and its current status live in
[the integration handover](../../../docs/handover/music-player-truepeak-core-integration.md).

This is Stage one of the migration described in
[the shared true-peak plan](../../../docs/planning/music-player-shared-truepeak-core.md):
the meter,
 the gain math,
 the decoded-audio source contract,
 the window-placement math,
and the versioned policy identity.
 The classifier,
 the Turso cache I/O,
 and the warming
engine land in later stages on top of this foundation.

## What it measures

True peak (also called inter-sample peak) is the highest level the analog waveform
reaches after a converter reconstructs it between the stored samples.
 It can sit above
the largest stored sample.
 The meter estimates it by oversampling each channel about
four times with a Catmull-Rom cubic at one quarter,
 one half,
 and three quarters between
samples,
 and tracks the largest magnitude.
 The same meter drives both full scans and
window probes,
 which is what makes their peaks comparable.

The gain math turns a measured peak into one constant per-track gain that brings the
track down to a `-1 dBTP` ceiling and never amplifies,
 so playback cannot overflow the
converter.

## Public surface

- `TruePeakMeter` and `true_peak_interleaved`:
   the streaming meter and a whole-buffer
  convenience for tests and synthetic on-device checks.
- `TruePeakSource` and `AudioSpec`:
   the decoded-audio contract the platform implements,
  seeking by frame for reproducible window placement.
- `TruePeakError`:
   the typed error the fallible source methods return.
- `normalization_gain`,
   `peak_dbtp`,
   `probe_estimated_peak`,
   `CEILING`:
   the gain and dB
  helpers.
- `window_frame_starts`,
   `WindowPlacement`:
   even window placement across a long track.
- `Policy`,
   `CacheIdentity`,
   `default_policy`:
   the shipped policy and the identity tuple
  that keys cache rows.

## Policy identity

A cached decision is reusable only when the full identity matches:
 `policy_id` (the
constants,
 classifier,
 gain math,
 and cache interpretation),
 `meter_id` (the meter
behavior,
 including the chunk-seam and end-of-track rules),
 `decoder_stack_id` (the
platform's decoder behavior,
 supplied by the platform),
 and `schema_version` (the row
layout).
 These stay separate so a decoder bump does not churn unrelated rows.
 The
`policy_id` is derived from the policy parameters,
 so changing a constant cannot silently
reuse a stale cache row.

The constants in `default_policy` are provisional starting values from the corrected
target.
 Stage two replaces them with the values found by the corpus parameter search,
which re-keys the cache automatically.

## Tasks

Run these with `mise run //packages/music-player/truepeak-core:<task>`.

- `build`,
   `build:debug`:
   compile the library.
- `lint`:
   `cargo check`.
- `lint:clippy`:
   clippy with warnings denied.
- `lint:rust`:
   the repo's max-lines and require-rustdoc linter.
- `test`,
   `test:debug`:
   the unit tests.
