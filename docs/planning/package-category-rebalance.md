# Plan: package category rebalance

Status:
 decided roadmap,
 partially executing.
The `current-time-context` shared formatter path move has landed under
`packages/agent-harness-shared/current-time-context`.
Remaining package moves are recorded as decisions and sequencing.

This plan explains how to apply the Rush-style two-level category model to this monorepo,
then records the decided package-set rebalances and their sequencing.
It is written for a reader who has not seen the repository before.

## Executive summary

The repository should keep the invariant:

```text
packages/<category>/<project>
```

The important word is **category**.
The first segment is not always an artifact type such as `cli`,
 `module`,
 or `webapp`.
It can also be a product or subsystem owner when several buildable units share one product identity.

That means this is good:

```text
packages/music-player/
  desktop-app/
  android-app/
  native-core/
```

This is clunkier because shared product code has no natural owner:

```text
packages/desktop-app/music-player/
packages/android-app/music-player/
packages/module/music-player-core/
```

The plan recommends these near-term moves;
the decision state section gives each one a status and a first action.

- Keep `packages/claude-code-plugins/*` as the template for a healthy product or host cluster.
- Keep `packages/agent-harness-shared/*` for utilities shared by multiple agent harnesses;
  `current-time-context` lives there now.
- Add a shared native core to `packages/music-player/*`,
   starting with `truepeak`.
- Build a `packages/mvm/*` product cluster:
   extract a core first,
   then move paths.
- Build a `packages/oxlint/*` subsystem cluster from `config/oxlint`,
   `oxlint-plugin/*`,
   and the oxlint fixture packages.
- Build a `packages/done/*` product cluster (`app` plus `variant-postcss`),
   keeping `done-postcss`.
- Build a `packages/forbidden-strings/*` product cluster from `cli/forbidden-strings` and `fuzz/forbidden-strings`.
- Keep `packages/pi-shared/*` as a deliberate extension-versus-infrastructure boundary;
   do not fold it into `pi`.
- Keep broad independent utility buckets such as `module`,
   `config`,
   `dev-script`,
   `shim`,
   and `stub` broad.

## Decision state

Most package sets below are a near-term go.
The `agent-harness-shared/current-time-context` move has landed;
remaining entries document the roadmap.

- `claude-code-plugins`:
  keep as-is;
  first action is the Phase 1 cleanup of its non-package directories.
- `music-player`:
  proceed;
  first action is extracting `native-core`,
  starting with `truepeak`.
- `mvm`:
  proceed;
  first action is extracting a `core` so `mcp` stops importing `cli` internals,
  then the path move.
- `oxlint`:
  proceed;
  first action is moving one plugin and its fixture,
  probably `tsdoc`.
- `done`:
  proceed;
  first action is moving the canonical app to `packages/done/app` and `done-postcss` to `packages/done/variant-postcss`.
- `forbidden-strings`:
  proceed;
  first action is moving its cli and fuzz crates into `packages/forbidden-strings/{cli,fuzz}`.
- `pi-shared`:
  keep;
  affirmed as an extension-versus-infrastructure boundary,
  not folded into `pi`.
- broad utility buckets (`module`,
   `config`,
   `dev-script`,
   `shim`,
   `stub`):
  keep broad;
  move a member out only when a product owns it.

## Why this plan exists

The package layout currently mixes two category styles:

- Artifact-type categories:
  `cli`,
   `module`,
   `config`,
   `mcp`,
   `dev-script`,
   `webapp-productivity`.
- Product or subsystem categories:
  `music-player`,
   `claude-code-plugins`,
   `figma`,
   `pi`.

Both styles are valid.
The problem appears when a product spans several artifact types.
The `music-player` product has a desktop app,
 an Android app,
 Rust engine code,
 Kotlin logic,
and obvious shared native-code opportunities.
If the desktop and Android apps lived under separate artifact categories,
shared code would have to live somewhere distant and artificial.

The plan below treats a category as the **ownership boundary** for code sharing.
Use artifact-type categories only when packages are genuinely unrelated except for artifact type.
Use product or subsystem categories when packages are adapters,
 variants,
 plugins,
 fixtures,
 or shared cores for
one product or host.

## Rush precedent

This layout is based on Rushstack's category-folder model.
The primary source is `microsoft/rushstack` at commit `0e46b84a4f62134298365f49bbe03b609ab09f7e`.
In `rush.json`,
 Rushstack recommends that buildable project folders be exactly two levels below the repository root;
the parent folder acts as the category.
It gives examples such as `apps`,
 `libraries`,
 `tools`,
 and `prototypes`.
The same file sets:

```json
"projectFolderMinDepth": 2,
"projectFolderMaxDepth": 2
```

Source:
`https://github.com/microsoft/rushstack/blob/0e46b84a4f62134298365f49bbe03b609ab09f7e/rush.json#L81-L99`.

Rush enforces the policy in `RushConfigurationProject.ts` by rejecting project folders shallower or deeper than
configured.
Source:
`microsoft/rushstack` commit `0e46b84`,
`libraries/rush-lib/src/api/RushConfigurationProject.ts`,
lines 223 to 235.

The key lesson is not the literal folder name `packages`.
Rush measures depth from the repository root;
this repository's enforced shape is `packages/` plus a fixed two-level category and project model.
The lesson is that depth stays fixed,
 and category names are periodically rebalanced through discussion.
At the cited commit,
Rushstack's category set includes `apps`,
 `libraries`,
 `build-tests`,
 `heft-plugins`,
 `rush-plugins`,
`rigs`,
 `vscode-extensions`,
 and others.
That proves the first segment can be a product area,
 a plugin host,
 a test family,
 or a tool family.

## Current repository constraints

### Workspace and task roots

Current measured state from the active tree:

- `packages/` contains 27 direct category directories,
  but one (`packages/android-app/`) is an empty directory that shadows the `music-player/android-app` project name,
  so the live category count is effectively 26;
  Phase 1 removes it.
