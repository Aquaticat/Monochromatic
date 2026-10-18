# Fresh-job pnpm-store cache research

## Question and workload

Determine whether pnpm-store archive restoration helps the current workspace install
on GitHub-hosted Ubuntu and Depot GitHub Actions Ubuntu runners.
This is separate from the historical semantic-bridge measurement
in [the cache policy](../decision/ci-caching.md#pnpm-store-not-cached).
It is also separate from Cargo artifact caches,
container layers,
prepared snapshots and persistent disks.

The experiment uses the existing semantic-bridge workflow's installation and artifact consumers:
`pnpm install --frozen-lockfile`,
then the semantic plugin build,
host lifecycle test and external-consumer test.
The installer receives an explicitly isolated `--store-dir`;
every measurement begins in a fresh allocation with an empty project store.
Node `26.12.0` and pnpm `12.14.0` match the frozen source's `mise.lock`.

## Experimental boundary

The isolated branch is `research/depot-pnpm-cache-20261018`.
It replaces the dispatchable `music-player-windows.yml` only on that branch.
The workflow has no push or pull-request trigger.
It does not change production routing or publication.

The pools are `ubuntu-24.04` and `depot-ubuntu-24.04-4`.
Record actual CPU,
memory and image versions rather than assuming identical hardware.
Both use the same pinned `actions/cache/restore` and `actions/cache/save` code.
The former uses GitHub's cache service;
the latter uses Depot's transparent Actions cache integration.

Run repeated cold jobs with deliberately absent keys,
a cold producer,
then repeated independent warm consumers.
Check the producer manifest,
dependency hashes and runner identity after restoration.
Preserve application-consumer failures as failures,
even when dependency preparation succeeds.
An additional branch probe tests the documented difference in cache branch isolation
without writing to another branch's source or existing cache keys.

Report restore,
install,
save,
artifact-consumer and complete-job intervals separately.
Report run-to-run spread before a speedup claim.
Tool setup,
cache-size guarding and artifact export remain visible in complete-job timing.

## Cache storage and cleanup

Repository-scoped `gh api repos/Aquaticats/Monochromatic/actions/cache/usage`
reported `9,113,717,494` active bytes across `14` caches before this experiment.
Usage had reached `10,843,494,612` bytes by the first dispatch,
because concurrent production caches were added.
The repository storage-limit endpoint returned HTTP `402` with
`Please ensure your account has a valid payment method on file to access this service.`
No payment method or account setting is changed to inspect that endpoint.
The actual repository limit remains unverified.

Remove only the completed native experiment's cache `9109200675`,
whose `942,152,318` bytes belong to
`refs/heads/trial/depot-native-long-path-20261018T035939491Z`.
The retained [native cleanup receipt](../audit/depot-native-worktree-cleanup-2026-10-18.evidence.json)
establishes that branch's experiment ownership.
Record the exact entry before deletion and confirm that identifier is absent afterward.
This is temporary experiment data,
not a production cache.
After that cleanup,
the new producer is blocked if repository usage exceeds `10,000,000,000` bytes.
A temporary compression check limits the single GitHub experiment archive to `500,000,000` bytes
before it can be saved.
The check's temporary file is removed;
the Actions cache stores the original pnpm-store directory.
The corrected harness's unique prefix is `research-20261018-pnpm-cache-v2`.

No production or unrelated cache entry may be deleted for this experiment.
After evidence capture,
remove only this experiment's GitHub cache entry by its recorded key and identifier.
Depot's experimental dependency archive remains subject to its documented retention policy.
Do not claim a cache deletion API without verifying it.

## Evidence status

The harness is committed on its isolated branch.
The initial run `39099461826` failed at tool installation,
before dependency setup or cache measurement.
Mise `2026.10.9` reported `No lockfile URL found` for explicitly versioned requests,
although the frozen lock contains their URLs under the configured `latest` specifiers.
The corrected harness requests `mise install node pnpm` under `MISE_LOCKED=1`
and asserts the resulting exact versions before measuring anything.
The [request-binding investigation](../troubleshooting/mise-lock-pins-repo-tool-version.md)
records the deciding source and verified repair.

Corrected cold run `39099920300` passed every job on immutable harness
`f8727149508e091e77799c2b25313f3bb9b40589`.
Each pool used separate allocations for the repeated samples.
Workspace installation,
the plugin build and both existing artifact-consumer tasks passed.
This control uses an explicit cache miss,
not a cache-disabled workflow.
No warm-cache benefit is established until the remaining phases finish.

The owned historical cache deletion completed and its identifier disappeared from the cache listing.
Repository usage after cleanup was `9,947,540,746` bytes across `16` entries.
These are separately observed usage snapshots,
not evidence that all other cache state stayed fixed between requests.
The command deleted only identifier `9109200675`;
it did not select production entries by age or key prefix.

Seed,
warm and branch results remain in progress.
Each dispatch records the exact SHA,
run URL,
terminal job metadata and logs in private scratch before its findings are summarized here.
