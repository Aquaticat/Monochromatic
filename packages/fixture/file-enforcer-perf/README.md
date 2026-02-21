# file-enforcer-perf

Performance benchmark suite for `@monochromatic-dev/dev-script-file-enforcer`.
Tests file-enforcer under VPS-like resource constraints using podman containers with CPU, memory, and IO throttling calibrated against a real VPS baseline.

## Quick start

```bash
# Micro-benchmarks (fast, runs locally)
bun test packages/fixture/file-enforcer-perf/src/perf.bench.test.ts

# End-to-end benchmarks with hyperfine (requires hyperfine)
bun packages/fixture/file-enforcer-perf/src/run-e2e.ts

# Full constrained benchmark in podman (requires podman, ~2 min)
bun packages/fixture/file-enforcer-perf/src/run-constrained.ts
```

## Benchmark fixture

`setup-fixture.ts` creates 240 files across 20 simulated packages at `/tmp/file-enforcer-perf/`:

- 5 markdown docs per package (100 lines each, shared header for dedup testing)
- 3 TypeScript source files per package
- 1 deep-nested module (6 levels: `lib/deep/nested/very/deep/module.ts`)
- 1 `settings.json` per package (for getProperty testing)
- 2 type definition files per package

`perf.config.ts` exercises all major operations: concatenation (5 groups of 4 packages), glob mirroring (3 patterns across 20 packages), getProperty extraction, dedup across all 20 readmes, and deep-glob mirroring.
Writes ~68 destination files total.

## Benchmark tiers

### Micro-benchmarks (`perf.bench.test.ts`)

11 tests using `performance.now()` in `bun:test`.
Detect gross regressions (10x+ slowdowns) but are inherently unreliable due to JIT optimization, GC pauses, and scheduler jitter.
Use generous pass thresholds and consume results to prevent dead code elimination.

### End-to-end (`run-e2e.ts`)

Uses hyperfine for statistically rigorous timing across 4 scenarios:

- **Cold run** -- dest directory empty, all files written fresh
- **Warm run** -- all content unchanged, all writes skipped
- **1 source changed** -- one source modified between runs
- **1 dest changed** -- one dest modified externally between runs

### Constrained (`run-constrained.ts`)

Runs inside a podman container simulating a cheap VPS:

- **CPU**: `--cpus=0.3` (0.3 of a core, calibrated against host IPC advantage)
- **Memory**: `--memory=1g`
- **IO**: `--device-read/write-iops=/dev/dm-0:100`, `--device-read/write-bps=/dev/dm-0:80mb`

Validates constraints by comparing container sysbench score against a known VPS baseline of 1605 events/sec.

## Calibration

The host CPU is an AMD Ryzen 7 8700F with ~1.7x the IPC of a typical VPS Xeon.
`--cpus=0.5` yielded 2710 sysbench events/sec (above the 1605 baseline), so `--cpus=0.3` is used to bring the container below the VPS performance level.

IO throttling limits are set to 100 IOPS and 80 MB/s, simulating a cheap shared HDD.
Verified with `dd` (200 writes in 1.98s = 101 IOPS) and bandwidth tests (4.2 MB/s at 5mb limit).

## Results (as of 2026-02-20)

### Host (AMD Ryzen 7 8700F, NVMe SSD)

- Cold: ~18ms
- Warm: ~16ms
- Source changed: ~16ms
- Dest changed: ~16ms

### Constrained (podman, --cpus=0.3, 1GB RAM, HDD-like IO)

- Cold: ~100ms
- Warm: ~2ms (with read cache)
- Source changed: ~2ms (with read cache + surgical invalidation)
- Dest changed: ~2ms (with read cache + surgical invalidation)

Warm/changed times are dominated by CFS scheduling jitter rather than actual CPU work.
Individual runs may show 40-90ms if they land on a CFS period boundary.

### Before read cache optimization

- Cold: ~196ms
- Warm: ~3ms
- Source changed: ~92ms (re-read all 307 files from disk)
- Dest changed: ~3ms

## Source files

- `setup-fixture.ts` -- creates the 240-file benchmark fixture
- `perf.config.ts` -- exercises all file-enforcer operations against the fixture
- `perf.bench.test.ts` -- 11 micro-benchmarks with JIT limitation notes
- `run-e2e.ts` -- hyperfine-based end-to-end benchmarks
- `validate-resources.ts` -- CPU, memory, IO, and sysbench benchmarks for resource validation
- `bench-in-container.ts` -- runs inside the container, validates cgroup limits, times config execution
- `run-constrained.ts` -- orchestrates podman build, resource validation, and constrained benchmarks
- `Containerfile` -- Fedora 43 with bun and sysbench
