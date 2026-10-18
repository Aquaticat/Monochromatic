# Complete repository coverage and executable CI research

## Correction and objective

The earlier routing research demonstrated routing fixtures,
not adequate research of the repository's intended CI coverage.
The readiness claim and user questions were withdrawn.
This campaign maps actual package and product consumers,
traces executable commands and influences,
and runs the applicable current-source Linux graph in bounded cloud shards.

The immutable application source is `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Experimental workflow code lives on `research/depot-complete-coverage-20261018`.
The main checkout receives documentation and evidence only.
Application failures are retained without source fixes.

## Work areas and completion evidence

- Package and product coverage:
  map every canonical first-party root,
  exports,
  feature family,
  test family,
  artifact consumer,
  explicit exclusion,
  and missing assertion in an immutable manifest.
- Executable graph:
  retain full owning task commands,
  dependencies,
  tools,
  services,
  host and platform prerequisites,
  current workflow triggers,
  and config/import/generated-file influences.
- Linux static and source validation:
  execute applicable package quality and default-test tasks in bounded shards,
  preserving test discovery and source versus setup failures.
- Build and artifact consumers:
  execute applicable builds and separate install/import/launch consumers from the same frozen source.
- Non-default coverage:
  investigate and execute named bounded expensive,
  fuzz,
  property,
  conformance,
  and mutation profiles;
  record actual exclusions and unexecuted surfaces.
- Cross-platform and host integration:
  inventory browser engines,
  OS/architecture/ABI/features,
  native add-ons,
  GUI,
  VM,
  device,
  plugin,
  hook,
  and publication consumers.
  Coordinate host-app,
  display,
  and device execution with the parent campaign.
  This lane does not launch or brief Android emulator use.
- Evidence and verification:
  record immutable source and harness identities,
  command trees,
  actual runner resources,
  run IDs,
  timings,
  terminal outcomes,
  logs,
  and source-bound artifacts;
  lint and render the completed note.

## Initial execution bounds

At most 2 owned cloud jobs run simultaneously.
The aggregate initial resource ceiling is 16 vCPUs and 64 GB RAM,
with at most 15 minutes per job and USD 5 nominal compute exposure for the first campaign.
The first candidate allocation is 2 Depot Linux workers of 8 vCPUs and 32 GB RAM each.
At the [documented USD 0.024 per minute](https://depot.dev/docs/github-actions/runner-types),
that wave has a nominal 15-minute compute ceiling of USD 0.72,
excluding any unmeasured billing minimum or subscription allocation.
No external paid provider,
subscription,
production routing,
repository setting,
or account billing access is authorized by this lane.

## First command-reviewed cloud wave

The source-filtered manifest capture on 2026-10-18 reports 2,425 repository Mise tasks
and 13,860 tracked files.
The raw worktree listing also inherited 19 unrelated tasks from its scratch-directory ancestor.
That ancestor declares only tasks:
no tools,
environment,
settings,
or variables,
and no direct root-task name collisions.
The next cloud wave compares the hash of all source-filtered task names before execution.
These are inventory measurements,
not completed checks or proof of coverage.

The first wave is
[GitHub Actions run 39104186007](https://github.com/Aquaticats/Monochromatic/actions/runs/39104186007).
Its workflow identity is `7a3b8dd2ca31110565ab1f05b913b4943d9f9dd3`;
the application checkout remains the frozen source.
The registered `music-player-windows.yml` filename is reused only on the research branch
for a manual-dispatch Linux experiment.
It changes no production workflow.

Both workers use `depot-ubuntu-24.04-8`.
Setup installs only locked Node and pnpm,
then follows the existing workflows' `pnpm install --frozen-lockfile` command.
It does not run the root `prepare` umbrella or bare `mise upgrade`.
The Mise parser is fixed at `2026.10.0` to match the local inventory capture.
Each command has a 90,000 ms ceiling;
the command campaign has a 540,000 ms ceiling,
shortened when setup consumes the upload margin.
Each job has a 15-minute hard cap.

Each worker builds the shared Oxlint configuration,
then executes the selected packages' owning `build`,
`lint:types`,
`lint:oxlint`,
and `test:unit` tasks.
It also creates a disposable research task for importing copied distribution files
from a directory outside the workspace.
The artifact task asserts negative indexing and empty-array rejection for `array-at`,
callback arity for `function-arity`,
and caught Error/primitive conversion for `caught-value`.
Other selected artifact imports assert only successful import and nonempty runtime exports.
Those weaker assertions are not represented as full functional coverage.

- Shard `a`:
  `array-at`,
  `async-time`,
  `const`,
  `pipe`,
  `or-throw`,
  and `pnpm-workspace-catalog`.
- Shard `b`:
  `fs-id`,
  `fs-path`,
  `zip-writer`,
  `numeric-format`,
  `function-arity`,
  and `caught-value`.

The selected unit-test source search found no HTTP/provider or agent-launch calls;
`zip-writer` additionally invokes the runner's `unzip` utility.
The evidence distinguishes source file candidates from runtime-discovered cases.
No test-case count is inferred from a successful command or a tracked-file count.
Logs,
outcomes,
not-started budget entries,
actual runner CPU/RAM/identity,
distribution files,
and artifact hashes are retained in source-bound receipts.

Before dispatch,
positive controls verified YAML `on` mapping and TOML static values.
The workflow parsed,
inline Node scripts compiled,
the generated owning-task TOML parsed,
and fixed source,
action pins,
concurrency,
and timeout bounds matched the intended experiment.

This is the first library wave.
Product,
browser,
plugin,
non-default,
and remaining applicable Linux coverage are still active work.

## First wave terminal evidence and experiment corrections

Run `39104186007` completed with both setup sequences and artifact uploads successful.
Both workers reported 8 CPUs,
33,664,888,832 bytes of RAM,
Node `v26.12.0`,
pnpm `12.14.0`,
and Mise `2026.10.0`.
The GitHub API records job intervals of 45 seconds and 50 seconds.
This is an execution observation,
not a comparison against GitHub workers or evidence of a speed multiplier.

All archive digests,
task log hashes,
distribution file hashes,
source identities,
and workflow identities were verified after download.
Of 62 command invocations,
54 succeeded.
The remaining outcomes are deliberately separated:

- Source lint failures:
  `array-at` emitted denied `typescript/no-unsafe-assignment` warnings;
  `const` and `numeric-format` emitted `test-import/require-eventual-artifact`
  on their test aggregation imports;
  `zip-writer` emitted the same artifact rule plus unused-disable warnings.
  The source was not changed.
- Experiment selector failures:
  `const` and `numeric-format` have owning `test` tasks,
  not `test:unit` tasks.
  Their actual suites remain to be executed with the correct commands.
- Experiment prerequisite failure:
  `caught-value` deliberately delegates its consumers into `module-test`,
  whose artifact was not built in the first pilot.
- Experiment consumer provisioning failure:
  copied `pnpm-workspace-catalog` distribution files need their declared external `yaml` dependency.
  The missing dependency is not evidence that its built artifact is invalid.

These outcomes do not establish a Depot provisioning or runner failure.
Successful commands also do not prove that every case or branch was reached.

## Expanded module wave and tracked follow-up

Run [`39105587003`](https://github.com/Aquaticats/Monochromatic/actions/runs/39105587003)
completed the reviewed wave covering all 58 active `package/module/*` roots,
split into 29 roots per worker.
Its explicit plans contain 125 and 129 owning invocations.
Both plans first build the harness,
logger,
shared Oxlint configuration,
and the module roots that declare standard build aggregates.
They then execute exact registered type,
lint,
and default-test commands.
Custom `test` tasks for `const`,
`llm-type`,
`matrix`,
and `numeric-format` are retained.
`caught-value` retains its actual delegated consumer command.

The module wave uses the same source and resource bounds as the pilot.
Every selected command was checked against the frozen source task definitions.
Selected Node CLI smoke tests use `--help`,
which their source documents and asserts as exiting before provider API calls.
Fixture subprocess,
disposable Git,
and `unzip` prerequisites were inspected.

Of 254 invocations,
232 passed.
Every module build and type command passed.
The failures comprise 18 Oxlint invocations and four default-test invocations.
The two source-filtered cloud inventories each contain 2,425 repository tasks,
no outside tasks,
and the expected task-name SHA-256:
`149afd917a4fa10f4b5846fc2c02a4ed69f89401ab9230c4869ff34c3cd76e7c`.
Both final receipts report no changed tracked files.
Job intervals were 176 seconds and 213 seconds.
These measurements are not a provider speed comparison.

The failed default suites require separate investigation:

- `conf-fork`:
  its cache-watch case did not meet a condition within 25,000 milliseconds.
- `logger`:
  its file-batch suite reports shared-Promise identity and malformed JSON assertions
  during reentrant writes.
  A later sink verification timeout is a separate logged event,
  not the identified failing suite boundary.
- `p-map-fork.fuzz`:
  its differential property reports a different error message for a null input.
- `wg-allowedips`:
  its input suite reports warning-count and exact error-message mismatches.

The source is retained unchanged.
These are observed test/fixture failures;
they do not establish provider causation or a stable source defect without controls.

## Durable source and execution evidence

The [coverage manifest](depot-complete-coverage-manifest.json)
indexes all 227 canonical active and inactive roots,
their declared APIs,
task families,
Node/Cargo manifests,
test candidates,
descriptors,
and source language counts.
It explicitly marks semantic coverage review and execution incomplete.
Its compressed JSON sidecars preserve all source-level import/export evidence,
static test declarations,
exact task bodies and root templates,
frozen workflow definitions,
and tracked tree identities.
They retain development dependency cycles.
Static declarations and task counts are not runtime case coverage.

The manifest records compressed and uncompressed SHA-256 hashes and sizes.
Every compressed JSON file was decompressed and compared byte for byte before publication.
Source-bound receipts preserve actual runners,
tools,
command outcomes,
log hashes,
and distribution hashes.
The original GitHub artifact ZIPs are also preserved in the repository,
so their evidence does not depend on GitHub's artifact retention window.
Their SHA-256 values match GitHub's artifact API digests.

The local ancestor config contains only unrelated tasks.
The user-global Mise config additionally supplies tools,
an environment key named `GH_PATH`,
and settings named `experimental`,
`auto_update`,
`pipx`,
and `npm`.
It declares no tasks,
task templates,
variables,
or hooks.
The frozen configuration and TypeScript/JavaScript/YAML sources contain no `GH_PATH` reference.
The optional `.env.local.json` path appears in Mise's config listing,
but the worktree file is absent.
The cloud inventory comparison and observed tool versions provide execution evidence;
broader local and cloud environment equivalence is not assumed.

## Reviewed Android cloud profile

The Android application is a Gradle/Kotlin Compose island with a native Rust JNI engine.
`package/music-player/android-app/mise.toml` owns the selected consumer commands:
`test:instrumented:build` builds debug and AndroidTest APKs after the two native ABIs;
`test:unit` invokes the actual host-JVM suite.
The native crate includes shared `truepeak-core` service and fingerprint features,
Turso,
Tokio,
JNI,
AAudio,
and the bundled Opus C build.
`app/build.gradle.kts` specifies minimum API 26,
target API 36,
and compile API 37.
The native build selects `arm64-v8a` and `x86_64` with an API 26 linker floor.
These declarations still require artifact and device verification.

The bounded profile has one native Depot CI worker of class `8x32`,
a 30-minute job limit,
and a 27-minute campaign deadline that leaves time for evidence upload.
It checks out exactly `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
It starts with the cache lane's already exercised `tools-r1` snapshot,
but verifies the current registry digest,
binary hashes,
and frozen dependency identities before use.
Its expected snapshot digest is
`sha256:9fb974fd32185c8afd5711370869d03e0f28e5b560c928eae324c20151ddeee8`.
Java/Rust preparation is shared;
Android dependency warmth is not assumed.

The profile selectively installs lock-bound Android command-line tools `23.0`
and `cargo-ndk` `4.1.2`.
It invokes the existing narrow `prepare:android` task,
not the `prepare` umbrella.
That task installs SDK platform `android-37.0`,
build tools `37.0.0`,
NDK `29.0.13846066`,
platform tools,
and the two Android Rust targets.
It accepts the SDK licenses through the existing owning implementation.
It installs and launches no emulator.

The profile preserves APK hashes and certificate/badging output,
checks packaged native bytes against the generated JNI libraries,
and records every packaged shared object's ABI,
JNI exports,
ELF load alignment,
RELRO alignment,
and APK ZIP alignment.
The [current Android page-size guidance][android-page-sizes] requires
16 KB load alignment and describes the RELRO-end and ZIP checks.
The installed SDK's `zipalign` usage was read,
and its exact check invocation was exercised on a disposable archive as a protocol control.
That archive control is not an APK native-layout result.
The first actual Android run is `qvsjm5hmdp`,
using experimental workflow commit `941caae67e` and the frozen application source.
The owning APK build command passed in 218,903 ms;
the host-JVM command passed in 63,086 ms.
Those are single-run observations,
not comparative speed measurements.
The fresh JVM output contains 127 JUnit XML reports and 1,289 cases,
with zero skipped cases,
failures,
or errors.
Every captured XML,
command log,
and APK hash was checked after downloading the artifact.
The tracked source remained unchanged.

The first collector failed its RELRO-end assertion on
`lib/arm64-v8a/libandroidx.graphics.path.so`.
That assertion was too broad:
the same Android guidance explicitly permits an unaligned RELRO end in a dedicated LOAD
with no subsequent writable data on the protected page.
Actual `readelf --program-headers --wide` output shows RELRO
`0x5c40 + 0x3c0 = 0x6000`,
covering the complete writable LOAD at `0x5c40 + 0x390`;
the next writable LOAD starts at `0x9fd0`,
beyond the protected page ending at `0x8000`.
The observed failure is therefore a research-collector false positive,
not evidence of an Android library defect.
The collector is being corrected with aligned,
dedicated-LOAD,
and writable-overlap controls.
The next run must preserve both APKs before checking either APK's layout.
The corrected classifier passed local aligned and dedicated-LOAD controls,
the actual padded AndroidX LOAD case,
and deliberately rejected shared writable data,
subsequent writable overlap,
and missing LOAD evidence.
Its generated JavaScript and YAML/TOML task boundaries also passed syntax validation.
The Google Play requirement in the cited guidance applies to 64-bit devices;
32-bit library layouts are recorded without extending that acceptance rule to them.
Both APK signatures,
package identities,
instrumentation target,
runner,
and certificate agreement are checked before the pair is handed to the device lane.

The preserved debug APK is 164,612,534 bytes,
with SHA-256 `bdf02a43b9bf235e8998362fff270c0a79060aaa9f9f923a5df01375e01e755f`.
Its actual signature and ZIP-alignment checks passed.
Badging identifies `dev.monochromatic.musicplayer`,
version `0.1.5`,
code `105`,
and the declared API levels.
Its badging advertises `arm64-v8a`,
`armeabi-v7a`,
`x86`,
and `x86_64`,
so every packaged native library still needs inspection against the two engine build targets.
The first collector stopped before retaining the AndroidTest APK;
the successful assembly task alone does not close that artifact-consumer gap.

The registry manifest digest matched the prepared snapshot.
The helper's separate config-blob inspection exceeded its arbitrary 1 MiB limit:
the actual descriptor is 6,502,729 bytes with media type
`application/vnd.depot.thin.snapshot.config.v2+json`.
This is a thin block-map configuration,
not an ordinary OCI `config.Env` array.
Absence of an OCI field cannot establish environment or secret exclusion.
The corrected helper must check the descriptor size and digest,
retain the actual schema distinction,
and keep runtime synthetic-marker observations separate.

Fresh JUnit XML,
declared/discovered case counts,
failure/skip counts,
source identities,
and command logs accompany the APKs for the parent's headful device consumer.

### Successful Android artifacts and JVM consumers

The corrected run `1jxc80q7q7` finished successfully at workflow `8256d8bb9d`,
still checking out the identical frozen application source.
Its [retained receipts and actual JUnit case index][android-receipts]
are 96,498 compressed bytes,
with SHA-256 `b517d9c2ff726f96c1afedc8c5bbb5ed2a389125ccc41913a1c3292bcf7d85e1`.
The downloaded ZIP matches the provider's 68,983,121-byte metadata.
Native CI metadata did not provide a server archive digest;
the local archive digest and all captured APK,
native payload,
JUnit,
and command-log hashes are retained and checked.

The pair passed signature,
ZIP,
package,
instrumentation-target,
runner,
and certificate-agreement checks:

- Debug APK:
  164,612,582 bytes,
  SHA-256 `96c1c48857fc6d6acf0f8bb488586cfefb39fd2950cb202685f15c7520c82eca`.
- AndroidTest APK:
  491,989 bytes,
  SHA-256 `f1e75619b158d07ce3fdec9af1cd6fa084e4645acec2aff9af7f83865cd4aa49`.

The APKs are retained privately and handed to the parent device lane as a matching pair.
Their common certificate differs from the first run's certificate.
No installed-device compatibility is inferred from APK signatures alone.
The complete debug ZIP contains 10 native libraries:
AndroidX graphics-path libraries for all 4 advertised ABIs,
and the engine plus Turso SDK/sync libraries for the 2 declared 64-bit build targets.
Both engine libraries expose 27 Java JNI symbols.
Every packaged library matches its corresponding Gradle stripped-native intermediate.
Every applicable ELF LOAD and RELRO check passes the corrected classifier.
No native libraries are packaged in the AndroidTest APK.
The extra 32-bit graphics-path libraries do not establish a working 32-bit engine.

The second JVM run again produced 127 reports and 1,289 passing cases,
with zero skipped cases,
failures,
or errors.
The case-identity multiset matches the first run.
The [task-level execution proof][android-jvm-execution]
retains both complete Gradle logs,
every task outcome,
and each XML report's timestamp and hash.
Both invocations show `:app:testDebugUnitTest` executing without `FROM-CACHE` or `UP-TO-DATE`.
Every report timestamp falls inside its actual test command's recorded interval.
Each invocation separately restores `:app:javaPreCompileDebugUnitTest` from cache;
that compilation-cache result is distinct from test execution.
Tracked source remained unchanged.
The byte comparison is narrower:
the 4 AndroidX payloads match between builds,
while the 6 engine/Turso payloads differ.
The [section-level comparison and original-source controls][android-reproducibility]
show matching `.text` bytes for all 8 inspected 64-bit libraries.
Each differing engine/Turso library contains the corresponding build's clock timestamp in `.rodata`;
the isolated unchanged `turso_core` build script reproduces deterministic output with `SOURCE_DATE_EPOCH`.
Symbol-table and string-table differences are retained separately.
The [timestamp diagnosis][android-timestamp-diagnosis] describes the verified seed control
and the absence of a complete normalized native or APK rebuild comparison.
Source identity is not being promoted into a whole-artifact bit-reproducibility claim.

The parent consumed the exact second-run pair on a private headful API 37,
`x86_64` device using emulator `37.2.12` and host GPU rendering.
Its actual page size was 16,384 bytes.
APK hashes and installation passed,
the invented FLAC/Opus/MP3 fixture rows were indexed,
and `MainActivity` became the actual top-resumed activity.
The frozen source's 4 instrumentation Kotlin files declare 16 cases;
the source-derived catalog matched all 16 executed identities.
Of those,
14 passed,
2 failed,
and zero were skipped.
The runner completed normally and the parent retained the raw failures and verified cleanup.
The [public device receipt][android-device-consumer] retains the exact failure identities:
`SessionStoreTest#migratesEveryLegacyCombination`
and `SessionStoreTest#currentPlaybackModeWinsOverLegacyKeys`.
Both report a null-context `getSharedPreferences` call,
matching the parent's freshly checked open issue `1002`.
These are consumer assertion failures,
separate from successful APK assembly and host-JVM tests.
The newer main checkout's 3 additional instrumentation classes are outside the frozen cohort.

[android-page-sizes]: https://developer.android.com/guide/practices/page-sizes
[android-receipts]: depot-complete-coverage-android-receipts.json.gz
[android-jvm-execution]: depot-complete-coverage-android-junit-execution.json.gz
[android-reproducibility]: depot-complete-coverage-android-reproducibility.json.gz
[android-timestamp-diagnosis]: ../troubleshooting/turso-android-native-build-timestamps.md
[android-device-consumer]: ../audit/depot-android-consumer-2026-10-18.evidence.json

## Remaining Node static and build campaign

The next bounded wave targets the 122 active Node package roots outside `package/module`.
Its frozen command plan selects 109 owning type-check tasks,
106 owning Oxlint tasks,
and 82 reviewed Node build entry points.
Shared module and Oxlint prerequisites add 42 command invocations to each shard.
The four shards therefore schedule 465 invocations,
with at most one shard running at a time.
Each uses `depot-ubuntu-24.04-8`,
with a 15-minute job limit,
90-second per-task bound,
and a nine-minute campaign limit.
This leaves room for the concurrent Android worker within this lane's 16-CPU/64-GB ceiling.
The maximum published compute-rate exposure for the four shards is USD 1.44,
before plan credits.

The review follows actual `build` and `build:js` fanout templates and every declared build child,
not just aggregate names.
`package/config/pnpr:build` also selects its image build,
so this wave invokes its existing `build:js` owner instead.
The reviewed custom builds include Electron staging,
the JetBrains theme JAR,
and standalone HTML generators.
Custom native builds,
the static-site generator,
font generation,
and roots lacking a build aggregate remain named entries in the plan for separate prerequisite review.
Their absence from this wave is not evidence that the packages have no applicable consumer.
The workflow preserves every command's failure and every not-started budget state.
It retains generated `dist` artifacts and checks that tracked source did not change.
Default tests are a separate campaign after process,
service,
and agent-recursion review;
the static wave cannot establish runtime coverage.

The first dispatch raced the Git push and selected old workflow head `8256d8bb9d`,
not the reviewed static-wave head `82ea6108c5`.
Run `39109746777` was identified from its actual `headSha` and workflow name,
then cancellation was requested.
It is excluded from static-wave coverage.
The corrected dispatch occurs only after the push completes and `git ls-remote` verifies the expected head.
Cancellation acknowledgement and terminal job states remain separate evidence.
The stale run is terminal `cancelled`,
including both jobs.
The intended static wave is run `39109937957`,
whose actual API record binds head `82ea6108c57c9ef9cf6880e6d4506679812a6776`
and workflow name `Research remaining Linux Node quality and build graph`.
That run is now terminal.
All 465 scheduled commands ran:
418 succeeded and 47 failed.
The failures comprise a product build,
39 Oxlint tasks,
and 7 type-check tasks.
The Doodle Widget build reports `Could not resolve 'canvg'` from its `jspdf` consumer.
Type failures involving an absent Auto Mode build remain prerequisite failures pending the owning build;
they are not being counted wholesale as source type defects.
All cloud inventories match the frozen 2,425-task names hash.
The builds also regenerated 17 tracked derived outputs,
including Claude plugin bundles and the IntelliJ JAR.
Those paths are retained explicitly;
this wave does not support an unchanged-tracked-tree claim.

The next default-test profile selects 24 roots with 75 tracked default-shaped files.
It runs the owning tasks and reviewed build prerequisites in 2 sequential 8 CPU/32 GB jobs,
with a 15-minute job cap,
90-second command cap,
and 9-minute campaign cap.
Its 127 scheduled invocations include shared build prerequisites.
Reviewed Electron cases import the produced app domain modules or perform disposable dry-run staging;
they do not establish a launched Electron application.
The terminal-launch test only checks the exported function's type,
and KWin cases exercise pure command selection.
The VM builder's default task has zero tracked default-shaped files;
its exit is a discovery control,
not credit for executed tests or a VM consumer.
Agent-host,
transport,
process,
and native-prerequisite profiles remain separate pending work.
The profile is dispatched as run `39112145763`,
with the API-confirmed workflow head `588275a55c7efefef93dbbc529078d31fdcfafd8`.
It is now terminal:
126 of 127 invocations passed.
The `unused-export` default task fails 2 real consumer cases with
`TypeError: analyzer.addFile is not a function`.
Its frozen type-check also reports `TS2339` for `addFile`,
`referencesOf`,
and the diagnostic's `module` property.
The locked `yuku-analyzer` `0.19.0` declarations and implementation instead expose `setFile`.
The VM-builder discovery control exits successfully with zero default-shaped files,
so it receives no executed-test credit.

The reviewed process profile is dispatched as run `39114552347`,
with API-confirmed harness commit `8fa5b508c061e9caec82847037a40a5ef414aa7b`.
Its 17 owning default tasks have 191 files confirmed by the actual filesystem glob,
with a source hash for each discovered file.
It invokes 131 commands across 2 sequential Depot `8CPU/32GB` jobs,
with a 15-minute job cap,
3-minute command cap,
and 9-minute campaign cap.
Both shards build the reviewed cross-package prerequisites before their assigned default tasks.
The CPU-cap and desktop-E2E owning configurations declare no build task.
The initial characterization of desktop-E2E as only pure and stand-in-socket helpers was incomplete:
`compositor-path.unit.test.ts` actually queries the installed Mise compositor,
and `image.unit.test.ts` invokes ImageMagick for PNG decoding.
Neither check starts a GUI,
but both require separately qualified installed tools.
The WireGuard companion lookup also requires the real `wg-quicker-exempt` release artifact.
The profile uses injected provider transports,
temporary Git repositories,
temporary file-enforcer configurations,
fake `sudo`,
fixture hardware paths,
and an invalid VM backend sentinel.
Actual paid provisioning,
physical compositor control,
and host hardware writes are outside these fixture tests.
The completed run invoked all 131 commands:
128 passed,
and the WireGuard,
CPU-cap,
and desktop-E2E default tasks failed.
Both workers used UID `1001`,
so the WireGuard fixture did enter its intended nonroot privilege path.
Both source receipts retain unchanged tracked files.
The missing native companion,
compositor lookup,
decoder prerequisite,
and CPU-cap assertion remain distinct diagnoses;
they are not assigned collectively to a provider.

Auto Mode's `build:native` and `test:native:*` names describe a maintained Pi host built from JavaScript/TypeScript.
They are not covered by the Cargo campaign.
Its source owner checks installed Pi `1.2.0`
and the external upstream revision `06a466935536f8c9bcacb2d5efc0fc021be1bdff`
before emitting the host graph.
This qualified external checkout is an additional build input,
distinct from the frozen first-party tree.
The build already rejects recursive invocation through `PI_AUTO_MODE_NATIVE_BUILD`.
The guarded host/default profile is now dispatched as run `39118106788`,
using pushed and API-verified harness `3f3a8f0bf3733f0c97bf29c56e9010e27371b0f2`.
Its 35 remaining non-module Node default owners have 424 source-hashed candidate files.
The distinct `package/cli/wg-allowedips` owner is included;
the previous module failures concerned `package/module/wg-allowedips`.
The profile plans 187 owning invocations across 2 sequential `8CPU/32GB` jobs,
with the same 15-minute job,
3-minute command,
and 9-minute campaign bounds.
It builds the actual qualified original Pi source before Auto Mode's defaults,
then runs the finite `permission`,
`prohibition`,
and `none` domain profile,
the maintained native syntax task,
and a type check after the native artifact prerequisite exists.
Installed SDK regular-file bytes are snapshotted before and after;
descendant `node_modules` and symbolic links are outside that byte snapshot.
Its test transports use finite synthetic responses and explicit fixture recursion/network guards.
This is a dispatched campaign,
not a passing host or whole-graph coverage claim.
Capacity profiles remain separate bounded work.

The process receipts,
original GitHub ZIPs,
and exact executed harness are now linked from the immutable coverage manifest.
The CPU watcher assertion expected `2800000 100000`
and observed `3000000 100000` after its fixture-path smoke run.
No provider cause is assigned from that single failure.
The decoder-producing command returned status `-1`;
the exact executable/setup cause still needs a positive tool probe.

The actual frozen `wg-quicker-exempt` release is admitted from native producer `lwp0vbb2vq`.
Its ELF SHA is `02053fc5338835abb4d6a7812a3b71244a2190512724040219cdd68595dee921`.
Admission verified 23 original source-file hashes,
the root Mise lock,
and the producer manifest hash.
The producer exercised 15 ordinary Nextest cases;
11 privileged ignored cases remain unexecuted.
The separate 44-invocation `wg-companion` profile completed successfully as run `39118628603`,
using the same immutable `3f3a8f0bf3733f0c97bf29c56e9010e27371b0f2` harness.
Its UID `1001` worker passed all 44 owning invocations.
The exact `finds repository sibling release outside secure path` case appears in the passing receipt.
All 14 owning-template candidate file hashes matched before execution.
The download admitted the original ZIP,
the producer's 23 source files,
root Mise lock,
manifest,
and exact ELF hash.
This closes the missing-producer lookup boundary without changing source.
The Node case resolves the real ELF path;
it does not execute that helper or exercise privileged BPF behavior.
The separate native producer's real usage/zero-mark controls remain distinct evidence.
The one-object signed URL was scoped to one exact owned repository Actions secret and one download step.
Terminal logs and normal artifacts were retained and verified before secret deletion;
the final exact-name API probe returned HTTP `404`.
The signed URL was never a dispatch input.
No ELF,
ELF-bearing ZIP,
or signed URL was committed.
The public compressed JSON receipt retains admission,
the actual passing line,
source provenance,
artifact digests,
and secret cleanup metadata.
The proposed untracked Git-transport copies were removed before publication.

The active queue remains independently verifiable:

- Keep the completed source-bound device consumer's 2 failed assertions
  and current-main source drift visible in aggregate acceptance.
  The isolated Turso build-script seed controls are complete;
  full normalized native-library or APK rebuild equivalence remains unmeasured.
- Finish the immutable package/feature/command manifest,
  including active and inactive roots,
  actual imported/generated influences,
  and native/Kotlin/Slint/build-tool consumers.
- Classify the published static,
  matched-provider,
  and default-task receipts against the exact first-party source assertions.
- Execute remaining applicable Node quality,
  product,
  plugin,
  browser,
  and default-test commands after command and side-effect review.
- Execute named bounded fuzz,
  property,
  conformance,
  mutation,
  and expensive profiles using each actual task's argument grammar.
- Run proper isolated packed-install consumers,
  using the existing `package/config/pnpr/src/publish-steps.ts` packing owner
  and `publish-plan.ts` manifest transformation.
  Retain the failed dependency-free import fixture as a positive control.
- Coordinate native,
  GUI,
  VM,
  and device evidence with the parent lane;
  do not duplicate its PR or protected-branch experiments.
- Publish scoped evidence,
  lint and render the note,
  and keep source failures distinct from harness,
  setup,
  discovery,
  and unexecuted cases.

## Current next action

Retain terminal output from guarded host/default run `39118106788`.
The actual sibling-release consumer and exact owned-secret cleanup are complete;
retain that passing boundary alongside the original missing-producer failure.
While cloud commands run,
qualify the desktop lookup/decoder prerequisites,
execute the isolated file-enforcer Git-config control,
and prepare actual bounded fuzz/conformance/browser/product consumers.
The immutable feature and consumer manifest remains under semantic review.

## Generator Git credential cleanup control

The frozen file-enforcer generator configures a credential-bearing Git URL subsection,
then removes a different token-free subsection.
The actual invented-token Git 2.56.0 control reproduced a live rewrite after the authored cleanup;
its shell returned `0` while a direct wrong-key unset returned `5`.
Matching-key and matching-section positive controls each removed the rewrite.
[The source trace and retained receipt](../troubleshooting/git-url-rewrite-cleanup-key.md)
cover only this live-configuration boundary.
No real credential,
complete generator image,
or exported image layer was used.
Expanded CI must preserve that limit when qualifying this existing image consumer.

## Guarded host terminal results and artifact boundary

Run `39118106788` invoked all 108 commands in shard `a`:
105 passed and 3 default owners failed.
Those failures are spread-rule assertions in `no-restricted-syntax`,
retirement-table characterization (`570` actual versus `551` expected),
and OpenAI Fast nested-option identity.
Its 34 default owners discovered and hash-matched 262 files.
Shard `b` invoked no commands because my admission helper searched only direct dependency links.
An intermediate ordering hypothesis was wrong:
the actual pnpm dependency install had already completed.
The incumbent coding-agent realpath/sibling lookup resolves the transitive SDK packages.

Corrected immutable harness `47aef8d403e4151593725943456fa3b0a8bce626`
ran as `39119985290`:
78 of 79 owning invocations passed.
The actual native build,
subsequent type check,
native syntax check,
and default unit task passed;
all 162 expected default files matched actual discovery.
The additional finite domain task passed permission and prohibition with zero HTTP/provider requests,
then failed its `none` assertion with actual `unresolved` versus expected `unspecified`.
This source assertion remains red.
The earlier missing-native-artifact type failure is closed by this qualified prerequisite build.

All 2,412 regular files across the five actual SDK 1.2.0 roots had identical before/after hashes.
Descendant `node_modules` and symlinks were outside that snapshot.
Original Pi source was pinned to `06a466935536f8c9bcacb2d5efc0fc021be1bdff`;
its reported unstaged tracked-file diff was empty.
One generated Claude stop-reminder bundle changed in the application checkout,
so this is not an unchanged-tree claim.

The normal native artifact is 65,588,732 compressed bytes and 198,624,683 expanded bytes.
All 33,912 actual ZIP members matched independent streamed decompression hashes
in a network-disabled read-only container capped at 2 GiB and 2 CPUs;
a deliberately corrupted extracted fixture was rejected.
Its actual payload includes WebAssembly and platform-native dependency files;
header presence is not runtime qualification for another OS or architecture.
The compiled payload stays in normal cloud artifact storage,
not Git history.
The public compressed receipt retains actual task logs,
all member hashes,
source admission,
and native header inventory.

The archive omits a declared producer output;
its runtime effect on a fresh consumer is unmeasured:
the producer declared `pi/ai/dist/providers/data/.manifest.json`,
3,762 bytes with SHA-256 `a4c0a81f2cc4323b81d4c5d3886b343dc226939168f33e8eb731c928a81cfce9`,
but that resource is absent from the actual ZIP.
The pinned uploader defaults `include-hidden-files` to `false`
and passes `excludeHiddenFiles: true` to its globber.
A follow-up must retain this failed boundary,
qualify explicit hidden-resource inclusion,
and run a fresh restored-artifact consumer before portability is credited.

## Bounded properties and remaining consumers

Run `39120929405`,
immutable harness `7e1b030e7e6898a7d1e7876cd0723dd61292c65a`,
dispatched the same frozen application source.
Its 69 planned invocations comprise 42 shared builds,
12 bounded fuzz owners over 28 actual property files,
13 authored deterministic coverage checks,
and JSONC conformance plus the shared Rust-fixture digest check.
Ten fuzz owners request 100 runs per property;
logger and TOML request 1,000 ms per property.
Actual successful trial counts are not exported by every owning task,
so requested budgets are not reported as observed trial counts.
The frozen tree contains only 12 matching coverage-baseline files;
the conf-fork baseline is absent.
No baseline refreeze or intentionally infinite deepmerge campaign is invoked.
The job has 8 CPUs,
32 GiB,
a 15-minute job bound,
a 9-minute command campaign,
and a 180-second per-task bound.
All 69 owning invocations reached a terminal outcome:
64 passed and 5 failed,
without a campaign-budget omission.
The receipt's declared artifact set is complete,
and it reports no changed tracked files.

The failed boundaries are:

- Conf-fork's coverage gate cannot read its absent frozen `coverage-baseline.json`.
- JSONC's gate reports covered-line counts 12 versus 14 for `edit-comment.ts`,
  8 versus 10 for `edit-set.ts`,
  2 versus 3 for `emit-value.ts`,
  and 2 versus 4 for `parse-jsonc.ts`.
- Logger's gate reports 453 versus 456 covered lines in `src/sink/console.ts`.
  These are actual coverage assertions;
  their cause has not been attributed to the source or the runtime version.
- Matcher's actual `isMatch` differential property shrank to inputs `['', 'a']`,
  patterns `['!', '!']`,
  and `{ caseSensitive: false, allPatterns: true }`.
  The fork returned `false` while the locked upstream returned `true`.
  The retained replay identity is seed `565212679`,
  path `70:2:3:2:2:3:5:5:5:5:6:6`,
  after 71 tests and 11 shrinks.
- P-map's streaming and concurrent differential properties report error-message parity failures
  for null and undefined iterable inputs respectively.
  Both exact seeds,
  paths,
  inputs,
  and nested assertions are retained.

The original ZIP and source-bound logs are recorded in
`depot-complete-coverage-typescript-fuzz-receipts.json.gz`.
No gate was waived or refrozen.

The finite deepmerge/compiler consumer,
TOML Go conformance,
mutation-container lifecycle,
actual Chromium/Firefox/WebKit consumers,
qualified desktop compositor/ImageMagick lookup and PNG decoding,
proper packed installs,
and complete product feature/assertion mapping remain tracked work.
The complete-coverage and execution-complete flags remain false.

## Actual browser owner baseline dispatched

Run `39123458425`,
immutable harness `6328647d8b7113a920d777044944612f3bc47a58`,
keeps the same frozen application source and original Playwright recipe.
Its 45 owning invocations comprise 42 shared builds plus the neutral module-test browser owner
separately for Chromium,
Firefox,
and WebKit.
That owner caps each actual Podman test container at 2 GiB and 2 CPUs with one worker.
This named profile uses no retries,
a 15-second test limit,
and a 90-second suite limit.
The original image declares Playwright 1.63.0 while the source lock declares 1.64.0;
the run preserves that baseline instead of changing the recipe.
The terminal receipt verifies all 45 owning invocations:
42 shared builds passed and the three engine owners failed before their test bodies.
Each engine enumerated two cases,
but Playwright 1.64.0 could not find its required executables in the original 1.63.0 image.
These six enumerated cases receive no executed-body credit.
The original container recipe and failure are retained.

## Fresh compiled-host artifact consumer dispatched

Run `39124269347`,
immutable harness `28bf38b0281f3bcace40b70d8b989d6e0ef7f875`,
retains the frozen application source and original failed artifact-membership evidence.
Its producer has 8 CPUs,
32 GiB,
and a 15-minute bound;
it executes the shared builds and actual auto-mode JavaScript and native host producers.
The uploader explicitly includes hidden files inside the reviewed receipt path.
Its dependent fresh consumer has 4 CPUs,
16 GiB,
and a separate 15-minute bound.
It admits one exact source-bound artifact,
checks its digest and declared output hashes,
restores only compiled output,
and executes the actual native domain owner without rebuilding application source.
The producer passed all 44 owning invocations.
The fresh consumer verified all 1,036 declared compiled file hashes,
including the formerly omitted 3,762-byte `.manifest.json`,
and restored 33,802 ZIP members against the matching installed SDK snapshot.
Its first actual domain import failed because `runner.js` did not expose `nativeAssertActive`.
No domain scenario ran in that first fresh consumer.
The consumer verifies the installed SDK snapshot against the producer before host execution.
Only the artifact download step receives its read-only workflow token;
no new repository secret was created.

The source diagnosis and outstanding membership/runtime boundaries are recorded in
[`github-artifact-hidden-sdk-resources.md`](../troubleshooting/github-artifact-hidden-sdk-resources.md).

## Restored activation and dependency topology controls

Run `39126088565`,
immutable harness `0d8123ea327f5beddedcf3ba99d698288ea6d979`,
retains the flattened artifact failure and calls the frozen source's activation owner.
Activation alone advances the failure from the missing export to missing dependency `which`.
Its namespace probes used an incorrect `.mjs` suffix for `paths.ts`;
those probe failures are harness errors and provide no namespace evidence.

Corrected run `39126304854`,
immutable harness `bb659f0f7fea71de9a2ba850bd04c5d0919fcb8e`,
restores the same exact producer artifact without building application source or running the unit suite.
It preserves the materialized directories,
calls `activateNativeBuild`,
and reconstructs the three emitted dependency symlinks with the exact frozen producer formula.
The loader's expected runner URL changes from unequal to equal to the generated absolute import.
The same 52,321-byte `runner.js`,
SHA-256 `ad8895d110bc4b0eb26415589b2e8b2e7516bf8f91c28504a8214f2e7572fe47`,
then exposes `nativeAssertActive` through the registered maintained loader.
The earlier 79-command producer and fresh 44-command producer have identical runner bytes.

The actual restored domain owner passes permission and prohibition with zero HTTP/provider requests,
then reaches the preserved `none` assertion:
actual `unresolved` versus expected `unspecified`.
This qualifies the measured same-layout restored consumer through those scenario boundaries.
Generated absolute imports and dependency symlinks remain packaging requirements;
arbitrary filesystem relocation and another platform are unmeasured.

## Matching-image browser and E2E campaign

Run `39126466632`,
immutable harness `552831830ef2f059b7efa5149fe20f053428c220`,
is the sole active coverage job.
Its finite plan has 50 owning invocations:
42 shared builds,
the authored browser-property bundle and product page build,
one copied-recipe matching-image control,
the root browser owner for all three configured engines,
and the root E2E owner for both configured engines.
The frozen inventory contains eight browser specifications and four E2E specifications.
All application source,
test assertions,
and Playwright configurations remain unchanged.
Only the copied Docker recipe's base-image token changes to the digest-qualified 1.64.0 image.
A consumer-boundary Podman wrapper adds 2 GiB memory and 2 CPU limits to each actual container.
The job remains bounded to 8 CPUs,
32 GiB,
15 minutes,
one worker,
zero retries,
and finite per-task and suite limits.
No terminal result is credited before collection.
