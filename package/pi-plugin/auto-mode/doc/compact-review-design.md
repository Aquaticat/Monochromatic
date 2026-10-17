# Compact prepared-group review

## Status and purpose

This is the implementation direction for the 2026-10-17 rearchitecture.
It is not a claim that the replacement has shipped or reached a particular size.
The user rejects the implementation's current complexity;
archiving diagnostics and removing the retired extension do not complete that request.
There is no accepted numeric line budget.

The current source inventory scans all 830 tracked TypeScript and JavaScript files.
After removing parser-identified comments,
interfaces,
type aliases,
and type-only module declarations,
it counts 68,040 nonblank source lines and 30,301 runtime AST statements.
Remaining annotations and string data still count as source lines.
The static literal-import runtime graph contains 20,153 such lines across 284 files.
Verification contains 30,073 lines across 300 filename-classified files.
Another 17,568 lines sit outside the static runtime graph;
this includes build code and cannot be called dead code without examining generation.

The parser inventory's positive control preserves a comment-looking string,
removes real comments and an interface,
and detects an added statement.
Detailed evidence is retained privately in
`${HOME}/temp/agent/pi-mimo-lint-approval-20261017/code-inventory.json`.

## The required seam

Pi already separates argument preparation,
execution,
and finalization in the qualified `packages/agent/src/agent-loop.ts`.
Its `prepareToolCall` performs tool lookup,
argument preparation,
validation,
and the original before hook.
Its `executePreparedToolCall` runs the actual prepared executable and drains updates.
Its `finalizeExecutedToolCall` retains the native after hook and result handling.

Auto-mode needs one review step after the complete group is prepared and before execution starts.
The original prepared records remain in that native invocation.
Review receives immutable presentation data;
its result does not become a transferable execution capability.

The installed caller constructs one native session preset and awaits its cleanup.
The session privately owns a run record and the current group records.
No caller needs to construct judgments,
issue leases,
publish evidence handles,
or select a manual versus automatic execution owner.

## Native execution module

Retain Pi's preparation,
execution,
and finalization bodies.
Prepare all declared members once,
retain their actual prepared records,
review the complete group,
then release those same records into native execution.
The adapter retains the installed complete-group scheduling and event contract.

The pristine sequential scheduler interleaves preparation and execution,
stops after cancellation,
and emits results immediately.
The installed complete-group implementation has different preparation and completion behavior.
Native reuse therefore needs a narrow adaptation and an event-trace comparison;
source reading alone does not prove equivalence.

The current dispatcher calls `runToolCall`,
suspends it inside `beforeToolCall`,
and adds executable wrappers,
deferred turns,
and completion gates to recover the missing preparation seam.
Selecting the native phase seam removes the reason for those protocols.
Their deletion is required before calling this a simplification.

## Private group module

One private group record retains original membership,
prepared inputs,
actual executable definitions,
callback references,
native cancellation,
source and tool freshness checks,
assessment allowance,
terminal decision,
and member completion state.

Automatic assessment,
exact-group confirmation,
and explicit bypass select a disposition on this same record.
They do not create different member or execution owners.
Freshness failure permanently invalidates it.
Switching a branch or value back cannot revive it.
An established stale decision cannot reopen a generic approval dialog.

Delete the corresponding public judgment publication and guard interfaces,
manual member and execution maps,
`manualOrigins`,
and internal token round trips after equivalent interface tests pass.
Private functions consume their own record directly.
Foreign callbacks and asynchronous effects still require concrete validation.

## Decision module

Retain clause,
heading,
incorporation,
authorization,
admission,
and complete-operation fallback semantics.
Locally planned questions and validated responses replace repeated issuance,
capture,
and reauthentication of evidence produced inside this module.
Stable question IDs,
source/member binding,
complete answer membership,
serving-model attribution,
currentness,
and once-only dispatch remain substantive checks.

