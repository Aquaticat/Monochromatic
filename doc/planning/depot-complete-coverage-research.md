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

The active queue remains independently verifiable:

- Finish the immutable package/feature/command manifest,
  including active and inactive roots,
  actual imported/generated influences,
  and native/Kotlin/Slint/build-tool consumers.
- Complete the matched provider repeat and filesystem-watch positive control
  for the four failed default suites.
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

Complete the immutable package/feature/command manifest,
inspect the first wave's terminal receipts,
and use measured setup,
execution,
and failure evidence to form subsequent applicable Linux shards.
