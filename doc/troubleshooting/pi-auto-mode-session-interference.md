# Auto-mode on Pi 1.2.0 blocks prompts after provider switching and tree navigation

## Symptom

On 2026-10-15 the user reported `Root lease has been retired` and `Connection error.`.
The session beginning at 22:17:29 UTC records a switch from Hyper to
`llmgateway-devpass/mimo-v2.6-pro`,
two connection failures with recovery context edits,
then a switch to `opencode-go/mimo-v2.6-pro` and a retired-lease failure.
The user confirms Esc, edit/retry, `/tree`, and `/reload` between attempts.
The transcript does not record the full UI action order or the original nested connection-error cause.

The failures reproduce independently in the installed native host without tool calls or external network access.
Provider switching fails before the fixture transport receives the next request.
Successful tree navigation causes the next prompt to fail before transport.
These are separate mechanisms with a shared architectural coupling,
not evidence that one error caused the other.

## Root cause

The endpoint and root-lease excerpts describe the reproduction baseline at commit `c408b94879`.
The replacement described in "Implemented correction" removed those admission paths on 2026-10-15.

### Provider switching retains the startup endpoint

`package/pi-plugin/auto-mode/native/contract/integration/native-host/bootstrap.ts:173`
reads the model during session binding.
At line 187 it computes the endpoint passed into the observer:

```typescript
// package/pi-plugin/auto-mode/native/contract/integration/native-host/bootstrap.ts
const baseUrl = root.session
  .model
  ?.baseUrl
  ?? 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
const endpoint = new URL(`${endpointBase}/chat/completions`).href;
```

`package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs:60`
compares every later request with that fixed endpoint before invoking terminal transport at line 79:

```javascript
// package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs
if ((url !== endpoint) || (init?.method !== 'POST')
  || ((typeof init.body) !== 'string') || !init.body.isWellFormed())
  throw new RequestObservationProfileError('Only the declared serialized JSON POST shape is observed');
```

A process-local diagnostic at that catch records this exact profile error after switching providers.
The OpenAI SDK then reports `Connection error.`.
Installed `openai@7.19.0/client.mjs:837` wraps transport rejection in `APIConnectionError`;
`openai@7.19.0/core/error.mjs:74` supplies the default message:

```javascript
// Installed openai@7.19.0/client.mjs
throw new Errors.APIConnectionError({
  message: getConnectionErrorMessage(response),
  cause: response,
});
// Installed openai@7.19.0/core/error.mjs
super(undefined, undefined, message || 'Connection error.', undefined);
```

The reproduction has one initial transport call and no second call.
It establishes a local cause for this error string;
it does not reconstruct the unretained nested exception from the user's original request.

### Tree navigation invalidates the root used by ordinary prompts

`package/pi-plugin/auto-mode/native/contract/lifecycle/sdk-custody-native/generate.ts:197`
adds root-occurrence replacement to native branch movement:

```typescript
// package/pi-plugin/auto-mode/native/contract/lifecycle/sdk-custody-native/generate.ts
to: '        if (this.#leafId === branchFromId) return;\n        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;\n    }'
```

The generated native `AgentSession.navigateTree` calls that manager branch operation,
refreshes finalized context,
and returns successfully.
The next stream invocation captures a root lease before the provider is called,
at `package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs:17`:

```javascript
// package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs
const rootLease = lifecycle.capture(boundRoot);
```

`package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/lifecycle.mjs:93`
retires the root when its native occurrence changed.
At line 146 the active-root check throws:

```javascript
// package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/lifecycle.mjs
if (current !== root.nativeOccurrence) {
  retireObserved(root);
  emit('lifecycle.native-occurrence.changed');
}
if (retired(root)) throw new RootLeaseRetiredError('Root lease has been retired');
```

The initial root is retained instead of replaced during capture at lines 187 to 193.
Old operation evidence must become unusable after navigation,
but requiring that old root for the next ordinary prompt gives retirement the wrong scope.

