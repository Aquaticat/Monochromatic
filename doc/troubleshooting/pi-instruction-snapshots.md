# Pi 0.87.1 instruction snapshots can miss later prompt transformations

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

These are inspected source-method observations,
not a reproduced TUI incident or a claim that Pi cannot support a suitable collector through another interface.
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
