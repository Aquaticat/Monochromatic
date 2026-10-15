# A Depot CI snapshot consumer waits on an additional mise cache restore

## Symptom

In trial run `qrjbnf2gbv` on 2026-10-15,
the prepared-image consumer logged `Restoring mise cache` at `22:04:47.258Z`
and `mise cache not found` at `22:08:59.691Z`.
The elapsed interval was 252.433 seconds.
Logger build,
type checks,
and unit tests subsequently passed.

The image already contained the installed Node tools and workspace dependencies.
The additional Actions cache was unnecessary for the intended image-reuse experiment.

## Root cause boundary

The [mise action source](https://github.com/jdx/mise-action),
revision `c2a87611a18de5b3828c5652fe268e992400cb5c`,
calls cache restoration before setup when the `cache` input is true in `src/index.ts:72`:

```typescript
// src/index.ts, run()
if (core.getBooleanInput('cache')) {
  cacheKey = await restoreMiseCache()
} else {
  core.setOutput('cache-hit', false)
}
```

`restoreMiseCache()` starts the log group in `src/index.ts:374`,
awaits `cache.restoreCache([cachePath], primaryKey)` at line 385,
and emits the miss message at line 389.
The observed wait falls within that operation.
The underlying service delay and retry behavior were not traced;
do not attribute it to snapshot boot time or conclude that every cache miss has this cost.

## Verification and workaround

`action.yml:51` defines `cache` with default `true` and documents disabling cache reads and writes.
Run `jp9w8gw62r` reused the existing snapshot tag and passed the same logger checks with:

```yaml
# .depot/workflows/depot-trial.yml, typescript-snapshot-use
- uses: jdx/mise-action@c2a87611a18de5b3828c5652fe268e992400cb5c
  with:
    minimum_release_age: 1d
    install: false
    cache: false
```

Its log contains no `Restoring mise cache` group.
The combined validation run completed in 118 seconds,
including independent Android and prerequisite-probe jobs.
That combined interval is not a controlled estimate of the cache flag's performance effect.

The tradeoff is that this action no longer restores or saves the tool directory through Actions cache.
The tested consumer obtains its tools from the prepared Depot image instead.
Changing a source checkout does not refresh tools baked into an existing image tag;
image invalidation must remain explicit.

## What does not establish a fix

A successful eventual cache miss does not explain the delay.
No retry-policy change,
cache service fix,
or production workflow modification was made.

## Upstream filing decision

No matching exemption appeared in `.out-of-scope/`.
`gh search issues 'cache slow' --repo jdx/mise-action` returned no results;
this is not an exhaustive duplicate search.

1.  An action or Depot defect is unproven;
    the unnecessary extra cache was a trial configuration choice.
2.  Service-side fixability is unknown without a service trace.
3.  Disabling the action cache is explicitly supported.
4.  Contribution policy was not assessed because no upstream patch is proposed.
5.  Maintainer intent on this delay is unknown.
6.  The consumer configuration change was exercised successfully;
    no upstream implementation patch is justified by the available evidence.

There is no actionable upstream filing to add.
No external report was sent.
