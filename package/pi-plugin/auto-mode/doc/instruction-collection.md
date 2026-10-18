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
Its repeated JSON records and final distinct record total 713,092,714 bytes,
exceeding the tested engine's 536,870,888-character string limit.
The test checks original publication identities,
repeat observation,
and rejection after the native root changes.
The old build fails at the same `charge()` call as the reported session.

The existing manager pool shares equal immutable content,
content hashes,
and serialized metadata within that pool's lifetime.
Every receipt still has its own source occurrence and publication capability.
Equal text does not merge provenance,
and receipt accounting still counts every occurrence.
The capacity fixture checks distinct publications and a later changed input as separate boundaries.

Native event snapshots keep an ordered phase list and a per-emission dictionary of copied values.
Each phase retains its kind,
input/output position,
callback ordinal,
path,
and value ordinal.
Equal copied values share storage within that emission;
changed values receive separate entries.
The dictionary wraps each value so that omitted `undefined` and explicit `null` remain distinct in JSON.
Every phase and distinct value contributes to pending-byte accounting before the source is published.
This belongs to the existing event-input owner rather than another execution or permission layer.

`test:native:event-sharing` compares actual native emissions with separate callback registrations.
For its payload,
one callback retains 30,984 bytes and 30 callbacks retain 36,476 bytes.
All 60 input/after phases preserve their original order and copied values after the borrowed event changes.
The complete native event receipt catalog also expands the representation and checks the original
mutation,
output,
error,
nested emission,
and cancellation cases.
The full-session heap failure remains under investigation;
these measurements establish callback sharing rather than complete-session capacity.

## Source-binding ownership

Every original message source has a distinct frozen plain view bound to its request and source occurrence.
`native/contract/integration/policy-source/run-messages.mjs` keeps identity checks with the governing snapshot.
Its methods are shared within that snapshot;
a private weak set authenticates each original binding before a method reads its view.
Every freshness check still revalidates the governing parent.
Equal content and shared checking code establish neither source identity nor permission.

Per-source closures previously multiplied retained allocation across successive decisions.
The real host's 100,000-receipt sampling profile attributes 476,526,736 bytes to that binding callback.
The profile retains a separate positive-control allocation.
This identifies an allocation owner rather than proving complete-session repair.

`test:native:source-binding-capacity` creates genuine manager inputs and retains complete source collections
across separate governing snapshots.
Its committed red run retains 48,724,128 bytes and exceeds the 36 MiB regression budget.
The test also requires original source ordering,
distinct views,
frozen plain records,
foreign receiver rejection,
source substitution rejection,
and retired-parent rejection.
The class alternative is rejected because it changes the binding's prototype and constructor surface.
Complete configured-host replays remain required after the maintained source rebuild.

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