- `packages/` contains 105 directories with `package.json`.
- `packages/` contains 109 directories with `mise.toml`.
- `packages-deprecated/` contains 1 package directory.
- `packages-paused/` contains 11 package directories.

Important nuance:
not every `packages/*/*` directory is an npm workspace package.
Some are Rust,
 Gradle,
 or tooling islands with `mise.toml` but no `package.json`.
Those are still active project roots for this repository.

The active non-`package.json` project roots are:

- `packages/cli/forbidden-strings`
- `packages/desktop-app/terminal`
- `packages/fuzz/forbidden-strings`
- `packages/linter/rust`
- `packages/music-player/android-app`
- `packages/music-player/desktop-app`

The active `packages/*/*` directories without `package.json` and without `mise.toml` are:

- `packages/claude-code-plugins/research-agent`
- `packages/claude-code-plugins/statusline`
- `packages/claude-code-plugins/verbose-tool-output`

Before changing layout,
read these files as the current source of truth:

- `pnpm-workspace.yaml`:
  declares `packages/*/*` and `packages-deprecated/*/*` as pnpm workspace globs.
- `mise.no-env.toml`:
  declares `packages/*/*` as active mise config roots,
  sets `task.monorepo_depth = 3`,
  and intentionally excludes `packages-deprecated/*/*` from the active task graph.
- `file-enforcer.config.ts`:
  generates `mise.toml` and scans `packages/*/*/node_modules/.bin` for PATH entries.
- `packages/claude-code-plugins/source/src/handlers/session-start-housekeeping.ts`:
  scans `packages/*/*/dist/final` for cleanup.

Verified task names for common migration cleanup:

- `mise run //:sync:files`
- `mise run //:prepare:pnpm:install`
- `mise run //:lint:markdown`

The task-name check was run with `mise tasks --all --hidden --json`.

### Inventory provenance

These counts and dependency facts drift as packages move,
so reverify them before acting on this plan.

- Verified at commit `7654b1b` on 2026-06-15.
- Counts:
  `find packages -mindepth 3 -maxdepth 3 -name package.json` and the same for `mise.toml`;
  `find packages -mindepth 1 -maxdepth 1 -type d` for categories.
- Tasks:
  `mise tasks --all --hidden --json`.
- Dependency direction:
  each package's `package.json` `dependencies`,
  plus Rust `Cargo.toml` `path` dependencies.

### Status trees

The repository has separate trees for package lifecycle state:

- `packages/`:
  active projects.
- `packages-deprecated/`:
  packages that remain installable or referenceable but are no longer maintained.
- `packages-paused/`:
  packages intentionally removed from active workspace and task fanout.

Do not solve status by inventing category names such as `old`,
 `paused`,
 or `deprecated` under `packages/`.
Use the status trees.

## Category ownership reference

Every first-level category and the ownership boundary it represents.
This list is the per-category explanation the acceptance criteria require;
keep it current whenever a category is added or removed.

Product,
 host,
 domain,
 and subsystem categories:

- `claude-code-plugins`:
  the Claude Code plugin host cluster;
  `source` and `hook-types` own shared runtime and protocol types,
  the rest are per-plugin shims.
- `music-player`:
  the music-player product;
  desktop and Android apps today,
  with a shared native core proposed below.
- `pi`:
  extensions for the Pi coding agent.
- `pi-shared`:
  reusable Pi-extension infrastructure (currently only `model-selection`);
  a deliberate extension-versus-infrastructure boundary,
  kept separate from `pi`.
- `agent-harness-shared`:
  utilities shared by multiple agent harness hosts;
  category name follows the shared suffix convention for cross-host agent infrastructure.
- `figma`:
  domain pipeline that parses Figma export formats and converts them to Penpot.
- `webapp-productivity`:
  productivity web apps;
  loses `done` and `done-postcss` to the new `done` cluster per this plan,
  keeping the other productivity apps.
- `webapp-content`:
  content web apps;
  a static-site blog generator and a messages demo.
- `audit`:
  design-audit references for external sites.
- `typeface`:
  custom fonts.
- `intellij-plugin`:
  themes and plugins for JetBrains IDEs.

Artifact-type and utility categories:

- `cli`:
  independent command-line tools,
   unrelated except for being CLIs;
  `cli/mvm` and `cli/forbidden-strings` leave for their product clusters per this plan.
- `mcp`:
  Model Context Protocol servers;
  `mcp/mvm` leaves for the `mvm` cluster per this plan,
  leaving shared `mcp/stdio`.
- `module`:
  broad bucket of host-neutral general-purpose TypeScript utilities not owned by an agent-harness shared category.
- `config`:
  host-neutral tool presets,
   for example TypeScript,
   tsdown,
   dprint,
   stylelint,
   cosign,
   tofu;
  `config/oxlint` moves into the `oxlint` subsystem per this plan.
- `build-tool`:
  build pipelines authored here,
   currently the cross-package CSS bundler.
- `dev-script`:
  repository automation that serves the repository itself.
- `linter`:
  linters authored here for non-TypeScript languages,
   currently Rust.
- `oxlint-plugin`:
  custom oxlint plugins;
  moves into the new `oxlint` subsystem cluster per this plan.
- `rolldown-plugin`:
  custom Rolldown bundler plugins.
- `runtime-error`:
  scripts that deliberately trigger runtime errors for error-handling tests.
- `fuzz`:
  fuzz-test harnesses for other packages;
  its only member,
   `fuzz/forbidden-strings`,
   moves into the `forbidden-strings` cluster per this plan,
  retiring the category.
- `test-fixture`:
  cross-cutting fixture packages consumed by other packages' tests;
  the `oxlint-*` fixtures leave for the `oxlint` cluster per this plan.
- `desktop-app`:
  standalone desktop apps not owned by another product,
   currently a terminal.
- `desktop-daemon`:
  long-running local desktop background services.
- `shim`:
  drop-in replacements for third-party packages,
   wired through pnpm `link:` overrides.
