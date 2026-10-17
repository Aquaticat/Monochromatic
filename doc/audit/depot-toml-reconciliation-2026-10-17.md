# TOML development-run reconciliation

Run `p9r4xl6n12` is terminal with incomplete selected execution.
The [evidence](depot-toml-reconciliation-2026-10-17.evidence.json)
reconciles the frozen 24-check manifest against actual emitted identities and downloaded artifacts.
This development run is not a complete-graph latency measurement.

## Actual check coverage

Of the 24 package checks,
19 passed and three failed.
TOML mutation started without a terminal result.
File-enforcer mutation never executed.
A `check-started` marker for a deferred check is not proof that its command ran;
the original executor emits scheduling markers even for skipped work.

The core attempt `lzb1kz3c1b` executed 21 checks:
19 passed,
and full-package file-enforcer Oxlint plus TOML fuzz coverage failed.
The three container/mutation checks were explicitly deferred in that attempt.
The container attempt `ltfw0kr3cd` passed its first three builds,
failed file-enforcer container tests,
and then remained inside TOML mutation until cancellation.
An independent readonly-parameter plugin build was also never reached in that attempt;
the core attempt separately built and tested that selected plugin successfully.

## Timeout boundary

File-enforcer container tests completed with failure after `79620.70287899999` milliseconds.
Their retained diagnostic repeats the logger sink verification timeout followed by `SIGKILL` from issue `#1070`.
The current evidence does not prove an out-of-memory kill or a causal link between those observations.
TOML mutation started at `2026-10-17T04:36:53.885Z`.
The provider canceled the job at `2026-10-17T05:04:22.162Z` with:

```text
# Depot provider cancellation diagnostic
The job was canceled because it exceeded the maximum execution time of 30 minutes.
```

The original executor waits for each child exit and buffers its output to a file.
It has no per-check deadline.
The job timeout prevented the artifact upload step from retaining the active mutation log.
The mutation task's internal cause remains unknown.
The canceled attempt also lacks an end-of-job source status/hash proof.
The replay command `mise run reconcile-toml -- --assert-complete` fails on this exact missing-terminal boundary.

## Source failures and artifact proof

The separate generated-file check `root.generated-consistency` ran `//:sync:files` and exited successfully.
It failed the clean-output contract because generated `mise.toml` removed package-bin PATH entries.
The retained patch matches the existing ambient-node_modules generation boundary in issue `#335`.
The historical LFS failure in issue `#1071` is a separate incident.
The full-package Oxlint task reported 84 errors across 137 files:

- `test-import(require-eventual-artifact)`: 62.
- `eslint(no-irregular-whitespace)`: 22.

No plugin panic appears in this observation;
issue `#1066` remains a separate historical incident.
Fuzz coverage remains issue `#1067`.
The unexecuted file-enforcer mutation task has a separate historical path-resolution failure in issue `#1068`.
No source fix is included.

- Generated artifact `01a14824-cf6a-792d-be62-536d80d971cb`:
  SHA-256 `97e1b4b8dd1087ebf4021ddeafe535551f017e20278e111ec768b9b3f7242460`.
- Core artifact `01a14826-ddbd-7b11-ac8f-2a571c7373a9`:
  SHA-256 `473f946fa516ebf1a1d41a31f594b126f0a908e77554d79d25f8d2a60a44b457`.

Every artifact member has a retained byte count and digest.
Downloaded core result records match streamed records,
and every check-log hash matches its emitted result.
Extraction validates relative names and writes fresh regular files,
with bounded expanded output.
The canceled container attempt has no listed artifact.

## Provider usage and continuation queue

- Attempt `ltfw0kr3cd`:
  `1816904` provider milliseconds at `16x64`.
- Attempt `lfx15ztb6k`:
  `89042` provider milliseconds at `16x64`.
- Attempt `lzb1kz3c1b`:
  `224138` provider milliseconds at `16x64`.

