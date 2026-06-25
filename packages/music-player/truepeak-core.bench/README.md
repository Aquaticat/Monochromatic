# truepeak-core-bench

Corpus evaluation and corrected-target parameter search for the shared true-peak policy.

This is Stage two of the shared true-peak plan: durable, reproducible evidence built on
the production [`truepeak-core`](../truepeak-core) meter, gain, window-placement, and
policy math, so the benchmark cannot diverge from what playback runs.

## What it does

It reads a per-track measurement corpus (`tracks.jsonl`) where each line is one track
measured by the shared meter: the full true peak and per-second bin peaks. Because the
bins are exact per-second meter peaks, any window policy can be simulated by re-slicing
them, so the search never re-decodes audio.

For a candidate policy `(window_count, window_seconds, probe_margin_db)` it:

- splits tracks into short (exact full scan) and long (probe),
- places the probe windows with `truepeak_core::WindowPlacement` and reads the bins they
  cover,
- computes the probe and exact gains with the shared gain math,
- scores the gain error against the `+0.5 / -2.0 dB` bounds,
- sums the decoded-seconds cost under the plan's amended accounting (a probe-then-full
  track pays both the probe and the full scan),
- ranks candidates by the decided objective: loudest-safe (least worst-case too-quiet)
  first, then simplest classifier.

It then prints the feature distributions of violators versus non-violators, fits a
probe-only full-scan classifier, and writes a per-track feature dump
(`out/long_features.jsonl`) so a metadata-aware classifier can be evaluated offline by
joining on the track path.

## Run

```sh
# tracks.jsonl is produced by the corpus collector (see the plan); not committed.
mise run //packages/music-player/truepeak-core.bench:run -- /path/to/tracks.jsonl
```

The target is computed from the corpus as `total decodable seconds / 4`, the corrected
quarter-library benchmark target.

## Findings so far

The sweep confirms two results that update the plan:

- More, shorter windows at a fixed decode budget cover more distinct regions and shrink
  the gaps that cause under-read, so a higher window count reaches a lower probe margin
  (and a better worst-case too-quiet error) than the prior fourteen-window policy at the
  same budget.
- Amplitude alone does not separate the violators: they are hot masters whose loudest
  sampled window overlaps the non-violators. Provenance metadata does separate large safe
  classes, so the classifier must read audio metadata, not just probe amplitudes (see the
  plan's classifier-search section).

## Tasks

Run with `mise run //packages/music-player/truepeak-core.bench:<task>`.

- `build`: compile the bench.
- `run`: evaluate and search a corpus (pass the `tracks.jsonl` path after `--`).
- `lint`, `lint:clippy`, `lint:rust`: the checks.
