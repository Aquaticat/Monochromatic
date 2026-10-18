# Instruction collection

## Purpose and callers

`native/contract/integration/policy-source` binds readable project policy and visible conversation
to the native session collector.
`native/contract/collector/rule-relevance-sdk-copy` observes original resource loading and reloads.
`native/contract/lifecycle/rule-relevance-cache` retains relevance estimates by original rule content.
The decision review consumes selected original excerpts rather than complete hidden provider requests.

This module exists because text alone does not identify its source,
scope,
or current version.
An identical quotation in tool output and a governing project file cannot acquire the same authority merely by matching.

## Interface and invariants

The collector publishes original readable-source occurrences and freshness checks.
`native/contract/collector/resource-input-custody` copies resource inputs without retaining borrowed mutable records.
The original file observer detects changed readable files.
The original source index supplies clause spans and headings.

`src/visible-context.ts` selects visible session content.
It excludes thinking and provider signatures.
`src/review-operation.ts` supplies the same shell projection for historical and proposed calls.
Startup relevance retains rules scoring at least `0.60` for potential permission relevance.
That selection is independent of the action-approval cutoff.
Changed or missing rules are refreshed through the incumbent cache owner.

Selected excerpts retain original source positions and hashes.
Source freshness is checked again after asynchronous assessment or confirmation.
No relevance score,
source hash,
or successful parse establishes execution permission.

## Alternatives

Sending every hidden provider input would violate the adopted human-readable source scope.
Sending complete policy documents at every judgment would defeat startup relevance selection.
Trusting arbitrary callback text as a readable file would remove the original file's freshness evidence.
The retained collector separates original source capture,
selection,
and interpretation.

## Retained input storage

Retained context contains original immutable source occurrences and publication capabilities.
Its aggregate is not a transport string.
The run owner no longer serializes the entire collection to update an unused byte counter.
That counter caused `RangeError: Invalid string length` during a real MiMo lint session,
before its proposed commands reached assessment.
Removing the counter also removes its wiring through emission,
rendering,
publication,
and context capture.
Actual manager receipt accounting remains in `run-prompt-custody-v3/loaded-pool.mjs`;
its counters have consumers and count separate source records.

`test:native:retained-context-capacity` passes genuine manager argument frames through the original pool
and run context owner.
Its separate records total 686,653,200 bytes,
exceeding the tested engine's 536,870,888-character string limit.
The test checks original publication identities,
repeat observation,
and rejection after the native root changes.
The old build fails at the same `charge()` call as the reported session.

## Verification

`test:native:resource-input`,
`test:native:resource-reload`,
`test:native:context-receipts`,
`test:native:startup-relevance`,
`test:native:decision-context`,
and `test:visible-context` exercise capture,
reload,
selection,
and transmitted excerpts.
The installed replay audits actual requests as described in
[review input verification](../native/review-input-verification.md).

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.