## Verification

The reproduction artifact reports Pi version `1.2.0`,
source commit `06a466935536f8c9bcacb2d5efc0fc021be1bdff`,
and compiler version `7.0.2` in its `source-manifest.json`.
The consumer regression is committed as `c408b94879`.

```bash
# Run from the repository root.
mise run //package/pi-plugin/auto-mode:test:native:session-actions
```

At the reproduction commit, the first case fails with `Follow-up after switch: Connection error.`.
The individual isolated fixtures are also runnable in
`${HOME}/temp/agent/pi-reported-errors-20261015/`:

```bash
# Run from the named scratch directory.
mise run reproduce switch
mise run reproduce tree
mise run reproduce retry
mise run reproduce reload
mise run reproduce abort
mise run inspect-cause
```

Failing catalog:

- Provider switch: initial prompt succeeds; follow-up reports `Connection error.`; one transport call total.
- Tree navigation: initial prompt and navigation succeed; follow-up reports `Root lease has been retired`;
  one transport call total.

Passing catalog:

- Retry control: authored transport failure on the first prompt; second prompt completes; two transport calls.
- Reload control: both prompts complete; two transport calls.
- Abort control: abort after the first completed prompt; second prompt completes; two transport calls.

The abort control does not exercise cancelling an in-flight response.
The retry control submits a second prompt; it does not exercise automatic retry backoff.
All fixtures use disposable homes, the built native host, and authored SSE responses.
No provider outage is necessary to reproduce either failure.

## Verified workarounds

No command-level workaround for the affected real session has been verified.
Reload succeeds on an otherwise valid session;
that does not establish recovery after a root has already retired.
Do not recommend reload as a demonstrated remedy for this incident.

## Implemented correction

The replacement moves judgment creation to complete-group dispatch.
Native branch identity scopes each operation instead of permanently retiring subsequent chat.
`package/pi-plugin/auto-mode/native/contract/integration/native-batch/operation-currentness.mjs:58`
compares the captured occurrence and retains staleness only on that operation:

```javascript
// package/pi-plugin/auto-mode/native/contract/integration/native-batch/operation-currentness.mjs
if(readCurrent()!==state.occurrence)throw new NativeOperationStaleError('Session branch changed during this tool decision');
```

Request capture failure is retained while the original stream continues.
`package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs:79`
records capture failure before selecting the caller's payload callback:

```javascript
// package/pi-plugin/auto-mode/native/contract/lifecycle/root-lifecycle-retirement-entry/observation-stream.mjs
}catch(error){fail(error);}
const payload=scope.failed?{
  association:undefined,
  onPayload:options?.onPayload
}:prepareObservedPayload({
```

The expanded tree test exposed another primary gate:
capturing an extension event containing `AbortSignal` rejected the next prompt with `RunPromptCustodyError`.
Prompt and event capture now retain that failure for automatic assessment without owning native callback effects.
`package/pi-plugin/auto-mode/native/contract/integration/native-batch/passive-capture.mjs:13`
keeps capture failure separate from the native fallback:

```javascript
// package/pi-plugin/auto-mode/native/contract/integration/native-batch/passive-capture.mjs
function observe({capture,fallback}){
  if(!state.failure){
    try{return capture();}
    catch(error){fail(error);}
  }
  return fallback?.();
}
```

Unavailable automatic evidence opens manual approval for the complete prepared group.
Allow executes that group; Stop, cancellation, and unavailable UI execute nothing.
This is the user's corrected fallback, adopted on 2026-10-15.
The tradeoff is that an unsupported event can leave its source owner unavailable for automatic decisions;
subsequent affected tools still require manual review.
No test establishes universal automatic-evidence recovery after arbitrary event data.

The original approval regression found another important boundary:
retired authorization after the first dialog must not open a second evidence-free dialog.
Commit `e9864891ee` retains an established policy decision through that failure.
It preserves prohibitions and independent authorization requirements.

