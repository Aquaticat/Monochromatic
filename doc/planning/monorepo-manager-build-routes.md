# Monorepo manager build routes

## Status and scope

- Status:
   proposal;
   no route is chosen.
- Requested 2026-09-16:
   compare extending Bazel against building a replacement from scratch.
- Scope:
   documentation only;
   no code,
   no installs,
   and no effort or duration estimates.
- Evidence sources:
   [`tech-monorepo-manager-vet-2026-09-16.md`](../audit/tech-monorepo-manager-vet-2026-09-16.md),
   [`bazel-migration-dx.md`](../research/bazel-migration-dx.md),
   [`mise-removal-coverage.md`](mise-removal-coverage.md),
   and repository package READMEs.

## Why building

The vet screened 732 entries and re-screened 21 after the user counted external wrappers as plugging in.
No candidate passed.
Candidates that documented pieces of inspection or control,
such as Tilt,
pitchfork,
devtooie,
and Rush through a plugin,
exited on documentation confusion triggers,
as did every candidate with complete documentation coverage.
The user's remaining fallback is building a Bazel replacement;
the user then asked whether Bazel itself can be bent to the requirements.

## Requirements recap

The authoritative checklist is the vet report,
sections "Requirement checklist" and "Frozen hard constraints".

- File-enforcer functionality,
   FE01 to FE24:
   FE14 and FE15 are pluggable by definition,
   FE18 and FE19 may be delegated to Meta Package Manager,
   and the configuration does not have to be TypeScript.
- WR1:
   a persistent watch process keeps task outputs up to date.
- WR2 and WR3:
   another process inspects and controls the running watch process through a documented RPC or IPC channel;
   control covers at least starting,
   rerunning,
   and cancelling work.
- Documentation readable without confusion,
   without JavaScript,
   and without strict bot blocking.
- Tasks for TypeScript,
   Rust,
   Kotlin with Gradle,
   and Zig packages.

## Existing repository assets

Both routes can reuse these;
their READMEs define current scope.

- `@monochromatic-dev/dev-script-file-enforcer`:
   the incumbent for FE01 to FE24,
   including watch mode,
   protected destinations,
   the persistent staleness manifest,
   and the tracking API.
- `@monochromatic-dev/dev-script-watch-restart`:
   watches source files and restarts one long-running child process;
   it replaced `watchexec` in one dev loop.
- `@monochromatic-dev/dev-script-task-util`:
   task helpers,
   including a `tsc` wrapper and an `oxlint` wrapper that preserves findings and exit status.
- `@monochromatic-dev/mcp-stdio`:
   JSON-RPC 2.0 over newline-delimited stdin and stdout.
  A watch daemon that other processes connect to needs a different transport;
   this package covers message framing only for stdio.
- Meta Package Manager `v7.6.1`:
   adapters for every package manager FE18 dispatches to.

## Route A: Bazel extension layer

### Reused from Bazel

- Declared-input actions with sandboxing:
   Bazel's sandbox "prevents the action from accidentally using any input files that are not declared"
   (`docs/docs/sandboxing.mdx:70-75` in the Bazel source).
- Live build events:
   the Build Event Protocol is documented for third-party insight into an invocation,
   and `--bes_backend` streams events to any server implementing the public
   `google/devtools/build/v1/publish_build_event.proto` service
   (`docs/remote/bep.mdx`).
- Orderly cancellation:
   exit code 8 documents an interrupted build with orderly shutdown
   (`docs/run/scripts.mdx:53`).
- Generated files in the source tree:
   bazel-lib `write_source_files` updates checked-in files and generates a `diff_test` that fails on drift.
- Dependency sources:
   rules_js reads `lockfileVersion: '9.0'`;
   rules_rust keeps `Cargo.toml` as the dependency source;
   rules_zig supports Zig 0.15.2.

### Built by the repository

- A watch daemon replacing `ibazel`,
   which reports outward only.
- The documented inspection and control RPC,
   backed by a local Build Event Service endpoint.
  Bazel's own client-to-server `Run` and `Cancel` protocol appears only in contributor docs
   (`docs/contribute/codebase.mdx:87-91`),
   so the daemon owns the `bazel` client process instead.
