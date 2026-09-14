# Preparation input verification ownership

## Scope

This package owns the provider-free preparation input CLI,
its standalone bootstrap build,
its application-runtime build and its committed CLI regression tests.
The output remains `unqualified-preparation-root-inputs`.
A passing test,
build,
hash comparison or native qualification grants no root,
phase,
writer or publication approval.

## Committed regression owner

`src/corpus-run/producer-prepare.unit.test.ts` exercises a copied built bootstrap.
`test:unit` depends on `bootstrap:seal`;
verification that intentionally skips task dependencies must build both normal `dist`
and the standalone bootstrap first.

The committed cases cover CLI grammar,
launch-file identity and privacy,
private-child context refusal,
unexpected-fault exit,
and fixture execution failure,
signal and environment-isolation behavior.
`src/message-names-only.unit.test.ts` owns the diagnostic-vocabulary inventory.
These tests are not described as exhaustive native lifecycle or package-path coverage.

`src/corpus-run/producer-input-comparison.unit.test.ts` imports the dedicated built comparison entry.
Its fixture bootstrap exercises persistence,
output verification,
error precedence,
caller ownership,
interruption and callback observation without a provider call.
Callback failures belong to frozen terminal result/error snapshots,
not previously synchronized comparison or failure records.
A fixture bootstrap is not qualification through the actual input CLI.

## Remaining comparison qualification

Task54 closes callback observation and failure-retention integration.
Task51 still checks the non-logger boundaries through the dedicated built entry:

- Input ownership and authentication:
  canonical paths,
  independent launch/bootstrap/Node identities and the exact child environment.
- Persistence:
  exclusive writes,
  original descriptor/path/content checks and retained evidence when recording fails.
- Association and output:
  absent/single/ambiguous child observations,
  dedicated-parent and output/home inventories,
  directory/file privacy,
  completion/created/cleanup bindings and independent artifact hashing.
- Lifecycle:
  cancellation before spawn and during execution,
  error events before actual close,
  deadline escalation and complete-output retention.

Existing artifact tests already cover these categories,
but category presence is not every branch's verification.
The remaining audit adds missing group/directory and late-inventory controls,
records built mutation sensitivity,
and distinguishes native failure cases from fixture-bootstrap coverage.
Defensive checks against a modified JavaScript runtime or arbitrary hostile-host behavior
are not reclassified as ordinary native qualification.
No extra public storage executor or test-only comparison API is introduced.

## Native qualification owner

The reviewer of a frozen launch contract owns native qualification for that exact artifact and host profile.
This is separate from the default portable unit suite.
The native suites currently remain private,
artifact-bound qualification evidence,
not committed portable CI regression coverage.
No claim under the package-completeness or branch-coverage rules is inferred from their presence.

Requalification must use newly frozen executable bytes after a bootstrap,
application,
Node,
library,
Podman or admitted platform-profile change.
The reviewer must read the launch identity separately before running it.
Do not rewrite an executing artifact or resume an existing run.

The qualification record must retain:

- Positive application-entry observation and pre-import refusals.
- Host pre-start inspection refusal and bound-file drift before application startup.
- Ordinary completion,
  malformed/private output and retained usable output after a later failure.
- First interruption during execution,
  creation and cleanup;
  repeated interruption restoring native termination.
- Independent state observation after successful and refused stop commands.
- Failed inspection,
  ambiguous creation,
  evidence-write collision and failed removal/absence verification.
- File-type,
  symlink,
  replacement and extent checks at the exercised input boundaries.
- Exact-ID cleanup only after terminal evidence,
  plus independent absence verification.

Native file-race tests at the launch boundary do not establish every support,
selection,
runtime or output-file branch.
A malformed inspection fixture is not hostile-host authentication evidence.
Guard sensitivity requires a separate built mutation proof;
ordinary negative fixtures are not labelled that proof.

## Current artifact record

The canonical current work record is
[`translation-repair-writer-unit-scope-2026-09-11.md`](../../../doc/planning/translation-repair-writer-unit-scope-2026-09-11.md).
It identifies frozen artifacts,
private qualification source hashes,
full-suite results,
retention manifests and cleanup evidence.
The [comparison work record](../../../doc/planning/translation-repair-preparation-plan-and-journal-2026-09-14.md)
separately identifies the current comparison runtime and its native telemetry cases.
That verification reuses the unchanged qualified Task47 bootstrap/application profile,
not its old parent-comparison implementation.
It covers matched/mismatched bytes,
throwing callbacks and cancellation after successful child completion;
it does not replace the broader lifecycle qualification inventory.
The native platform and tooling investigations are in
[`translation-repair-native-runtime-bundling.md`](../../../doc/troubleshooting/translation-repair-native-runtime-bundling.md).

Byte equality with a direct native serialization uses the same parser and reconstruction implementation.
It is not independent semantic correctness evidence.
The runtime ledger identifies actual test-entry processes;
it does not claim to observe descendants that remove its preload or environment.
