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
calls cache restoration before setup when the `cache` input is true in `src/index.ts:67`:

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

## Depot CLI 2.102.22 local patches collide with files retained by snapshot checkout

### Symptom

Run `341kqr5sw7` created the desktop-package snapshot successfully,
then failed its first consumer during `Apply local patch from Depot Cache`:

```text
# git apply diagnostic in the first snapshot consumer
error: .depot/workflows/depot-package-snapshot.yml: already exists in working directory
```

The same diagnostic named other files introduced on the unpublished trial branch.
No package verification task had run yet.
This incident is separate from the mise-cache delay.
[Failed consumer](https://depot.dev/orgs/l4zncjjbj5/workflows/341kqr5sw7)

### Source trace and scope

Depot CLI `v2.102.22`,
`pkg/cmd/ci/run.go:601`,
sets an injected checkout's `ref` to the local patch's merge base.
```go
// depot/cli, pkg/cmd/ci/run.go:601, v2.102.22
withMap["ref"] = mergeBase
```

The generated shell step at line 612 applies the patch:

```sh
# depot/cli, pkg/cmd/ci/run.go:612, inside the generated shell string
git apply --allow-empty /tmp/local.patch
```

Lines 622 to 624 insert that step immediately after checkout:

```go
// depot/cli, pkg/cmd/ci/run.go:622, v2.102.22
newSteps = append(newSteps, steps[:checkoutIndex+1]...)
newSteps = append(newSteps, patchStep)
newSteps = append(newSteps, steps[checkoutIndex+1:]...)
```

[Tagged CLI source](https://github.com/depot/cli/blob/v2.102.22/pkg/cmd/ci/run.go#L549)

The snapshot was captured after the preparation job applied that local patch.
Its newly added files remained on disk.
The consumer intentionally used `clean: false` to retain installed workspace dependencies,
then checked out the merge base and attempted the same add-file patch.
Git rejected the paths already present.
This identifies the checkout/patch interaction;
it does not establish damaged snapshot contents or failed package installation.
[Snapshot checkout guidance](https://depot.dev/docs/ci/how-to-guides/custom-images#best-practices)

### Verification and workaround

The reproduction lives on `trial/depot-package-snapshot-20261016`,
commit `0577b002b2`,
in `.depot/workflows/depot-package-snapshot.yml`.
Its tasks are in `package/music-player/desktop-app/mise.toml`.
Before that branch was pushed,
the following invocation uploaded a local patch relative to `origin/main`:

```sh
# Isolated trial worktree with the committed branch still unpublished
depot ci run --workflow .depot/workflows/depot-package-snapshot.yml
```

The failure catalog is a snapshot captured from locally patched checkout files,
followed by a `clean: false` consumer with an injected add-file patch.
The working catalog uses the same snapshot and files with a pushed commit,
so the CLI has no local patch to inject.
The tested boundary change was:

```sh
# Same isolated trial worktree, publishing only the experiment branch
git push --set-upstream origin trial/depot-package-snapshot-20261016
depot ci run --workflow .depot/workflows/depot-package-snapshot.yml
```

Repeat run `6w30pv5zds` checked out `0577b002b2` without a local-patch step.
Both consumers verified all 23 installed package versions and executed ImageMagick without reinstalling them.
Their workspace dependency checks reported `Already up to date`.
Attempts `x8b3b4xhkb` and `kpwm36f319` had distinct sandbox IDs;
both also required a prior-consumer marker to be absent before writing their own.
The completed run therefore verifies fresh consumers of the same prepared filesystem.
[Patch-free repeat](https://depot.dev/orgs/l4zncjjbj5/workflows/6w30pv5zds)

The tradeoff is publishing the experiment commit to the repository before this form of snapshot consumption.
`clean: false` also preserves other untracked files,
so dependency reuse must include explicit lockfile and tool-version checks.
The image tag still needs refresh when its preparation inputs change.

### What does not establish a workaround

Reusing the same image with the same locally injected add-file patch already failed.
Enabling checkout cleaning was not tested here;
it would remove the untracked workspace dependencies whose reuse this trial measures.
Skipping an arbitrary failed patch is not verified and could leave the wrong source revision.

The separate fresh-session probe reported `Failed to connect to bus: No medium found`
from `systemctl --user` and `systemd-run --user`.
`pactl info` reported `Connection failure: Connection refused`.
Those commands ran after package verification passed;
installed files do not establish a running user manager or audio service.
This probe did not attempt to create a replacement session manager.

### Upstream filing decision for the patch interaction

No `.out-of-scope/` entry names Depot.
Issue and pull-request searches for `"snapshot" "patch"` in `depot/cli` returned no matches.
That search is bounded evidence,
not a claim that no related report exists.

1.  An upstream defect is not established:
    the trial deliberately retained untracked files and then reapplied an add-file patch.
2.  CLI handling can be changed in principle,
    but the correct ownership and cleanup contract has not been established.
3.  Local patches and preserving snapshot dependencies are separately documented;
    this exact repeated-patch combination has not been shown to have a supported contract.
4.  Contribution policy was not evaluated because no upstream filing or patch is proposed.
5.  The searches found no maintainer decision on this combination.
6.  The repository-side pushed-commit workaround was exercised;
    no upstream fix was prototyped or claimed.

There is no upstream filing artifact to add at this stage.
No external report was sent.
