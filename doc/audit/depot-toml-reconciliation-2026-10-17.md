# TOML development-run reconciliation

Run `p9r4xl6n12` is terminal with incomplete selected execution.
The [evidence](depot-toml-reconciliation-2026-10-17.evidence.json)
reconciles the frozen 24-check manifest against actual emitted identities and downloaded artifacts.
This development run is not a complete-graph latency measurement.

## Actual check coverage

Of the 24 package checks, 19 passed and three failed.
TOML mutation started without a terminal result.
File-enforcer mutation never executed.
A `check-started` marker for a deferred check is not proof that its command ran;
the original executor emits scheduling markers even for skipped work.

The core attempt `lzb1kz3c1b` executed 21 checks:
19 passed, and full-package file-enforcer Oxlint plus TOML fuzz coverage failed.
The three container/mutation checks were explicitly deferred in that attempt.
The container attempt `ltfw0kr3cd` passed its first three builds,
failed file-enforcer container tests, and then remained inside TOML mutation until cancellation.
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
The replay command `mise run reconcile-toml -- --assert-complete` fails on this exact missing-terminal boundary.

## Source failures and artifact proof

The separate generated-file check `root.generated-consistency` ran `//:sync:files` and exited successfully.
It failed the clean-output contract because generated `mise.toml` removed package-bin PATH entries.
The retained patch matches the existing ambient-node_modules generation boundary in issue `#335`.
The historical LFS failure in issue `#1071` is a separate incident.
The full-package Oxlint panic remains issue `#1066`, and fuzz coverage remains issue `#1067`.
The unexecuted file-enforcer mutation task has a separate historical path-resolution failure in issue `#1068`.
No source fix is included.

- Generated artifact `01a14824-cf6a-792d-be62-536d80d971cb`:
  SHA-256 `97e1b4b8dd1087ebf4021ddeafe535551f017e20278e111ec768b9b3f7242460`.
- Core artifact `01a14826-ddbd-7b11-ac8f-2a571c7373a9`:
  SHA-256 `473f946fa516ebf1a1d41a31f594b126f0a908e77554d79d25f8d2a60a44b457`.

Every artifact member has a retained byte count and digest.
Downloaded core result records match streamed records, and every check-log hash matches its emitted result.
Extraction validates relative names and writes fresh regular files, with bounded expanded output.
The canceled container attempt has no listed artifact.

## Provider usage and continuation queue

- Attempt `ltfw0kr3cd`: `1816904` provider milliseconds at `16x64`.
- Attempt `lfx15ztb6k`: `89042` provider milliseconds at `16x64`.
- Attempt `lzb1kz3c1b`: `224138` provider milliseconds at `16x64`.

The summed provider intervals are `2130084` milliseconds,
or `34081344` allocated vCPU-milliseconds.
These values retain failed and canceled usage; no monetary total is inferred.

An isolated trial continuation is being prepared with independent container/mutation routing,
a per-check deadline, incremental evidence, source immutability proof, and cleanup/artifact time.
Final coherent dispatch remains held.