- `stub`:
  minimal stand-in implementations for dependency management.

Planned new categories,
 created by this plan and not present yet:

- `mvm`,
   `oxlint`,
   `done`,
   `forbidden-strings`:
  product or subsystem clusters;
  each owns its adapters,
   core,
   plugins,
   or fixtures together.

Status note:

- `android-app`:
  empty leftover directory that shadows the `music-player/android-app` project name;
  not a real category,
  removed in Phase 1.

## Terms used in this plan

### Category

The first segment under `packages/`.
It is the ownership and grouping boundary.
Examples:
`music-player`,
 `claude-code-plugins`,
 `module`,
 `config`,
 `mvm`,
 `oxlint`.

### Project

The second segment under `packages/`.
It is a buildable or task-addressable unit.
It may be an npm package,
 a Rust crate,
 a Gradle project,
 a fixture package,
 or a mise-only tool root.

### Adapter

A project that exposes a shared core through one host or interface.
Examples:
CLI adapter,
 MCP adapter,
 Pi extension,
 Claude Code plugin shim,
 Android app shell.

### Core

A project that owns shared logic consumed by multiple adapters or apps.
Examples:
`claude-code-plugins/source`,
 future `music-player/native-core`,
 future `mvm/core`.

### Variant

A project that implements the same product against a different framework,
 renderer,
 build pipeline,
 or experiment.
Example:
`done-postcss` is a PostCSS comparison variant of `done`.

### Fixture

A project or data tree that exists to test another package.
Fixtures should live near their owner when the owner is clear.
Use `test-fixture` only for fixtures that are intentionally cross-cutting or package-like on their own.

## Category decision rules

### Rule 1: category by ownership, not by file extension

Choose the first segment by asking:

> Who owns this code and what other project must change with it?

If several packages always move together,
they belong under the same category even if they produce different artifacts.

### Rule 2: product clusters beat artifact buckets

Use a product category when a product has multiple adapters,
 platforms,
 variants,
 or shared internals.

Good:

```text
packages/mvm/
  cli/
  mcp/
  core/
```

Avoid for growing products:

```text
packages/cli/mvm/
packages/mcp/mvm/
packages/module/mvm-core/
```

### Rule 3: host clusters beat generic plugin buckets

If packages are plugins for a specific host,
the host should usually be the category.

Good:

```text
packages/claude-code-plugins/
  source/
  hook-types/
  guardrail/
```

Good:

```text
packages/oxlint/
  config/
  plugin-tsdoc/
  fixture-tsdoc/
```

Less good when the host grows:

```text
packages/config/oxlint/
packages/oxlint-plugin/tsdoc/
packages/test-fixture/oxlint-tsdoc/
```

### Rule 4: keep independent utility buckets broad

Do not cluster every dependency edge.
A shared utility used by unrelated packages belongs in a broad utility category.

Keep broad buckets for:

- `module/*`
- `config/*`
- `dev-script/*`
- `shim/*`
- `stub/*`

A utility should move into a product cluster only when it is conceptually owned by that product and unlikely to make
sense outside it.

### Rule 5: no third-level active packages

Do not create active package roots like:

```text
packages/music-player/shared/native-core/
packages/oxlint/plugins/tsdoc/
```

The tooling is intentionally built around `packages/*/*`.
If a name needs more words,
put them in the second segment:

```text
packages/music-player/native-core/
packages/oxlint/plugin-tsdoc/
```

This rule governs active project roots,
the task-addressable units at `packages/*/*` (`monorepo_depth = 3`).
Build-internal units nested deeper are exempt.
`packages/music-player/android-app/rust` is a `cdylib` crate,
and `packages/music-player/android-app/app` is a Gradle module;
both are owned and built by `android-app`,
are not addressed independently by pnpm or mise,
and so do not count as third-level active packages.
A nested unit must become a `packages/<category>/<project>` root only when it needs independent task identity.

### Rule 6: path migration and package-name migration are separate

Moving a project path does not require renaming the npm package in the same commit.
For example,
`packages/cli/mvm` could move to `packages/mvm/cli` while temporarily keeping
`@monochromatic-dev/cli-mvm`.

Rename package names only after checking:

- whether the package is published or intended to publish,
- whether external docs mention the old name,
- whether root `package.json` or other packages depend on the old name,
- whether a compatibility alias or deprecation package is needed.

Long-term naming inside product clusters should prefer:

```text
@monochromatic-dev/<category>-<project>
```

Examples:

- `@monochromatic-dev/mvm-cli`
- `@monochromatic-dev/mvm-mcp`
- `@monochromatic-dev/music-player-native-core`
- `@monochromatic-dev/oxlint-plugin-tsdoc`

But path clarity matters first.
Do not block a useful path move on a risky package-name rename.

### Rule 7: dependency direction inside clusters

A folder move fixes ownership,
not architecture.
Inside a product or subsystem cluster,
keep dependencies flowing one way:

```text
adapter -> core -> neutral utilities
```

- An adapter (CLI,
   MCP,
   Pi extension,
   plugin shim,
   app shell) depends on its core.
- A core must not depend on any adapter.
- A fixture must not be a dependency of production code unless it is explicitly test-only.
- Config-to-plugin boundaries are documented per subsystem.

This is why the MVM move extracts a core first:
`mcp/mvm` currently imports `cli/mvm` source through `@monochromatic-dev/cli-mvm/ts`,
an adapter depending on another adapter.
It is also why `native-core` must not import platform output or UI crates.

## Recommended target state by package set

The category ownership reference above covers every current category.
The subsections below go deeper on the package sets with a near-term move,
plus the buckets and dependency edges deliberately left unclustered.

### Music-player

#### Current state

Current active roots:

```text
packages/music-player/
  desktop-app/
  android-app/
```

This is already the right category shape.
Both roots are project roots with `mise.toml`,
 but neither is an npm package.
`desktop-app` is a Rust plus Slint app.
`android-app` is a Gradle plus Kotlin app with a nested Rust `cdylib` crate at `android-app/rust`.

