# Add mutation testing to file-enforcer

Status: revised implementation plan (supersedes the host-Stryker, per-mutant-container draft)
Target package: `@monochromatic-dev/dev-script-file-enforcer`
New reusable package: `@monochromatic-dev/dev-script-mutation-test`
Primary task: `mise run //packages/dev-script/file-enforcer:test:mutation`

This revision keeps the goals of the earlier plan (Stryker engine, Node native TypeScript instead of
`tsx`, Podman-only, inline Nushell with no checked-in `.nu` files, hardware portability) but changes the
execution topology after verifying the earlier draft against this repository. The verification is recorded
below so future sessions can see why the design changed.

## What was verified before writing this plan

Each claim here was checked by running a command or reading source, not from recall.

- Host `node --version` is `v26.3.0`, so the repo's pinned `node = "latest"` (`mise.toml:52`) already
  resolves to Node 26. Running `node packages/dev-script/file-enforcer/src/pipeline/json.property.unit.test.ts`,
  `node .../tracker.unit.test.ts`, and `node .../pipeline/inspect.unit.test.ts` all exit 0, so the harness
  files run under Node 26 native type stripping.
- The repo already runs property tests under Node: the `fuzz` task in
  `packages/dev-script/file-enforcer/mise.toml` calls `^node $file`. The standard `test:unit`
  task runs under Bun (`mise.toml:302`, `par-each { |file| bun $file }`).
- file-enforcer source has 73 production `.ts` files (125 total `.ts`, 52 test-like). The earlier "76" was
  stale. The count must be derived dynamically, never hard-coded.
- `@monochromatic-dev/module-test` resolves its default import to built `dist/final/neutral/index.mjs`
  (`packages/module/test/package.json`), and its `/ts` subpath to `./src/*`. file-enforcer imports
  workspace packages through the `/ts` subpath in 57 places (for example `src/log.ts` imports
  `@monochromatic-dev/module-logger/ts`). Those resolve to `.ts` under `node_modules` via pnpm symlinks;
  Node's default realpath resolution rewrites them to real `packages/...` paths, so they load.
- The workspace uses `nodeLinker: isolated`, `hoist: false`, `hoistWorkspacePackages: false`
  (`pnpm-workspace.yaml:140`, `:141`, `:186`) and `packageImportMethod: hardlink` (`:350`).
  `packages/dev-script/file-enforcer/node_modules` exists and holds the package's own dependency
  symlinks (`chokidar`, `dot-prop`, `find-up`, `fast-check`, `tiny-readdir-glob`, and a large
  `.monochromatic` cache). Mounting only `<repoRoot>/node_modules` cannot expose these. The earlier
  empirical Node runs silently used the host's package-local `node_modules`.
- `pnpm-lock.yaml` changed 165 times in the last 90 days; root `node_modules` is 1.3 GB.
- Stryker's command runner (`packages/core/src/test-runner/command-test-runner.ts` in the upstream repo)
  runs the configured command through `child_process.exec` with `cwd` set to the sandbox working directory.
  Exit code 0 maps to a passing run (mutant survived); any non-zero maps to a failing run (mutant killed).
  A `Timeout` status is produced only by Stryker's own timeout handler, never by the child's exit code.
- Stryker always excludes `node_modules` from the sandbox copy (upstream
  `packages/api/schema/stryker-core.json`), and offers `inPlace` (mutate files in place, restore from a
  backup afterward) and `symlinkNodeModules`.

## Resolved design decisions

These four decisions were settled through a grilling pass. They drive the rest of the plan.

### Stryker runs inside one container per source file

The earlier draft put Stryker on the host and spawned one Podman container per mutant command. That forced
three problems that all disappear when Stryker runs inside the container:

- per-mutant container cold starts (thousands of `podman run` invocations);
- a host-versus-container `node_modules` overlay that breaks under `nodeLinker: isolated`;
- coordinating Podman's per-mutant `--timeout` with Stryker's timeout classification.

In this revision the host orchestrator spawns one restricted container per source file (about 73 for the
first landing). Stryker, the TypeScript checker, and Node all run inside that container. Stryker still
starts a fresh Node process per mutant through its command runner, so per-mutant isolation and environment
reload are preserved. Per-file isolation is sufficient: the threat model is auto-mutated trusted code that
may hang, crash, or exhaust resources, which the container caps already contain.

### Dependencies are baked into a locally built, content-addressed image

