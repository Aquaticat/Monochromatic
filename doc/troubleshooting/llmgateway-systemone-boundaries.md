# LLM Gateway System One source does not establish model identity, retry count, or payload-free error logs

## Status and symptom

The auto-mode migration requires narrow axiom estimates,
complete current policy input,
qualified model identity,
and a five-second total assessment budget.
The user permits one client transport retry and accepts gateway-internal retries.
Necessity-based retention without a fixed deletion deadline is accepted for future private non-secret inputs.
Neither zero retention nor an end-to-end two-attempt cap is required.
No private upload or production implementation is authorized.

A successful `/v1/systemone` response does not establish all these boundaries.
The public source normalizes the model name,
rotates credentials after retryable failures,
and retains upstream error diagnostics separately from ordinary payload fields.
These are source findings reproduced with an offline mocked-provider harness,
not observations of model substitution or private-data retention in the hosted service.

## Source identity

Repository:
 <https://github.com/theopenco/llmgateway>.
Revision:
 `4affe8bf02559880fea74fa5ba685ad2cb19168d`.
Read-only clone:
 `~/temp/agent/llmgateway-auto-mode-source-2026-09-26`.
The route's SHA-256 is `9eb34513cc6dfc6e8c4aa8b9d9a0dfa114f40c6129ff24563d43001feb67b841`.
Source paths in this document are relative to that pinned clone.
The hosted deployment's matching revision has not been established.

The first synchronous clone attempt timed out and left an incomplete checkout without `HEAD`.
A process inspection found no surviving clone process.
A new process-managed clone into the distinct source path completed successfully.
The incomplete directory was not treated as source evidence or deleted.
No dependency installation or upstream build was run.

## Root cause trace

### Request forwarding and model identity are different evidence

`apps/gateway/src/systemone/systemone.ts:633-637` constructs the upstream request from validated fields:

```typescript
// apps/gateway/src/systemone/systemone.ts:633-637
requestBody: {
  model: upstreamModel,
  state,
  questions,
},
```

The handler serializes that body for `fetchProvider` at lines 716 to 727.
Its state summarizer is used for log display,
not for the forwarded `state`.
The source does not demonstrate token preservation inside TypeSafe's model.

The same route at lines 1091 to 1094 overwrites upstream identity:

```typescript
// apps/gateway/src/systemone/systemone.ts:1091-1094
const normalizedResponse: Record<string, unknown> = {
  ...upstream,
  model: responseModel,
};
```

`responseModel` comes from the gateway's selected catalog mapping,
not a comparison with `upstream.model`.
The offline mismatch control returned HTTP 200 and `typesafe/jev-1.13.0`
when the mock provider reported `synthetic-unexpected-version`.
The pilot's matching response label remains an observed fact,
but must not be described as independently verified upstream identity.

The response is returned at line 1171 without applying `systemOneResponseSchema.safeParse`.
The missing-answer control therefore returned HTTP 200 with an empty `answers` object.
The consumer must validate required answer IDs,
values,
usage,
and its own snapshot binding;
a successful HTTP status is insufficient.

### One gateway request can contain several upstream attempts

`systemone.ts:641-665` remembers a failed credential and resolves another credential for the same selected provider.
The main loop at line 676 continues after a retryable HTTP failure:

```typescript
// apps/gateway/src/systemone/systemone.ts:935-941
const nextAttempt = shouldRetryAlternateKey(
  finishReason,
  status,
  upstreamText,
)
  ? await resolveNextAttempt(attempt)
  : null;
```

The imported helper in `apps/gateway/src/chat/tools/retry-with-fallback.ts:65-95`
accepts `upstream_error` as retryable.
The separate network-failure branch at `systemone.ts:778-782` also resolves another credential.
The route neither reads `x-no-fallback` nor consumes a caller-supplied attempt limit.
The offline control with two synthetic retryable failures produced three upstream calls,
with and without that header.
This is same-provider credential rotation,
not evidence of cross-provider fallback.

`systemone.ts:715` calls `createCombinedSignal(controller)` for each attempt.
`apps/gateway/src/lib/timeout-config.ts:87-98` creates a new configured timeout signal and combines cancellation:

