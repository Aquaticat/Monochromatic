# Music-player true-peak parameter search handover

## Current goal

Find parameter sets for the current music library that decode about `879779/2` seconds of audio while keeping
applied gain error bounded for every decodable track.
The current target is `439889.5` decoded seconds.
The user clarified the intended classification is not only hot versus non-hot:

- **Needs full scan** means the probe cannot safely approximate gain,
   so scan the whole track and apply exact gain.
- **Probably does not need full scan** means the probe-derived gain is acceptable for this current library.
- When loosening bounds,
   loosen the too-quiet side first,
   then the too-loud side.
- The shortest-audio always-scanned threshold must equal `window_seconds * window_count`.

## Important correction

The earlier impossibility proof only applied to the older proposal contract where skipped/non-hot tracks get no gain.
That is not the user's intended search space.
Continue with probe-derived approximate gain for tracks classified as probably not needing full scan.

## Measurement artifacts

Scratch project:

```text
/tmp/agent/truepeak-param-search
```

Current full-library measurement:

```text
/tmp/agent/truepeak-param-search/out-20260624/tracks.jsonl
/tmp/agent/truepeak-param-search/out-20260624/summary.json
/tmp/agent/truepeak-param-search/out-20260624/errors.json
```

Observed current-library summary:

- `3992` audio-extension files found.
- `3991` measured.
- One decode failure remains:
  `/home/user/Seafile/Plain/Music/Fate/Super ☆ Affection.mp4`.
- Full decode total is `887897.8663151219` seconds.
- Target is `439889.5` seconds.

The full measurement uses copied production decoder code from
`packages/music-player/desktop-app/src/decode.rs`,
 `opus.rs`,
 `error.rs`,
 and Catmull-Rom true-peak logic.

## Candidate threshold and window product

Solving `sum(min(track_duration, threshold)) = 439889.5` on the measured current library gives:

```text
threshold_seconds = 113.46868362806399
```

For `14` windows:

```text
window_count = 14
window_seconds = 8.104905973433143
threshold_seconds = window_count * window_seconds = 113.468683628064
```

At that threshold:

- `311` tracks are short enough to always full-scan.
- `3680` tracks are candidates for probe-derived approximate gain.
- Theoretical decoded seconds are `439889.500000025`,
   within floating-point error of target.

## Completed searches and dead ends

`search_params.py` checked a simple fixed-headroom sample-gain model over integer windows.
It found no valid fixed or adaptive candidates at the target.
This was too narrow because it did not allow full-scan exceptions for tracks where probe-derived gain misses the
error envelope.

The original no-params proof is a dead end for the clarified goal.
It assumed non-hot means `0 dB` gain.
That only proves the old exact-or-absent contract cannot hit half decode.
It does not apply once non-hot tracks may use probe-derived approximate gain.

`search_threshold_exact.py` used one-second bins and found approximate candidates for exact target threshold:

- `14` windows of `8.104905973433143` seconds with fixed `1.0 dB` headroom.
- `23` windows of `4.93342102730713` seconds with fixed `1.0 dB` headroom.
- `24` windows of `4.727861817836` seconds with fixed `1.0 dB` headroom.

Exact verification showed the `14` by `8.104905973433143` fixed-margin candidate is not valid:

```text
/tmp/agent/truepeak-param-search/out-20260624/verify-stream-14x8.1049.json
```

It failed because no single fixed margin satisfies both sides:

- `margin_low_db = 1.0680847675897522`
- `margin_high_db = 1.0`
- Chosen `1.069 dB` keeps worst too-loud within bound but makes worst too-quiet `-1.069 dB`.

This means fixed margin is close but fails `+0.5/-1.0` on exact streaming windows.
Next search should loosen the too-quiet side first or add a classifier that full-scans the tracks causing too-quiet
failure.

`search_exceptions.py` was killed after `38s` because its direct nested Python loops were too slow.
Do not resume that script as-is.

`search_count14_fast.py` is a faster NumPy-assisted bin search around `14` windows.
It found optimistic one-second-bin candidates near:

```text
threshold_seconds = 113.45
window_count = 14
window_seconds = 8.103571428571406
margin_db = 0.996 to 1.0
```

The best bin result decoded `439820.7442487232` seconds,
`68.75575127679622` seconds below target,
with no bin-estimated exceptions.
This is not yet verified because one-second bins over-cover fractional window edges and can overestimate sampled
peaks.
Exact streaming verification is required before trusting it.

## Exact window measurement artifacts

`measure_windows.rs` was added under the scratch harness to stream each track once and record exact sampled max/min
for the candidate windows.
The command just run was:

```bash
# from /tmp/agent/truepeak-param-search
cargo run --release --bin measure_windows -- \
  out-20260624/tracks.jsonl \
  14 \
  8.104905973433143 \
  out-20260624/windows-14x8.1049.jsonl
```

Use this file for the exact-target `14` window analysis:

```text
/tmp/agent/truepeak-param-search/out-20260624/windows-14x8.1049.jsonl
```

A second exact measurement is running for the faster bin candidate:

```bash
# from /tmp/agent/truepeak-param-search
cargo run --release --bin measure_windows -- \
  out-20260624/tracks.jsonl \
  14 \
  8.103571428571406 \
  out-20260624/windows-14x8.10357.jsonl
```

Use this file when present:

```text
/tmp/agent/truepeak-param-search/out-20260624/windows-14x8.10357.jsonl
```

It contains per-track:

- full peak
- sampled max peak
- sampled min peak
- actual probe seconds
- whether the track was short and therefore full-scanned

## Next concrete step

Search using `windows-14x8.1049.jsonl` for a rule with these outputs:

- classify some long tracks as needs full scan,
   adding their full durations to decoded seconds;
- classify the rest as probably does not need full scan,
   applying probe-derived gain;
- keep decoded seconds near or at `439889.5`;
- keep every track within `+0.5 dB` too loud and `-1.0 dB` too quiet if possible;
- if not possible,
   loosen too-quiet first,
   then too-loud.

A simple starting rule is fixed margin plus full-scan exceptions:

```text
estimated_peak_dbtp = sampled_max_dbtp + margin_db
probe_gain_db = min(0, -1 - estimated_peak_dbtp)
error_db = probe_gain_db - exact_gain_db
needs_full_scan if error_db is outside allowed bounds
```

For fixed margin near `1.0` to `1.07 dB`,
 count and total duration of exception tracks.
If the added exception duration exceeds the target budget,
 loosen the too-quiet bound incrementally before loosening
the too-loud bound.

## Skills to use

- `diagnose` only if a verifier result appears inconsistent.
- `testing-practices` if converting scratch search into repo tests.
- `handoff` when updating this document for a future session.