Evidence of shared-code pressure:

- `packages/music-player/desktop-app/src/decode.rs`
- `packages/music-player/android-app/rust/src/decode.rs`
- `packages/music-player/desktop-app/src/opus.rs`
- `packages/music-player/android-app/rust/src/opus.rs`
- `packages/music-player/desktop-app/src/truepeak.rs`
- `packages/music-player/android-app/rust/src/truepeak.rs`
- `packages/music-player/desktop-app/src/engine.rs`
- `packages/music-player/android-app/rust/src/engine.rs`

The matching file names are not small.
Measured line totals across the desktop and Android copies were:

- `decode.rs`:
   2,827 lines.
- `opus.rs`:
   1,386 lines.
- `truepeak.rs`:
   1,122 lines.
- `engine.rs`:
   1,805 lines.

The product glossary already recognizes the shared product language:

- `packages/music-player/desktop-app/CONTEXT.md`
- `packages/music-player/android-app/CONTEXT.md`

Relevant cross-platform decisions already apply to both roots:

- `docs/decisions/music-player-android-port.md`
- `docs/decisions/music-player-session-source-root.md`
- `docs/decisions/music-player-live-update-rescan.md`

#### Target shape

Add shared Rust crates under the same product category:

```text
packages/music-player/
  desktop-app/
  android-app/
  native-core/
```

If the shared surface later splits cleanly,
allow more product-owned second-level projects:

```text
packages/music-player/
  native-decode/
  native-truepeak/
  domain-core/
```

Start with `native-core` unless extraction proves the boundaries are already obvious.
One shared crate is easier to migrate than several premature crates.

#### Preconditions

Settled from the current crates:
there is no root Cargo workspace,
`desktop-app` is a standalone crate (edition 2024),
and `android-app/rust` is its own isolated workspace (empty `[workspace]`,
 edition 2021).

- Make `native-core` a standalone crate consumed through a `path` dependency,
  not a Cargo workspace member;
  path dependencies cross the isolation boundary and let it keep its own edition.
- Constrain its dependency profile to codec and DSP crates only,
   for example `symphonia` and `opus`;
  it must not pull `slint`,
   `winit`,
   `jni`,
   `ndk` or AAudio,
   PipeWire,
   `cpal`,
   or any UI crate.
- Give `native-core` its own `cargo test`,
   not only adapter tests.
- For Android,
   run a native build that crosses the Gradle,
   cargo,
   and NDK boundary before declaring an extraction done.
- Document feature flags if desktop and Android need different optional dependencies.

#### What belongs in `native-core`

First candidates:

- codec probing and decode abstractions,
- Opus packet decode glue,
- true-peak measurement,
- shared error types,
- shared audio spec types,
- pure tests and fixtures shared by both app targets.

Later candidates:

- queue and pagination logic if the Rust engine stays authoritative,
- session data model if Android keeps the Rust engine as the source of truth,
- peak cache fingerprint math if Kotlin and Rust versions should converge.

Do not move platform output into `native-core` initially.
Keep these adapter-owned:

- PipeWire output,
- cpal output,
- AAudio output,
- Slint UI,
- Compose UI,
- MediaSessionService integration,
- SAF and MediaStore source enumeration,
- platform-specific persistence glue.

#### Migration sketch

1. Create `packages/music-player/native-core/Cargo.toml` and `src/lib.rs`.
2. Move one pure module first,
   probably `truepeak.rs`,
   because it is pure DSP and has clear tests.
3. Add path dependencies:

   ```toml
   # packages/music-player/desktop-app/Cargo.toml
   music-player-native-core = { path = "../native-core" }
   ```

   ```toml
   # packages/music-player/android-app/rust/Cargo.toml
   music-player-native-core = { path = "../../native-core" }
   ```

4. Port one consumer at a time.
5. Keep old module wrappers temporarily if it reduces churn:

   ```rust
   pub use music_player_native_core::truepeak::*;
   ```

6. Move tests with the module,
   then keep adapter-specific tests beside adapters.
7. Repeat for `opus`,
    `decode`,
    and shared error surfaces only after `truepeak` is stable.

#### Verification

Run at minimum:

```sh
mise run //packages/music-player/desktop-app:test
mise run //packages/music-player/desktop-app:lint
mise run //packages/music-player/android-app:test:unit
mise run //packages/music-player/android-app:lint
```

For Android native changes,
run the package's native build task and a device boundary check before declaring the extraction done.

### Claude Code plugins

#### Current state

Current cluster:

```text
packages/claude-code-plugins/
  source/
  hook-types/
  bash-output-filter/
  claude-spawn/
  correction-reminder/
  guardrail/
  prompt-time/
  session-start-housekeeping/
  stop-reminders/
  terminal-title/
  research-agent/
  statusline/
  verbose-tool-output/
```

This should remain as-is.
It is the best existing example of the desired category model.

Evidence:
`packages/claude-code-plugins/README.md` documents the cluster explicitly.
The per-plugin packages are thin shims.
`source/` owns shared runtime and handler logic.
`hook-types/` owns canonical hook protocol types.

#### Target shape

Keep:

```text
packages/claude-code-plugins/
  source/
  hook-types/
  <plugin>/
```

Future shared logic should continue to land in `source/` or another second-level project in this category,
not in `module/` unless the logic is genuinely host-neutral.

#### Cleanup questions

Three active directories under this category do not have `package.json`:

- `research-agent`
- `statusline`
- `verbose-tool-output`

Decide for each whether it is:

- a real project root that should have `mise.toml` and documentation,
- package content that should live under another project,
- paused or abandoned content that should move to `packages-paused/`,
- obsolete content that should be deleted after reading it.

### Pi extensions

#### Current state

Current active roots:

```text
packages/pi-plugin/
  advisor/
  auto-mode/
  current-time-context/
  morph-compact/
  spawn/
  statusline/
  terminal-title/
  thinking-defaults/

packages/pi-shared/
  model-selection/
```