### Replacement verification

The disposable package under `${HOME}/temp/agent/pi-host-isolation-20261015/`
retains the build and consumer logs.
`complete-matrix.log` passes native session actions, passive callback and transport checks,
host lifecycle, runtime-hook installation, policy outcomes, and manual fallback on `native-release-JWvYLT`.
`approval-matrix.log` on `native-release-LNNqh3` passes original approval,
native-context reload, fresh confirmation, and uncertainty controls.
Its out-of-profile bypass expectation required updating for the accepted manual fallback.
The subsequent `approval-final.log` passes that Stop control, the complete approval matrix,
and selected-context verification with six assessments and eighteen native child executions.

The installed replacement is `native-release-Yhc7sX`.
`installed-configured.log` verifies the original installed command with all 17 configured packages:
Allow executes one read, while prohibition and an unmet independent prerequisite execute none.
`live-final.log` passes the same policy outcomes using live Luna against the disposable candidate.
`installed-live.log` then verifies live Luna through the installed command:
516 questions in three successful HTTP requests, one dialog, and one native read.
Primary responses and dialog selection remain authored fixtures.
No human keyboard approval or universal semantic accuracy is claimed.

`installed-manual-group.log` passes parent identity, native retirement, cancellation,
host replacement, one-shot execution, and returned-token rejection.
A process-local omission of the parent-identity check makes that committed regression fail with
`changed-parent must reject its stale Allow response`; the production check remains present.

The session-action cases include switching providers, tree navigation, explicit retry, reload,
completed and in-flight abort, combined actions, cancelled and no-op navigation, summary navigation,
fork, resume, agent retry, and provider retry.
The native callback tests exercise capture failure before and after callbacks,
exactly-once execution, unchanged return values, and original thrown-value identity.
The manual matrix independently injects observation and assessment failure and checks
Allow, Stop, cancellation, and headless behavior.

The configured-host harness initially mounted the scratch alias without its canonical generated-import path.
After mounting both paths, it also needed to preload the candidate's HTTP dispatcher before installing fixture fetch.
Preloading the installed release's dispatcher allowed candidate initialization to replace that fixture transport.
These are harness corrections, not additional provider incidents.

One verification attempt ended with Mise's `killed by SIGABRT` without a retained native fatal diagnostic.
A later commit hook reported `cannot fork()` and `Resource temporarily unavailable`.
The shared worker task limit was 256; a later sample measured 245 tasks.
Those samples do not prove the original abort's cause.
Verification now reduces fixture worker pools and runs the configured checks separately.
The user subsequently requested 2048 tasks.
The maintained hook and both live worker groups now use that limit while memory and CPU budgets remain unchanged.
The [worker-limits record](codex-shell-worker-limits.md) documents the coordinated update.

## What does not work

- Attributing the connection message to the remote provider without checking its nested cause.
- Treating a passing retry control as proof that tree navigation preserves prompt usability.
- Treating old-lease rejection as sufficient verification: the next prompt must still work.
- Declaring the decision-core replacement complete without ordinary provider-selection and navigation consumers.

The user identified an architectural problem after these reproductions.
The user accepted the
[host-isolation proposal](../planning/pi-auto-mode-host-isolation.md).
Its replacement passes the disposable session reproductions and the installed configured-host checks.

## Upstream filing decision

No upstream issue or patch is proposed.

1.  Upstream fault: no; the failing endpoint check and root lease are maintained auto-mode code.
2.  Upstream fixability: no upstream fix is needed for these demonstrated mechanisms.
3.  Supported use: the tests invoke the installed session's provider-selection and tree-navigation methods.
4.  Contribution policy: not investigated because an upstream contribution is not proposed.
5.  Maintainer willingness: not investigated for the same reason.
6.  Compatible upstream prototype: inapplicable; the correction belongs to the maintained integration.