```typescript
// apps/gateway/src/lib/timeout-config.ts:87-98, selected statements
const timeoutSignal = createTimeoutSignal(cfg);
if (cancellationController) {
  return AbortSignal.any([timeoutSignal, cancellationController.signal]);
}
return timeoutSignal;
```

This call passes no project routing override.
The auto-mode client must enforce its own total deadline;
no five-second hosted deadline follows from the gateway defaults.
A client abort listener exists in this source,
but this harness did not verify real network cancellation or post-abort provider billing.
Do not equate one client retry with a two-attempt upstream cap.

### Metadata-only stripping does not strip upstream error text

The error branch copies the upstream response into diagnostics:

```typescript
// apps/gateway/src/systemone/systemone.ts:985-989
errorDetails: {
  statusCode: status,
  statusText: upstreamResponse.statusText,
  responseText: upstreamText,
},
```

`apps/gateway/src/lib/logs.ts:350-352` strips designated fields before queue publication:

```typescript
// apps/gateway/src/lib/logs.ts:350-352
if (options?.retentionLevel !== "retain") {
  logData = stripRetentionSensitiveLogFields(logData);
}
```

`packages/db/src/log-retention.ts:32-49` preserves the spread object and clears ordinary payload fields:

```typescript
// packages/db/src/log-retention.ts:32-49, selected statements
return {
  ...logData,
  messages: null,
  content: null,
  rawRequest: null,
  rawResponse: null,
  upstreamRequest: null,
  upstreamResponse: null,
};
```

It does not clear `errorDetails`.
The actual helper retained the synthetic marker `SYNTHETIC_ERROR_CONTENT`
from an upstream error while clearing `messages`,
`rawRequest`,
and `upstreamRequest`.
If an upstream error echoes submitted content,
that content can survive this stripping boundary.
The harness did not execute Redis/database publication or prove any live provider echoes customer content.
The finding is a conditional error-channel exposure,
not a claim that every metadata-only request stores its prompt.

## Verification

Private harness:
 `~/temp/agent/llmgateway-route-probe-2026-09-26`.
The harness copies inspected route source,
removes its import region,
strips TypeScript annotations with Node,
and supplies in-memory host service doubles.
It executes the upstream route body and retention helper,
not a rewritten route algorithm.
Zod validation,
Hono middleware,
credential storage,
retry classification,
DB,
and network behavior are mocked.
The retry fixture uses a known retryable 503;
it does not exercise classification of other failures.

```sh
# Private offline harness, not the production repository.
cd -- "${HOME}/temp/agent/llmgateway-route-probe-2026-09-26"
mise --no-env --no-hooks run build
mise --no-env --no-hooks run probe
```

Pinned base image:
 `bbc51c187ec813fd7c6a49afd22c15efdfe969b8c3a9a9cd49193c8a03908984`.
Built probe image:
 `0a55e1fbafe71f9bf6b539e0c8011b7d9ce7ba768690143c801fb3de5160dd53`.
Runtime:
 2 GiB memory including swap allowance,
2 CPUs,
64 PIDs,
60-second container timeout,
256 MiB Node heap,
read-only filesystem,
no network,
no capabilities,
and no host mounts or real credentials.
The Containerfile has COPY instructions only,
with no upstream install/build script execution.
Process `proc_dff9` exited 0.
Node emitted its `stripTypeScriptTypes is an experimental feature` warning;
no assertion failed.

### Working controls

- The complete 42,677-byte policy string survived forwarding unchanged.
  Snapshot:
   `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`.
- A valid Noul answer survived the route.
- Ordinary payload fields were cleared by the metadata-only helper.
- Retain-all mode preserved ordinary log content,
  proving the null-field check could distinguish the retention modes.

### Unsupported boundary assumptions

- A mismatched upstream model name was not rejected.
- Two retryable failures produced three calls despite `x-no-fallback: true`.
- Missing answer IDs passed the route as HTTP 200.
- Echoed error text survived the metadata-only stripping helper.

These controls establish the stated pinned-source behavior only.
The existing live synthetic pilot establishes native API access,
not these failure paths in the hosted deployment.

### Live public context-limit rejection

