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

The active artifact reports Pi version `1.2.0`,
source commit `06a466935536f8c9bcacb2d5efc0fc021be1bdff`,
and compiler version `7.0.2` in its `source-manifest.json`.
The consumer regression is committed as `c408b94879`.

```bash
# Run from the repository root.
mise run //package/pi-plugin/auto-mode:test:native:session-actions
```

The first case fails with `Follow-up after switch: Connection error.`.
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

No workaround for the affected real session has been verified.
Reload succeeds on an otherwise valid session;
that does not establish recovery after a root has already retired.
Do not recommend reload as a demonstrated remedy for this incident.

## What does not work

- Attributing the connection message to the remote provider without checking its nested cause.
- Treating a passing retry control as proof that tree navigation preserves prompt usability.
- Treating old-lease rejection as sufficient verification: the next prompt must still work.
- Declaring the decision-core replacement complete without ordinary provider-selection and navigation consumers.

The user identified an architectural problem after these reproductions.
Production fixes are paused while the
[host-isolation proposal](../planning/pi-auto-mode-host-isolation.md)
is reviewed.

## Upstream filing decision

No upstream issue or patch is proposed.

1.  Upstream fault: no; the failing endpoint check and root lease are maintained auto-mode code.
2.  Upstream fixability: no upstream fix is needed for these demonstrated mechanisms.
3.  Supported use: the tests invoke the installed session's provider-selection and tree-navigation methods.
4.  Contribution policy: not investigated because an upstream contribution is not proposed.
5.  Maintainer willingness: not investigated for the same reason.
6.  Compatible upstream prototype: inapplicable; a local architectural correction remains proposed.
