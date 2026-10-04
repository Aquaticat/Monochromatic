# Pi 1.0.0 nested tool calls need separate parent-execution admission

## Symptom

The private auto-mode prototype admits a complete model-issued tool group through its changed agent loop.
An extension tool calling `ctx.executeTool()` does not pass its children through that outer group interface.
In the measured profile,
a saved parent context also executed an inert child after the parent result and final assistant response.
The child reused the original parent's `/1` identifier and did not update its persisted nested-call record.

These are findings about the private consumer's coverage and parent-lifetime requirements,
not evidence of an upstream security promise or a production auto-mode bypass.
No installed SDK or production guard was changed.
The diagnostic used fixed inert parent definitions,
not Codemode source execution or semantic assessment of arbitrary programs.

A separate fixture configuration failure preceded the diagnostic:
agent-core emitted `Tool owned_leaf not found` for both attempted children.
The fixture had excluded that leaf through the SDK `tools` allow-list.
This was not a nested guard rejection or a missing execution context.

## Source identity

The installed artifacts are `@earendil-works/pi-coding-agent@1.0.0`
and `@earendil-works/pi-agent-core@1.0.0`.
Paths beginning with `dist/core/` refer to that installed coding-agent package;
agent-core paths are named explicitly.
The private manifests retain hashes of the inspected installed files and the derived SDK graph.
The upstream `v1.0.0` tag resolves to `a13d35a742c6ef8462812a28fbe1d8c8b7431c32`.
The read-only checkout `~/temp/agent/pi-sdk-1.0.0-source.qxeIPlda` is pinned to that commit.
Its `packages/coding-agent/src/core/nested-tool-calls.ts:163-259`
and `packages/coding-agent/src/core/extensions/wrapper.ts:17-21`
confirm the existing scope map and context-factory path.
The earlier `v0.87.1` source checkout is not substituted for these artifacts.

Private workspace:
`~/temp/agent/auto-mode-consumer-contract.mDLkyNoP`.

- Failed fixture:
  `contract/collector/nested-judgment-intake/`.
- Corrected diagnostic:
  `contract/collector/nested-judgment-intake-v2/`.
- Protected outer-group SDK graph:
  `contract/collector/judgment-sdk-freshness/stage-private/manifest.json`.

## Root cause trace

### The session runs nested calls outside the changed outer loop

`dist/core/agent-session.js:375` creates `NestedToolCallRunner` on demand.
Its host calls native `runToolCall` directly and selects the latest assistant message:

```javascript
// dist/core/agent-session.js:379-397, selected statements
const assistantMessage = this._findLastAssistantMessage();
return runToolCall(toolCall, {
  tools: this._getCallableTools(),
  assistantMessage,
  context: { messages: this.agent.state.messages, tools: this.agent.state.tools },
  beforeToolCall: (context) => this._beforeToolCall(context, parentId),
  afterToolCall: (context) => this._afterToolCall(context, parentId),
  signal,
  onUpdate,
});
```

That path retains ordinary nested hooks.
It does not call the private `beginToolJudgment`,
combined prepared-group assessment,
or captured outer-group freshness callback.
The corrected diagnostic observed those group callbacks for the parent only.

### A tool context captures a caller identifier and checks runner liveness

`dist/core/extensions/runner.js:690` creates the tool context.
The nested method checks the runner and forwards the captured identifier:

```javascript
// dist/core/extensions/runner.js:700-714, selected statements
executeTool: {
  value: async (name, args, options = {}) => {
    runner.assertActive();
    return runner.executeToolFn(toolCallId, name, args, {
      ...options,
      signal: options.signal ?? signal,
    });
  },
},
```

The omitted branch reports an unavailable nested-call function;
it does not add a parent-execution lifetime check.
Session/runner liveness therefore is not proof that the original parent invocation remains active.
A child-supplied signal also needs separate handling when a consumer must retain the original cancellation scope.
The `proc_4202` diagnostic did not test signal substitution.
The separate `proc_8bea` contrast measured that path after the context-lifetime prerequisite.

