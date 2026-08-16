# GitHub REST API 2026-03-10 recommends serial Issue creation instead of a concurrency-five queue

## Symptom

A bounded queue can make concurrent GitHub Issue creation look provider-safe.
The proposed adapter initially considered `p-limit` 7.3.1 with concurrency five.
That schedule conflicts with GitHub's current REST API guidance before any request fails:
GitHub recommends serial requests and a pause of at least one second between mutative requests.

This is a design-time incompatibility,
not a reproduced GitHub outage or an upstream `p-limit` defect.

## Root cause

### GitHub treats concurrency and mutation pacing as separate secondary-rate-limit risks

[GitHub's REST API best-practices document][github-best-practices]
says under “Avoid concurrent requests”:

> To avoid exceeding secondary rate limits,
> you should make requests serially instead of concurrently.
> To achieve this,
> you can implement a queue system for requests.

The adjacent “Pause between mutative requests” section adds:

> If you are making a large number of `POST`,
> `PATCH`,
> `PUT`,
> or `DELETE` requests,
> wait at least one second between each request.

Issue creation is a `POST` operation.
A concurrency cap controls how many requests run together,
but it does not make those requests serial or impose time between their starts.

GitHub's “Handle rate limit errors appropriately” section also requires clients
to honor `retry-after`,
wait until `x-ratelimit-reset` when the remaining count is zero,
or wait at least one minute and increase later delays for a secondary limit without either header.
Continuing while rate-limited can result in integration banning.

### `p-limit` starts work immediately whenever capacity exists

The source audit used `p-limit` tag `v7.3.1`,
commit `df476048d023ff868cd45b35ee47f5fb0ca2b25a`.
[`index.js:18-24`][p-limit-resume] starts another queued function whenever active work is below the cap:

```js
const resumeNext = () => {
	// Process the next queued function if we're under the concurrency limit
	if (activeCount < concurrency && queue.size > 0) {
		activeCount++;
		queue.dequeue().run();
	}
};
```

[`index.js:59-63`][p-limit-immediate] invokes that scheduler immediately after enqueueing:

```js
// Start processing immediately if we haven't reached the concurrency limit
if (activeCount < concurrency) {
	resumeNext();
}
```

There is no time-based pacing in this path.
`pLimit(5)` can therefore start five Issue requests without the provider-documented pause.

### Queue clearing cannot revoke active Issue requests

[`index.d.ts:17-27`][p-limit-clear-type] documents the cancellation boundary:

```ts
/**
Discard pending promises that are waiting to run.

Note: This does not cancel promises that are already running.

When `rejectOnClear` is enabled, pending promises are rejected with an `AbortError`.
*/
clearQueue: () => void;
```

[`index.js:77-89`][p-limit-clear-source] confirms that `clearQueue()` touches queued entries only.
A failure observed under concurrency five could leave other Issue creations already in flight.
Clearing pending work would not provide strict stop-at-first-failure behavior.

### Issue creation has no documented idempotency mechanism

[GitHub's best-practices document][github-best-practices]
says conditional requests for unsafe methods such as `POST` are unsupported
unless an endpoint documents otherwise.
The [Create an issue endpoint][github-create-issue] documents its request fields and responses
but no idempotency key or conditional-create contract.

A network failure,
timeout,
or `5xx` response can therefore leave the client unable to prove whether the Issue was created.
Retrying that request can create a duplicate.
The adapter design deliberately accepts that risk to retry ambiguous transient failures,
and its help,
preview,
and result diagnostics must disclose it.

## Verification

### Versions and sources

- GitHub REST API documentation version:
  `2026-03-10 (latest)`,
  accessed 2026-08-16.
- `p-limit` package:
  tag `v7.3.1`,
  commit `df476048d023ff868cd45b35ee47f5fb0ca2b25a`,
  MIT license.
- Upstream clone:
  `~/temp/agent/p-limit-7.3.1-20260816`.
- Workspace catalog:
  `pnpm-workspace.yaml` already contains `p-limit: '>=7.3.1'`.

No live GitHub Issue was created for this investigation.
The deciding GitHub behavior is an explicit provider instruction,
and exercising the rejected schedule would mutate external state without proving that GitHub permits it.
The `p-limit` scheduler and cancellation boundaries were verified from source and type declarations.

A local source check is reproducible with:

```bash
rg --line-number \
  'resumeNext|Start processing immediately|clearQueue|does not cancel' \
  "$HOME/temp/agent/p-limit-7.3.1-20260816/index.js" \
  "$HOME/temp/agent/p-limit-7.3.1-20260816/index.d.ts"
```

### Provider-aligned behavior catalog

- Dispatch one mutative GitHub request at a time.
- Leave at least one second between mutative requests.
- Honor `retry-after` before another request.
- Wait for `x-ratelimit-reset` when `x-ratelimit-remaining` is zero.
- Stop after a bounded number of exponentially delayed secondary-rate-limit retries.
- Treat ambiguous create retries as carrying duplicate-Issue risk.

### Conflicting behavior catalog

- Start five Issue-creation requests together.
- Start another mutation immediately when one concurrency slot opens.
- Treat a concurrency cap as request pacing.
- Assume `clearQueue()` cancels Issue requests that already started.

## Verified workarounds

### Serialize Issue creation and pace request starts

The selected adapter design follows both provider instructions:

1. Create one Issue at a time.
2. Wait at least one second before starting the next Issue-creation request.
3. Do not add `p-limit` to the adapter package for Issue creation.
4. Retry the user-approved failure classes under a bounded policy.
5. Stop scheduling new Issues after a retry-exhausted failure.

This is verified against GitHub's published concurrency and mutation-pacing contract.
Runtime verification remains part of adapter implementation because no production adapter exists yet.

Tradeoffs:

- Publication takes longer than a concurrent queue.
- Strict serialization makes stop-at-first-terminal-failure exact for requests not yet started.
- Provider-compliant pacing reduces secondary-rate-limit exposure but cannot eliminate network or service failures.
- Retrying ambiguous Issue-creation failures can create duplicates.

## What does not work

### `pLimit(5)` without pacing

It bounds simultaneous work but immediately fills available slots.
It satisfies neither serial dispatch nor the one-second mutation pause.

### `pLimit(5)` with one-second start spacing

Spacing request starts follows the mutation-pause guidance,
but slow requests can still overlap.
It therefore continues to conflict with GitHub's separate serial-request recommendation.

### Clearing the queue after a failure

`clearQueue()` discards pending functions only.
It cannot cancel requests already running,
so concurrency five cannot promise that no later Issue is created after the first terminal failure.

### Assuming a retry is duplicate-safe

The Issue-creation endpoint has no documented idempotency key.
An ambiguous failed response is not proof that GitHub created nothing.
The adapter may retry by explicit design choice,
but it must not claim that the retry is duplicate-safe.

## Upstream filing decision

No `.out-of-scope/` entry covers GitHub REST mutation concurrency or `p-limit` queue clearing.
GitHub documentation issues and community discussions were searched for:

- `Pause between mutative requests concurrent requests REST`;
- `secondary rate limit one second concurrent Issue creation`;
- `p-limit clearQueue does not cancel running promises`.

No upstream defect matching this design conflict was found.
The `p-limit` tracker contains historical queue-clearing discussions,
but current 7.3.1 types already state the active-task boundary.

The filing constraints resolve as follows:

1. **Is it really upstream's fault?**
   No.
   GitHub documents the accepted request schedule,
   and `p-limit` documents that it limits concurrency rather than pacing or canceling active tasks.
2. **Can upstream fix it?**
   Not applicable as a defect.
   The consumer must choose a schedule compatible with the destination API.
3. **Are they supporting this use case?**
   GitHub supports Issue creation and publishes the relevant rate-limit practices.
   `p-limit` supports bounded concurrency,
   not provider-specific pacing.
4. **Would the repo welcome our contribution?**
   Not evaluated because there is no missing or incorrect upstream contract to change.
5. **Will they likely fix it?**
   Not applicable;
   the observed behavior is documented and intentional.
6. **Have we prototyped a minimal fix compatible with their architecture?**
   Not applicable because constraints one and two fail.
   The selected fix is consumer-side serialization.

There is nothing additive to file or comment upstream.

[github-best-practices]: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
[github-create-issue]: https://docs.github.com/en/rest/issues/issues#create-an-issue
[p-limit-clear-source]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L77-L89
[p-limit-clear-type]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.d.ts#L17-L27
[p-limit-immediate]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L59-L63
[p-limit-resume]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L18-L24
