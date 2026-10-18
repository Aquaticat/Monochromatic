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

The pool stages appended origins in its own private array and publishes a cached frozen snapshot on read.
Appending invalidates only that cache;
existing published arrays remain unchanged and repeated reads preserve identity until another append.
This avoids copying every retained prefix for every native query observation.
Three 50,000-input baseline probes consume 9,125,882 to 9,450,071 process CPU microseconds.
Three private snapshot probes consume 441,879 to 543,405 microseconds.
The committed CPU regression fails at 9,989,359 microseconds against a 4,000,000-microsecond budget,
then passes on the maintained snapshot implementation at 483,453 microseconds.
These CPU measurements describe the bounded Node 26 Linux fixture.
The private snapshot probe retains more final heap than its baseline,
about 95.6 MB against 90.8 MB;
the measured benefit is append work, not a retained-memory reduction.

Input-only publication views share a function that always rejects message-payload eligibility.
They retain their distinct occurrence and publication identities without retaining the full text-projection owner.
Live aliases still hold their original owner for native copy propagation;
actual message and system/tool contribution validation keep their existing paths.
The capacity fixture's input-only publications retain 3,607,008 to 3,608,432 bytes before this change.
Its committed memory guard fails at 3,607,384 bytes against a 3,200,000-byte budget;
the private shared-function probe passes at 2,753,832 bytes with the same receipt and root checks.

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

## Native cancellation controls

`native/contract/collector/run-prompt-custody-v3/event-input-projection.ts`
owns the declared top-level `signal` field on input and after snapshots of
`session_before_tree` and `session_before_compact`.
The ordinary copier remains strict for messages,
tool metadata,
nested controls,
extension outputs and every other event kind.

A projection factory belongs to one original emission.
Its weak map represents handle continuity as
`{nativeControl: 'cancellation-signal', reference}`:
the same handle reuses its reference after replacement and restoration.
This marker records identity within the emission;
it provides no instruction or permission authority.
Original callbacks still receive the original event and live signal.

The projection reads own descriptors,
preserves all unrelated fields and never invokes a signal accessor.
It does not read `aborted`,
`reason`,
listeners or internal symbols.
Exact prototype compatibility limits this representation to the declared platform-control shape;
it does not authenticate construction.
Compatible lookalikes remain authority-free references.
The Node v26.12.0 probe accepts a copied prototype and copied internal descriptors through its intrinsic getter,
so that getter cannot supply the proposed authentication proof.
The measured behavior and rejected design are retained in
the repository's [Pi SDK troubleshooting record](../../../../doc/troubleshooting/pi-sdk-staging.md).

`test:native:event-controls` exercises the original runner and retained manager receipt,
including replacement,
restoration,
pre-aborted signals,
accessors,
proxies,
ordinary signal values and the strict boundaries.
Private source-copy rebuilds remove each scope,
identity,
field-preservation,
proxy or opacity guard and make the maintained consumer fail.

The factory was named `createNativeEventControlProjection` in `event-controls.ts`
before its 2026-10-18 extension to declared compaction data.
Its current name is `createNativeEventInputProjection` in `event-input-projection.ts`.
The cancellation reference map remains scoped to one original emission.

## Native compaction file collections

The SDK's `CompactionPreparation.fileOps` contains native string sets for
`read`,
`written` and `edited`.
`compaction-file-paths.ts` projects only those fields in input and after snapshots
of `session_before_compact`.
Each set becomes `{nativeCollection: 'file-path-set', values}`,
preserving insertion order and every string path.
The callback keeps its original event,
preparation and mutable sets.
The existing copier then owns independent snapshot validation and freezing.

This representation retains collection contents rather than opaque handle identity.
The marker grants no source or permission authority.
The helper uses the captured native values method,
checks native set storage and refuses extra own properties,
proxies and non-string members.
It does not invoke instance iterators or preparation accessors.
Unrelated descriptors and ordinary field values remain with the existing copier.
Sets in ordinary message/tool metadata,
other event kinds and extension outputs keep their strict rejection.

The actual RPC compaction on `native-release-hGuAfo` reaches this field profile
and retains the unsupported-prototype capture failure.
The committed `test:native:compaction-inputs` regression reproduces it with the SDK's actual `createFileOps`
and an original native event runner after an ordinary-data positive control.
It also covers callback mutation,
independent before/after snapshots,
wrong roles,
extra properties,
proxy traps and accessors.
The repaired projection still needs its built consumer verification at this checkpoint.

## Loaded and appended message content

Loaded history and live manager appends share `assertManagerMessageContent`.
Both preserve supported native text signatures,
thinking and tool-call blocks locally.
The provider boundary separately excludes thinking,
signatures and raw structured shell commands.
Applying the text-only custom-message validator to all loaded history rejects normal persisted assistants.

`test:native:loaded-message-content` fails against that mismatch before the repair.
After the rebuild,
actual SDK persistence and reopen pass,
and live/load source comparisons cover supported and rejected content catalogs.
A private source-copy rebuild restoring only the text-only validator makes the maintained regression fail.
Successful compaction or navigation alone cannot clear a retained capture error.

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

EVQ:
Native event tests read retained manager receipts and assert capture succeeds;
successful host actions alone do not prove complete evidence.

The additional session-action catalog exposes a native `AbortSignal` in `session_before_tree`.
The SDK also supplies that control field to `session_before_compact`.
The ordinary message/tool copier rejects its prototype,
while the passive event observer deliberately preserves original callback execution.
That combination allows navigation to succeed even though assessment later cannot read complete evidence.
`test:native:event-controls` reads the original manager source after invoking the actual runner;
its committed failing run reproduces that distinction.
The root `TCV` wording remains unchanged.

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