### Recorder lifetime and caller labels do not preserve execution occurrence identity

`dist/core/nested-tool-calls.js:99` creates a scope when the caller identifier has no current entry:

```javascript
// dist/core/nested-tool-calls.js:99-112, selected statements
let scope = this.scopes.get(callerId);
if (!scope) {
  scope = { recorder: new NestedCallRecorder(), nextId: 1, holdsQueue: false };
  this.scopes.set(callerId, scope);
}
const toolCall = {
  type: "toolCall",
  id: `${callerId}/${scope.nextId++}`,
  name,
  arguments: args ?? {},
};
```

`takeRecord` removes the parent scope.
`dist/core/agent-session.js:698-709` attaches that snapshot to the parent tool result and clears scopes at agent end:

```javascript
// dist/core/agent-session.js:698-709, selected statements
const summary = this._nestedToolCalls.takeRecord(message.toolCallId);
if (summary?.calls) message.nestedCalls = summary.calls;
// In the agent_end branch:
this._nestedToolCalls.clear();
```

The late-context case then created another scope through the same saved method.
The repeated child identifier described a different occurrence;
it did not authenticate continuation of the original parent or revive its judgment.

### The failed fixture confused allowed tools with active declarations

`dist/core/sdk.js:145-148` uses `options.tools` as both an allow-list input and the initial active selection.
`dist/core/agent-session.js:2780-2785` filters extension definitions before building the registry:

```javascript
// dist/core/sdk.js:145-148, selected statements
const allowedToolNames = options.tools ?? (options.noTools === "all" ? [] : undefined);
```

```javascript
// dist/core/agent-session.js:2780-2785, selected statements
const allCustomTools = [/* registered and SDK custom definitions */]
  .filter((tool) => this._isAllowedTool(tool.definition.name));
```

Agent-core `dist/agent-loop.js:486` reports the missing lookup as:

```javascript
// pi-agent-core dist/agent-loop.js:486
createErrorToolResult(`Tool ${toolCall.name} not found`);
```

The corrected fixture allowed both owned tools,
then called `session.setActiveToolsByName(['owned_probe'])`.
Before prompting,
it verified that only the parent was active,
both tools were callable,
and the leaf retained `codemode` exposure.

## Verification

`proc_8724` failed with `AssertionError [ERR_ASSERTION]: 0 !== 2`.
Its persisted parent result contains two `Tool owned_leaf not found` records.
No leaf executed,
and the later planned cases did not run.
That namespace and its consumed source remain unchanged.

`proc_4202` passed the corrected diagnostic using Node `26.10.0`:
three SDK sessions,
six injected wire requests,
three outer inert executions,
seven nested inert executions,
and three canned semantic attempts.
There were no external model requests.
The verifier checked complete streams,
source hashes,
parent persistence,
ordinary nested hooks/events,
and native disposal completion.

Working catalog:

- Registered and allow-listed leaf execution through the actual `ctx.executeTool()` method.
- Parallel children and the native sequential queue.
- Native nested hooks,
  parent identifiers,
  and complete persisted records for awaited children.
- A parent-only model declaration with both parent and leaf callable.

Coverage-gap catalog:

- Child execution did not reenter complete-group preparation,
  judgment construction,
  or the outer freshness callback.
- The cached parent context executed another leaf after the parent completed.
- That call reused the `/1` child identifier.
- The persisted parent record remained unchanged after the late call.

The recorded invocation was:

```bash
# Private one-shot fixture; use a fresh source namespace for another execution.
cd ~/temp/agent/auto-mode-consumer-contract.mDLkyNoP/contract/collector/nested-judgment-intake-v2
mise --no-env --no-hooks run check
```

The fixture deliberately refuses to overwrite its existing evidence directory.
Do not rerun it in the consumed namespace or treat raw result presence as terminal process success.
Heap limits,
cleared fixture directories,
and injected transport are fixture controls,
not OS isolation,
atomicity,
or a hard handback guarantee.

