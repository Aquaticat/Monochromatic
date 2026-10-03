# Pi 0.87.1 and 1.0.0 instruction snapshots can miss later prompt transformations

## Symptom and relevance

An authorization consumer that copies project context during its `before_agent_start` handler
can miss an instruction added by a later handler.
Switching to `ctx.getSystemPrompt()` addresses that particular run-option difference in the tested methods,
but does not expose every request-local message or payload transformation.
A snapshot taken from one surface is not evidence that all governing instructions were collected.

This matters to auto-mode's Q21 requirement:
follow applicable governing instructions,
including legitimate `AGENTS.md` rules,
rather than treating missing human grants as missing authority.
Unknown instruction coverage is not an instruction-free case.
The [confirmed contract](../planning/pi-auto-mode-effect-contract.md) remains unqualified at the actual host.

The original phase used inspected source-method observations.
The separately recorded SDK phase exercised actual sessions and callbacks.
Neither is a reproduced TUI incident or a claim that Pi cannot support a suitable collector through another interface.
No production extension or upstream source was changed.
The fixture markers demonstrate visibility,
not authority:
an extension-added string or provider-payload field does not become a governing instruction merely by appearing there.
Source authority and any legitimate delegation need separate code-owned evidence.

## Source identity

The read-only Pi checkout is `~/temp/agent/pi-input-provenance-2026-09-26`,
at commit `f07218c4d4bbc12bef056a7058c3dd49dfe41abe` for Pi `0.87.1`.
Pi source paths in this document are relative to that checkout.
The probe copied installed compiled code and declarations for `@earendil-works/pi-coding-agent@0.87.1`,
along with pure rendering/replay helpers from its installed `pi-ai` dependency.

The private workspace is `~/temp/agent/auto-mode-consumer-contract.mDLkyNoP`.
`inputs-manifest.json` lists every copied input and hash.
`execution-manifest.json` binds the listed owned controllers,
probe sources,
fixed plan,
and copied inputs.
It is not a hermetic runtime or host-dependency closure.

Execution-manifest SHA-256:
`8ea2c0fd07492c58a3007a680a5aad175076d4fbc52a6d83c0d9dc9fff379c01`.

Image:
`sha256:d15c48492a7dd21a977612aefa661297de4d3253d14c375e7d0157f5bcb5617a`.

Preparation used host Node `v26.10.0`.
The isolated probe reported Node `v24.21.0`.
Do not silently describe this as actual-host Node `v26.10.0` verification.

## Root cause trace

### Base construction options and the current getter are different views

`packages/coding-agent/src/core/extensions/types.ts:352` declares `getSystemPrompt()` on ordinary context.
Line 361 places `getSystemPromptOptions()` on command context.
The corresponding implementation at `extensions/runner.ts:889` constructs that command-only addition:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:897
context.getSystemPromptOptions = () => {
  this.assertActive();
  return this.getSystemPromptOptionsFn();
};
```

The callbacks are bound separately at `agent-session.ts:3124`:

```typescript
// packages/coding-agent/src/core/agent-session.ts:3124
getSystemPrompt: () => this.systemPrompt,
getSystemPromptOptions: () => this._baseSystemPromptOptions,
```

The getter selects run options when present:

```typescript
// packages/coding-agent/src/core/agent-session.ts:1239
get systemPrompt(): string {
  return buildSystemPrompt(this._runSystemPromptOptions ?? this._baseSystemPromptOptions);
}
```

The actual method controls exposed no base-options method on ordinary context,
exposed it on command context,
and observed a later run contribution through the getter while the base-options callback remained unchanged.
The supplied inactive-context check rejected access;
real host lifecycle invalidation was not exercised.

### A handler observes its position in the composition chain

`extensions/runner.ts:1317` creates one mutable normalized option set.
Handlers receive that set in order,
and the combined result is returned after the chain:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1317, selected statements
const currentOptions = normalizeBuildSystemPromptOptions(systemPromptOptions);
const renderCurrentSystemPrompt = (): string => buildSystemPrompt(currentOptions);
```

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1323
ctx.getSystemPrompt = () => {
  this.assertActive();
  return renderCurrentSystemPrompt();
};
```

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1339 and 1363, selected statements
systemPromptOptions: currentOptions,
return { messages, systemPromptOptions: currentOptions };
```

The incumbent copies only the context-file contribution during its own callback,
in `package/pi-plugin/auto-mode/src/index.ts:258`,
`handleBeforeAgentStart()`:

```typescript
// package/pi-plugin/auto-mode/src/index.ts:258, selected statements
const { systemPromptOptions, } = event;
const { contextFiles, } = systemPromptOptions;
currentProjectContext = buildProjectContext(contextFiles,);
```

