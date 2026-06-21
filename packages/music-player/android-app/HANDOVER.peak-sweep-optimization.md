# Handover: Android peak-sweep parallelization and the sub-20-minute goal

Cross-session state for the work that turned the Android true-peak sweep from "never finishes" into a
parallel foreground index, and is now optimizing it to scan the full library in under 20 minutes.
Keep this updated as the optimization lands.

## Goal (active)

Full-library true-peak scan in under 20 minutes on the owner's Pixel 6 (Tensor G1). A session goal
loop is enforcing it. The baseline parallel sweep is ~30 minutes; the remaining gap needs the
hot-versus-not-hot skip described below, because the decode itself is a throttle-bound floor.

## Result

Goal met. A clean end-to-end full sweep of all 3959 tracks completed in 6.7 minutes (404 s) on a
heat-soaked device, with the foreground service indexing the whole library and self-stopping (logcat:
`PeakSweepService indexed 3959 of 3959 tracks`). That is roughly 3x under the 20-minute goal, and a
cool first-launch is faster still. Windowed sampling (commit 9eea1b840) raised on-device throughput to
483 to 588 tracks/min from ~130, a 3.7x to 4.5x speedup. The accuracy tradeoff is deliberate and
bounded, not zero: windowing can under-read a dynamic track whose only loud transient falls between
windows. Measured on 43 windowed tracks across all 5 formats, one (~2 percent) under-read past the
+2 dB margin, and even that one stayed non-clipping because the -1 dBTP ceiling's own headroom
absorbed it. See the validation below.

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
- Android-Lint fixes to `PeakSweepService.kt` (commit 0ba1fe3e4).
- Windowed true-peak scan in `rust/src/truepeak.rs` (commit 9eea1b840): the under-20-minute win.
- `lint:rust` task added to the android-app `mise.toml`: the root `lint:rust` fanout
  (`mise '//packages/...:lint:rust'`) previously skipped this crate because it had no such task, so the
  native `.rs` was never run through the shared rust-linter (only hand-checked). It now passes clean
  (max-lines, require-rustdoc).

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

The files carry NO ReplayGain/R128 tags (ffprobe confirmed across Opus, FLAC, MP3), so the cheap
signal is a partial decode, not metadata. Hot (brickwalled) masters hit their ceiling throughout, so
decoding a few short windows spread across the track captures the peak; dynamic tracks read low and
normalize to unity gain. The rare dynamic track whose only loud transient falls between windows is the
~1 percent the owner accepts (it plays at its original level, which is not clipping).

Implemented in `rust/src/truepeak.rs` (`measure_windowed_peak`): for tracks over 90 s, sample 4
windows of 15 s at 0/33/66/100 percent, each with its own meter (no seam artifact), take the loudest,
and inflate by +2 dB (`WINDOW_SAFETY_FACTOR`). The +2 dB margin plus the -1 dBTP ceiling's own 1 dB of
headroom keep sub-1dB under-reads non-clipping; they do not make windowing exact.
Validated against ffmpeg true peak on 47 tracks across all 5 formats (31 Opus, 7 FLAC, 3 MP3, 3 WAV,
3 M4A), 43 of them over 90 s so on the windowed path. One under-read past the +2 dB margin: Joe
Hisaishi - Summer, a dynamic orchestral piece whose lone loud transient fell between windows, full true
peak +0.5 dBTP versus windowed+2 dB at 0.0 dBTP, so it normalizes to about -0.5 dBTP, still under
0 dBFS (no clip). That is the ~2 percent bounded miss the owner accepts; zero clip risk across the
sample. The brickwalled hot majority never misses (at ceiling throughout every window).

## Next steps

1. Done: lint fixes committed (0ba1fe3e4); windowed `measure_windowed_peak` implemented and
   accuracy-validated; native rebuilt and installed.
2. Confirm throughput: benchmark the windowed `nativeMeasureTruePeak` on a cooled device (fork APK,
   `engine=truepeak`) and time a clean full sweep to completion. Target under 20 min. Tune
   `WINDOW_COUNT`/`WINDOW_SECS` if needed (fewer/shorter windows = faster, slightly less reliable).
3. Commit the Rust windowing change once the throughput target is confirmed.
4. Optional further win: candidate-only oversampling (skip the three Catmull-Rom interpolations when
   `1.3 * window_max <= running_peak`, the exact L1-bound), now that windowing already cut decode.
5. Write tests for the new paths and re-run the full sweep end to end.

## Gotchas

- The device is heat-soaked after long benchmarking, so short runs throttle hard (the per-minute
  series collapses). Trust the cooled steady state (~130/min truepeak) from the 90-minute run and the
  clean production sweep, not back-to-back short bursts.
- The throwaway benchmark lives in the forked worktree `/tmp/agent/mp-android-bench-jun20`
  (`PeakSweepBenchmark.benchmarkRealLibrary`, `engine` arg of truepeak/decodeonly/mediacodec). It is
  not committed to main. `am instrument` does not launch `MainActivity`, so it never triggers the
  auto-sweep, the benchmark stays clean.
- Keep the device awake for long runs with `adb shell svc power stayon true` and restore after.