## Original cancellation and a substituted child signal

`proc_8bea` used two actual private SDK sessions and an active inert parent definition.
The parent aborted the agent's original signal,
then awaited a child call.
The default inherited signal produced the native `Operation aborted` result and no leaf execution.
Supplying another live signal executed one inert leaf instead.
Both cases kept the parent invocation active during the call;
this is separate from the saved-context-after-return incident.

Agent-core `dist/agent.js:218-219` implements the abort used by the fixture:

```javascript
// pi-agent-core dist/agent.js:218-219
abort() {
  this.activeRun?.abortController.abort();
}
```

The nested context still selected `options.signal ?? signal`
in `dist/core/extensions/runner.js:713`.
Agent-core's `prepareToolCall` checks that supplied signal after the before-call hook:

```javascript
// pi-agent-core dist/agent-loop.js:499-505, selected statements
if (signal?.aborted) {
  return {
    kind: "immediate",
    result: createErrorToolResult("Operation aborted"),
    isError: true,
  };
}
```

The diagnostic kept two injected wire requests,
two canned semantic attempts,
complete native records,
and successful disposal.
No external inference or real tool effects occurred.
See private `contract/collector/nested-cancellation-intake/result.json`.

A fresh consumer wrapper now forwards the actual parent signal when no different child signal is requested,
or composes both with native `AbortSignal.any`.
Additional child cancellation remains effective rather than being discarded.
`proc_4be3` passed ten runtime/helper controls,
including a positive native-signal control;
`proc_4dbb` removed each cancellation dependency separately and observed the intended assertion failure.
Those helper controls were followed by actual SDK composition in `proc_2cf6`.
Four SDK sessions and four injected requests produced child execution counts `[0, 0, 1, 0]`:
original cancellation blocked inherited and substituted child signals,
live signals allowed execution,
and additional child cancellation still blocked it.
The verifier reconciled complete native streams,
source identities,
parent records,
and disposal.
No deadline,
new model budget,
or permission was introduced.
The private consumer change is:

```javascript
// contract/lifecycle/nested-context-cancellation/wrapper.mjs, selected statements
const requested = options === undefined ? undefined : options.signal;
const effectiveSignal = requested === undefined || requested === signal
  ? signal
  : AbortSignal.any([signal, requested]);
const effectiveOptions = { ...options, signal: effectiveSignal };
```

The full wrapper retains the parent-invocation lifetime check and native context descriptors.
The protected cancellation claim requires an actual parent signal;
legacy unbound calls remain outside that claim.
This is still not an original-judgment carrier or complete nested group admission.

## Verified workaround and remaining implementation

Allow-listing both owned names and activating only the parent repaired the fixture setup.
Its tradeoff is explicit responsibility for maintaining allowed and declared tool sets separately.
This configuration does not establish a parent-execution lifetime or complete nested semantic group.

### Private invocation-lifetime prerequisite

The derived registered-tool wrapper now scopes new nested invocation to the parent's actual execute call.
`proc_cb12` passed seven interface controls using the native helper;
`proc_01d5` verified both retirement and invocation-check omissions.
`proc_fc01` exercised the changed private SDK in three sessions:
live parallel/sequential children remained functional,
while the saved context rejected `NestedContextClosedError` before another child started.
The fixture retained six nested executions instead of the diagnostic's seven.

The consumer-side source is
`contract/lifecycle/nested-context-lifetime/wrapper.mjs`
in the private workspace.
`contract/collector/nested-context-sdk-copy/stage.mjs`
binds it to the native helper and redirects the protected session's existing registered-wrapper imports.
The installed packages and upstream checkout remain unchanged.

The core change is the scoped method and the parent-return retirement:

```javascript
// contract/lifecycle/nested-context-lifetime/wrapper.mjs, selected statements
const descriptors = Object.getOwnPropertyDescriptors(context);
const invoke = descriptors.executeTool.value;
const guarded = Object.defineProperties(Object.create(Object.getPrototypeOf(context)), {
  ...descriptors,
  executeTool: {
    ...descriptors.executeTool,
    value: async (name, args, options) => {
      if (!isActive()) throw new NestedContextClosedError(toolCallId);
      return await invoke(name, args, options);
    },
  },
});
```

