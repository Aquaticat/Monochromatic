# Depot TOML mutation completion

## Observed timeout and diagnosed boundary

Development run `p9r4xl6n12` canceled container attempt `ltfw0kr3cd` after its 30-minute job limit.
The file-enforcer container check had already failed after `79620.70287899999` milliseconds (`#1070`).
TOML mutation started and had no terminal result;
independent file-enforcer mutation never ran.
The [TOML audit](../audit/depot-toml-reconciliation-2026-10-17.md) retains exact identities and provider usage.

At frozen source `525d2e09f8168a3bdd7e513e26d4c80b363123e5`,
`package/cli/mutation-test/src/host/cli-options.ts` permits each container session to last `1800` seconds.
`package/cli/mutation-test/src/host/orchestrate.ts` can schedule further sessions and retries.
The original trial executor waits for child exit without a per-check deadline,
buffers output to check logs,
and sequences independent gates in one container job.
The outer job budget includes setup and the preceding check.
Cancellation skipped active-log upload and the final source immutability proof.
The mutation campaign's internal cause is not established.

## Trial continuation and evidence retention

The isolated workflow `.depot/workflows/depot-complete-toml-bounded.yml` on
`trial/depot-toml-continuation-20261017` preserves source tasks and flags.
Complete scope runs the original core/generated consumers plus independent container and mutation jobs.
Development mutation-only scope omits the already completed container failure.
The mutation matrix disables fail-fast.
A check deadline or source failure cannot cancel its independent sibling.

The wrapper budgets one consumer for `3600000` milliseconds in a `90`-minute job.
It retains incremental output and correlated container state/events,
sends SIGTERM and then SIGKILL to the owned process group,
and kills/removes only containers carrying its random private label.
Container shutdown operations have independent `60000`-millisecond budgets.
A timed-out started gate remains timed out;
a gate never reached behind a failed prerequisite stays unexecuted.
Cleanup or instrumentation failures remain failed harness outcomes.

The frozen mutator's terminal formatter lists totals,
survivors,
and timeouts,
while complete observed identities reside in shard manifest/report JSON.
The wrapper sets a private `TMPDIR` outside source and retains those raw files and hashes.
The source command receives no extra report flag or changed assertion.
Source identity proofs retain HEAD,
tree,
tracked status,
tool/task hashes,
and available Cargo inputs
before and after consumers,
tied to shared cohort/hash/request-time inputs.

## Verified controls and limits

Exact-source positive controls and a mutated-source rejection control pass.
Both local fixture overrides reject CI mode.
The real container timeout control records `2147483648` memory bytes,
`2` CPU quota,
and `64` PID capacity.
SIGTERM-resistant child and grandchild processes terminate,
and the correlated container is removed with its engine events retained.
A normal source exit `0` passes;
an exit `7` remains failed.
Synthetic shard identity files survive and match their retained hashes.

The initial short cleanup budgets left stopped containers present and correctly failed the controls.
Separate `60000`-millisecond shutdown budgets passed the same boundary.
The cause of Podman's shutdown acknowledgement delay is not established.
Consumer,
process-signal,
shutdown-operation,
and total wrapper intervals are separate evidence fields.
Local controls prove the adapter behavior;
they do not prove source mutation success.
Issue `#1113` remains open pending actual retained consumer outcomes.
Final coherent dispatch is held.

## Default native report

The full CLI emitter writes `cwd()/mutation-report.json` after orchestration.
The TOML source task changes into its monorepo root before invoking that CLI.
The prepared wrapper copies available default reports into the existing external evidence directory.
It hashes each copy and records source mtime and whether the file existed before the consumer.
A report unchanged from before the consumer remains explicitly stale.
This preserves the original command and all assertions.

A native-report positive fixture and a stale-report marking control pass.
The development request predates this copy adapter.
Its separate read-only `depot sandbox exec` observer uses the original VM session and a native command timeout.
The VM `/bin/pwd` probe succeeded;
the observer retained the complete native report with a verified digest.

## Final source guard scope

The [source guard controls](../audit/depot-route-source-guards-2026-10-17.md)
verify a separate final-harness repair under existing issue `#1114`.
The guard rejects both Git index exclusions across tracked source
and compares configured metadata bytes directly to `HEAD`.
Its inventory includes root `.cargo/` configuration and every tracked Cargo manifest and lockfile,
including nested Android Rust metadata.
Untracked and ignored output remains outside this inventory.
The development mutation run retains its original harness identity.

## Actual retained infrastructure outcome

Development run `p6vm5s00w6` completed its independent mutation commands.
File-enforcer failed at its existing package-path `ENOENT` boundary.
TOML retained `3062` distinct mutant identities across `9037` shard attempts,
all marked `runtimeError` after source copying failed before assertions.
Each shard reports `rsync` exit `23` and
`rsync: [generator] chgrp "/work/." failed: Operation not permitted (1)`.
This is the diagnosed root-owned work-tmpfs boundary,
separate from issues `#1116` and `#1117`.

The wrapper did not time out.
Its final cleanup proves no owned process group or labeled container remains.
The combined provider interval is `2834043` milliseconds at `16x64`.
The full native report is retained as compressed byte-identical evidence in
[the terminal audit](../audit/depot-toml-reconciliation-2026-10-17.md#terminal-toml-infrastructure-outcome).
These infrastructure-derived statuses do not establish source mutation completion or passing tests.
The complete current container adapter was exercised by the bounded actual TOML pilot described in the consumer recovery section.

Pilot `0j8zhbn9n0` now exercises that complete adapter through the unchanged source task
with one existing source-file selector and the full unit suite.
Its actual source command completed with exit zero; the wrapper metadata failure remains separate.

## Consumer recovery and metadata observation failure

Actual pilot `0j8zhbn9n0` ran the unchanged one-file source mutation task
through the complete containers adapter from `d098532a5b6946231daf3c4f43e38444359a307e`.
Its baseline is green and the only selected mutant is `compileError`.
This source-terminal result carries no mutant assertion execution credit.
It verifies the owned work volume and unchanged generated-metadata bind on a real TOML consumer.
It does not complete the 3062-identity campaign.

The provider job failed when metadata collection asserted `null !== 0`.
That harness omitted the operation, signal, error code, and stdout/stderr byte counts,
so a timeout is not yet a diagnosis of the historical operation.
The replacement receipt harness logs those fields incrementally before asserting success.
Its disposable timeout control captures `SIGKILL`, `ETIMEDOUT`, and both output streams.
Actual repeat `mj128hqwv0` preserves the eight-second operation budget and original source command.
Collect that result before selecting a remedy or retrying the full campaign.
The [TOML audit](../audit/depot-toml-reconciliation-2026-10-17.md)
retains exact requests, source/harness revisions, cleanup intervals, and provider usage.

## Inherited method lookup emits invalid replacement values

Issue [#1118](https://github.com/Aquaticats/Monochromatic/issues/1118)
is a distinct source producer defect in `package/cli/mutation-test/src/engine/operator/chain-method.ts`.
The unchanged source lookup accepts inherited Object functions as method-swap replacements.
A real source consumer proves mapped-string and unmapped negative controls,
then function-valued `toString`, `constructor`, and `hasOwnProperty` replacements.
JSON omits the function-valued replacement property on three retained cloud candidates.
This does not explain the container source-copy failure;
all of those earlier attempts failed before mutant assertions.
The audit retains exact candidate identities and the verified issue body.
No source-body remedy was applied.
