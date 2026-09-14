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
The native platform and tooling investigations are in
[`translation-repair-native-runtime-bundling.md`](../../../doc/troubleshooting/translation-repair-native-runtime-bundling.md).

Byte equality with a direct native serialization uses the same parser and reconstruction implementation.
It is not independent semantic correctness evidence.
The runtime ledger identifies actual test-entry processes;
it does not claim to observe descendants that remove its preload or environment.