```javascript
// contract/lifecycle/nested-context-lifetime/wrapper.mjs, actual execution lifetime
let active = true;
const guarded = guardContext({ context, toolCallId, isActive: () => active });
try {
  return await definition.execute(toolCallId, params, signal, onUpdate, guarded);
} finally {
  active = false;
}
```

Tradeoffs and limits:

- Native context getters stay lazy,
  and method property descriptors are preserved.
- A child invocation already initiated while the parent was active may still settle afterward.
  This is not a claim that a queued child can start without another release check.
- The helper retains exceptional parent exit,
  including `throw undefined`,
  while retiring later invocation.
- Supplied native contexts are a trusted profile,
  not authenticated arbitrary caller objects.
- Original judgment identity,
  original cancellation,
  full nested group admission,
  and complete native event/cleanup parity are separate unfinished work.
- `proc_fc01` imported the actual derived SDK and checked full streams,
  persistence,
  and native disposal;
  it was not an installed-host guard test.

### Exact original occurrence context at native root entry

The later private carrier ties the native context to the existing producer response,
prepared member,
and one-use execution occurrence.
A fixed session reader resolves the original response through that session's current owned stream,
then validates the opaque execution token.
A context copied from its public fields is not an issued context.
The existing registered-wrapper fifth context slot carries that exact object;
no ambient current-parent state or new session/root registry was added.

`proc_681e` passed seven actual SDK profiles after interface and guard controls.
Missing selected context factories rejected the group before native preparation.
Copied contexts entered no definition.
Ordinary tool errors still allowed the next serial member,
while source staleness stopped it.
The issuer occurrence was returned before native result hooks;
local context return alone is not that proof.
The native retirement-omission control remains separate.

No complete nested-group handler is installed in this graph.
The carrier therefore rejects that missing support before starting a child,
rather than delegating to the old independent path.
This is a verified closed default,
not functional qualification of arbitrary nested programs.

Private sources:
`contract/lifecycle/execution-context-carrier/`,
`contract/lifecycle/judgment-execution-occurrences/`,
and `contract/collector/execution-context-sdk-copy/stage.mjs`.

### Complete nested admission remains open

There is no verified complete nested-admission workaround yet.
The implementation must extend existing execution/scope ownership,
bind the exact original judgment and parent program,
and reject stale or foreign execution occurrences without manufacturing another budget.
Sibling transport arrival,
queue drains,
and cached caller labels must not stand in for complete semantic membership.
Preserve native hooks,
updates,
recorder/usage output,
and completed effects.

## What does not work

- Treating `codemode` exposure as an override of the SDK allow-list.
- Treating root or runner liveness as evidence that a particular parent execution is still active.
- Treating a child identifier as an unforgeable execution occurrence.
- Treating a successful outer-group guard test as coverage of the separate nested execution path.
- Treating the fixed-parent diagnostic as qualification of arbitrary Codemode programs.

## Upstream filing decision

1.  Upstream fault is not established.
    The excluded leaf was a fixture configuration error;
    the nested judgment requirement belongs to the private consumer.
2.  A consumer-side implementation remains under development.
    No claim of architectural impossibility is made.
3.  Native nested calls are supported;
    no cited upstream contract promises this private whole-program judgment or parent-lifetime policy.
4.  Contribution-policy review is not used to justify any filing here.
5.  No maintainer rejection or intent is inferred from the observed behavior.
6.  A complete nested-admission fix has not been qualified.
    The verified allow-list correction is not that fix.

The inspected `.out-of-scope/pi-gpt55-long-context.md` concerns context-window metadata,
not this case.
No upstream issue or comment is drafted or sent:
the fixture error supplies no upstream bug,
and a complete consumer-side fix is not yet available.
No claim that the upstream tracker lacks a related issue is made.
