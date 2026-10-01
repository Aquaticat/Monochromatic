# rpiv-todo 2.11.0 nested calls can lose live tasks during replay

## Symptom

The live task list can accept updates through `tools.todo()` inside `codemode`,
then return to an older snapshot after replay.
A subsequent query reports `Error: #95 not found`.
The qualification history retains eleven reconciliation receipts.
A separate query during diagnosis again returned that error.
These observations are not individually correlated with lifecycle events.

The separately observed `codemode` diagnostic is a different incident:
`RangeError: store is full: stored values would exceed 1048576 characters of JSON`.
Clearing obsolete stored values addresses capacity,
not task replay.
The interrupted qualification supplement was not written or launched.

## Root cause

This is an inspected composition failure,
not a claim that the whole harness is broken.
Loaded-source identity has not been independently established.
The deciding installed implementations were rpiv-todo 2.11.0 and Pi 0.99.1.

### Live state and the persisted snapshot differ

In rpiv-todo `todo.ts:78` to `todo.ts:81`,
execution changes live state and returns a result envelope:

```typescript
// packages/rpiv-todo/todo.ts
const result = applyTaskMutation(getState(sid(ctx)), params.action, params as TaskMutationParams);
commitState(sid(ctx), result.state);
return buildToolResult(params.action, params as TaskMutationParams, result.state, result.op);
```

The snapshot is returned in `details`,
not independently persisted by this mutation seam.
`tool/response-envelope.ts:90` constructs `tasks: state.tasks` and `nextId: state.nextId`:

```typescript
// packages/rpiv-todo/tool/response-envelope.ts
const details: TaskDetails = {
    action,
    params: params as Record<string, unknown>,
    tasks: state.tasks,
    nextId: state.nextId,
    ...(op.kind === "error" ? { error: op.message } : {}),
};
return { content: [{ type: "text", text }], details };
```

### Nested results are not direct transcript snapshots

Pi 0.99.1 `dist/core/nested-tool-calls.js:153` explicitly distinguishes nested results:

```javascript
// Pi installed dist/core/nested-tool-calls.js
// Nested results are not persisted, so their usage is only counted through the recorder.
if (outcome.result.usage)
    scope.recorder.addUsage(outcome.result.usage);
```

`dist/core/agent-session.js:693` attaches call summaries to the parent message as `nestedCalls`.
`dist/core/nested-tool-calls.js:40` creates summaries containing identity,
name,
status,
and admitted arguments,
not the returned task snapshot.

```javascript
// Pi installed dist/core/nested-tool-calls.js
const record = { id: toolCall.id, name: toolCall.name, status: "unfinished" };
```

`dist/extensions/codemode/execute.js:172` returns text to the script for a tool without `outputSchema`.
Its `execute.js:194` snapshot is a call-summary envelope:

```javascript
// Pi installed dist/extensions/codemode/execute.js
const snapshot = () => ({ calls: calls.map((call) => ({ ...call })) });
```

Printing a nested task result therefore does not create a direct `todo` result with task details.
The installed implementation can persist ordinary direct messages through
`dist/core/agent-session.js:741`:

```javascript
// Pi installed dist/core/agent-session.js
entryId = this.sessionManager.appendMessage(event.message);
```

### Replay selects the old direct snapshot

rpiv-todo `state/replay.ts:29` to `state/replay.ts:31` filters the branch:

```typescript
// packages/rpiv-todo/state/replay.ts
if (e.type !== "message") continue;
const msg = e.message;
if (msg?.role !== "toolResult" || msg.toolName !== "todo") continue;
if (!isTaskDetails(msg.details)) continue;
```

`index.ts:186` and `index.ts:199` replace the live slot using that replay result:

```typescript
// packages/rpiv-todo/index.ts
replaceState(id, replayFromBranch(ctx));
```

The handlers at `index.ts:194`,
`index.ts:219`,
and `index.ts:223` cover the replay events:

```typescript
// packages/rpiv-todo/index.ts, selected handler registrations
pi.on("session_start", async (_event, ctx) => {
pi.on("session_compact", async (_event, ctx) => {
pi.on("session_tree", async (_event, ctx) => {
```
A nested mutation can consequently disappear when the most recent direct snapshot predates it.
This source chain establishes the failure mechanism,
not the triggering event for every historical recurrence.

## Verification

The read-only upstream clone was pinned to `68d9a0014b70006d7b04b57933752338a2716db7`.
Its replay,
tool,
and lifecycle files matched the corresponding installed files using `cmp`.
That clone's revision is not a release-version or loaded-source attestation.

The disposable harness is retained in the separate qualification repository:
`contract/diagnostic/todo-codemode-replay/`.
Copied modules change only the runtime state import from `.js` to `.ts`.
No installed module or real task state was changed by the fixture.

```sh
# Separate qualification repository, not this repository
cd -- "$HOME/temp/agent/auto-mode-consumer-contract.mDLkyNoP/contract/diagnostic/todo-codemode-replay"
TODO_REPLAY_SESSION_METADATA_PATH='<existing session file>' mise --no-env --no-hooks run probe-v2
```

The path is an explicit input,
not an instruction to upload or copy a transcript.
The probe prints only aggregate counts and selected task metadata.
Native JSON parsing and the metadata scan are bounded by an 8 MiB record cap.
The process uses a 128 MiB old-space limit,
which is not a total-memory bound.

