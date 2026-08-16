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
The adapter design retries ambiguous transient failures only after repository-number reconciliation.
Before each initial request,
it captures the greatest Issue or pull request number.
After an ambiguous failure,
it queries newer numbers and compares exact generated title and body.
A match suppresses the retry;
a failed reconciliation query stops processing.

GitHub's current Issue documentation does not state a read-after-write consistency guarantee.
A successful query that finds no match therefore reduces duplicate risk.
It cannot prove that a retry is duplicate-safe.
Help,
preview,
and result diagnostics must disclose that residual risk.

### `gh api` leaves explicit retry orchestration to its caller

The selected adapter delegates authentication and HTTP to GitHub CLI 2.97.0,
but retains its own retry policy.
[`pkg/cmd/api/api.go:369-381`][gh-api-input]
opens the named `--input` file and supplies it as the request body:

```go
if opts.RequestInputFile != "" {
	file, size, err := openUserFile(opts.RequestInputFile, opts.IO.In)
	if err != nil {
		return err
	}
	defer file.Close()
	requestPath = addQuery(requestPath, params)
	requestBody = file
```

The adapter can therefore avoid sending issue bodies through its standard input or process arguments.
[`pkg/cmd/api/api.go:474-478`][gh-api-headers]
prints response status and headers before processing the body when `--include` is set:

```go
if opts.ShowResponseHeaders {
	fmt.Fprintln(headersWriter, resp.Proto, resp.Status)
	printHeaders(headersWriter, resp.Header, opts.IO.ColorEnabled())
	fmt.Fprint(headersWriter, "\r\n")
}
```

For each non-paginated command invocation,
[`pkg/cmd/api/http.go:83`][gh-api-do]
performs the request through one client call:

```go
return client.Do(req)
```

The `cli/go-gh` 2.13.0 client begins with `http.DefaultTransport`
and then wraps it for sanitization,
optional caching,
logging,
and headers.
[`pkg/api/http_client.go:59-69`][go-gh-transport]
shows no retry transport in that chain:

```go
transport := http.DefaultTransport

if opts.UnixDomainSocket != "" {
	transport = newUnixDomainSocketRoundTripper(opts.UnixDomainSocket)
}

if opts.Transport != nil {
	transport = opts.Transport
}

transport = newSanitizerRoundTripper(transport)
```

This establishes that `gh api` has no application-level retry loop on this path.
The adapter can classify the returned status and headers,
reconcile an ambiguous creation result,
and decide whether to start another command.
It must not claim control over undocumented lower-level transport behavior.

GitHub CLI's command options also supply no timeout to that client.
[`pkg/cmd/api/api.go:390-405`][gh-api-client]
constructs `HTTPClientOptions` without one,
while [`cli/go-gh/pkg/api/client_options.go:59-61`][go-gh-timeout]
documents the resulting default:

```go
// Timeout specifies a time limit for each API request.
// Default is no timeout.
Timeout time.Duration
```

GitHub CLI 2.97.0 exposes no `gh api` timeout flag.
The adapter must therefore bound the subprocess lifetime itself
if it promises a request timeout or a finite graceful-interrupt wait.

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
- GitHub CLI:
  tag `v2.97.0`,
  commit `55dbb4dc6b7edb10b48e3d7fc5bccd32318d1b55`.
- `cli/go-gh` used by GitHub CLI:
  tag `v2.13.0`,
  commit `a0a6e8947ae2ceedb496654757886ef41ef5ac72`.

No live GitHub Issue was created for this investigation.
The deciding GitHub behavior is an explicit provider instruction,
and exercising the rejected schedule would mutate external state without proving that GitHub permits it.
The `p-limit` scheduler and cancellation boundaries were verified from source and type declarations.

A read-only probe of `GET /repos/Aquaticat/Monochromatic/issues`
with `state=all`,
`sort=created`,
`direction=desc`,
and `per_page=5` returned descending integer numbers and included a pull request entry.
This verifies the high-water query surface against the destination repository.
It does not establish an undocumented read-after-write guarantee.

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
4. Permit at most three retries after an initial retryable failure.
5. Honor GitHub rate-limit headers;
   otherwise use exponential delays starting at sixty seconds for rate limits
   and one second for network,
   timeout,
   or `5xx` failures.
6. Reconcile ambiguous failures against Issue or pull request numbers above a pre-request high-water mark.
7. Stop instead of retrying if the reconciliation query fails.
8. Stop scheduling new Issues after a retry-exhausted failure.
9. Invoke each REST operation through non-paginated `gh api --include`.
10. Pass each JSON request body through a private named file with `--input`,
    never through standard input or process arguments.
11. Parse returned status,
    headers,
    and JSON before deciding whether another `gh api` invocation is allowed.
12. Apply an adapter-owned subprocess deadline because `gh api` 2.97.0 has no request timeout by default.

This is verified against GitHub's published concurrency and mutation-pacing contract
and the GitHub CLI 2.97.0 request path.
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
A no-match reconciliation query is also not documented as a consistency guarantee.
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
[gh-api-client]: https://github.com/cli/cli/blob/v2.97.0/pkg/cmd/api/api.go#L390-L405
[gh-api-do]: https://github.com/cli/cli/blob/55dbb4dc6b7edb10b48e3d7fc5bccd32318d1b55/pkg/cmd/api/http.go#L83
[gh-api-headers]: https://github.com/cli/cli/blob/55dbb4dc6b7edb10b48e3d7fc5bccd32318d1b55/pkg/cmd/api/api.go#L474-L478
[gh-api-input]: https://github.com/cli/cli/blob/55dbb4dc6b7edb10b48e3d7fc5bccd32318d1b55/pkg/cmd/api/api.go#L369-L381
[go-gh-timeout]: https://github.com/cli/go-gh/blob/v2.13.0/pkg/api/client_options.go#L59-L61
[go-gh-transport]: https://github.com/cli/go-gh/blob/v2.13.0/pkg/api/http_client.go#L59-L69
[p-limit-clear-source]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L77-L89
[p-limit-clear-type]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.d.ts#L17-L27
[p-limit-immediate]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L59-L63
[p-limit-resume]: https://github.com/sindresorhus/p-limit/blob/v7.3.1/index.js#L18-L24
