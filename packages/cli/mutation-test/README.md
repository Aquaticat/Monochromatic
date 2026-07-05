# @monochromatic-dev/cli-mutation-test

Container-native mutation testing framework built on oxc.

Replaces the StrykerJS-based `dev-script-mutation-test`:
mutants are enumerated host-side with `oxc-parser` and applied by span splicing,
then executed in sharded disposable Podman containers with taint-aware re-runs.

## Trust model

A mutant is arbitrary bad code.
Once the first mutant executes in a container, that container is untrusted:

- Mutants are grouped into shards, one disposable container per shard,
  bounding how many results share a tainted container.
- Any anomaly (per-mutant timeout, runtime error, restore failure, container failure)
  re-runs the shard remainder in fresh half-size shards; bisection bottoms out at
  single-mutant shards, so every mutant eventually gets an untainted position-1 run
  if needed.
- Every Survived and final Timeout result is confirmed as the first mutant in a
  fresh container before being reported. Killed results are accepted from any
  shard position.

## Statuses and reporting

Native versioned JSON report; no mutation score.
Statuses: killed, survived, timeout, compileError, runtimeError.
Each mutant record carries provenance: shard id, position, rerun count, confirmed flag.
Exit code is zero when the run completes (survivors included); nonzero only on
infrastructure failure.

## Type-check filter

Each mutant is checked with `tsgo --noEmit --incremental --project` inside the
shard container (warm `.tsbuildinfo` from the baseline check); non-compiling
mutants are reported as compileError and skip test execution.

## Status

Under construction; design record:
<https://github.com/Aquaticat/Monochromatic/issues/247#issuecomment-4887670850>
(one correction: oxc-parser JS bindings return UTF-16 string offsets, so the
splicer works on JS string slices, not Buffers).