The container's `node_modules` is provisioned by baking it into the runtime image at build time, keyed by
the `pnpm-lock.yaml` hash and the container platform. Mutation testing is opt-in and kept out of the
default `test` task, so the image only rebuilds when a mutation run starts after the lockfile has changed
since the last run, not on every lockfile commit. The image is built locally (no registry push), so there
is no registry churn; orphaned layers are reclaimed with `podman image prune`.

Baking front-loads `pnpm install` into one cached image layer instead of repeating it per container.
`nodeLinker: isolated` places `node_modules` inside the source tree at every package, so live source cannot
be bind-mounted over baked `node_modules` without the mount shadowing them. The container therefore lays
current source down at runtime (see the container layout below); this is required by both the baked-image
and the rejected store-volume option, so it is not a cost unique to baking.

### The first landing covers the whole package

The first landing runs all production source files in file-enforcer and reports a single weighted score.
The one-file run remains a verification gate that runs first and yields a measured per-file wall-clock
before the whole-package run, but whole-package coverage is part of the first landing, not a follow-up.

### The TypeScript checker stays on

`checkers: ['typescript']` with `prioritizePerformanceOverAccuracy: false`. Node strips types and runs the
result without type-checking, so a mutant that introduces a type error but still emits valid JavaScript
would otherwise be scored by runtime behavior and pollute the result. The checker classifies such mutants
as `CompileError` and excludes them, keeping the score trustworthy. The cost is a type-check per mutant,
often the dominant runtime term; it is measured on the one-file gate, and a documented switch drops it to
performance mode or off if the whole-package run is intolerable.

## Architecture

```text
mise task: test:mutation
  -> host orchestrator (Node 26, from @monochromatic-dev/dev-script-mutation-test)
    -> resolve repo root and target package root
    -> ensure the runtime image exists (build if the lockfile-hash + platform tag is missing)
    -> enumerate target source files dynamically (no hard-coded count)
    -> bounded outer worker queue over source files; per source file:
        -> spawn ONE restricted Podman container
            (repo source mounted read-only; node_modules baked in the image; reports dir writable)
        -> container entrypoint:
            -> rsync current source from the read-only mount into a writable tmpfs work tree,
               excluding every node_modules, dist, and .git
            -> recreate node_modules in the work tree as symlinks into the baked layer
            -> run Stryker (inPlace) for the one mutated source file
                -> Stryker TypeScript checker classifies type-invalid mutants as CompileError
                -> Stryker command runner runs `nu -c <inline script>` per mutant
                    -> inline Nu runs each selected .ts test file with Node 26, fresh process per file
                -> Stryker writes a per-file JSON report to the writable reports dir
    -> aggregate JSON reports by raw mutant counts (never by averaging per-file percentages)
    -> print score, survivors, compile errors, timeouts, and preflight failures
```

The host owns orchestration, image readiness, the outer worker queue, and report aggregation. Each
container owns one source file's full Stryker session.

## Container layout

The image bakes a repo-shaped tree with installed dependencies at a fixed path, for example `/baked`,
containing `/baked/node_modules` (root virtual store) and `/baked/packages/*/node_modules` (the isolated
per-package symlink farms). The container runs with these mounts and options:

- repo source mounted read-only at `/src-ro` (used only as the rsync source);
- a writable tmpfs work tree at `/work` (size-capped);
- a writable host scratch directory mounted at `/out` for JSON reports (scoped to a host temp dir, never
  the repo);
- writable tmpfs for `/tmp`;
- everything else read-only.

The entrypoint, before launching Stryker:

1.  `rsync /src-ro/ /work/` excluding `**/node_modules`, `**/dist`, `**/.git`. Source is small once
    `node_modules` is excluded, so this copies the current state of all workspace packages, not just
    file-enforcer, which keeps workspace dependency source fresh.
2.  Symlink `node_modules` from the baked layer into the work tree: `/work/node_modules` to
    `/baked/node_modules`, and each `/work/packages/<pkg>/node_modules` to
    `/baked/packages/<pkg>/node_modules`. Dependency `.ts`/`.js` resolution stays inside `/baked`
    (read-only). Workspace `/ts` imports resolve to real `packages/...` paths in `/work`, outside any
    `node_modules` segment, which is what Node 26 native type stripping requires.

Stryker then runs with `cwd` at `/work/packages/dev-script/file-enforcer` and `inPlace: true`, so it mutates
the writable copy in place and restores it from its backup afterward. Because `inPlace` is on, Stryker does
not create a sandbox and does not depend on copying or symlinking `node_modules` into a sandbox, which is
the behavior that breaks under isolated linking.

