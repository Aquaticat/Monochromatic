# Monorepo manager vet report

Status:
in progress.

Lifecycle phase:
context and rubric frozen;
discovery pending.

Subject:
Monorepo manager.

Decision scope:
select a monorepo manager for Monochromatic that provides every file-enforcer functionality and a watch mode with an RPC or
IPC inspection and control channel,
natively or through documented extension,
before plugging functionality into a tool or building a Bazel replacement.

Start date:
2026-09-16.

Last updated:
2026-09-16.

Governing skill commit:
`a05818ad70a40e5769a36de669697ba109891b31`.

Governing skill SHA-256:
`393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
`cafbebe56ed9aa8f5ed2dc0f500fa351c79754fcdd56dd4632b38e7626fe0898`.
It supersedes `340bcda696599b81be2d3314af769ed3c774d3914ad724a32f148d9d975eec89`,
recorded before the user added the control requirement and before any candidate evidence was collected.

Active audit owner:
Claude Code session `e28ad59c-f3f5-46e9-8c8c-59a61c331610`.

Prior compatible report:
none.
Related but incompatible:
[`tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md`](tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md)
covers tool provisioning and task execution without the file-enforcer or inspection requirements.
[`bazel-migration-dx.md`](../research/bazel-migration-dx.md) is a single-candidate research note.

## Context

Measured on 2026-09-16:

- Incumbent task runner:
   Mise `2026.9.5` on Linux x64,
   1,825 tasks,
   0 with `sources` or `outputs`.
- Incumbent generation and enforcement:
   `@monochromatic-dev/dev-script-file-enforcer`,
   workspace source.
- Workspace:
   176 `package.json`,
   19 `Cargo.toml`,
   Gradle Kotlin DSL builds under `package/music-player/android-app/` and `package/linter/kotlin/`,
   Zig `0.15.2`.
- One active author;
   GitHub Actions CI is being expanded.
- The user states insufficient Mise documentation as the reason to migrate.

Requirements source:
`doc/planning/mise-removal-coverage.md`,
section "Monorepo manager hard requirements".

## Requirement checklist

### File-enforcer functionality

Derived from exports in `package/dev-script/file-enforcer/src/index.ts` and the CLI in `src/cli.ts`,
not from the package README,
which predates the current source layout.

- FE01 TypeScript configuration executed directly with top-level `await`;
   the author controls sequencing and parallelism.
- FE02 CLI discovers `file-enforcer.config.ts` upward from the working directory.
- FE03 File and glob reads with glob provenance:
   `cat`,
   `globResults`,
   `expandGlob`.
- FE04 In-memory read cache with targeted invalidation:
   `readCache`,
   `readCached`,
   `updateCache`,
   `invalidatePaths`.
- FE05 Writes that skip identical content and replace atomically:
   `overwrite`,
   `readExisting`,
   `src/io/write-atomic.ts`.
- FE06 Create-only atomic writes:
   `overwriteIfNotExists`.
- FE07 Glob mirroring with positional wildcard substitution:
   `overwriteEach`,
   `mirrorGlobPath`.
- FE08 Lazy content builders skipped when captured inputs are unchanged.
- FE09 Persistent staleness manifest with content hashes,
   glob expansions,
   destination metadata,
   and a cross-process lock with owner recovery
   (`src/io/staleness-*.ts`).
- FE10 JSON transforms:
   parse,
   format,
   flat merge,
   default merge,
   key omission,
   property path lookup.
- FE11 TOML reads and comment-preserving splice edits:
   `getTomlProperty`,
   `editTomlKey`,
   `overwriteTomlKey`.
- FE12 XML entry listing,
   lookup,
   replace-or-insert,
   and attribute escaping.
- FE13 Line deduplication:
   `dedup`.
- FE14 Cargo manifest enforcement plans:
   `manageCargoManifests`.
- FE15 JetBrains LSP4IJ settings management and options-directory discovery.
- FE16 Command execution with captured output:
   `exec`.
- FE17 Platform dispatch through ordered,
   nestable predicate commands with per-session cached evaluation:
   `exec(platformCommands)`,
   `evaluatePredicate`.
- FE18 OS package provisioning across apt,
   dnf,
   pacman,
   apk,
   zypper,
   brew,
   winget,
   scoop,
   and choco,
   with privilege detection:
   `ensurePackage`,
   `detectManager`,
   `canProvide`,
   `installPackage`.
- FE19 Package index generated from Repology plus hand-maintained overrides:
   `p`,
   `mergeOverrides`,
   `registerPackages`,
   `src/package/mise.generate-index.ts`.
- FE20 Read,
   write,
   glob,
   and timestamp tracking API:
   `trackRead`,
   `trackDest`,
   `trackGlob`,
   `captureTrackedSources`,
   `addWatchedPaths`.
- FE21 Watch mode rerunning the configuration when tracked sources change
   (`--watch`,
   `startWatching`).
- FE22 Protected destinations:
   external edits to managed outputs are reverted and reported through a desktop notification
   (`src/watch/watch.ts:28-29`,
   `src/watch/notify.ts`).
- FE23 Watch echo suppression from recorded write timestamps,
   debounced batched reruns,
   and watcher restart supervision
   (`src/watch/watch-rerun-queue.ts`,
   `src/watch/watch-supervisor.ts`).
- FE24 Tagged structured logging.

### Watch plus inspection pattern

- WR1 A persistent watch process keeps task outputs up to date after source changes.
- WR2 Another process can ask the running watch process what it is doing,
   covering at least current and recent activity,
   through a documented RPC or IPC channel.
- WR3 Through the same channel,
   another process can control the running watch process,
   at least starting or rerunning work and cancelling running work.

## Frozen hard constraints

- HC1 Every FE item is available natively or through a documented extension mechanism.
- HC2 WR1 is available natively or through a documented extension mechanism.
- HC3 WR2 and WR3 are available natively or through a documented extension mechanism.
- HC4 Inspectable open-source local execution.
- HC5 Works on repository-supported local and CI platforms:
   Linux x64 development,
   GitHub-hosted Linux,
   macOS,
   and Windows runners.
- HC6 Runs arbitrary command tasks for TypeScript,
   Rust,
   Kotlin with Gradle,
   and Zig workspace packages.

## Components and overlays

Base category:
inspectable open-source local technology.
A candidate with a hosted control plane receives a second managed-service classification for that component.

Overlays:

- incumbent dependency replacement;
- high-trust execution in developer-machine and CI boundaries;
- native,
  Wasm,
  prebuilt binary,
  or generated-code boundary;
- multi-platform claim.

## Tiering from the stated fallback order

The user's order is lexicographic and sits outside score arithmetic:

1. Tier A:
   FE,
   WR1,
   WR2,
   and WR3 all native.
2. Tier B:
   some requirement is met only by plugging functionality into the tool through a documented extension mechanism.
   Each plugged item records the extension point and what must be built.
3. Tier C:
   no tool qualifies and plugging is judged too hard;
   the user would consider building a Bazel replacement.

No fix difficulty is estimated for unbuilt plug-ins.

## Frozen soft criteria

Weights are 1 unless a stated preference sets them.

- Documentation quality for consumed features,
  weight 5,
  because insufficient documentation is the stated reason for leaving Mise.
- Native requirement coverage within a tier,
  weight 1.
- Watch inspection and control depth,
  weight 1.
- Cache correctness and affected-only execution,
  including input enforcement,
  weight 1.
- Community and ecosystem,
  weight 1.
- Maintenance evidence,
  weight 1.
- Polyglot repository fit,
  weight 1.
- Migration surface from Mise,
  weight 1.
- Human auditability,
  weight 1.

## Unresolved preferences

- Whether control must extend beyond starting,
  rerunning,
  and cancelling work.
- Whether an undocumented but inspectable internal protocol can satisfy WR2.
- Relative weight of community size;
  the user raised it without a magnitude.

## Discovery protocol

### Frozen query schedule

Registry and ecosystem index queries:

- npm registry search API,
   `text=keywords:monorepo`,
   popularity-weighted,
   250 per page.
- npm registry search API,
   `text=keywords:build-system`.
- npm registry search API,
   `text=keywords:task-runner`.
- crates.io API,
   `q=build system`,
   sorted by downloads,
   100 per page.
- crates.io API,
   `q=task runner`.
- crates.io API,
   `q=monorepo`.
- `https://monorepo.tools` tool comparison.
- `korfuri/awesome-monorepo` README build-tool sections.

Repository-host queries:

- `gh search repos --topic monorepo --sort stars`,
   100 per page.
- `gh search repos --topic build-system --sort stars`.
- `gh search repos --topic build-tool --sort stars`.
- `gh search repos --topic task-runner --sort stars`.
- `gh search repos "watch mode" daemon build --sort stars`.

Broader web queries:

- `monorepo build tool daemon watch mode API inspect running tasks`
- `build system daemon status command show running actions`
- `Bazel alternative monorepo build system 2026`
- `Nx alternative monorepo task runner`
- `Turborepo alternative`
- `task runner watch mode HTTP API status`
- `monorepo tool code generation keep generated files in sync`
- `incremental build system file watcher keeps outputs up to date continuously`

Repository queries:

- Mise configuration and `mise watch` use;
- file-enforcer source;
- prior reports and plans:
   `tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md`,
   `mise-keep-vs-build-own.md`,
   `mise-removal-coverage.md`,
   `bazel-migration-dx.md`;
- `rg` for turbo,
   nx,
   moon,
   wireit,
   lage,
   rush,
   tilt,
   buck2,
   pants,
   gradle,
   nadle.

Expansion round:
pending taxonomy collection.

### Query ledger

Pending.

### Candidate ledger

Pending.