### Working catalog

- A synthetic live snapshot containing task 95 is visible before replay.
- Appending a direct `todo` result carrying that snapshot preserves task 95 and `nextId: 96` during replay.

### Failing catalog

- A newer wrapper result without task details leaves the old direct snapshot selected.
  Replay removes synthetic task 95 and restores `nextId: 82`.
- The initial probe assumed managed children received `PI_SESSION_FILE`.
  Node 26.10.0 emitted `AssertionError [ERR_ASSERTION]` at `probe.mjs:23:8`:
  actual type `undefined`, expected type `string`.
  `proc_663c` exited 1.
  This was an owned setup error,
  not evidence about the harness's task failure.
  `probe-v2` supplies the path explicitly and preserves the original attempt.

`proc_853c` exited 0 after executing the fixture and read-only metadata scan.
Its observed transcript prefix contained 480 direct task snapshots,
566 `codemode` results,
and 36 compactions.
No `codemode` top-level details contained `tasks`.
The last physical direct snapshot contained 81 tasks,
`maxId: 81`,
and `nextId: 82`,
with historical task 68 in progress and task 81 pending.

The last-entry ancestry scan found the same snapshot.
It was not independently bound to the live handler's active branch;
it did not reject missing parents or duplicate IDs.
Those limitations do not apply to the separate last-physical-snapshot observation.

No native live compaction,
restart,
navigation,
or full task-registry equality test was performed.
An independent reviewer confirmed the mechanism-versus-incident distinction.

## Verified workarounds

Use an actual top-level `todo` invocation for task mutations,
not a nested `tools.todo()` call:

```typescript
// Tool request examples, not an executable codemode script
// Direct todo tool arguments:
const directArguments = { action: 'update', id: 95, status: 'in_progress' };
// Avoid this composition for durable task mutation:
await tools.todo({ action: 'update', id: 95, status: 'in_progress' });
```

The source and positive replay fixture support this workaround conditionally:
the full direct result must be retained on the branch subsequently replayed.
Live lifecycle verification remains outstanding.
The tradeoff is fewer batching opportunities.
Other stateless calls can still use `codemode`.

A direct read does not recover lost tasks.
Even an error result can carry the already-stale current snapshot.
Preserve evidence before reconciling;
`nextId: 82` means new tasks could reuse historical identifiers.
The diagnostic did not restore the real registry to test the workaround.

## What does not work

- Repeatedly restoring through `codemode` recreates the same missing persistence boundary.
  Earlier restorations remain bookkeeping,
  not verification or authority.
- Treating printed success as a durable snapshot mistakes presentation for persistence.
- Clearing the `codemode` store does not change task replay.
- Treating compaction counts as rollback counts invents incident correlation.
- Treating installed or cloned source as proof of active loaded source overstates the evidence.

## Upstream filing artifact

No issue,
comment,
installed patch,
or production change was made.
The local diagnosis is not a request to export the session.

### Upstream filing decision

- Responsibility: the composition boundary is demonstrated;
  sole upstream ownership is not established.
- Fixability: independent extension persistence is a possible design direction,
  not an implemented or API-verified remedy.
- Supported use case: rpiv-todo's README promises survival across compaction and reload;
  support for this nested-call combination was not established.
- Contributions: the cloned README welcomes issues and pull requests and identifies AI co-authorship.
- Maintainer response: tracker searches were read-only;
  no acceptance or rejection of this combination was established.
- Prototype: only the reproduction and direct-snapshot positive control exist.
  No upstream fix prototype was applied.

`.out-of-scope/codex-harness.md` excludes Codex integration,
not this Pi incident.
`.out-of-scope/pi-gpt55-long-context.md` concerns context-window variants,
not task persistence.
Neither is a matching exemption.

Tracker searches for `todo codemode`,
`todo compaction`,
and pull requests for `todo persistence` returned no results in those scopes.
The broader `todo state` search returned issues 123,
159,
and 254.
These are related leads,
not an established duplicate.
Contribution and duplicate assessment remain incomplete;
no fileable draft is claimed.

### Local draft, do not file as-is

~~~md
<!-- Local issue draft, not an authorized external message -->
# Task snapshots from nested todo calls are not recovered during replay

Installed rpiv-todo 2.11.0 keeps live mutations in `state/store.ts`,
then reconstructs them from direct `todo` tool-result details in `state/replay.ts:30`.
Inspected Pi 0.99.1 `dist/core/nested-tool-calls.js:153` does not persist nested results.
A disposable copied-source replay fixture loses synthetic task 95 after a wrapper-only result;
adding a direct `todo` snapshot preserves it.
No live lifecycle reproduction or loaded-source attestation is claimed.

Reproduction: the retained `probe-v2.mjs` constructs the old direct snapshot,
commits newer synthetic live state,
and invokes replay with a later wrapper result lacking task details.
The direct-snapshot positive control tests the opposite outcome.

Possible remedy: independently persist extension snapshots and replay that format,
with backward compatibility for direct results.
The persistence API and a fix prototype still require qualification.
This draft is incomplete and must not be filed as-is.
~~~

### Local policy proposal

Proposed clarification for agent tooling guidance:
use direct calls for tools whose durable state depends on their own transcript result;
batch them only after qualifying the composition's persistence and replay behavior.
`AGENTS.md` remains unchanged.