In the controlled handler chain,
the earlier owned copy retained 1 context file,
while the actual combined options retained 2 after a later addition.
The addition was present in the getter after installing those combined run options in the host stand-in.
That positive control establishes the observed difference;
it does not prove all real extension sources or their authority were captured.
The early observer was a synthetic fixture with the relevant copy behavior,
not execution of auto-mode's handler.
The omission depends on a later contributor existing.
Actual installed extension order was not measured,
so this does not establish that the deployed guard currently misses a particular instruction.

### Request-local transformations do not update the getter's option fields

`extensions/runner.ts:1221` runs `context_with_system` handlers on the full message list:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1225, selected statements
const event: ContextWithSystemEvent = { type: "context_with_system", messages: currentMessages };
const handlerResult = (await handler(event, ctx)) as ContextEventResult | undefined;
currentMessages = handlerResult?.messages ?? currentMessages;
```

The method returned a message containing the request-local marker,
while the session getter still rendered the separately held run options without that marker.
The supplied original message array remained unchanged.
The fixture did not execute the complete SDK request lifecycle.
The stand-in installed combined run options explicitly;
real `AgentSession.prompt()` ordering and next-turn refresh remain unverified.

### Forced text is another projection

`agent-session.ts:1433` wraps the preceding transformation and then applies forced text:

```typescript
// packages/coding-agent/src/core/agent-session.ts:1436, selected statements
const transformed = previousTransformContext ? await previousTransformContext(messages, signal) : messages;
const forced = this._runSystemPromptOptions?.forceSystemPrompt;
if (forced === undefined) return transformed;
```

```typescript
// packages/coding-agent/src/core/agent-session.ts:1440, selected statements
const head: SystemMessage = {
  role: "system",
  content: forced,
  ...(current?.toolsAdded ? { toolsAdded: current.toolsAdded } : {}),
  timestamp: current?.timestamp ?? Date.now(),
};
return [head, ...transformed.filter((message) => message.role !== "system")];
```

In the source-method control,
forced text replaced the preceding request-local marker,
retained the synthetic tool declaration,
and left the supplied transcript array unchanged.
This is not verification of persisted-session replay or tool-removal behavior.

### The provider-payload hook is a separate mutable view

`extensions/runner.ts:1253` accepts and returns a payload independently of the run-option fields:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1264
const handlerResult = await handler(event, ctx);
if (handlerResult !== undefined) {
  currentPayload = handlerResult;
}
```

The actual hook-chain method added a marker to a synthetic payload without changing the session getter.
The test did not use a real provider's payload schema,
encoder,
transport,
or hosted prompt processing.
Do not generalize its synthetic field name into a provider contract.

### A missing leading system message is reported but still returned by this runner method