`packages/pi-shared/model-selection/README.md` says it lives under `pi-shared` because it is reusable Pi extension
infrastructure and not a Pi extension itself.
Current measured consumers are:

- `packages/pi-plugin/advisor`
- `packages/pi-plugin/auto-mode`
- `packages/pi-plugin/thinking-default`

#### Recommendation

Keep `pi-shared` as its own category.
Do not fold it into `pi`.

`packages/pi-shared/model-selection/README.md` makes the boundary explicit:
the category holds reusable Pi-extension infrastructure that is not itself a Pi extension,
must be intended for at least two Pi packages,
and must expose APIs that make sense outside one extension command,
 renderer,
 or config surface.
Actual Pi extensions stay under `packages/pi-plugin/`.

The boundary is by kind,
 not by consumer count.
`model-selection` is a library with tiered subpath exports (`/core`,
 `/scope`,
 `/cost`,
 `/budget`,
 `/pi-coding-agent`)
and documented consumer boundaries;
folding it under `pi/` would put a shared library among deployable extensions and erase that distinction.
That only Pi packages consume it today does not make it an extension.

This corrects an earlier draft that recommended collapsing `pi-shared` into `pi`.
That reasoning used consumer count as the criterion;
the right criterion is kind,
 extension versus infrastructure.

#### When the category would change

If a non-Pi host consumes `model-selection`,
for example a Claude Code plugin,
 a standalone CLI,
 or a generic LLM provider package,
the category may instead be too narrow,
and a broader name such as `llm` or `agent-runtime` would fit,
but only after real consumers exist.
Until then,
 `pi-shared` stays.

### MVM

#### Current state

Current roots:

```text
packages/cli/mvm/
packages/mcp/mvm/
```

`packages/mcp/mvm/README.md` says the MCP server exposes `mvm` VM management operations over stdio.
The package dependency graph confirms `mcp/mvm` depends on `cli/mvm` and `mcp/stdio`.

This is a product with multiple adapters:

- CLI adapter:
  human command line.
- MCP adapter:
  AI tool protocol.
- Backend core:
  libvirt and Hetzner VM lifecycle logic.

#### Target shape

MVM is a near-term go.
The trigger the draft named is already met:
`mcp/mvm` imports `cli/mvm` source through `@monochromatic-dev/cli-mvm/ts`,
so one adapter depends on another adapter's internals.
Move to a product cluster:

```text
packages/mvm/
  cli/
  mcp/
  core/
```

Long-term package names could become:

- `@monochromatic-dev/mvm-cli`
- `@monochromatic-dev/mvm-mcp`
- `@monochromatic-dev/mvm-core`

Path migration can happen before package-name migration.

#### What belongs in `core`

The core package should own:

- VM identity model,
- backend selection,
- libvirt lifecycle operations,
- Hetzner lifecycle operations,
- SSH or guest-exec abstractions,
- image/template refresh logic,
- shared errors and result types.

The CLI package should own:

- argument parsing,
- terminal output,
- shell-oriented exit behavior,
- human help text.

The MCP package should own:

- MCP tool schemas,
- JSON result shaping,
- stdio server wiring,
- agent-facing descriptions.

#### Migration sketch

Two ordered steps.
Step 1 fixes the dependency direction;
step 2 moves the paths.

Step 1:
 extract a core.

1. Extract backend logic into internal source modules inside the existing `packages/cli/mvm` package first,
   not a new third-level project.
2. Make `cli/mvm` a thin adapter over those core modules.
3. Make `mcp/mvm` import the core modules rather than CLI internals,
   removing the `@monochromatic-dev/cli-mvm/ts` adapter-to-adapter import.
4. Add core-level contract tests against a mocked or disposable backend before moving any destructive behavior.

Step 2:
 move the paths.

1. Create `packages/mvm/{cli,mcp,core}` and `git mv` each project once the dependency direction is clean.
2. Make `core` its own package consumed by both adapters.
3. Update docs and task names.

#### Verification

Use a disposable VM target or mocked backend for destructive operations.
Do not verify destroy/reset behavior against real shared VM state.

Minimum checks:

```sh
mise run //packages/cli/mvm:test:unit
mise run //packages/mcp/mvm:test:unit
mise run //packages/cli/mvm:lint
mise run //packages/mcp/mvm:lint
```

After a path move,
run the equivalent new task names.

### Oxlint subsystem

#### Current state

Current active roots:

```text
packages/config/oxlint/
packages/oxlint-plugin/no-restricted-syntax/
packages/oxlint-plugin/stylistic/
packages/oxlint-plugin/tsdoc/
packages/test-fixture/oxlint-no-restricted-syntax/
packages/test-fixture/oxlint-stylistic/
packages/test-fixture/oxlint-tsdoc/
```

`packages/config/oxlint/README.md` says the config package depends on the three plugin packages,
and its built entry bundles plugin sidecars.
The plugin READMEs point at matching fixture packages.

This is a subsystem cluster split across three first-level categories.
The split is understandable historically:
config packages under `config`,
 plugins under `oxlint-plugin`,
 fixtures under `test-fixture`.
But ownership is now oxlint-specific.

#### Target shape

Oxlint is a near-term go.
Move the config,
 plugins,
 and fixtures into one subsystem cluster:

```text
packages/oxlint/
  config/
  plugin-no-restricted-syntax/
  plugin-stylistic/
  plugin-tsdoc/
  fixture-no-restricted-syntax/
  fixture-stylistic/
  fixture-tsdoc/
```

Long-term names could become:

- `@monochromatic-dev/oxlint-config`
- `@monochromatic-dev/oxlint-plugin-no-restricted-syntax`
- `@monochromatic-dev/oxlint-plugin-stylistic`
- `@monochromatic-dev/oxlint-plugin-tsdoc`
- `@monochromatic-dev/oxlint-fixture-tsdoc`

Package-name migration is optional and should be staged separately.
The current names under `@monochromatic-dev/oxlint-plugin-*` may be worth keeping if publication compatibility matters.

