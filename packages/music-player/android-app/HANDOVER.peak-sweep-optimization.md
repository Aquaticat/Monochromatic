# Handover: Android peak-sweep parallelization and the sub-20-minute goal

Cross-session state for the work that turned the Android true-peak sweep from "never finishes" into a
parallel foreground index, and is now optimizing it to scan the full library in under 20 minutes.
Keep this updated as the optimization lands.

## Goal (active)

Full-library true-peak scan in under 20 minutes on the owner's Pixel 6 (Tensor G1). A session goal
loop is enforcing it. The baseline parallel sweep is ~30 minutes; the remaining gap needs the
hot-versus-not-hot skip described below, because the decode itself is a throttle-bound floor.

## Device and library facts (measured)

- Pixel 6, Tensor gs101, 8 cores: 4 little @ 1.80 GHz, 2 mid @ 2.25 GHz, 2 big @ 2.80 GHz.
- Library: about 3975 tracks under `/storage/emulated/0/Plain/Music/`, mixed formats:
  ~2586 Opus (audio/ogg), ~1197 FLAC, ~147 MP3, ~27 WAV, ~18 MP4/AAC. Opus carries
  `R128_TRACK_GAIN`; FLAC and MP3 carry ReplayGain tags that often include `REPLAYGAIN_TRACK_PEAK`
  (a sample peak, an even more direct hot/not signal). The large lossless FLACs are also the slowest
  to decode, so skipping the non-hot ones saves the most. A real mix of hot and not-hot masters.
- The debug build is `run-as`-able. Clear the one-time flag and cache with
  `adb shell run-as dev.monochromatic.musicplayer rm -f files/peaks.json shared_prefs/peak-sweep.xml`.

## Shipped and committed

- `DECISION.peak-sweep-parallelism.md` (commit f54e61fc2): the on-device benchmark and the config
  decision. Thread priority is the lever, not worker count; 4 workers at `THREAD_PRIORITY_DEFAULT`
  saturates the 4 performance cores; sustained ~130 tracks/min; full library ~30 min.
- Parallel foreground sweep (commit 86b303840): `PeakSweepService` (auto-started from
  `MainActivity.onCreate`, dataSync foreground service, 4-worker default-priority pool, one-time
  SharedPreferences flag, kill-resilient via the cache cursor and atomic batched flush, `onTimeout`
  stop). The decode dispatcher is now a parameter on `measureTrackPeak` and `measureAndCache`, so the
  background upkeep worker keeps the single low-priority thread. Verified on device: auto-starts
  foreground, four `peak-sweep-fg` workers, fills the cache, no crash. Detekt and Android Lint clean.
- Uncommitted at last checkpoint: the two Android-Lint fixes to `PeakSweepService.kt` (SDK-guard the
  API-29 `FOREGROUND_SERVICE_TYPE_DATA_SYNC` constant, use the KTX `edit { }`). Commit these.

## Optimization findings (this session)

- Hardware `MediaCodec` decode is a dead end: 3.8 tracks/min single-thread, 8.7 four-thread, about
  30x slower than symphonia. Android audio `MediaCodec` is software here with heavy per-track setup
  and a concurrent-instance limit. Do not pursue.
- The 4x Catmull-Rom oversampling is about 25 to 32 percent of per-track time (`decodeonly` 198 to
  232/min versus `truepeak` 149 to 176/min in matched bursts). It is accuracy-preserving to optimize:
  the Catmull-Rom interpolation gain is bounded (basis L1-norm at t in {0.25, 0.5, 0.75} peaks at
  1.25), so when `1.3 * window_max <= running_peak` the three cubics cannot beat the current peak and
  can be skipped, giving the identical true peak with far less work. This alone lands around 23 to 25
  min, not under 20.
- The decode (symphonia/libopus) is the irreducible throttle-bound floor for an exact full-track scan.

## The lever to under 20 minutes: skip non-hot tracks

Normalization is attenuate-only: `normalizationGain(truePeak) = min(CEILING / truePeak, 1.0)` with
`CEILING = 0.8912509` (-1 dBTP, `core/Normalization.kt`). A track whose true peak is at or below
-1 dBTP gets gain 1.0, so its exact peak is irrelevant and it never needs measuring. Only hot masters
(true peak above -1 dBTP) need the full true-peak decode.

The cheap, decode-free signal is the Opus loudness tag (`R128_TRACK_GAIN`, and any ReplayGain tags).
Peak is roughly loudness plus crest factor. Using a conservative (generous) crest-factor bound, if
`loudness + bound <= -1 dBTP` the track provably cannot be hot and is skipped to gain 1.0; otherwise
it is measured exactly. Conservative means it over-measures, never wrongly skipping a hot track, so
no clipping is introduced. The owner is comfortable with a 99 percent-reliable hot/not split.

## Next steps

1. Commit the uncommitted lint fixes to `PeakSweepService.kt`.
2. Validate the split: ffprobe is on the host. Pull a varied sample across formats (Opus, FLAC, MP3),
   read `R128_TRACK_GAIN`/ReplayGain (including `REPLAYGAIN_TRACK_PEAK` where present), and compute the
   real true peak with ffmpeg (`astats`/`ebur128`). Confirm the tag predicts "peak above -1 dBTP"
   reliably and set the conservative threshold.
3. Implement in Rust: read the Opus loudness tag (symphonia exposes metadata via `MetadataOptions`),
   skip clearly-not-hot tracks to gain 1.0, measure the rest. Add candidate-only oversampling for the
   tracks that are measured.
4. Re-measure the full sweep on a cooled device; target under 20 min.

## Gotchas

- The device is heat-soaked after long benchmarking, so short runs throttle hard (the per-minute
  series collapses). Trust the cooled steady state (~130/min truepeak) from the 90-minute run and the
  clean production sweep, not back-to-back short bursts.
- The throwaway benchmark lives in the forked worktree `/tmp/agent/mp-android-bench-jun20`
  (`PeakSweepBenchmark.benchmarkRealLibrary`, `engine` arg of truepeak/decodeonly/mediacodec). It is
  not committed to main. `am instrument` does not launch `MainActivity`, so it never triggers the
  auto-sweep, the benchmark stays clean.
- Keep the device awake for long runs with `adb shell svc power stayon true` and restore after.