### Baseline Podman argv

`src/container-args.ts` is a pure function that builds this argv (one container per source file). Values in
angle brackets are computed.

```sh
podman run \
  --rm \
  --pull=never \
  --network=none \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --memory=<perFileMemory> \
  --cpus=<perFileCpus> \
  --pids-limit=<perFilePids> \
  --timeout <generousSessionSeconds> \
  --tmpfs /tmp:rw,exec,size=1g \
  --tmpfs /work:rw,exec,size=<workSize> \
  --env HOME=/tmp \
  --env TMPDIR=/tmp \
  --env XDG_CACHE_HOME=/tmp/.cache \
  --volume <repoRoot>:/src-ro:ro<,Z if SELinux> \
  --volume <hostReportDir>:/out:rw<,Z if SELinux> \
  --workdir /work \
  <runtimeImage> \
  node <bakedEntrypoint> --package <targetPkgRelPath> --mutate <oneSourceFileRelPath> --report /out/<unique>.json
```

Notes:

- `--timeout` here is a generous whole-session safety cap, not a per-mutant killer. Per-mutant hangs are
  handled by Stryker's own `timeoutMS` inside the container, which is the only path that produces a
  `Timeout` classification.
- The repo mount is read-only and is used only as the rsync source; the container never executes from it.
- `node_modules` comes from the baked image, never from the host checkout.
- Copy the existing canary SELinux pattern if one is required; otherwise make the `:Z` relabel suffix
  configurable so non-SELinux hosts do not relabel unnecessarily.
- Prefer rootless Podman; add `--userns=keep-id` only if it matches the existing canary pattern.

## New package

```text
packages/dev-script/mutation-test/
```

Package name `@monochromatic-dev/dev-script-mutation-test`. Purpose: reusable mutation-test infrastructure
for repo packages; file-enforcer is the first consumer.

### Files to create

```text
packages/dev-script/mutation-test/
  package.json
  mise.toml
  tsconfig.json
  tsdown.node.config.ts
  README.md
  runtime/Containerfile
  src/index.ts              # host orchestrator
  src/in-container.ts       # container entrypoint: rsync, symlink farm, run Stryker
  src/container-args.ts     # pure podman argv builder
  src/runtime-image.ts      # image identity, build-if-missing
  src/stryker-config.ts     # per-source-file Stryker config
  src/inline-nu.ts          # inline Nu test sequencer as a TypeScript string
  src/source-selection.ts   # enumerate mutate targets
  src/test-selection.ts     # select tests per source file
  src/report.ts             # weighted aggregation of Stryker JSON
  src/*.unit.test.ts
```

The earlier draft's `src/container-run.ts` (host process spawned by Stryker per mutant) and
`src/dependency-volume.ts` (named volume preparation) are not created. Stryker is no longer spawned by the
host per mutant, and dependencies are baked into the image rather than prepared into a volume.

### `package.json`

Runtime dependencies:

```text
@stryker-mutator/core
@stryker-mutator/typescript-checker
nano-spawn
```

Dev dependencies mirror sibling dev-script packages (`@monochromatic-dev/config-tsdown`,
`@monochromatic-dev/config-typescript`, `@monochromatic-dev/module-test`, `@types/node`, `typescript`).
Do not add `tsx`.

### `runtime/Containerfile`

Build a runtime image containing Fedora userspace, Node 26, Nushell, pnpm installed through mise, and
installed repo dependencies. Use `fedora:latest` as the base image. Do not use corepack. Build steps:

1.  Start from `fedora:latest` for the build platform Podman selects.
2.  Install system prerequisites with `dnf`, including `rsync`, `git`, `curl`, `dnf-plugins-core`, and
    `ca-certificates`.
3.  Install Nushell with `dnf`. Nushell must exist before any mise task shell or inline Nu verification runs.
4.  Install mise with the official Fedora/COPR path, then use mise to install the repo-pinned `node` and
    `npm:pnpm` tools. Do not activate or install the entire root toolset, since the image only needs Node and pnpm.
5.  Copy the repo (or at least every `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`) into
    `/baked`.
6.  Run `pnpm install --frozen-lockfile` through `mise exec node npm:pnpm -- ...` so `/baked` holds the
    full isolated `node_modules` layout while still using the repo's pinned package-manager version.

`src/runtime-image.ts` owns the image reference. It computes a content-derived local tag, for example
`localhost/monochromatic-mutation-runtime:node26-<lockHash>-<platform>`, checks whether it exists, and
builds it if missing. Do not pin a single-architecture image and run it on another architecture by
accident; let Podman select the host platform unless an explicit debug override is given.

