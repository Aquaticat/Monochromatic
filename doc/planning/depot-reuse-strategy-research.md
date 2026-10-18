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
15 minutes per job and at most 12 jobs.
At USD 0.00005 per vCPU-second,
that scheduling ceiling corresponds to a USD 4.32 compute timestamp-price proxy.
It is a guardrail,
not a measured bill or storage-inclusive total.

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
Writes are confined to disposable sandboxes,
unique image/cache prefixes and retained research artifacts.
No production key,
disk or shared target directory is modified.
Stop on the declared resource ceiling,
unexpected credential use or an uninspected execution path.
Preserve failed outcomes and include their compute exposure.

## Campaign work queue

The first preparation run is `xkmm08vpjs`,
dispatched from pushed harness `e65f3ccf26781999717cfd9c17e1bd361f42183a`.
It requests one `depot-ubuntu-24.04-8` sandbox and a 15-minute timeout.
Its proposed image destination is `l4zncjjbj5.registry.depot.dev/research-reuse-20261018:tools-r1`.
That reference is not a verified reusable image until capture and fresh-consumer checks finish.
The helper's official release resolver supplies a pinned Depot S3 archive;
authenticated lookup of public `depot/snapshot` source returned HTTP `404`.
The helper's internal source/build provenance is therefore unverified,
even though the snapshot action's download and invocation code is inspected.

Parent work separately owns Android APK/instrumented builds,
headful device consumption,
default-image graphics/KVM and prepared-image portability to GitHub Actions.
This campaign does not launch or delegate emulator work.

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
