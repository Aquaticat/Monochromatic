# Depot Developer pool cache research

## Purpose and status

This note supports the authorized expansion of CI using Depot alongside GitHub.
It separates reusable preparation from build caches,
test-result evidence,
and release artifacts.
It is research for the later interview,
not a production routing change or a subscription change.
The parent investigation owns new provider experiments and their results.
The probe designs here remain unmeasured until their actual consumer runs complete.

Sources were checked on 2026-10-18.
The repository inspection ended at `bff874861fbae3f4c043714d43b2c4c948567122`;
concurrent work can advance `main` without changing this inspection boundary.
No account-wide usage,
invoice,
subscription,
cache deletion,
or production secret operation was performed.

## The cache products have different boundaries

### Actions archive caches

[Depot's Actions integration][actions-integration] explicitly limits its transparent Actions cache replacement
to Depot GitHub Actions runners.
An unchanged `actions/cache` invocation uses Depot Cache on those runners
and GitHub Cache on GitHub-hosted runners.
Matching keys and YAML therefore do not establish shared entries across the providers.
The same redirection covers setup actions that use the Actions cache API.

Depot scopes these entries to the repository,
but explicitly does not isolate branches.
Its default retention is 14 days with no configured size limit.
Available age policies are 7,
14,
and 30 days;
available size policies range from 25 GB to 500 GB or no limit.
These are documented defaults and options,
not the inspected account's settings.
[Depot Cache][cache-overview] prices storage beyond the included amount at USD $0.20 per GB,
using hourly snapshots averaged over the month.
No unlimited-free-storage conclusion follows from an unlimited retention setting.

[GitHub's current reference][github-cache] documents a default 10-GB repository allowance,
seven-day idle eviction,
and optional paid higher limits.
Its branch access rules differ from Depot's.
It also documents `cache-mode` and token-enforced permissions;
compatibility with Depot's replacement must be exercised rather than assumed.
The existing repository cache policy's 10-GB budget remains a local decision,
not evidence that GitHub offers no paid expansion.

### Remote compiler and task caches

[Depot's sccache integration][sccache] supports use from any CI provider or workstation.
It documents `SCCACHE_WEBDAV_ENDPOINT=https://cache.depot.dev`
and a compatible API token in `SCCACHE_WEBDAV_TOKEN`.
For user tokens with several organizations,
the documented alternative uses `SCCACHE_WEBDAV_USERNAME` for the organization ID
and `SCCACHE_WEBDAV_PASSWORD` for the token.
Rust additionally needs `RUSTC_WRAPPER=sccache`.

This enables a distinct research route:
free GitHub-hosted compute with Depot's remote compiler cache.
It does not redirect `actions/cache` or reuse an Actions archive automatically.
Keep compiler-cache comparisons separate from directory-archive comparisons.
Measure actual hits,
misses,
non-cacheable compilations,
and final consumer behavior.

[Authentication documentation][cache-auth] supports user and organization tokens,
explicitly excludes project tokens,
and gives Depot runners a job-lifetime `DEPOT_CACHE_TOKEN`.
No documented direct sccache OIDC exchange was established in the inspected sources.
An existing project-build authorization is insufficient evidence of remote-cache authorization.
The experiment must not create a broad credential to conceal this limit.

[Depot's Gradle integration][gradle] also works outside Depot compute.
It requires build caching to be enabled and an `HttpBuildCache` pointing to Depot,
with compatible token credentials.
Depot runners supply an initialization script automatically.
Containerized Gradle or sccache builds still need credentials passed through their boundary;
host environment configuration does not implicitly enter a Docker build.

### Persistent cache disks

The official [`depot/cache-mount` README][cache-mount] says the action works only in standalone Depot CI.
It does not work on Depot's GitHub Actions runners or GitHub-hosted runners.
The namespace is organization-wide,
not repository-scoped.
Public fork pull requests receive an ordinary empty directory instead of a mount.
Disk data persists between jobs;
the action's post step does not delete it.

The inspected action revision is `38d61fd25163e9ef3a3eff8a61676994d306e549`.
`action.yml` requires `path` and `name`,
accepts `debug`,
and runs Node 24.
Names cannot contain whitespace.
Use a name identifying repository,
experiment,
trust level,
and format version.
The README recommends one writer with many readers,
or writes partitioned into separate directories.
Multi-write filesystem support does not prove that concurrent Cargo or Gradle mutations are safe.

In `src/index.ts:49`,
the action selects conditional mount mode:

```typescript
// depot/cache-mount, src/index.ts:50, revision 38d61fd25163e9ef3a3eff8a61676994d306e549
const mountArgs = args.filter((arg) => arg !== '--shared' && arg !== '--conditional')
const cliArgs = ['--preserve-env=ARCHIL_MOUNT_TOKEN', ARCHIL_BIN, 'mount', '--conditional', ...mountArgs]
```

`src/post.ts:21` first invokes `archil unmount`;
`src/post.ts:26` then releases the disk token through the sandbox metadata API.
An unmount failure prevents reaching that later block.
Preserve both post-step outcomes when claiming lifecycle cleanup.
The README documents automatic retention deletion,
defaulting to 14 days,
and manual deletion through Depot CI settings.
No action input for deleting disk data exists in this revision.

`src/index.ts:91` uses an installed `/usr/bin/archil` when present.
Otherwise it downloads and runs the upstream installer.
Pinning the action revision alone therefore does not identify the installed Archil executable.
Record the executable's version,
hash,
and preinstallation status in a probe.

### Prepared filesystems and container builders

[Custom images][custom-images] snapshot the Depot CI filesystem,
including installed packages,
SDKs,
workspace dependencies,
and pre-pulled container images.
They do not preserve process environment variables or running services.
The snapshot action is specific to standalone Depot CI.
An arbitrary Docker image is not interchangeable with a sandbox snapshot.

The [prepared desktop trial](../audit/depot-prepared-desktop-2026-10-16.md)
already verified separately allocated consumers of prepared files and source-bound executables.
Both consumers passed their 117 injectable interaction checks and cleanup assertions.
They still had to start the private user manager,
audio,
and compositor services.
The [snapshot investigation](../troubleshooting/depot-snapshot-mise-cache.md)
records PATH activation,
an unnecessary additional mise cache wait,
and a checkout/local-patch collision.

Keep preparation identity explicit:
base image and package versions,
toolchain identities,
installer policy,
lockfiles,
configuration,
and every included local artifact input.
Use immutable prepared versions and verify a manifest in each consumer.
If preserving dependencies in a pre-cloned workspace,
the documented `clean: false` checkout avoids deleting them;
it also preserves other untracked state.
Verify the actual source head and expected clean-state exceptions.
Publish experiment commits before consuming prepared checkouts that would otherwise receive a local add-file patch.

Depot container builders have another cache:
BuildKit image layers and mutable cache mounts.
That cache is separate from the Actions archive service,
persistent CI disks,
and snapshots.
Measure layer hits separately from compilation-cache hits and local artifact download time.

## Repository boundaries and invalidation inputs

The [CI caching policy](../decision/ci-caching.md)
already records fresh-job GitHub cache wins for selected Rust verification builds.
It also records pnpm-store cache regressions:
restoration plus installation cost more than installation alone in the tested jobs.
Those measurements do not establish that a different Depot cache backend has the same result.
They make pnpm caching a separate hypothesis rather than an automatic improvement.

- Rust:
  current workflows distinguish OS,
  architecture,
  runner image,
  compiler identity,
  target triple,
  lockfile,
  profile,
  and feature set.
  Preserve those dimensions and relevant linker or `RUSTFLAGS` inputs.
  Keep downloadable crate content separate from mutable target directories.
  The release policy excludes shipped or attested outputs from caches.
- pnpm:
  `pnpm-workspace.yaml` enables isolated workspace installation,
  prunes virtual-store orphans on installation,
  and records optional-platform coverage for Linux and macOS,
  x64 and ARM64,
  glibc and musl.
  Include lockfile,
  pnpm version,
  workspace settings,
  dependency policies,
  package manifests,
  patches,
  Node identity,
  and native-package platform in install identity.
  A content store and a fully linked `node_modules` snapshot have different portability requirements.
- Linked JavaScript dependencies:
  a restored tree needs working workspace symlinks,
  native optional modules,
  installed build hooks,
  and the expected checkout layout.
  Verify actual imports from fresh consumers at both provider workspace roots.
  Do not infer portability merely because tar extraction succeeds.
- TypeScript and generated bundles:
  root `mise.toml:456` dispatches an existing built Node entry before its source fallback.
  The Oxlint preparation helper also compares source and output modification times.
  Source-bound manifests and changed-input runtime assertions are therefore required
  before treating restored generated output as current.
- Bun:
  it is a pinned task runtime/compiler island in root `mise.toml`,
  not this repository's package manager.
  Compiler or bytecode outputs need Bun identity,
  target,
  flags,
  and source inputs.
  A Bun package-download cache is not a substitute for the pnpm installation graph.
- Gradle and Android:
  Android enables `org.gradle.caching=true`
  and disables configuration caching in its `gradle.properties`.
  The inspected settings files do not configure a Depot remote cache.
  Record wrapper,
  JDK,
  plugin,
  build-script,
  SDK,
  NDK,
  ABI,
  and native-library inputs.
  A prepared SDK can avoid repeated installation;
  it does not prove a built APK or instrumented test is current.
- Browsers:
  `playwright.Dockerfile` binds the browser image to a digest
  and says its Playwright version must match the workspace dependency.
  It separately installs Bun through an installer.
  Preserve the final prepared image identity and actual tool versions,
  not only its browser base tag.
  Browser executables,
  native libraries,
  application bundles,
  fonts,
  and runtime services remain distinct dependencies.

The installed `node_modules/.modules.yaml` was measured,
not assumed:
it contains JSON,
`pnpm@12.11.2`,
`layoutVersion: 5`,
and `nodeLinker: isolated`.
The filename does not establish YAML field syntax,
and the ambient tree does not establish the frozen environment of a new CI job.

## Cargo correctness is a required control

The [Cargo/BuildKit investigation](../troubleshooting/cargo-buildkit-source-timestamps.md)
proved that an older changed-source timestamp could reuse a newer executable for different content.
The command succeeded while the runtime CLI-name assertion failed.
Separate cache namespaces did not prevent it.

The corrected fixture is retained at `ef616a2900269c52c61d24f816520504a3d74dd2`:
`package/music-player/desktop-app/depot-trial/Containerfile`
and `bake.hcl`.
It hashes copied source content,
cleans the local `music-player` and `truepeak-core` release packages on a mismatch,
and records the new hash only after successful compilation.
Registry dependency artifacts survive.
The tested compile command is `cargo build --release --locked --features alsa-fallback --jobs <N>`
inside the production Alpine toolchain;
the executable is checked inside the production runtime.
The archived task is `mise run //package/music-player/desktop-app:trial:github:sizing`.

Its [corrected matrix](../audit/depot-runner-sizing-2026-10-15.md)
passed all 100 runtime assertions,
including repeated changed-source snapshots.
These were repetitions on allocated runners,
not the missing distribution across independently allocated warm jobs.
Do not drop the content check to improve apparent cache performance.

## Proposed fresh-job experiment

### Archive comparison

Use independent GitHub-hosted and Depot-hosted Linux allocations
with the same frozen source,
toolchain,
container digest where used,
commands,
Cargo job count,
cache path inputs,
and consumer assertions.
Record actual CPU,
memory,
OS image,
workspace path,
runtime versions,
runner identity,
and allocation timestamps.
A provider label alone does not establish equal hardware.

Use a unique experiment prefix and fixture-owned directories;
do not reset or delete shared caches to obtain a cold observation.
For each provider,
create independent seed namespaces,
then restore each seed in a newly allocated job.
At least three independent allocations per unchanged condition give an observed spread;
retain individual samples rather than claim population reliability.
Capture a cold miss,
successful seed upload,
and actual fresh-job warm restoration.
An exact-hit output or a lookup-only hit is insufficient without restored files and exercised consumers.

Run changed-input controls:
an observable local source change,
a valid package-manager-generated dependency/lock change,
and a distinct compiler or linker identity.
Keep a separate expected hash for each fixture.
Exercise source state A,
state B,
and A again so an older cached source snapshot cannot silently reuse B's executable.
Keep a known wrong-output control to prove that the runtime assertion can detect stale reuse.
Do not manually edit a lockfile just to obtain a different key.

Dependency archive keys should identify compatible toolchain/platform inputs,
with the lock hash at the end for a controlled prefix fallback.
Local generated-output reuse additionally needs source identity and invalidation.
Log primary key,
matched key,
miss versus prefix versus exact hit,
cache service,
archive size,
restore/save intervals,
build intervals,
consumer intervals,
and all exit statuses.

### Saves when frozen tests fail

The pinned repository action is `actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae`.
Its `action.yml:46` uses `post-if: success()`;
its deprecated `save-always` input says that it does not work as intended.
Use explicit restore and save actions in the experiment.
`src/saveImpl.ts:65` calls the cache toolkit,
and its error handler can report a warning without failing the job.
A green save step therefore does not prove an entry exists.
Require the later fresh-job restore as the consumer verification.

Save only after successful dependency preparation or compilation,
with an explicit non-cancelled condition that still runs after unrelated known test failures.
For example,
the current Windows workflow already separates test compilation,
binary compilation,
cache pruning/saving,
and test execution in `.github/workflows/music-player-windows.yml:260`.
Preserve test failures and original consumer statuses;
do not turn the complete workflow green through `continue-on-error`.
Keep failed seed uploads and no-restoration consumers in the result ledger.

### Persistent disk and preparation probes

For a bounded disk probe,
mount an isolated disk in a seed job,
verify it is a real mount,
write a small content-addressed fixture and manifest atomically,
then read and hash it in independently allocated consumers.
Use separate per-job write directories for the fan-out control.
Require each consumer's private marker to be absent before writing it.
Record mount identity,
retained data identity,
read/write outcomes,
Archil identity,
and both cleanup operations.
A directory existing after the public-fork skip is not a successful mount.

For prepared images,
separate preparation time from consumer startup,
activation,
validation,
and live service readiness.
Verify unchanged consumers skip installation or compilation only when their manifests allow it.
A changed lock,
toolchain,
base package,
or local artifact input must select or build the corresponding prepared version.
Keep preparation jobs as explicit predecessors of artifact consumers,
with failure propagation and complete test reporting.

### Trust and cost interpretation

Cached executable content can affect later builds and tests.
Exclude credentials,
ephemeral runtime sockets,
and private service state.
Use trusted producers and prove the backend's writer permissions.
Branch names in cache keys prevent accidental collisions;
they do not prevent a malicious writer from choosing the trusted key.
Depot's absent branch isolation must be addressed at the actual authorization boundary
before privileged consumers share caches with untrusted code.

Caches are disposable acceleration inputs.
Artifacts are explicit outputs tied to source,
commands,
producer,
and digest.
Prepared images are versioned environments.
Persistent disks are mutable shared filesystems.
None of these alone is proof that a test executed or that a release artifact is trustworthy.

Report setup,
restore,
compile,
test,
save,
artifact upload/download,
and complete allocation intervals separately.
Charge failed and repeated allocations too.
Preserve all samples and compare provider differences against unchanged-input spread.
For overlapping jobs,
value the user's unfinished waiting interval once;
sum compute usage independently.
Include preparation amortization,
logical cache/archive sizes,
and storage retention in the model.
In-job directory sizes do not measure account-wide billable occupancy.
No invoice or complete monthly cost is inferred here.

## Sources and limits

Official docs and open source establish supported interfaces and documented boundaries.
Historical linked reports establish only their measured workloads.
The new archive,
disk,
snapshot,
and remote compiler-cache designs require real invocations before adoption.
No overall cached speedup,
cross-provider shared archive,
safe untrusted-writer boundary,
or complete storage total was established by this note.

[actions-integration]: https://depot.dev/docs/cache/integrations/github-actions
[cache-overview]: https://depot.dev/docs/cache/overview
[cache-auth]: https://depot.dev/docs/cache/authentication
[sccache]: https://depot.dev/docs/cache/integrations/sccache
[gradle]: https://depot.dev/docs/cache/integrations/gradle
[custom-images]: https://depot.dev/docs/ci/how-to-guides/custom-images
[cache-mount]: https://github.com/depot/cache-mount
[github-cache]: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
