# file-enforcer-perf TODO

## Statistical rigor

- Each constrained scenario currently runs only once.
  Run each scenario many times (10-30 runs) and report median, p95, and standard deviation.
  This is critical for separating actual performance regressions from CFS scheduling jitter.
- The micro-benchmarks use generous 10-50x thresholds.
  Track a history of benchmark results and alert on sustained drift rather than single-run spikes.
- Warm runs show 2-55ms variance under `--cpus=0.3` purely from CFS jitter.
  Report the percentage of runs that complete within a target latency (e.g., "95% under 10ms") instead of single-run times.

## Benchmark coverage

- No benchmark for the `exec()` operation.
  Add a scenario that shells out to a command whose output is written to a destination file.
- No benchmark for `overwriteIfNotExists` -- only `overwrite` and `overwriteEach` are exercised.
- No benchmark for watch mode latency (time from fs event to re-run completion).
  This would require a different harness that starts the watcher, modifies a file, and measures the response time.
- No benchmark for config files with many independent rules running in `Promise.all`.
  The current perf.config.ts has 12 parallel operations; test with 50-100 to stress the event loop.

## Calibration

- The `--cpus=0.3` calibration is specific to the current host CPU (Ryzen 7 8700F).
  On a different machine, the ratio between host IPC and VPS IPC will differ.
  Consider auto-calibrating: run sysbench on host, compute the CPU fraction needed to match 1605 events/sec.
- IO throttling (`--device-read/write-iops`) only applies to IO that bypasses the page cache.
  Small files (like file-enforcer's workload) mostly hit page cache, so the IOPS limit barely affects results.
  This is realistic (VPS also benefit from page cache), but worth noting for interpretation.
- The block device path (`/dev/dm-0`) is hardcoded for this machine's LUKS setup.
  Auto-detect the block device backing the monorepo directory using `stat` and `/sys/block/` introspection.

## Container setup

- The Containerfile installs sysbench via dnf on every build (cache miss).
  Pre-bake a base image with sysbench to speed up cold builds.
- No pinned version for bun in the container.
  `curl -fsSL https://bun.sh/install | bash` gets the latest, which could change benchmark behavior.
  Pin to a specific bun version for reproducibility.
- The container mounts the entire monorepo as a volume.
  For more isolated benchmarks, copy only the necessary packages into the container.

## Host baseline

- sysbench is not installed on the host (`-1 events/sec` in output).
  Install sysbench on the host for a direct host-vs-container comparison.
  Currently the host baseline only uses the SHA-256 hash benchmark.
- No hyperfine integration in the constrained pipeline.
  `run-e2e.ts` uses hyperfine on the host but `run-constrained.ts` uses single-run timing inside the container.
  Run hyperfine inside the container for consistent methodology.
