# Depot reuse strategy research

## Active research boundary

The earlier pnpm archive and library compiler-cache probes do not establish a CI reuse strategy.
This campaign exercises cross-language preparation,
installed-tool reuse,
real build/test consumers and input invalidation.
Research is reopened;
no interview or production adoption is pending.

The frozen repository source is `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Executable harnesses live only on the isolated `research/depot-reuse-20261018` branch.
Main receives documentation and evidence.
No production routing,
subscription,
organization settings,
account-wide usage or invoices are changed or inspected.
Existing automatic job identity supplies Cache authorization;
no broad credential is created or copied into a new secret.

## Repository inventory

A tracked-file inventory at the frozen source contains 13,860 files.
Active `package/` files include 1,894 Rust sources,
294 Kotlin sources,
five Kotlin build scripts,
one C++ source,
4,409 TypeScript sources and 345 `.mjs` files.
There are 23 standalone Rust manifests,
two Gradle settings roots and 181 projects reported by the earlier frozen pnpm install.
No tracked Go source/module,
Python project manifest or CMake project file was found.
This does not exclude native code downloaded by Cargo,
the Android NDK,
Qt/C++ bindings or Zig-backed dependencies.
The inventory retains the complete filename and cache-reference searches,
rather than treating absent language manifests as absent transitive tool use.

The existing preparation owner is root `mise.toml`.
Its `prepare` task runs `prepare:pnpm` first,
then the remaining preparation children concurrently.
`prepare:pnpm` installs packages,
approves Sharp and runs file-enforcer.
`prepare:playwright` builds the existing Podman image.
`prepare:android` provisions platform/build tools,
NDK and Rust targets after checking their installed paths.
This campaign invokes the applicable narrow owners rather than running the umbrella preparation task.
Android emulator and graphics work belong to the parent campaign.

The pnpm layout is explicitly `nodeLinker: isolated` with `packageImportMethod: clone-or-copy`.
Its configured Linux/macOS,
x64/ARM64 and glibc/musl optional artifacts make the installed virtual store broader than one runner's native needs.
Content-store archives,
installed dependency snapshots and workspace symlinks therefore need separate correctness and timing checks.

## Planned command tree and execution manifest

The first campaign permits at most two simultaneous owned jobs,
8 vCPUs and 32 GB per job,
15 minutes per job and initially at most 12 jobs.
At USD 0.00005 per vCPU-second,
that scheduling ceiling corresponds to a USD 4.32 compute timestamp-price proxy.
It is a guardrail,
not a measured bill or storage-inclusive total.
The expanded bound and completed-job arithmetic are recorded in `Expanded campaign bound`.

The preparation job installs only the frozen Mise subset:
Node,
pnpm,
Temurin 21,
Rust,
Cargo Binstall and Nextest.
The lock resolves Rust to `nightly-2026-10-17`,
Temurin to `21.0.12+8.0.LTS` and Nextest to `0.9.148`.
Rust's declared Clippy,
source,
LLVM tools and Android targets are included in the measured cold preparation cost.
Installed files use a unique `/opt` research prefix so their snapshot lifecycle is explicit.
The committed Gradle wrapper resolves `9.8.1`;
the official distribution and wrapper-JAR SHA-256 values are checked before execution.

The snapshot action is inspected at revision `a082cbabd407afdf324a7b4f41889795636f4b24`.
Its release resolver currently selects snapshot tool `1.2.30`.
The action executes the tool through `sudo`,
authenticates with an automatic snapshot/job token and pushes only a unique research image.
Capture,
upload,
fresh-image startup and installed-tool availability are separate evidence boundaries.
The source checkout is removed before capture.
Only synthetic source/secret markers are used to check exclusions;
explicit environment masks supplement the platform defaults.
Filesystem marker controls do not prove that every possible secret location is excluded.

Kotlin consumers build the existing linter JAR and execute its JUnit tests.
Remote HTTP build caching uses the existing automatic job Cache token,
with local task-output caching disabled and a unique declared namespace in task inputs.
Gradle's task-specific `test --rerun` allows actual test execution alongside reused compilation.
Download/module caches,
configuration state,
compiler outputs and test execution are measured separately.

Rust consumers build the native Git-policy CLI and run existing Nextest library,
binary and public candidate-consumer tests.
The CLI links the repository's scanner,
regex engine and JSONC library.
Registry archives,
target artifacts,
incremental state,
sccache compilation and final linking remain distinct stores and boundaries.
No application source repair may turn a failing frozen baseline into an alleged passing cache result.

External reads cover the frozen source,
official tool releases,
Gradle distributions,
Maven/Gradle plugin repositories,
crates.io and Depot's CI/Cache/Registry endpoints.
Writes use disposable sandboxes,
unique image/disk/compiler-cache prefixes and retained research artifacts.
Gradle task outputs include an experiment-specific input salt.
Gradle's artifact-transform cache keys do not inherit that task salt;
the seed job can populate content-derived transform entries in the organization HTTP backend.
This is a separate trust and namespace boundary,
not a claim that every HTTP key carries the experiment name.
Stop on the declared resource ceiling,
unexpected credential use or an uninspected execution path.
Preserve failed outcomes and include their compute exposure.

## Captured preparation and active consumers

The first preparation run is `xkmm08vpjs`,
dispatched from pushed harness `e65f3ccf26781999717cfd9c17e1bd361f42183a`.
It requests one `depot-ubuntu-24.04-8` sandbox and a 15-minute timeout.
The preparation finished at `2026-10-18T06:32:24Z`.
Its image destination is `l4zncjjbj5.registry.depot.dev/research-reuse-20261018:tools-r1`,
with pushed manifest digest `sha256:9fb974fd32185c8afd5711370869d03e0f28e5b560c928eae324c20151ddeee8`.
Fresh native-CI tag consumers booted the image and matched all prepared tool and frozen-input hashes.
The [preparation evidence](../audit/depot-reuse-strategy-2026-10-18.evidence.json)
binds the frozen source inputs,
tool hashes and all 11 retained artifact members to the provider's uploaded ZIP digest.

Measured command durations are 15.137 seconds for the locked core tools,
1.575 seconds for Nextest,
2.361 seconds for pnpm's 582 downloaded packages,
1.238 seconds to create the installed-dependency archive,
16.880 seconds for Gradle dependency-graph resolution and 0.725 seconds for Cargo fetch.
Gradle's dependency report does not prove all later compile/test JARs were downloaded.
The snapshot helper measured 19.104 seconds for capture plus upload,
with 5,703,139,328 uploaded block bytes.
These boundaries exclude fresh-image startup,
checkout and action startup;
uploaded bytes are not a verified storage charge.
The pnpm store contains 908,109,264 bytes and the installed archive contains 296,779,994 bytes.

The helper selected by release version `1.2.30` reports `snapshot 0.1.0 (119be55)` at runtime.
Both identities are retained rather than silently treating them as matching versions.
The `max-age: 6h` input is not evidence of automatic registry deletion.

Consumer run `6wt5gm6t75`,
from harness `168107a38eadffe157c74be4267c10341c675550`,
failed before sandbox startup when `runs-on.image` used the full registry `@sha256:` reference.
The provider's diagnosis states:
`Dispatch failed: [not_found] image "9fb974fd32185c8afd5711370869d03e0f28e5b560c928eae324c20151ddeee8" not found`.
The documented unique tag form boots successfully.
The deciding server-side image resolver is not public;
this failure does not establish a universal digest-reference prohibition.
This dispatch failure does not measure Gradle,
tool installation or cache restoration.
The helper's official release resolver supplies a pinned Depot S3 archive;
authenticated lookup of public `depot/snapshot` source returned HTTP `404`.
The helper's internal source/build provenance is therefore unverified,
even though the snapshot action's download and invocation code is inspected.

The tag consumer `wh76h0pjpx` exposed a harness error:
the offline network-namespace control dropped to the runner user but retained `sudo`'s home directory.
Mise `2026.10.9` reported permission errors creating `~/.local/state/mise/trusted-configs`.
The corrected control supplies the runner's `HOME`,
`USER` and `LOGNAME` explicitly.
Subsequent consumers pass offline installed-tool availability,
prove that an empty isolated tool home fails offline,
and recover that missing Node installation through the locked online owner.
The failed control is retained separately from application or cache failures.

Gradle seed `x1psl3qf94` from harness `997db20b3bd5f1cdf3413c645d964c34dac63518` passed.
It restored dependencies from the prepared pnpm content store,
passed the existing semantic plugin build/host/external consumers,
built the Kotlin linter JAR and executed six JUnit tests with no failures or skips.
The recording HTTP proxy observed cache misses and successful uploads through automatic job identity.
Repeated fresh warm allocations are the next measurement;
one seed does not establish a speed benefit.

Rust seed `ldj6qhgjd5` from the same harness restored the installed-dependency archive,
passed the same JavaScript consumers,
built the real native CLI and compiled Nextest test executables.
The actual test run planned 1,951 tests across three binaries with five skipped.
Default fail-fast executed 234:
230 passed and four failed,
leaving 1,717 unrun.
Those failures compare options against provider Git `2.55`,
while the repository-owned native verification baseline requires Git `2.56.0`.
The required Git revision is `a018953688f1b10bddf91bff8747068f5f4746a4`,
already selected by `package/git-policy/cli/bin/build-git-test-image.mjs`.
The next tool image will provision that prerequisite under a new tag,
retain `tools-r1` unchanged and rerun actual tests.
The target archive is published only after tests pass,
so this failed seed did not publish a supposedly reusable passing target.

The registry manifest for `tools-r1` was fetched using the automatic job snapshot identity.
Its configuration media type is `application/vnd.depot.thin.snapshot.config.v2+json`;
its layers use `application/vnd.depot.thin.snapshot.sparse.v1` and `application/vnd.depot.ext4.image.v1`.
This is a native block snapshot,
not verified conventional Docker-compatible filesystem layers.
Fresh jobs contain neither the synthetic source marker nor the synthetic secret file.
Both masked and unmasked synthetic runtime environment controls are absent;
that observation alone cannot attribute their absence to masking.

## Expanded campaign bound

The expanded authorization permits at most 16 total owned jobs,
with the same two-job concurrency,
eight-vCPU,
32-GB and 15-minute per-job limits.
Before the expanded launches,
the five completed request-to-terminal windows are 94,
13,
54,
171 and 208 seconds,
totaling 540 seconds.
Charging every second of those windows at all eight requested vCPUs and USD 0.00005 per vCPU-second
gives a USD 0.216 timestamp-price proxy.
The remaining eleven full 15-minute job ceilings add USD 3.96,
for a combined USD 4.176 scheduling bound under the USD 5 compute guardrail.
The failed digest dispatch is conservatively included despite allocating no sandbox.
These request windows can include unbilled orchestration;
the calculation is not account billing evidence.
Snapshot storage,
artifact storage,
cache retention,
registry requests and network charges remain separately unmeasured.

The next two jobs use identical harness `9f59235436` and `reuse-gradle-warm.yml` on separate allocations.
Each verifies the same `tools-r1` inputs,
restores compilation from the same read-only remote task namespace and executes the existing JUnit consumers.
The image's preserved Mise executable supplies the documented installation-free bootstrap.
That bootstrap differs from the seed's Mise action,
so whole-job timing will not be attributed solely to remote compilation reuse.

Parent work separately owns Android APK/instrumented builds,
headful device consumption,
default-image graphics/KVM and prepared-image portability to GitHub Actions.
This campaign does not launch or delegate emulator work.

## Campaign work queue

- Verify snapshot capture/upload and fresh installed-tool reuse,
  including source/secret marker controls and missing-tool behavior.
- Compare pnpm content-store reuse with installed dependency/virtual-store restoration,
  workspace linking and actual existing JavaScript consumers.
- Exercise Kotlin remote caching with real tests,
  repeated unchanged fresh allocations and changed source/dependency/tool inputs.
- Exercise the native Rust CLI's compile,
  link and Nextest consumers with repeated unchanged allocations and changed inputs.
- Probe stale,
  missing,
  partial and corrupted state only within isolated research fixtures.
- Reconcile Android/JDK/SDK/NDK preparation with the parent graphics feasibility evidence;
  inspect existing BuildKit/container preparation owners and applicable cache-mount behavior.
- Retain timings,
  allocation spread,
  artifact/source hashes,
  stored bytes and exact resource/cost exclusions before proposing a reuse strategy.

## Primary sources

- [Depot custom images](https://depot.dev/docs/ci/how-to-guides/custom-images)
- [Snapshot action source](https://github.com/depot/snapshot-action)
- [Depot Gradle integration](https://depot.dev/docs/cache/integrations/gradle)
- [Gradle 9.8.1 cache model](https://docs.gradle.org/9.8.1/userguide/build_cache.html)
- [Gradle task-specific reruns](https://docs.gradle.org/9.8.1/userguide/command_line_interface.html#sec:rerun_tasks)
- [Nextest 0.9.148 release](https://github.com/nextest-rs/nextest/releases/tag/cargo-nextest-0.9.148)