#### Fixture strategy: keep them as packages

Each fixture is referenced by filesystem path from exactly one plugin's test,
with no import by package name,
but each carries its own `mise` tasks.
The decision is to keep them as first-class `packages/oxlint/fixture-*` packages,
preserving their independent build and lint tasks,
which isolate the deliberately rule-violating fixture code from the plugins' own linting.

The criterion for future fixtures still stands:
keep a fixture as a workspace package only when it needs its own package boundary,
independent task,
or import identity;
otherwise fold it into the owning plugin as package-local test data.

#### Migration sketch

1. Move `config/oxlint` only after plugin import paths are stable.
2. Move one plugin and its fixture first,
   probably `tsdoc`,
   because it has a clear config-to-plugin-to-fixture chain.
3. Update config package dependencies and sidecar entry imports.
4. Update README related-package sections.
5. Update tests that reference fixture paths.
6. Run oxlint package builds before moving the next plugin.

#### Verification

Minimum checks after each plugin move:

```sh
mise run //packages/config/oxlint:build
mise run //packages/config/oxlint:lint
mise run //packages/oxlint-plugin/tsdoc:test:unit
mise run //packages/oxlint-plugin/tsdoc:lint
```

`config/oxlint` has no test task today;
verify it with `build` and `lint`.
After path moves,
replace task paths with the new `packages/oxlint/...` paths.
Also run a root oxlint check because the root config consumes the built config package.

### Done product and comparison variants

#### Current state

Current roots:

```text
packages/webapp-productivity/done/
packages/webapp-productivity/done-postcss/
```

`packages/webapp-productivity/done/README.md` says `done-postcss` is a sibling comparison package.
`packages/webapp-productivity/done-postcss/README.md` says it implements the same product with a different CSS
authoring pipeline and is not intended to ship.

This is a product plus variant.
The current category `webapp-productivity` is useful for discovery,
but it is weaker as an ownership boundary.

#### Target shape

Done is a near-term go.
Build the product cluster now:

```text
packages/done/
  app/
  variant-postcss/
```

Leave room for more members later (`variant-tailwind`,
 `fixture-data`),
but only `app` and `variant-postcss` move now.
Use `app` for the canonical shipped product because the category name is the product name.
Do not call the canonical project `done` under `packages/done/done`.

`done-postcss` stays.
`docs/audit/dry.md` already records it as an intentional fork:
`done` is canonical,
 and `done-postcss` is a CSS-pipeline comparison and lint blueprint that `done` mirrors.

#### What belongs in the cluster

Belongs in `packages/done/*`:

- the canonical Done app,
- CSS framework comparison variants,
- Done-specific fixture data,
- Done-specific shared product model if variants need it,
- migration scripts that only serve Done.

Does not belong there:

- generic CSS build tooling,
- generic hyperscript helpers,
- generic LLM types,
- generic page-weight or build tooling.

Those stay in `build-tool`,
 `module`,
 or `dev-script`.

#### Migration sketch

1. Move the canonical app to `packages/done/app`.
2. Move `done-postcss` to `packages/done/variant-postcss`.
3. Update README cross-links from `../done` to `../app`.
4. Update deployment and root convenience tasks that mention the old path.
5. Leave the other `webapp-productivity` apps where they are;
   only `done` and `done-postcss` move.

### Forbidden-strings

#### Current state

Current roots:

```text
packages/cli/forbidden-strings/
packages/fuzz/forbidden-strings/
```

`cli/forbidden-strings` is a Rust scanner for forbidden literal strings and regex patterns,
built as a library plus a binary.
`fuzz/forbidden-strings` is its fuzz harness;
its `Cargo.toml` path-depends on `cli/forbidden-strings` with the `fuzzing` feature.
It is the only member of the `fuzz/` category.

This is one product split across two artifact-type categories:
a CLI scanner and its fuzz harness.

#### Target shape

Forbidden-strings is a near-term go.
Move both crates into a product cluster:

```text
packages/forbidden-strings/
  cli/
  fuzz/
```

The `cli` crate keeps its library plus binary;
the `fuzz` crate keeps fuzzing it through a `path` dependency.
This empties the `fuzz/` category,
 which then retires;
future fuzz harnesses live beside the code they fuzz,
 inside that code's cluster.

Long-term package names could become `forbidden-strings-cli` and `forbidden-strings-fuzz`,
staged separately from the path move.

#### Migration sketch

1. Create `packages/forbidden-strings/` and `git mv` the cli crate to `packages/forbidden-strings/cli`.
2. `git mv` the fuzz crate to `packages/forbidden-strings/fuzz`.
3. Update the fuzz crate's `path` dependency to point at the new cli location.
4. Update task references and any docs that name `cli/forbidden-strings` or `fuzz/forbidden-strings`.
5. Remove the now-empty `fuzz/` category.

#### Verification

```sh
mise run //packages/cli/forbidden-strings:test
mise run //packages/cli/forbidden-strings:lint
mise run //packages/fuzz/forbidden-strings:test
```

After the move,
 run the equivalent `packages/forbidden-strings/...` task names,
and run one fuzz target (`mise run //packages/forbidden-strings/fuzz:run -- -max_total_time=30`)
to confirm the `path` dependency still resolves.

### Figma parsers

#### Current state

Current roots:

```text
packages/figma/kiwi/
packages/figma/to-penpot/
```

`penpot` depends on `kiwi`.
The READMEs describe a clear domain pipeline:
parse Figma export formats,
then convert parsed output to Penpot.

#### Recommendation

Keep as-is.
This is already a domain category.

Potential future shape:

```text
packages/figma/
  kiwi/
  penpot/
  cli/
  fixtures/
```

Only add `cli` if command-line behavior becomes more than a script inside `penpot`.
Only add `fixtures` if shared fixtures need an independent workspace boundary.

### Current-time-context packages

#### Current state

Current relevant roots:

