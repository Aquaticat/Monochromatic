# Current CI baseline register

Status:
implementation work item 1,
opened 2026-10-18.
This register records what the current static,
unit and build profiles actually do.
It is not a passing baseline.
No profile here is a gate.

## Pinned revision and owner map

The baseline revision is `4f3d5a65a776355f55d32e1334109c05debfaa09`.
The worktree was clean for the measurement aside from dependencies.
The owner map at that revision is 225 package directories,
210 active,
13 paused and 2 archived,
with 14,301 tracked files.
The source-owned task declarations are 2,600,
expanded by `mise` to 2,464 records.
The evaluation's 223,
208,
13,860 and 2,425 counts are historical for its frozen cohort.
They are not a current starting scope.

## Static profile

Command:
`mise run lint:monochromatic-lint`.
Exit code: 1.
Affected files:
1,046.
Findings:
85,719.
The dominant classes are:

- `markdown/semantic-line-breaks`:
  81,700.
- `rust/require-rustdoc`:
  2,077.
- `markdown/no-bare-urls`:
  1,894.
- `rust/max-lines`: 27.
- `markdown/heading-increment`: 5.
- `markdown/no-trailing-punctuation`: 4.
- `markdown/link-image-style`: 3.
- `markdown/link-image-reference-definitions`: 2.
- `markdown/fenced-code-language`: 2.
- `markdown/single-h1`: 1.

Exact per-finding identities are in
[the compressed static log](../audit/depot-current-baseline-static-2026-10-18.log.gz).
Disposition:
the fast static subset is changed-path scoped.
The whole-tree result is an advisory baseline,
not a gate.
The selector and the exact lint configuration are work item 2.

## Unit profile

Command:
`mise run test:unit`.
Exit code: 1.
Named failing test files: 751.
The exact repository-relative file identities are in
[the unit failure list](../audit/depot-current-baseline-unit-files-2026-10-18.json).
Distribution by package family:
`package/module` 284,
`package/pi-plugin` 260,
`package/cli` 51,
`package/oxlint-plugin` 40,
`package/dev-script` 27,
`package/agent-harness-shared` 25,
`package/pi-shared` 19,
`package/config` 10,
`package/mcp` 8,
`package/claude-code-plugin` 6,
`package/cloudflare-worker` 6,
`package/desktop-app` 6,
`package/build-tool` 3,
`package/git` 3,
`package/music-player` 2,
`package/rolldown-plugin` 1.
The raw log is in
[the compressed unit log](../audit/depot-current-baseline-unit-2026-10-18.log.gz).
Observed failure classes:
1,979 `ERR_MODULE_NOT_FOUND`,
987 `Cannot find`,
354 `Unexpected token ... is not valid JSON` and
94 AggregateErrors.
The first failures reference missing `dist/final/node/index.mjs`.
The run executed without built prerequisites,
so the 751 names are a missing-prerequisite cascade,
not product failure evidence.
A sampled JSON-parse failure comes from
`package/oxlint-plugin/test-support/src/index.ts:331`,
where `JSON.parse(stdout)` receives a `Failed to ...` child-output string.
That is a harness or child-command boundary,
not a product assertion.
No unit case is converted to a pass by this register.

Disposition:
this run is invalid as a product baseline.
Rerun the unit profile after a successful build,
then partition the remaining failures by cause.
No product failure is attributed from this run.
This is work item 1 and its acceptance artifact.

## Host boundary

The first bounded build rerun was started on the shared development host and then stopped.
That was outside the plan's execution routing and stressed the host.
Full build and unit baselines run only in the bounded CI environment or a resource-capped
container,
never on the shared development host.
The aborted attempt produced no failure classification.

## CI baseline runs

The first bounded CI baseline run is GitHub run `39196063655` on the Depot-managed
`depot-ubuntu-24.04-8` runner.
It failed in the dependency-preparation step after 3 minutes, before any build or unit work.
`mise install` installed 58 of 59 tools and failed on `pipx:slopo@latest` because the dependency
sidecar `.mise/locks/pipx-slopo/0.9.0` is absent on a fresh checkout.
That is an environment and tool-install failure, not a product failure.

The corrected run is GitHub run `39196377166`.
It installs the repository tools with `continue-on-error`, then prepares dependencies, builds and
runs unit with automatic tool installation off.
The slopo sidecar failure is retained as tooling noise.
Outcomes are pending.

## Build profile

Command:
`mise run build`.
Exit code: 1.
Failed tasks:

- `//package/config/lfs-r2-worker:build:js:browser`.
- `//package/cli/wg-allowedips:build:js`.
- `//package/dev-script/file-enforcer:build:js`.
- `//package/dev-script/task-util:build:js`.

Observed errors include `rolldown exited with non-zero status: killed by SIGABRT`,
`node exited with non-zero status: killed by SIGABRT` and
`Assertion failed: (0) == (uv_thread_create(t.get(), start_thread, this))`.
The raw log is in
[the compressed build log](../audit/depot-current-baseline-build-2026-10-18.log.gz).

Disposition:
the SIGABRT and thread-creation results are consistent with host-resource or
concurrency pressure under the parallel fanout.
They are not attributed to product source.
A rerun in the bounded CI environment is required before any build failure is classified.

## Triage queue

1.  Re-run the build in the bounded CI environment and capture per-task logs.
    Classify each failed task as product,
    harness,
    environment or resource.
2.  Rerun the unit profile after a successful build,
    then partition the remaining failures by cause.
    Separate the 354 JSON-parse errors and 94 AggregateErrors from product assertions.
3.  Select the changed-path static selector and its exact lint rules.
    Confirm the whole-tree baseline remains advisory.
4.  Record the refreshed owner map and the three baselines in the implementation evidence.
5.  Set the relative target baseline from these measurements;
    do not claim a speed target from a
    failed baseline.

## Acceptance and limits

Acceptance:
every observed failure class has a disposition,
the baseline commands reproduce the
recorded exit codes,
and the exact identities are linked.
This register does not claim product failure attribution,
complete coverage or a passing CI state.
It records the state the rollout starts from.
