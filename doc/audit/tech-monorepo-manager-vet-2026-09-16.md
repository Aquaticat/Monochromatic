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
`93965544ecfaae75f635465fbeb32fa6ab8f19696624723bf0f71456f5586470`.
Superseded fingerprints,
newest first,
none of which had candidate screening evidence:

- `39dc93902e80f8a713cf55d3a0d2b6ff24651344785f88c5a75ec6fabc5d36c6`,
   before the user clarified that documentation structure is part of the documentation gate;
- `8f69b0cf08360061800fa6b0d8197fb8c20e22171d23d191348bc3c296cc01d4`,
   before the user added the documentation gate;
- `cafbebe56ed9aa8f5ed2dc0f500fa351c79754fcdd56dd4632b38e7626fe0898`,
   before the user allowed Meta Package Manager to own OS package provisioning;
- `340bcda696599b81be2d3314af769ed3c774d3914ad724a32f148d9d975eec89`,
   before the user added the control requirement.

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

- FE01 Configuration that expresses the generation and enforcement rules,
   with author control over sequencing and parallelism.
   The user stated on 2026-09-16 that the configuration does not have to be TypeScript;
   file-enforcer's direct TypeScript execution is incumbent behavior,
   not a requirement.
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

### Delegation of FE18 and FE19

The user allowed Meta Package Manager to replace FE18 and FE19 on 2026-09-16.
Meta Package Manager `v7.6.1` ships adapters for every manager FE18 dispatches to:
`apk.py`,
`apt.py`,
`dnf.py`,
`homebrew.py`,
`pacman.py`,
`scoop.py`,
`winget.py`,
`zypper.py`,
and `choco.toml`
(`gh api 'repos/kdeldycke/meta-package-manager/contents/meta_package_manager/managers?ref=v7.6.1'`).

Parity items not yet checked:
privilege escalation,
the binary-name to per-manager package-name mapping that FE19's index supplies,
such as `rg` to `ripgrep`,
and the check-before-install behavior.
Version enforcement gaps are recorded in
[`tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md`](tech-mpm-and-pnpm-as-a-mise-replacement-vet-2026-09-12.md);
FE18 records no versions either.

### Watch plus inspection pattern

- WR1 A persistent watch process keeps task outputs up to date after source changes.
- WR2 Another process can ask the running watch process what it is doing,
   covering at least current and recent activity,
   through a documented RPC or IPC channel.
- WR3 Through the same channel,
   another process can control the running watch process,
   at least starting or rerunning work and cancelling running work.

## Frozen hard constraints

- HC1 Every FE item is available natively or through a documented extension mechanism,
   except FE18 and FE19,
   which may be delegated to Meta Package Manager.
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
- HC7 Official documentation covers every consumed feature in a structure a reader can navigate.
   The user added this gate on 2026-09-16:
   cull wildly underdocumented candidates early.
   The user then clarified with moon screenshots that incoherent documentation structure counts,
   not only missing pages.

### HC7 screening test

Recorded operationalization,
open to user correction.
Official documentation means the project's own docs site,
reference pages,
or repository docs.
A feature named only in a changelog,
issue,
blog post,
or source code counts as undocumented.

Coverage:
a candidate exits when its official documentation lacks any of:

- a configuration reference;
- a CLI or API reference for the commands this repository would run;
- behavior-level documentation for each native surface it would supply for WR1,
   WR2,
   or WR3;
- documentation of the extension mechanism it would host plugged-in FE items through.

Structure:
a candidate exits when a reader starting from the documentation's own navigation cannot predictably reach
the behavior of a consumed feature.
Signals recorded during the check:

- index or overview pages whose entries lack usable summaries,
   such as descriptions cut off mid-sentence or entries that show only a child count;
- navigation sections that list unrelated kinds of pages as flat siblings with no grouping by purpose;
- one consumed feature spread across several sections without a page that ties them together;
- current documentation that depends on a separately frozen version for consumed behavior;
- a page whose description of what a command does contradicts its own documented defaults,
   so following the description produces surprising behavior;
- consumed behavior that users can learn only by asking maintainers in chat,
   such as Discord,
   instead of from official documentation.

Signals that do not prevent reaching a consumed feature's behavior lower the weight-5 documentation quality score
instead of removing the candidate.

### User-directed exclusions

- moon:
   excluded on 2026-09-16 by the user's judgment that its documentation is wildly underdocumented
   and structurally hostile to readers.
  Evidence is the user's screenshots of `moonrepo.dev` on 2026-09-16:
  - the Commands overview shows summaries cut off mid-sentence,
     such as "will generate and serve a visual graph of",
     and the `daemon`,
     `docker`,
     `extension`,
     `query`,
     and `sync` entries show only an item count;
  - the Guides menu lists continuous integration,
     code owners,
     daemon,
     Docker integration,
     extensions,
     MCP integration,
     offline mode,
     remote caching,
     Renovate,
     terminal notifications,
     WASM plugins,
     webhooks,
     and VCS hooks as flat siblings;
  - a banner states that the documentation is for moon v2 and that v1 documentation is frozen elsewhere.
- moon,
   user-reported experience:
   deleting almost all caches required `moon clean` with a lifetime of 1 second,
   the behavior was unexpected,
   and the user had to ask the primary developer on Discord.
  Current source `moonrepo/moon` `website/docs/commands/clean.mdx`,
   last changed in `2ef35f144` on 2026-02-18,
   says the command "can be used to reset the workspace entirely",
   while its option list gives `--lifetime` a default of "7 days" without connecting the two.
  The same page labels `--all`,
   "Clean all cached items and reset state",
   as added in 2.0.0.

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
   every FE item except FE14,
   FE15,
   FE18,
   and FE19 is native,
   and WR1,
   WR2,
   and WR3 are native.
   FE14 and FE15 are repository-specific policies,
   which the user classifies as pluggable by definition;
   Tier A still requires a documented extension mechanism that can express them.
   FE18 and FE19 belong to Meta Package Manager when delegated.
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

### Early WR evidence recorded before the candidate ledger

Collected 2026-09-16 while discovery ran;
each tool still needs discovery provenance and full screening.

- Bazel `8e90a0d`:
   no native watch command;
   `CommandServer` exposes `Run`,
   `Cancel`,
   `UpdateTerminalSize`,
   and `Ping`;
   one command at a time per output base.
  `ibazel` v0.33.0 reports outward only.
  Details in `doc/research/bazel-migration-dx.md`.
- Tilt v0.37.7,
   released 2026-08-15,
   repository pushed 2026-09-14:
   `internal/cli/` contains `trigger`,
   `get`,
   `describe`,
   `enable`,
   `disable`,
   `wait`,
   and `logs` commands.
  `tilt trigger` posts to the running Tilt process's HTTP API
   (`internal/cli/trigger.go:61-63`).
  A GitHub code search for `cancel update` returned no files;
   that search does not prove cancellation is absent.
- Gradle Tooling API documentation
   (<https://docs.gradle.org/current/userguide/tooling_api.html>)
   covers running builds,
   cancelling a running build,
   and progress events,
   but does not mention continuous build through the Tooling API
   or connecting to a build started by another process.
- Nx daemon reference
   (`nrwl/nx` `astro-docs/src/content/docs/reference/nx-daemon.mdoc:9-24,60,109-110`):
   the daemon watches workspace files to keep project graph data current,
   clients reach it through a Unix socket,
   `nx daemon` prints its process ID and log path,
   and the socket is described as a remote for code execution.
  The page documents no client protocol for outside tools and no task control through the daemon.

### Query ledger

Pending.

### Candidate ledger

Pending.