```text
packages/agent-harness-shared/current-time-context/
packages/pi-plugin/current-time-context/
packages/claude-code-plugins/source/
```

`packages/agent-harness-shared/current-time-context/README.md` says the package exists because Claude Code
hooks and Pi extensions inject the same coarse local time context.
The Pi extension consumes the shared package.
Claude Code plugin logic lives in the Claude Code plugin source cluster.

#### Recommendation

Keep the shared formatter in `agent-harness-shared/current-time-context`.
It is host-neutral but specifically shared across agent harness hosts,
so the shared suffix convention is more discoverable than the broad `module` bucket.
Keep host adapters in their host categories:

```text
packages/agent-harness-shared/current-time-context/
packages/pi-plugin/current-time-context/
packages/claude-code-plugins/source/
```

Do not create a `current-time-context` product category unless it grows beyond a tiny formatter plus host adapters.
This category captures the expected family of many shared agent-harness utilities without treating one formatter as
its own product.

The same holds for other concepts that appear once per host.
`statusline` and `terminal-title` each exist under both `pi/` and `claude-code-plugins/`,
and `spawn` appears as `pi/spawn` and `claude-code-plugins/claude-spawn`.
They share a concept but no code,
 and they bind to different host APIs,
so each stays under its host cluster.
Extract an `agent-harness-shared/` package only if real shared agent-harness logic emerges,
as it did for `current-time-context`.

### Broad utility categories

#### Module

Keep `packages/module/*` broad.
It currently holds general-purpose TypeScript utilities such as logging,
path helpers,
test helpers,
TOML editing,
observable helpers,
and token counting.

Move a module out only when it becomes product-owned.
Example:
a future `mvm-core` should live under `packages/mvm/core`,
not `packages/module/mvm-core`,
because MVM owns it.

#### Config

Keep `packages/config/*` broad for host-neutral tool presets.
Examples:
TypeScript,
 tsdown,
 dprint,
 stylelint,
 cosign,
 tofu.

Exception:
`config/oxlint` moves into the `oxlint` subsystem because its config is tightly coupled to local oxlint plugin
packages and fixtures.

#### Dev-script

Keep `packages/dev-script/*` broad for independent repository automation.
Do not move a script into a product cluster unless it only serves that product.

Example:
`file-enforcer` stays in `dev-script` because it serves the repository.
A hypothetical `music-player-release-prep` should live under `music-player` if it only serves that product.

#### Test-fixture

Keep `packages/test-fixture/*` for cross-cutting fixture packages.
Move fixtures closer to owners when ownership is specific.

Likely owner-specific fixture candidates:

- `test-fixture/oxlint-*`:
  owned by the oxlint subsystem;
  they move with it as `packages/oxlint/fixture-*` packages per this plan.
- `test-fixture/css-imported`,
   `css-imported-no-exports`,
   `css-importing`,
   `css-importing-filepath`:
  a fixture family for `build-tool/css`;
  candidates to move beside it,
   though `build-tool/css` itself stays broad because unrelated apps consume it.
- `test-fixture/toml-edit`:
  owned by `module/toml-edit`,
   unless it must stay package-like for fuzz workflows.
- `test-fixture/file-enforcer-perf`:
  owned by `dev-script/file-enforcer`,
   unless it must stay package-like for benchmark isolation.
- `test-fixture/data-sequence`:
  owner not yet identified;
  confirm its consumer before moving it.

Do not move fixtures just to make the tree look tidy.
Move them when test ownership or path clarity improves.

#### Shim and stub

Keep `packages/shim/*` and `packages/stub/*` broad.
They describe dependency-management roles,
not product ownership.

## Migration phases

Each phase should be independently reviewable.
Do not attempt all moves in one commit.

### Phase 0: Adopt the policy

This document is Phase 0,
and its decisions are adopted.
The rules below are the agreed policy:

- `packages/<category>/<project>` remains mandatory for active project roots.
- Category means ownership boundary.
- Product and host categories are allowed.
- Artifact-type categories remain useful for independent utilities.
- Path moves and package-name renames are separate decisions.

Optional follow-up:
add a shorter policy summary to `AGENTS.md` or a package-layout README,
so future agents see the rule before creating packages.

### Phase 1: Clean obvious layout debris

Handle low-risk cleanup first:

1. Remove or explain empty `packages/android-app/`.
2. Decide the status of non-package Claude Code plugin dirs:
   `research-agent`,
    `statusline`,
    `verbose-tool-output`.
3. Decide whether every active `packages/*/*` directory must have one of:
   `package.json`,
    `Cargo.toml`,
    Gradle settings,
    or `mise.toml`.
4. Document accepted npm-name exceptions.

This phase should not rename packages or move large source trees.
It makes the inventory trustworthy before bigger moves.

### Phase 2: Extract `music-player/native-core`

This is the highest-value extraction because it removes real duplicated DSP code.
Do not let the discretionary cluster moves below overtake it,
unless one of them becomes independently urgent.

Recommended order:

1. Create `packages/music-player/native-core` as a standalone path-dependency crate.
2. Extract `truepeak` first.
3. Prove both desktop and Android consume it.
4. Extract `opus` only after the first shared crate lands cleanly.
5. Extract `decode` after the error and audio-spec types are stable.
6. Revisit engine sharing last.

Honor the preconditions:
no platform or UI dependencies in the core,
its own `cargo test`,
and an Android native build across the Gradle,
 cargo,
 and NDK boundary.

### Phase 3: Affirm `pi-shared`

No move.
`pi-shared` stays as an extension-versus-infrastructure boundary.
Update any stale prose,
 including this plan's earlier draft,
 that suggested folding it into `pi`,
and revisit only if a non-Pi host consumes `model-selection`.

### Phase 4: Build the MVM product cluster

Two steps.
First extract a `core` inside `packages/cli/mvm` so `mcp/mvm` stops importing `cli` internals.
Then move paths:

```text
packages/mvm/
  core/
  cli/
  mcp/
```