At `extensions/runner.ts:1230`,
the runner checks whether the handler removed a previously present leading system message,
emits an extension error,
and ultimately returns `currentMessages` at line 1250.
The decisive source fragments are:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1230, beginning of the diagnostic branch
if (hadLeadingSystemMessage && currentMessages[0]?.role !== "system") {
  this.emitError({
```

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1250
return currentMessages;
```

Pi's `ExtensionRunner.emitContext()` reports:

```text
Handler removed the leading system message; the request has no prompt or initial tool declarations. Keep it at index 0 or replace a dropped prefix with getCurrentSystemMessage().
```

The fresh unforced fixture captured that exact diagnostic and received the changed list with no system message.
The diagnostic was retained in the result rather than filtered from stderr.
This does not establish what every downstream provider or a forced projection would do with that list.

## Verification

The frozen source-method phase ran once through `mise`:

```bash
# Private workspace: ~/temp/agent/auto-mode-consumer-contract.mDLkyNoP
mise --no-env --no-hooks run probe
```

This is the recorded invocation,
not an instruction to replay the completed phase.
The controller rejects existing output files.
A separately authorized reproduction needs a new disposable output namespace and its own preserved receipts.
Do not delete current results or bypass the replay guard.

`proc_fcd6` exited successfully.
`probe.verified.json` confirms all 8 scheduled observations and both source-integrity controls.
The copied-input hash guard rejected an equal-length change to an unexecuted opening comment.
A separate artifact with only that hash assertion omitted accepted the same change;
the extracted method-body hash remained identical.
The committed guard was not removed from its original file.

The runtime invocation used 2 GiB memory,
2 CPUs,
zero extra swap,
PID and file-descriptor limits,
a 60-second container lifetime limit,
a non-root user,
a read-only filesystem,
no network,
and no host mounts.
No external model call,
SDK startup,
real session-history load,
or represented action occurred.
Unexpected stderr was not accepted;
the retained successful run's stderr is empty.

### Clean observations

- Ordinary context returned the base prompt with the copied full policy.
- Command context exposed base options and called the supplied active-context check.
- Combined run options and the getter exposed the deliberate later handler contribution.
- Forced projection returned its specified text and retained the fixture tool declaration.
- Fixed case order,
  control receipts,
  baked file hashes,
  image identity,
  current-policy identity,
  and host/runtime execution-manifest binding passed their checks.

### Views that did not contain a later contribution

- An earlier owned context-file copy omitted the later context-file addition.
- Command base options omitted the run-only contribution.
- The session getter omitted the request-local system-message change.
- The session getter omitted the synthetic provider-payload change.

These are view differences,
not interchangeable failures of a single complete-instruction interface.
Actual host integration and human authority remain unverified.

## Actual SDK session observations

The subsequent private `contract/sdk/session-esm` phase ran the same view questions
through real Pi `0.87.1` `AgentSession` instances,
registered extension callbacks,
and an inert custom tool.
A first-party scripted provider supplied all responses;
no external model call or represented operation occurred.

`proc_da53` passed all 4 fixed cases in separate containers:
4 sessions,
8 scripted responses,
and 4 inert tool executions.
Each session emitted one session-start,
agent-start,
and agent-end event,
then completed disposal with empty stderr.
The runtime was Node `v26.10.0`,
with 2 GiB memory,
2 CPUs,
zero extra swap,
64 PIDs,
256 file descriptors,
a read-only root,
disposable tmpfs,
and no external network or host state mounts.

The corrected phase freeze is
`3dcb6e07fdd2a9e9dc813d5011b4693510ddabc7e08e1f1297529cdf2fea255b`.
The image is
`6527f73d748deee6ad0ea84aaea611ad70c8fead2a8c1d05c5b836393fa30c17`.
It used the complete 31,214-byte policy snapshot
`2f4377aa7b950d178999a88337bfd7ec1dba1723313d1650d712e06b2dc3a7cc`,
not the older source-method policy epoch.
The scripted provider views retained the full new policy in every case,
including forced projection.

### Baseline and resource owner

The actual `ResourceLoader` exposed the global fixture file and project policy file.
Its configured inline system prompt had no source path.
The early callback,
tool-time getter,
and both scripted-provider requests exposed the baseline and global markers with full policy text.
The owner inventory remained unchanged throughout the run.
This establishes representation and ownership access from the SDK constructor,
not legitimacy of arbitrary files or production-extension access to that owner.

### Later run contribution

The earlier callback and resource-owner inventory omitted the later fixture contribution.
The actual tool callback's getter and both provider requests included it.
The deliberately registered observer/contributor factory order was exercised by the real runner.
Installed production-extension ordering remains unmeasured.

### Request-local change

Both provider requests contained the marker introduced by `context_with_system`.
The tool-time getter did not.
The handler ran twice,
and the resource-owner inventory stayed unchanged.
This confirms that the measured getter cannot substitute for the request-stage observation.

### Forced projection

The request-local handler produced its marker twice,
but neither provider request retained it after forced projection.
The tool-time getter and provider requests contained the forced marker and complete policy instead.
They omitted the baseline/global markers,
while the resource owner still retained its original inventory.
A changed rendered view does not itself establish a change in instruction authority.

### Preserved failed setup and limits

The original `contract/sdk/session` attempt stopped before creating a session
because its owned helper used CommonJS resolution for Pi AI's import-only entry point.
The correction changed only that import selection in a new epoch;
reference SHA-256 remained
`9acfe7b38a559b9044dceeed88b24c4caf5886d46093d0087f2743de9fa83020`.
No result was relabeled and no completed constructor was replayed.
The [staging report](pi-sdk-staging.md#fixture-import-condition-correction)
retains the diagnostic and source trace.

These are real SDK lifecycle observations,
not real-human authentication,
TUI/RPC qualification,
actual provider encoding,
complete producer coverage,
governing-instruction semantics,
finalizer behavior,
or production timing qualification.
No production extension or cutoff was changed.

## Pi 1.0.0 terminal-stage controls

A later private phase,
`contract/collector/request-stage-controls/`,
ran stock installed Pi 1.0.0 with Node 26.10.0.
`proc_74bc` exited 0:
six new owned `AgentSession` completions,
six scripted local provider requests,
zero external model requests,
and zero represented tool effects.
This is not historical session-ledger reconciliation or a human-witnessed root.

The worker used a cleared disposable home,
no discovered extensions or context files,
no tools,
and disabled agent retries,
compaction,
and cache warming with effective-setting readback.
Its complete streams were private before SDK import,
worker stderr was empty,
and a 60-second process bound was enforced.
The 512 MiB old-space setting is not a total-memory bound.
Listed source and Node hashes were checked;
complete transitive runtime attestation was not claimed.

### Source path and callback order

Paths in this subsection are relative to installed `@earendil-works/pi-coding-agent@1.0.0`,
not the historical 0.87.1 checkout.
`dist/core/sdk.js:213` forwards the payload hook to the extension runner:

```javascript
// @earendil-works/pi-coding-agent/dist/core/sdk.js
const transformProviderPayload = async (payload) => {
    const runner = extensionRunnerRef.current;
    if (!runner?.hasHandlers("before_provider_request"))
        return payload;
    return runner.emitBeforeProviderRequest(payload);
};
```

The SDK installs that callback as `onPayload` at `dist/core/sdk.js:262`.
The provider must actually call it and use its returned payload.
`dist/core/extensions/runner.js:1060` runs the handler chain;
its replacement branch at line 1071 is:

```javascript
// @earendil-works/pi-coding-agent/dist/core/extensions/runner.js
if (handlerResult !== undefined) {
    currentPayload = handlerResult;
}
```

`dist/core/agent-session.js:1310` wraps the preceding context transform and then applies forced prompt text:

```javascript
// @earendil-works/pi-coding-agent/dist/core/agent-session.js
const transformed = previousTransformContext ? await previousTransformContext(messages, signal) : messages;
const forced = this._runSystemPromptOptions?.forceSystemPrompt;
if (forced === undefined)
    return transformed;
```

The owned traces asserted exact callback order,
not merely handler counts.
The combined case confirmed that forced projection replaced the request-local system head before payload rewriting.

### Observed boundaries

- Base and forced cases:
  the getter equaled the normalized provider prompt and final synthetic payload prompt.
- Request-local context case:
  the getter differed from both provider and final payload prompt.
- Payload case:
  the getter matched provider context but omitted the final native-payload additions.
- Combined case:
  forced text replaced the request-local head,
  then both payload handlers added their markers in registration order.
- Omitted-hook control:
  the getter and unchanged payload matched,
  yet the final-payload validator rejected the missing required transformations with `FinalPayloadCoverageError`.

Every persisted session retained the base marker and omitted the forced,
request-local,
and payload markers.
Own entries matched their persisted JSON values;
this was not raw-object identity or byte-for-byte serialization equality.
The existing collector's `assertObservedFresh()` passed on its observed surfaces even when later payload content differed.
It correctly retained `run-producer-inventory`,
`final-request-transformations`,
and `provider-native-payload` as unqualified gaps.
Its freshness check was never a claim of terminal-request completeness.

A separate disposable guard-removal pair passed with the validator intact and failed when the mismatch check was removed.
Unexpected setup,
SDK,
retention,
extension,
and cleanup errors were not accepted as that expected rejection.

The collector separately read the complete current mandatory policy,
with SHA-256 `15890c665cdb1c054f8c56c2f212cb75297292b812dc0a2e8065e21156483c39`.
The scripted SDK provider used owned marker prompts,
not a full-policy model assessment.
This phase qualifies source-stage observations for its synthetic native payload protocol,
not real provider encoding,
complete producer coverage,
current permission,
or governing-instruction authority.
The [built-in OpenAI serialization probe](#built-in-openai-serialization-boundary)
subsequently exercised a real provider adapter without external network access.

## Built-in OpenAI serialization boundary

The private `contract/collector/request-wire-controls/` phase completed as `proc_3c50`,
exit 0,
with seven new owned SDK completions and seven captured `openai-completions` requests.
It registered model metadata only,
not a custom stream implementation.
A wrapper around the SDK's public `agent.streamFunction` supplied an injected fetch implementation while delegating
through the original SDK and `ModelRuntime` pipeline.
Global fetch remained a failing tripwire.
No hosted model or external network was used.

Installed Pi AI 1.0.0 `dist/api/openai-completions.js:186` supplies `options.fetch` to its OpenAI client.
The request hook precedes actual client serialization:

```javascript
// @earendil-works/pi-ai/dist/api/openai-completions.js:186
const client = createClient(model, normalizedContext, apiKey, options?.headers, options?.fetch, cacheSessionId, compat);
let params = buildParams(model, normalizedContext, options, compat, cacheRetention, grammarToolInputProperties);
const nextParams = await options?.onPayload?.(params, model);
if (nextParams !== undefined) {
    params = nextParams;
}
```

The client sends those parameters through `chat.completions.create` at line 197.
The injected fetch captured the serialized JSON body,
not an invented payload field or a copy taken inside an earlier extension handler.
It returned owned OpenAI SSE frames,
which the built-in adapter decoded through normal SDK completion.
The central OpenAI 7.19.0 package,
ESM entry/client,
and streaming files were hashed alongside the listed Pi sources.
Full transitive attestation remains outside the claim.

The base,
forced,
request-local,
payload,
combined,
and omitted-hook observations matched the synthetic-payload phase.
An asynchronous first payload handler completed before the second handler ran.
A separate escaping case preserved quotes,
backslashes,
line breaks,
Unicode,
and literal SSE sentinel text through request serialization and response decoding.
The payload validator was reused only after checking byte identity and its existing intact/removal receipt.
Unchanged guard controls were not replayed.

Complete private worker streams and every outcome matched;
worker stderr was empty.
The worker retained its cleared environment and 60-second bound.
Native JSON-value persistence again retained only the base marker,
not forced,
request-local,
or payload additions.
Omitting `onPayload` forwarding produced a normally completed SDK request but failed the final-payload coverage check.
Matching a getter to an encoded prompt is therefore insufficient to prove that every required producer ran.

This establishes the observed serialization boundary for the tested text-only `openai-completions` configuration
and injected transport.
It does not establish hosted behavior,
all provider/transport families,
instruction authority,
current human permission,
or production-ready collection.
The [consumer-owned observation controls](#consumer-owned-observation-controls)
subsequently exercised immutable receipts,
SDK response/root association,
and missing,
foreign,
and stale rejection.

## Consumer-owned observation controls

The private `contract/collector/request-observation-owner/` module passed `proc_c523`,
exit 0:
25 intact cases and five independent guard-removal failures.
The changed copies failed on the exact consumer `Missing expected exception` assertion;
arbitrary exceptions did not count.
Original source stayed unchanged.
These controls reused the existing source collector and made no SDK sessions or external requests.

Its interface wraps a bound stream function,
returns an immutable receipt for an exact response object,
revalidates receipt ownership and observed freshness,
and invalidates old generations.
Receipt copies and response copies do not inherit ownership.
Reused response objects become ambiguous rather than silently changing request association.
The module retains the source collector's coverage gaps and never creates instruction authority or permission.

The unchanged owner then passed stock SDK binding in `proc_cf38`,
exit 0,
under `contract/collector/request-observation-sdk/`:
eight completed sessions,
16 serialized requests,
one inert tool execution,
and no external model requests.
The actual `beforeToolCall` context carried the decoded response object accepted by the owner.
Its receipt matched the exact serialized first request.

Observed stream instances were extensible;
`result` was inherited rather than an own property.
Decorating the method worked,
with iterator identity preserved.
The original SDK argument preparation,
asynchronous permission hook,
and result hook remained active.
The inert tool received `requested-native-hook` and returned the result-hook replacement.
A native hook denial prevented observation lookup and execution.

Missing binding,
a response copy,
a foreign observer,
a fixture epoch change,
an owned resource-loader reload,
and explicit invalidation prevented the inert tool from running.
Copy and foreign-observer controls also verified that the original response still worked with its owning observer.
Root/source/invalidation controls first verified the intact observation.
The loader reload changed the inventory visible at tool preparation;
it was not deferred until another request for this source surface.
The follow-up model request made the earlier receipt stale.

The verifier reconciled exact traces,
measured method/iterator properties,
serialized and persisted tool-result IDs and content,
private worker streams,
listed source hashes,
and unchanged mandatory policy.
Worker stderr was empty.

This is a single-tool consumer check,
not composed-group admission,
production lifecycle-event wiring,
or complete cancellation and handback parity.
The epoch reader was fixture-owned;
stop-turn receipt consumption was not qualified.
Complete producer coverage,
instruction authority,
and a new authenticated SDK-linked human original remain separate requirements.
No installed source or auto-mode production implementation changed.

## Complete prepared-group consumer

The private `contract/collector/request-observation-batch/` follow-up passed `proc_70b6`,
exit 0,
using the unchanged observer and the already tested private SDK/group-dispatch copies.
It completed five SDK sessions,
ten serialized requests,
and five inert member executions,
with no external model requests.
Installed SDK files remained unchanged.

Parallel and sequential groups each completed native preparation for both declared members,
then shared one assessment and one owned request receipt before either member executed.
Final prepared arguments,
member order,
source freshness,
and native result processing were checked at the consumer.
Missing ownership stopped both members before assessment.
An owned loader change during preparation also stopped both before assessment.
Neither failure fell back to independent per-tool approval.

The partial-execution control admitted a sequential group while its observation was fresh.
The first inert member waited until both members had passed release,
then changed the owned loader inventory.
The waiting second member failed precisely at `member-execute`.
The first result remained successful and persisted;
the second was an explicit error.
This is freshness rejection,
not rollback of completed work.

Assessment counts were `1, 1, 0, 0, 1` and execution counts were `2, 2, 0, 0, 1`
for parallel,
sequential,
missing ownership,
preparation-time change,
and post-first-execution change respectively.
Full streams,
per-member outcomes,
source hashes,
and JSON-value persistence reconciled with empty worker stderr.
Real lifecycle epoch wiring,
complete producer coverage,
instruction authority,
and current human permission remain open.

## Actual tree lifecycle observations

The stock SDK diagnostic `contract/collector/request-tree-lifecycle/` completed as `proc_1da7`,
exit 0:
six SDK sessions,
six injected requests,
no tools executed,
and no external model requests.
A stop-response receipt matched its serialized request and remained fresh after normal SDK completion.

The no-op tree target emitted no tree event and preserved the receipt.
A cancelled navigation emitted only `session_before_tree`,
kept the original leaf,
and preserved the receipt.
With the fixture epoch fixed at zero,
actual navigation away and back also left the observer reporting freshness.
The manager identity and observed prompt/resource/policy surfaces remained unchanged.
Those checks did not substitute for a lifecycle epoch.

Wiring `observer.invalidate()` to `session_tree` rejected the old receipt after the callback ran.
Restoring the original leaf did not revive it.
However,
the receipt was still usable inside that callback before invalidation,
after the native leaf had already changed.
This demonstrates post-event rejection,
not closure of the transition window.

Calling `SessionManager.branch()` directly changed and restored the actual leaf without emitting extension tree events.
The constant-epoch observer remained fresh.
An event-only implementation therefore cannot claim direct-manager mutation coverage from these tree-hook controls.
These are limits of the tested observer configuration,
not an installed SDK fix or a grant of authority to recorded messages.

Private streams and all mode records reconciled with empty worker stderr.
The selected source and mandatory policy hashes remained unchanged.
Runtime replacement,
including same-manager in-memory forks,
remains the next separate surface to exercise before choosing lifecycle wiring.

## Actual runtime replacement and fork observations

The private `contract/collector/request-runtime-lifecycle/` phase completed as `proc_7d74`,
exit 0,
using real service/runtime factories.
It constructed 14 SDK sessions;
eight completed an owned response and the replacement sessions were not prompted.
Eight injected requests ran,
with no tools or external model requests.
Every constructed session completed its delegated disposal exactly once.

Cancelled `newSession` kept the original runtime and fresh receipt.
Successful new-session,
switch,
and persisted-fork paths replaced both the `AgentSession` and manager.
An in-memory fork replaced the `AgentSession` but reused its manager.
Without explicit invalidation,
that old receipt was rejected by the stale extension-context check rather than by manager identity.
The SDK extension runner emitted its existing `This extension ctx is stale after session replacement or reload` diagnostic.
Manager identity alone did not explain that rejection.

In the tested replacement paths,
the receipt remained usable during `session_shutdown` and immediately before the host's
`setBeforeSessionInvalidate` callback.
Explicit invalidation in that callback rejected it before native disposal.
The observed ordering was shutdown,
host invalidation callback,
disposal,
replacement factory,
new session start,
rebind,
and `withSession`.
This does not close an earlier transition window merely because eventual rejection works.

A deliberately failing replacement factory preserved its exact error object.
The outgoing session was already disposed;
no replacement SDK session was constructed,
and its old receipt stayed unusable.
Private streams,
constructed/completed counts,
callback ordering,
selected source hashes,
and policy hashes reconciled with empty worker stderr.

These results cover the named native flows,
not a production lifecycle lease.
The existing registry's fixed-session branch snapshots must not be confused with a lifecycle-only epoch that
survives normal message appends but expires on root changes.
Direct mutations and borrowed mutable entry references still need an explicit coverage contract.

## Borrowed manager values and interception limits

The private `contract/collector/manager-mutation-coverage/` phase passed `proc_152e`,
exit 0,
with 18 owned native managers,
no `AgentSession` construction,
and no model or network requests.
Persistent and in-memory fixtures exercised `getEntry`,
`getEntries`,
`getBranch`,
`getTree`,
`buildSessionProjection`,
and the message object supplied to `appendMessage`.

Every tested path shared the native message object.
Changing its controlled `content` field changed both the active graph and its projection.
Existing persistent JSONL bytes did not change.
Restoring the field restored the graph;
all mutation stayed inside disposable fixtures.
A fresh outer array or tree wrapper therefore did not provide immutable nested values.

The method-dispatch controls distinguished mechanisms that must not be conflated.
An in-place instance hook intercepted an ordinary `branch()` call through another reference to that same manager.
A cached pre-install method and `SessionManager.prototype.branch.call(...)` each moved and restored the leaf
without invoking the instance hook.
Every route then passed a property-call positive control,
proving the hook was installed and capable of observing a call.

This narrows the conclusion:
raw-manager exposure alone does not bypass an in-place hook,
but the measured cached/prototype routes and mutable message aliases defeat a complete-coverage claim.
Method wrapping,
post-mutation events,
and persisted-file comparison are not interchangeable ownership guarantees.
No native getter behavior or installed implementation was changed.

## Copy-boundary experiment staging failure

The first private `contract/lifecycle/manager-copy-boundary/` attempt,
`proc_c72a`,
failed in staging before any worker,
manager fixture,
or model request ran.
Node 26.10.0 `readFileSync` emitted `ENOENT` for the assumed installed
`@earendil-works/pi-coding-agent/LICENSE` path.
The installed 1.0.0 package directory did not contain that file.
The package manifest declared MIT and named the upstream repository,
but that did not prove a local license-file path.

The assumption was in the authored stager,
not a demonstrated SDK runtime defect.
Its original sources and generated module prefix remain intact.
A fresh `manager-copy-boundary-v2` phase validates the retained MIT text against the
[upstream v1.0.0 license](https://github.com/earendil-works/pi/blob/v1.0.0/LICENSE)
before writing generated artifacts.
The verified Git blob is `b0a8e9b81083294360c69b4ec45d3d39a2b28197`.
No copy-boundary behavior or SDK compatibility result is inferred from the failed staging attempt.

The fresh recovery phase subsequently passed `proc_0468`:
30 paired cases,
32 owned native managers,
no SDK sessions,
and no model requests.
The original baseline preserved every tested alias effect.
The copy-in/copy-out variant prevented tested getter,
append-argument,
and preloaded-input mutations from changing canonical graph or projection values.
Raw own-state access still changed both variants.
Persistent bytes and fixture restoration were checked separately.
This first phase is a data-copy result for the inspected profile,
not full encapsulation.

The actual SDK follow-up `contract/lifecycle/manager-copy-sdk/` passed `proc_5f26`:
four completed sessions,
eight injected requests,
two inert tool executions,
and no external model requests.
Original and changed managers both preserved selected final-message replacement,
asynchronous native tool hooks,
before-settle draft preview,
append-only context edits,
continuation payload content,
and persisted JSON values.
The final settle callback was measured in both modes.
Public message-end event identity stayed intact while stored-message identity became separate in the copy variant.
That distinguishes live event coordination from retained state ownership.

This does not qualify auto-retry/recovery omission,
arbitrary extension payloads,
raw own-state protection,
or complete mutation custody.
The installed SDK remained unchanged.

### Private fields isolate data but leave method routes open

`contract/lifecycle/manager-private-fields/` passed `proc_50e1`:
58 declared observations using four owned native managers,
no SDK sessions or model requests.
The experiment converted the pinned copy variant's 11 state fields to JavaScript private fields.
All state fields disappeared from ordinary own-property enumeration.
Public writes to ten tested field names no longer changed canonical read results,
unlike the copy-only baseline.

The persistent `flushed` flag had a separate positive control.
Setting the baseline's public flag to false caused exact `EEXIST` at its owned session path:
the memory entry had been appended,
but the old file bytes remained.
The private-field variant ignored the public shadow and persisted the new append.
The failed baseline fixture was not reused.

Private fields did not close method custody:

-   Cached and prototype `branch` calls still moved/restored the leaf without the selected instance hook.
-   An own getter override still spoofed ordinary `getSessionId()` calls.
    A captured prototype getter returned the actual ID.
-   The compiled public `_loadEntries` method still replaced/restored graph content in both variants.

The result catalogs unexercised methods rather than claiming whole-module compatibility.
The follow-up `manager-private-fields-sdk/` passed `proc_809e`:
two changed-variant SDK sessions,
four injected requests,
one inert execution,
and no external model requests.
It reused the pinned prior probe logic with only the variant schedule and aggregate counts changed.
Measured consumer outcomes matched the retained copy-boundary baseline without replaying unchanged sessions.

Data isolation and those selected consumers are now qualified within their stated profiles.
A native lifecycle occurrence and protected method surface are not implemented or qualified.
The proposed next structural work is recorded in
[the private SDK custody proposal](../planning/pi-auto-mode-sdk-state-custody.md),
now accepted for private prototyping only,
not deployment.

### Intrinsic native occurrences and protected methods

The accepted private SDK custody prototype lives in `contract/lifecycle/sdk-custody-native/`.
It adds opaque root occurrences,
protects the instance/prototype/constructor method slots,
and makes low-level writers private.
The installed declaration exposes `_persist` publicly;
removing that writer is a deliberate interface change for this controlled prototype,
not arbitrary SDK-caller compatibility.

The first run,
`proc_b8f3`,
completed its native workers but failed independent verification.
Node `assert/strict` emitted `AssertionError [ERR_ASSERTION]` because the mutable-instance worker's message
did not match the predeclared method-assignment witness.
Its retained stack points to `sdk-custody-native/check.mjs:35:12`,
the public `leafId` shadow assertion.
The original failure and source remain intact.

`proc_04d7` then exercised four fresh paired controls.
The retained frozen prototype rejected ordinary method assignment in both variants.
Only the unfrozen instance admitted an own getter through `Reflect.defineProperty` and returned its spoofed value.
The intact instance rejected that definition.
This corrects the authored test assumption;
it is not an upstream defect claim.

`proc_2023` reconciled the retained workers with the specific stack/source witness and that supplement,
without replaying the native matrix.
It admitted 24 intact native-manager cases and 12 independent guard-removal outcomes.
Cached/prototype navigation changed the native occurrence;
returning to the old leaf did not revive it.
The append family preserved its lifecycle occurrence.
A fault immediately before the branch write retained the original error and old leaf,
while the occurrence had already changed.
Separate omissions exercised each structural marker site.

No SDK agent session or external model request ran in this native-manager phase.
The stronger protected-method variant then passed selected actual SDK consumers in `proc_51fd`:
two completed sessions,
four injected requests,
one inert execution,
no external model calls.
Its measured message/context-edit outcomes matched retained baseline records.
This does not establish every SDK caller's compatibility.

Independent source review found separate registry-integration defects:
a callback could invalidate a root after its last freshness check,
and a replacement-reader failure could occur after transition finalization.
`proc_f13e` reproduced nine failing controls on the preserved draft.
The remedy validates after callbacks,
prepares fallible replacement observations before finalization,
and publishes commit/cancellation state without further callbacks.
Failed preparation keeps transition cleanup available;
an unreturned begin handle is cleaned up internally.

`proc_9258` passed 24 retained legacy cases,
17 native-reader protocol cases,
nine callback/publication cases,
and 11 independent guard-removal variants.
These use constructor-owned doubles,
not actual SDK roots.
The next `root-lifecycle-intrinsic-sdk/` phase binds this registry and the request observer to real SDK navigation,
including cached/prototype calls without instance hooks.
It is prepared but not yet qualified.

## Verified workarounds and limits

The source-method control showed that reading the later getter sees the tested run-option contribution
missed by the earlier owned copy.
It also showed that this is not a complete workaround for request-local or payload-only changes.
No production collector workaround is qualified by this phase.

The consumer design must retain mandatory current policy separately,
track admitted instruction sources and composition stages,
and distinguish incomplete coverage from established absence.
Those are contract requirements,
not a claim that a single existing getter already implements them.
Remaining integration work may use composition or a different host interface;
no whole-toolset impossibility is established.

## What does not work

- Treating an early context-file snapshot as all governing instructions.
- Treating command base options as the complete current run state.
- Treating `getSystemPrompt()` as proof that every request-local or payload rewrite was observed.
- Treating a role,
  filename,
  or prompt string as an authenticated source or instruction-coverage witness.
- Treating the missing-leading-system diagnostic as a veto by this runner method.
- Declaring Node `v26.10.0`,
  real TUI/RPC,
  persisted replay,
  human-authentication,
  or provider-encoding qualification from this Node `v24.21.0` method probe.

## Upstream filing artifact

Nothing is filed or drafted.
The completed probe establishes consumer-relevant composition behavior,
not a new upstream defect.

The bounded tracker searches were `getSystemPrompt` in issues
and `context_with_system` in pull requests,
each with a limit of 20 results.
Bodies and comments were read for the relevant matches:

- [Issue 3539](https://github.com/earendil-works/pi/issues/3539)
  already discusses context-file versus system-prompt visibility and later payload rewrites.
  Its earlier in-handler getter mismatch was fixed;
  the inspected `emitBeforeAgentStart()` binds a live chain renderer at `runner.ts:1323`.
  Do not re-prototype that historical mismatch against the current source.
- [PR 9846](https://github.com/earendil-works/pi/pull/9846)
  added the current separation between `context` and `context_with_system`.
  Its restoration behavior and full-system stage are present in the inspected source.
- [Issue 9932](https://github.com/earendil-works/pi/issues/9932)
  concerns tool-removal drift with forced text.
  This probe did not remove a tool and does not reproduce or fix that reported incident.
- [Issue 9432](https://github.com/earendil-works/pi/issues/9432)
  proposes stable session-start contributions with source metadata.
  It is a proposal,
  not an installed capability assumed by this contract.

### Upstream filing decision

1.  Upstream fault:
    not established.
    The tested transformations are documented extension capabilities.
2.  Fixability:
    no impossibility claim and no upstream fix target selected.
    A consumer collection interface still needs investigation and actual-host testing.
3.  Supported use:
    extensions and prompt transformations are supported;
    a complete authorization-source witness is not established by these methods.
4.  Contribution policy:
    the pinned `CONTRIBUTING.md` was read.
    It requires understood contributions,
    human-voice issue reporting or clearly labeled AI follow-up,
    and contributor approval gates.
    No human-authored filing or contribution is proposed here.
5.  Maintainer willingness:
    no refusal of this consumer use case is inferred.
    Existing discussion already explains the relevant visibility limits;
    no additive defect report has been established.
6.  Fix prototype:
    none.
    This is a source-method observation harness,
    not an upstream patch or a qualified production workaround.

`.out-of-scope/pi-gpt55-long-context.md` was checked;
its model-window topic does not cover these instruction-view observations.
The inspected `.out-of-scope/codex-harness.md` excludes the Codex harness,
not Pi;
`.out-of-scope/terminal-title-fork-parity-tests.md` excludes a particular cross-harness title test,
not this source-view probe.
No other exclusion filename indicated this topic.
Any later filing requires its own applicable exclusion,
contribution,
duplicate,
and tested-fix checks.