The summed provider intervals are `2130084` milliseconds,
or `34081344` allocated vCPU-milliseconds.
These values retain failed and canceled usage;
no monetary total is inferred.

This audit records the isolated bounded continuation and its controls.

## Bounded continuation route

The pushed trial branch `trial/depot-toml-continuation-20261017` freezes harness `274ec49595d60f663249d61ab35a0806fe29aff0`.
Its workflow is `.depot/workflows/depot-complete-toml-bounded.yml`,
with required inputs
`cohort_id`,
`manifest_sha256`,
`requested_at`,
and `scope`.
`scope=complete` runs `toml`,
`generated`,
`container`,
and the two-member `mutations` matrix.
`scope=mutations-only` runs only the two missing mutation gates.
The independent jobs preserve the exact source tasks and their original flags.
Each bounded gate has a `3600000`-millisecond consumer budget and a `90`-minute job limit.
Separate cleanup operations have `60000`-millisecond budgets.
The adapter retains incremental stdout,
scoped container states/events,
raw mutant shard JSON,
per-file hashes,
and source/cohort proofs before and after consumers.
The private `TMPDIR` and label-only Podman wrapper are recorded as separate harness overlays.

Exact-source controls pass before and after consumers,
reject a tracked source mutation,
and pass again after restoring the disposable fixture.
Both identity and command-fixture modes reject CI use.
A real container control observed `2147483648` memory bytes,
`2` CPU quota,
and `64` PID capacity.
Its SIGTERM-resistant Node child and grandchild were killed,
and the correlated container was removed.
The `15000`-millisecond consumer timeout control finished in `48354.209200000005` milliseconds,
including acknowledged shutdown and evidence retention.
A normal exit `0` passes,
and an exit `7` remains failed with its output retained.
Synthetic shard manifest/report files are hashed and retained as fixture evidence.
The initial cleanup controls failed honestly with containers still present after their short shutdown budgets;
their original results remain in the evidence alongside the successful control.
Scoped dprint and `git diff --check` pass.

Issues [#1111](https://github.com/Aquaticats/Monochromatic/issues/1111)
and [#1112](https://github.com/Aquaticats/Monochromatic/issues/1112)
retain the two actual lint diagnostic boundaries.
Issue [#1113](https://github.com/Aquaticats/Monochromatic/issues/1113)
tracks the missing-terminal scheduling and artifact-retention boundary.
All three bodies,
open states,
and triage labels were re-fetched and verified.

Development dispatch `p6vm5s00w6` requests only the two missing mutation gates.
Final coherent dispatch remains held.

## Development mutation outcomes

Run `p6vm5s00w6` is a separate development continuation on harness `274ec49595d60f663249d61ab35a0806fe29aff0`.
The provider confirms branch `refs/heads/trial/depot-toml-continuation-20261017` and trigger `workflow_dispatch`.
Actual consumer proofs retain the exact request identifier,
manifest hash,
and request time.
Core,
generated,
and completed container jobs are skipped by `scope=mutations-only`.

File-enforcer mutation attempt `3r4zr1jp80` reached an actual failed terminal outcome,
repeating the doubled package-path `ENOENT` from issue `#1068`.
Its selected source task ran for `298.0142400000004` milliseconds.
The wrapper finished in `2738.735309` milliseconds with cleanup verified.
The provider interval is `95451` milliseconds at `16x64`,
or `1527216` allocated vCPU-milliseconds.
The failure occurred before mutant discovery;
no mutant identities or successful campaign are claimed.
Downloaded artifact `01a1487e-a04e-758b-b2cb-910beb55c0ff` has SHA-256
`490aa2cf69719c8894670599d0914720238b4d654905af0f56fd5f60328734bc`.
All check-log hashes and matching clean before/after source proofs are verified.

TOML mutation attempt `q3xbl70q20` independently selected 54 source files,
excluded 37 test files,
and began building its runtime image.
Its terminal collector remains active;
final outcome and usage are still pending.
These development observations do not form a complete-graph latency sample.
Final coherent dispatch remains held.
