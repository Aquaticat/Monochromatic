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

The platform apps are being migrated onto this crate stage by stage,
 not in a single cut,
so the crate can be the source of truth before every caller has fully moved.
 Both apps now
share its meter and gain math;
 the higher-level policy,
 the Turso persistence,
 and the
adaptive classifier are the stages that follow.
 Current consumers:

- Desktop (`desktop-app`):
   migrated.
   Depends on this crate by path;
   its true-peak metering and normalization gain come from here,
   and its former in-tree copies are gone.
   It keeps only its own decode-loop opener,
   which feeds decoded chunks into the shared meter.
- Android (`android-app/rust`):
   migrated (meter and whole-buffer helper).
   Its `TruePeakMeter` and `true_peak_interleaved` come from this crate;
   the duplicated copies are gone.
   Android keeps its own measurement policy (a full scan for short tracks,
   a windowed estimate with a safety factor for long ones) until the shared adaptive
   classifier lands and replaces both apps' policies.

The integration work,
 its staging,
 and its current status live in
[the integration handover](../../../doc/handover/music-player-truepeak-core-integration.md).

This is Stage one of the migration described in
[the shared true-peak plan](../../../doc/planning/music-player-shared-truepeak-core.md):
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

`default_policy` holds the decided policy from the Stage-two corpus search:
 a full scan
for short tracks,
 a proportional probe (a fifth of each longer track,
 in short evenly
placed windows),
 and a fixed `0.8 dB` margin.
 The margin is the decision point,
 trading
worst-case too-quiet against the count of cold-start tracks the realtime clamp catches;
 see
the plan's fine-bin findings.
 Changing any constant re-keys the cache automatically.

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