- A second `--output_base` for queries during builds,
   because one Bazel server handles one invocation at a time
   (`docs/run/client-server.mdx:12-14`).
- File-enforcer logic rewritten as Bazel actions with declared inputs,
   plus protected-destination reverts,
   which `write_source_files` does not perform.
- Rule wrappers for tools without Bazel support:
   oxlint including JS plugins and type-aware mode,
   tsdown,
   rolldown,
   and cargo-nextest.

### Inherited gaps

- Bazel exited the vet on the confusion rule:
   `https://bazel.build/docs/configurable-attributes` links "Configurable Build Attributes" to two different URLs.
- rules_android describes itself as an incomplete development preview,
   so the Gradle Android app becomes a port.
- rules_ts expects dependencies to provide `.d.ts` files,
   which conflicts with `/ts` source imports.
- The JetBrains Bazel plugin covers Java and Kotlin only.
- Native pnpm 12 support in rules_js is unreleased as of v3.4.1.

### Pros

- Sandbox-enforced inputs make affected-only lint and test caching resistant to undeclared-input stale hits.
- A mature local and remote cache is available as CI is added.
- Live build events are a documented,
   public protocol.

### Cons

- Every Bazel-facing interaction uses documentation the user's rule rejected.
- The repository still builds the watch daemon,
   the RPC,
   and file-enforcer actions.
- Tool coverage requires new wrappers,
   an Android port,
   and a change to `.ts` source imports.

## Route B: From-scratch replacement

### Reused from the repository

- File-enforcer as-is for FE01 to FE24,
   including its watch loop and staleness manifest.
- Native tool invocation as Mise tasks use today:
   Cargo,
   Gradle,
   Zig,
   tsdown,
   and oxlint through `task-util`,
   with no rulesets.
- `watch-restart` for long-running child processes.
- Meta Package Manager for FE18 and FE19.

### Built by the repository

- A workspace and project model with a task graph,
   replacing Mise task configuration and the Node fanout scripts in `mise.no-env.toml`.
- A content-hash task cache with declared inputs.
- A watch daemon that reruns affected tasks.
- The documented inspection and control RPC and its transport.
- User-facing documentation meeting the confusion,
   no-JavaScript,
   and no-bot-blocking rules.

### Pros

- Documentation quality is under repository control.
- No Bazel ruleset gaps:
   tools keep their native build systems,
   including Gradle for Android.
- `/ts` source imports and file-enforcer's model stay unchanged.

### Cons

- Nothing enforces declared inputs unless the repository builds enforcement,
   so stale cache hits from undeclared inputs remain possible.
- Remote caching and execution for CI do not exist unless built.
- The task graph,
   scheduling,
   and caching that Bazel already provides are rebuilt.

## Ranking

Route B over Route A.
The two requirements that eliminated every market tool,
readable documentation and watch with inspection and control,
are repository-built in both routes.
What remains of Route A's advantage is Bazel's task graph,
sandboxed cache,
and build events;
against that,
Route A also inherits documentation the user rejected,
an Android port,
missing oxlint,
tsdown,
rolldown,
and cargo-nextest rules,
and a conflict with `/ts` source imports.

The strongest counterpoint is cache correctness:
if sandbox-enforced inputs or a mature remote cache for the new CI become hard requirements,
Route A gains the capability Route B would have to build,
and the ranking can flip.

## Open questions

- Must the task cache enforce declared inputs,
   or is declaration without enforcement acceptable?
- Is a shared remote cache between local runs and CI required?
- Which transport should the inspection and control RPC use:
   a local socket,
   HTTP on loopback,
   or both?
- Which platforms must the daemon support under HC5,
   given Fedora development and macOS and Windows CI runners?
- Does the Mise removal ledger keep tool provisioning,
   environment,
   and secrets outside the monorepo manager in both routes?

## Next action

The user chooses a route or answers the open questions that could flip the ranking.
A design document for the chosen route follows;
no code is written before that.