A separate first-party client called the pinned hosted model with complete freshly read policy
and one Noul question about an explicit synthetic color field.
It made a no-padding control request,
then requests padded with 40,000 and 80,000 repetitions of `x `.
These are repeat counts,
not measured tokenizer counts for rejected requests.
No private content,
raw history,
or final-action question was submitted.

Results from process `proc_b3f1`,
exit 0:

- Control:
   HTTP 200,
  45,020 request bytes,
  10,457 reported input tokens,
  22 reported output tokens,
  probability 0.98 for the explicit blue field,
  1548.170908 milliseconds total assessment time.
- First padded request:
   HTTP 400,
  125,020 request bytes,
  931.8712969999999 milliseconds.
- Second padded request:
   HTTP 400,
  205,020 request bytes,
  3185.840116 milliseconds.

Both error bodies were exactly:

```json
{
  "detail": {
    "error_type": "max_tokens_exceeded"
  }
}
```

The body names the token-limit error;
it does not identify which documented token budget was exceeded.
Do not infer an exact tokenizer boundary from byte counts or repeat counts.
The gateway returned each result inside the five-second individual assessment budget.
The whole process duration includes all requests and is not a per-request latency.
No client retry was attempted for these intentional limit errors.
Gateway-internal attempts remain unknown.

The unchanged policy snapshot was rechecked after every response.
These live observations demonstrate rejection of the tested oversized inputs,
not universal overflow behavior,
complete token-by-token model preservation,
or forced-timeout handling.
The successful color answer is an access control,
not an authorization-quality result.

Private client and artifact:
`~/temp/agent/jev-context-boundary-2026-09-26/probe.mjs`
and `result-initial.json` in the same directory.
Client SHA-256:
 `1b9cbaf2d5451a39b6377a48378189e31c91e74eccb6bd55bd7f64589db0a647`.
Artifact SHA-256:
 `a3ca521bc98bcc04330b3ab04dfb05626bc148d06794ca6d039798c6d6b1e3f7`.
The create-new artifact prevents an unchanged rerun from overwriting evidence.
The probe uses one admitted credential,
rejects redirects,
bounds response size to 64 KiB,
and caps its Node heap at 256 MiB.
Its README and mise task retain the complete execution manifest.

## Verified workarounds and present containment

No production workaround has been built or verified.
Continue public/synthetic-only evaluation until remaining hosted qualification and cutover authorization are resolved.
Q12 accepts the necessity-based retention posture;
zero retention is not a new blocker.
Public fixtures keep private evaluation payloads out of either log path,
but do not qualify real private runtime assessment.

The private axiom runner already rejects missing answer IDs and invalid probabilities.
Its live pilot passed valid-answer checks;
failure-path mutation coverage and a five-second total-budget implementation remain pending.
Sanitizing an error after it reaches the client cannot remove content already logged upstream.

## What does not work

- Treating a matching gateway model label as upstream identity attestation.
- Treating provider pinning or `x-no-fallback` as a proven upstream attempt cap.
- Applying chat-specific retry configuration to System One without tracing this route.
- Equating no model training with no payload retention.
- Treating exact gateway request forwarding as proof of hosted model token preservation.
- Treating this mocked harness as a real-service failure reproduction or a full integration suite.

## Upstream filing artifact

No issue or comment is drafted or filed.
This is an adoption-boundary audit,
not a demonstrated hosted incident.
No provider has been contacted.

### Upstream filing decision

1.  Upstream fault:
     not established for the hosted deployment.
    Same-provider retries and catalog normalization may be intentional;
    the conditional error channel needs complete integration evidence before a defect claim.
2.  Fixability:
     no impossibility claim.
    Consumer validation can protect response shape,
    but server-side retention requires evidence and control at that server boundary.
3.  Supported use:
     native typed questions are documented;
    no strict end-to-end attempt cap is required after Q11 B.
    The user has accepted TypeSafe AUP section 1.5 for this guard-classification evaluation.
4.  Contribution policy:
     not evaluated because no upstream patch or filing is proposed.
5.  Maintainer willingness:
     not evaluated;
    no public request or communication was sent.
6.  Fix prototype:
     none.
    The isolated source-behavior probe is not an upstream fix.

An upstream-filing workflow would require the applicable exclusion checks,
contribution policy,
duplicate search,
and a compatible tested fix before a draft.