### `src/stryker-config.ts`

Build one Stryker config per source file (executed inside that file's container):

```ts
{
  testRunner: 'command',
  commandRunner: {
    command: '<nu -c with the inline sequencer>',
  },
  mutate: ['<one source file, relative to the package>'],
  coverageAnalysis: 'off',
  inPlace: true,
  checkers: ['typescript'],
  tsconfigFile: '<package or repo tsconfig that resolves /ts subpaths and .ts extensions>',
  typescriptChecker: { prioritizePerformanceOverAccuracy: false },
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: '/out/<unique report path for this source file>' },
  concurrency: 1,
}
```

Rationale:

- `coverageAnalysis: 'off'` is required because the command runner cannot report per-test coverage.
- `inPlace: true` avoids Stryker's sandbox, which always excludes `node_modules` and would therefore drop
  the isolated per-package `node_modules` this repo needs.
- `checkers: ['typescript']` keeps type-invalid mutants out of the score (Node does not type-check).
- `concurrency: 1` gives the outer orchestrator sole ownership of parallelism; one container per file is
  the unit of concurrency.
- The JSON reporter writes to the writable `/out` mount so aggregation never scrapes text output.

Stryker sets `__STRYKER_ACTIVE_MUTANT__` in the command's environment itself; the inline sequencer does not
need to plumb it.

### `src/inline-nu.ts`

The inline script sequences the selected test files inside the container, one fresh Node process per file,
which avoids leaking `module-test` state between files and preserves simple exit-code semantics. The
TypeScript builder passes it as a single `nu -c` argument and passes the test list as a single environment
value, never interpolated into the script.

```nu
let tests = ($env.MUTATION_TEST_FILES_JSON | from json)

for test in $tests {
  let result = (do -i { ^node $test } | complete)

  if $result.stdout != '' {
    print --no-newline $result.stdout
  }

  if $result.stderr != '' {
    print --stderr --no-newline $result.stderr
  }

  if $result.exit_code != 0 {
    exit $result.exit_code
  }
}
```

This exists because `node a.test.ts b.test.ts` runs only `a.test.ts` as the program entry; the rest become
its arguments. Something must sequence the files, and inline Nu is that sequencer, consistent with the
existing `fuzz` task and the repo's no-checked-in-script rule.

### `src/source-selection.ts`

Enumerate mutate targets from the target package, starting from `src/**/*.ts`, excluding:

```text
*.unit.test.ts
*.test.ts
*.spec.ts
*.d.ts
fixtures/**
```

Compute the file list dynamically and print the resolved count. Document any file excluded as non-runtime
(for example test-support helpers such as fuzz-budget plumbing) with a reason, rather than relying on a
fixed total.

### `src/test-selection.ts`

For each source file, select sibling `*.unit.test.ts`, related regression tests
(`*-regression.unit.test.ts`), package integration tests (`integration.unit.test.ts`), and any manually
configured package-wide tests. Provide a `--full-suite` mode that runs the package's full
unit/regression/integration set for every source file. The default per-file selection is a runtime
optimization; `--full-suite` is the stricter pass. Test paths handed to the sequencer are relative to the
container work tree, never absolute host paths.

### `src/report.ts`

Aggregate Stryker JSON by raw counts, never by averaging per-file percentages:

```text
killed
survived
timeout
compileError
runtimeError
noCoverage
ignored
```

Compute the package score from totals and print survivor locations and mutant descriptions grouped by
source file. A per-file Stryker failure must not erase already-completed results.

## Changes to existing files

### `pnpm-workspace.yaml`

Add catalog entries for `@stryker-mutator/core` and `@stryker-mutator/typescript-checker`. Do not add
`tsx`.

### `packages/dev-script/file-enforcer/package.json`

```json
{
  "devDependencies": {
    "@monochromatic-dev/dev-script-mutation-test": "workspace:*"
  }
}
```

### `packages/dev-script/file-enforcer/mise.toml`

Add an opt-in task, kept out of the default `test` task. Invoke the orchestrator through the repo's
workspace Node dispatch (`workspace_node_dispatch` in `mise.toml:223`), which prefers
`dist/final/node/index.mjs` and falls back to `src`, rather than a hard-coded `dist/index.js`.

```toml
[tasks."test:mutation"]
description = "Run container-isolated Stryker mutation tests"
run = "<workspace_node_dispatch invocation of mutation-test, passing the target package path>"
```

### `docs/decisions/mutation-testing.md`

Record why Stryker, why the command runner, why Node 26 native TypeScript replaces `tsx`, why Podman has no
Docker fallback, why Stryker runs inside one container per file, why dependencies are baked, why `inPlace`
is required under `nodeLinker: isolated`, why default execution is per-source-file with `--full-suite`
available, and the known accuracy and runtime tradeoffs.

## Node 26 runtime preflights

Run these from inside the restricted container before the mutation run.

- Native TypeScript smoke: run a tiny erasable-syntax `.ts` file with plain `node`; fail if the path needs
  `tsx`, `ts-node`, Babel, or a build step.
- Workspace import smoke: from the work tree, import the harness and the workspace packages the selected
  tests use; prove each workspace `.ts` resolves to a real `packages/...` path outside any `node_modules`
  segment. Fix failures by resolution, exports, or a JavaScript build, never by adding `tsx`.
- Import specifier smoke: run one file using relative imports; fail if runtime resolution depends on
  `tsconfig` path aliases or extensionless resolution Node will not perform.
- Two-test-file smoke: pass two tiny test files in `MUTATION_TEST_FILES_JSON` and prove both executed.

## Concurrency model

One concurrency owner: the outer orchestrator. Per-file containers are the unit of parallelism.

```text
outer source-file workers: derived from host CPU and memory budget
Stryker concurrency per container: 1
per-container CPU and memory: configurable (larger than the old per-mutant caps, since Stryker plus the
  TypeScript checker plus Node all run inside one container)
```

The outer queue never starts more containers than the configured CPU and memory budget supports. Every
container gets a unique JSON report path under the host reports directory.

## Verification plan

1.  Package build and local unit tests: `mise run //packages/dev-script/mutation-test:build`,
    `:lint:types`, `:test:unit`. Unit tests cover Stryker config generation, Podman argv generation
    (no Docker fallback, no `tsx`), inline Nu inclusion, image-identity computation, source and test
    selection, and weighted report aggregation.
2.  Runtime image smoke: build the image, then
    `podman run --rm --pull=never <runtimeImage> node --version` and `... nu --version`; confirm Node 26
    and Nushell.
3.  Baked dependency smoke: run a restricted container with the host `node_modules` deliberately
    unavailable and confirm selected tests still pass, proving the container uses baked dependencies.
4.  Node 26 native TypeScript smoke: inside the container work tree, run one representative test file with
    plain `node`; confirm no `tsx`, no loader hook, working import specifiers, and workspace `.ts` imports
    resolving outside `node_modules`.
5.  Inline Nu two-file smoke: pass two test files, confirm both markers appear and that a failure in either
    makes the container exit non-zero.
6.  Stryker dry run: run `dryRunOnly` for one source file with the real container; confirm tests pass with
    no active mutant.
7.  Known mutant kill smoke: confirm an active mutant makes the selected test fail and Stryker records it
    as killed.
8.  Type-invalid mutant smoke: confirm the TypeScript checker reports `CompileError` rather than counting
    the mutant as a normal killed mutant.
9.  Container restriction smoke: from inside the container, prove network access fails, repo (`/src-ro`)
    writes fail, root filesystem writes fail, `/tmp` and `/work` writes succeed, and reports land in
    `/out`.
10. One-file mutation run and measurement:
    `mise run //packages/dev-script/file-enforcer:test:mutation -- src/io/glob-mirror.ts`. Confirm a JSON
    report, a survivor list, weighted counts matching Stryker raw data, a unique report path, and a visible
    container. Record the measured wall-clock; this is the runtime signal for the whole-package run and for
    the TypeScript-checker cost decision.
11. Whole-package mutation run: `mise run //packages/dev-script/file-enforcer:test:mutation`. Confirm the
    dynamically enumerated source files are all considered unless explicitly excluded with a reason, that a
    per-file failure does not erase completed results, that the aggregate score is computed from raw mutant
    counts, and that runtime and any quarantined tests are recorded in the README and ADR.
12. Hardware portability smoke: on one amd64 and one arm64 environment, run the same task without changing
    source. Confirm no default `--platform` override, a native or explicitly compatible image, image tags
    that differ by platform, no host `node_modules` read inside the container, and success on both.

## Acceptance criteria

1.  `tsx` is absent from package deps, catalog entries, commands, and docs.
2.  No `.nu` file is added.
3.  Podman is the only supported runtime.
4.  Node 26 plain `.ts` execution is proven inside the container.
5.  Inline Nu proves all selected test files execute.
6.  The container is networkless, root-read-only, capability-dropped, and resource-capped, and it executes
    only from the writable work tree, never from the read-only repo mount.
7.  The container uses baked dependencies, not host `node_modules`.
8.  The TypeScript checker classifies type-invalid mutants as compile errors.
9.  One-file and whole-package runs emit JSON reports and survivor lists.
10. The aggregate score is weighted by raw mutant counts.
11. The same task runs on supported hardware without source changes.
12. The production source list is computed dynamically, with any exclusion documented and justified.

## Risks and mitigations

- Workspace dependency source is stale in the baked image. Mitigation: the container rsyncs current source
  for all workspace packages into the work tree before running, so only `node_modules` is baked, not the
  source under test or its workspace dependencies' source.
- Node refuses `.ts` under `node_modules`. Mitigation: the workspace import smoke proves workspace `.ts`
  resolves to real `packages/...` paths outside `node_modules`; this already works on the host via pnpm
  symlinks and Node realpath. Do not add `tsx`.
- The TypeScript checker dominates runtime at whole-package scale. Mitigation: measure on the one-file gate;
  keep a documented switch to performance mode or off, changed only with the tradeoff recorded.
- Whole-package runtime is unknown until measured. Mitigation: the one-file gate runs first and reports
  wall-clock; if the projection is intolerable, narrow per-file test selection or the checker before the
  full run, and record the decision.
- The image rebuild is needed but missed. Mitigation: `src/runtime-image.ts` tags by lockfile hash and
  platform and builds if the tag is missing, so a changed lockfile forces a rebuild automatically.
- SELinux relabeling differs across hosts. Mitigation: make the `:Z` suffix configurable and copy the
  existing canary pattern when present.

## Stryker upstream vet

Per the repository's tool-vetting rule, Stryker was inspected at the source level, not only via docs. The
upstream repo carries CI (`ci.yml`, `publish.yml`, `performance.yml`) and dogfoods mutation testing on
itself (`mutation-testing.yml`); it has 237 `*.spec.ts` files across packages; and
`@stryker-mutator/typescript-checker` is a real, separately tested package
(`typescript-checker.ts`, `typescript-compiler.ts`, `tsconfig-helpers.ts`). The command runner behavior
relied on by this plan was read directly in
`packages/core/src/test-runner/command-test-runner.ts`. One caveat: a shallow clone of the default branch
presented minified identifiers in some files, so option semantics (`inPlace`, `symlinkNodeModules`, the
always-ignored `node_modules`) were confirmed from `packages/api/schema/stryker-core.json` rather than the
minified TypeScript. Pin exact versions through the catalog when adding the dependencies.

## What changed from the prior draft

- Topology: Stryker now runs inside one container per source file, not on the host with one container per
  mutant.
- Dependencies: baked into a locally built, content-addressed image, not prepared into a named volume; the
  volume preparation file is dropped.
- Sandbox: Stryker runs `inPlace` against a writable work tree, so there is no sandbox and no dependence on
  Stryker copying or symlinking `node_modules` into a sandbox, which is required under `nodeLinker:
  isolated`.
- Isolated linking: the plan now accounts for per-package `node_modules`, which the prior draft missed by
  mounting only `<repoRoot>/node_modules`.
- Timeout classification: Stryker's own `timeoutMS` handles per-mutant hangs; Podman `--timeout` is only a
  whole-session safety cap, so hung mutants are no longer miscounted as killed.
- Command quoting: the per-mutant Podman argv is gone; the only shell-string boundary is one static
  `nu -c` inside the container.
- Source count: the stale "76" is replaced by a dynamically computed list (73 today).
- Task wiring: the mutation task uses the repo's workspace Node dispatch and the real
  `dist/final/node/*.mjs` layout, not a hard-coded `dist/index.js`.

## Reference notes

Official docs cross-checked against source:

- Node.js TypeScript runtime: https://nodejs.org/api/typescript.html
- StrykerJS configuration: https://stryker-mutator.io/docs/stryker-js/configuration/
- StrykerJS TypeScript checker: https://stryker-mutator.io/docs/stryker-js/typescript-checker/
- Podman run: https://docs.podman.io/en/latest/markdown/podman-run.1.html
- Nushell stdout/stderr/exit codes: https://www.nushell.sh/book/stdout_stderr_exit_codes.html
- mise tasks: https://mise.jdx.dev/tasks/