Do the core extraction before the path move.

### Phase 5: Build the oxlint subsystem cluster

End state:

```text
packages/oxlint/
  config/
  plugin-no-restricted-syntax/
  plugin-stylistic/
  plugin-tsdoc/
  fixture-no-restricted-syntax/
  fixture-stylistic/
  fixture-tsdoc/
```

Move one plugin and its fixture first.
Keep fixtures as first-class packages.
Do not rename every package at once.

### Phase 6: Build the Done product cluster

Move the canonical app to `packages/done/app` and `done-postcss` to `packages/done/variant-postcss`.
Keep `done-postcss`;
its value is already recorded in `docs/audit/dry.md`.
Leave the other `webapp-productivity` apps in place.

### Phase 7: Build the forbidden-strings product cluster

Move `cli/forbidden-strings` and `fuzz/forbidden-strings` into `packages/forbidden-strings/{cli,fuzz}`,
update the fuzz crate's `path` dependency,
and retire the now-empty `fuzz/` category.

### Phase 8: Reconcile package names

Only after path moves stabilize,
review npm package names.

For each moved project,
choose one:

- Keep the old package name for compatibility.
- Rename to match the new category.
- Publish or keep a deprecated wrapper if external consumers exist.

Do not combine this with large source moves.

## General migration procedure

Use this procedure for each path move.

### Before moving

1. Read the package README and nearby decision docs.
2. Identify direct workspace dependents from `package.json`.
3. Search for path references with `rg`.
4. Decide whether package name changes now or later.
5. Identify generated files and file-enforcer outputs.
6. Identify package-specific verification tasks from its `mise.toml`.

### Move

Use `git mv` for tracked files.
Stage explicit pathspecs when committing.
Do not use bulk `git add .`.

For a path-only move,
update at least:

- `package.json` `repository.directory`,
   when present,
- README install and task examples,
- docs under `docs/decisions`,
   `docs/planning`,
   `docs/troubleshooting`,
   and `docs/handover`,
- root `package.json` dependencies only if package names change,
- workspace dependencies only if package names change,
- `pnpm-lock.yaml`,
   reviewed after reinstall,
- the moved crate's `Cargo.lock`,
   and any path-dependent crate's `Cargo.lock` (there is no root Cargo workspace),
- Gradle settings and native build scripts for `music-player/android-app`,
- pnpm catalog and `overrides` entries in `pnpm-workspace.yaml` that name the old path,
- `.github/CODEOWNERS` entries,
- task references such as `mise run //packages/old/path:task`,
- test fixture path constants,
- CI workflow path filters,
- generated config inputs if file-enforcer owns them.

After path edits,
run:

```sh
mise run //:sync:files
mise run //:prepare:pnpm:install
```

### Verify

Run narrow verification first:

- moved package build,
- moved package lint,
- moved package tests,
- direct dependents' tests.

Then run broader checks when the move touches shared tooling:

- root markdown lint for docs-heavy moves,
- root oxlint when oxlint config or plugin paths move,
- root build fanout only for broad package-name changes.

### Search for leftovers

Run searches for:

- old path,
- old task path,
- old package name if renamed,
- old README-relative links,
- old generated output paths.

Treat a zero-result search as valid only after checking the command actually searched the intended tree.

## Acceptance criteria for this whole plan

The plan is complete when all accepted moves satisfy these conditions:

- Every active project root is exactly `packages/<category>/<project>`.
- Each first-level category has a one-sentence ownership explanation in this document's category ownership reference,
  updated whenever a category is added or removed.
- Product and subsystem clusters own their shared cores,
   adapters,
   plugins,
   and fixtures together.
- Dependencies inside a cluster flow adapter to core to neutral utilities;
  no core depends on an adapter.
- Artifact-type categories contain independent utilities,
  not product fragments that change together.
- No active project requires a third-level package root;
  build-internal nested units such as `music-player/android-app/rust` are exempt.
- `packages-deprecated/` and `packages-paused/` remain the only status trees.
- Package names either match the new category or have documented compatibility reasons.
- Root generated files are in sync.
- Package-specific tests pass for every moved package and every direct dependent.
- Documentation references do not point at old paths except in historical sections that explicitly say they are
  historical.

### Why there is no automation guardrail

A repository check that rejected stray or third-level project roots was considered and rejected.

- The mechanical part is already enforced.
  pnpm's `packages/*/*` workspace glob and mise's `packages/*/*` config roots (`monorepo_depth = 3`)
  only recognize two-level project roots,
  so a non-conforming directory is simply not picked up as a workspace or task root.
- The meaningful part cannot be mechanized.
  Whether a package sits in the right category,
  and whether a category should exist at all,
  are ownership judgments a linter cannot make;
  a passing check would give false confidence about the policy it cannot verify.

So this plan relies on review,
 not a new guardrail.

## Non-goals

This plan does not require moving every package.
It should reduce friction,
not produce symmetry for its own sake.

This plan does not require publishing packages.
Publishing is a separate decision with separate compatibility requirements.

This plan does not require replacing pnpm with Rush.
Rushstack is the design precedent for the category model,
not a tool migration target.

This plan does not require every shared dependency to become a product cluster.
Neutral utilities stay neutral.

## Quick decision checklist for future packages

When adding a package,
answer these in order:

1. Is this part of an existing product,
    plugin host,
    or subsystem?
   If yes,
   put it under that category.
2. Is this a shared core for adapters in that category?
   If yes,
   keep it beside the adapters.
3. Is this an independent reusable utility?
   If yes,
   use `module`,
    `config`,
    `dev-script`,
    `shim`,
    or `stub` as appropriate.
4. Is this a fixture for one owner?
   If yes,
   keep it near the owner unless it needs a workspace boundary.
5. Is this paused or deprecated?
   If yes,
   use `packages-paused/` or `packages-deprecated/`,
    not a category name under `packages/`.
6. Would the package path need three segments below `packages/`?
   If yes,
   rename the second segment instead of adding depth.