Reuse the existing Luna transport and parser utilities.
Keep the model,
`0.60` admission,
startup relevance,
three bundles of three parallel provider calls,
and the existing single shared retry.
Fifteen seconds remains advisory.
Replacing clause interpretation with one operation question would change the decision procedure
and is not part of this refactor.

One provider-material assembly path covers parent calls,
prepared members,
historical calls,
known process-result metadata,
and process notifications.
It excludes thinking,
signatures,
and shell source fields while retaining complete literal output and unrelated data.

## Source and session module

Keep readable policy identity,
selected excerpts,
source freshness,
original main-response identity,
and the selected visible message window.
The window remains the larger of the five-message floor and complete latest-user span.
Passive capture failure cannot break ordinary chat or provider switching.

Collapse source and session handoffs only after tests establish equivalent native mutation observation.
Proof that a source contributed to the primary request is distinct from its readable decision projection.
This refactor does not silently discard the former requirement.
A copied provider string is not a substitute for original source identity.

## Program module

Keep the existing finite codemode profiles,
native VM,
callsite rewriting and round-trip checks,
result conversion,
native nested-call recorder,
and exclusive queues.
Reached result-dependent successor groups use the same private group review seam
after actual arguments become available.
Parent cleanup drains reached work,
including rejection paths.
Unsupported forms retain current manual or explicit-bypass behavior and the fixed guard.

## Build module

Separate generator inputs and verification material from emitted runtime contents.
Do not copy the entire contract tree into each release.
Emit only the generated host modules,
required runtime implementation,
policy data,
and licensing.
Preserve qualification,
immutable release-local identities,
failed-build rollback,
and previous running consumers.
Count actual output files and dependency closure.
The current literal `copiedModules: 13` receipt is not a verified module inventory.

## Verification and deletion order

### Implemented main-group phase seam

The main dispatcher now receives actual native preparation and execution closures
from `native/contract/integration/native-batch/boundary.ts`.
It retains returned prepared records instead of suspending `runToolCall` inside a before hook.
Sequential execution iterates those records;
parallel execution drains their settlements.
The original native execution and finalization functions retain updates,
after hooks,
and native result conversion.
A local executable adapter still supplies the incumbent fifth context argument.

The comparison against immutable baseline `native-release-1voz8z`
matches nine three-member traces,
including validation failure,
native hook blocking,
tool failure,
after-hook failure,
denial,
and cancellation.
The first prototype omitted the canceled prepared member's after hook
and changed validation-failure result order.
The corrected comparison exercises those differences explicitly.

The maintained `test:native:phases` task runs real disposable SDK sessions,
actual native Bash definitions,
original extension callbacks,
awaited update subscribers,
and authored external model responses.
Its sequential and parallel cases provide positive controls for actual execution concurrency.
The eight initial modes pass,
as does the 24-case decision-fallback matrix.

The obsolete executable,
member,
lifecycle,
and completion protocols and their private-mechanism tests are deleted:
22 files,
3,093 physical lines.
This is an intermediate implementation cut.
The child dispatcher,
separate manual ownership,
and judgment/evidence handoffs still require consolidation.
The process-notification freshness investigation remains open.

### Remaining migration

First compare current and replacement native phase traces in disposable builds.
Cover sequential and parallel groups,
before/after hooks,
preparation failures,
updates,
termination,
cancellation,
tool failures,
and cleanup failures.

Then replace separate manual and automatic execution ownership,
public judgment handoffs,
and claim/evidence handles with private group state.
Replace mechanism-shaped tests with tests through the same installed-session seam as consumers.
Demonstrate removed guards cause the replacement tests to fail.
Delete superseded tests and implementations together.

Finally exercise configured installed sessions,
both reported interactions with their preceding turns,
prohibited operations,
source/tool changes during assessment and confirmation,
provider switching after capture failures,
program profiles,
and complete transmitted payloads.
Measure source,
verification,
generators,
clean output,
and runtime dependencies separately.
