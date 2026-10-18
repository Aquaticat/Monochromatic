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
The producer is blocked if repository usage exceeds `9,300,000,000` bytes.
A temporary compression check limits the single GitHub experiment archive to `500,000,000` bytes
before it can be saved.
The check's temporary file is removed;
the Actions cache stores the original pnpm-store directory.
The unique prefix is `research-20261018-pnpm-cache-v1`.

No existing cache entry may be deleted for this experiment.
After evidence capture,
remove only this experiment's GitHub cache entry by its recorded key and identifier.
Depot's experimental dependency archive remains subject to its documented retention policy.
Do not claim a cache deletion API without verifying it.

## Evidence status

The harness is committed on its isolated branch.
Cold,
seed,
warm and branch results have not yet been established.
Each dispatch records the exact SHA,
run URL,
terminal job metadata and logs in private scratch before its findings are summarized here.
