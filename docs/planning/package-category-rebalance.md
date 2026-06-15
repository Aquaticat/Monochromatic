# Plan: package category rebalance

Status:
 planning draft.
No package moves have landed from this plan yet.

This plan explains how to apply the Rush-style two-level category model to this monorepo,
then proposes concrete package-set rebalances.
It is written for a reader who has not seen the repository before.

## Executive summary

The repository should keep the invariant:

```text
packages/<category>/<project>
```

The important word is **category**.
The first segment is not always an artifact type such as `cli`, `module`, or `webapp`.
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

The plan recommends:

- Keep `packages/claude-code-plugins/*` as the template for a healthy product or host cluster.
- Keep `packages/music-player/*` product-first and add a shared native core there.
- Consider folding `packages/pi-shared/model-selection` into `packages/pi/model-selection`.
- Consider turning `cli/mvm` plus `mcp/mvm` into a `packages/mvm/*` product cluster.
- Consider turning `config/oxlint`, `oxlint-plugins/*`, and oxlint fixture packages into a `packages/oxlint/*`
  subsystem cluster.
- Consider turning `done` and `done-postcss` into a `packages/done/*` product cluster if comparison variants keep
  growing.
- Keep broad independent utility buckets such as `module`, `config`, `dev-script`, `shim`, and `stub` broad.

## Why this plan exists

The package layout currently mixes two category styles:

- Artifact-type categories:
  `cli`, `module`, `config`, `mcp`, `dev-script`, `webapp-productivity`.
- Product or subsystem categories:
  `music-player`, `claude-code-plugins`, `figma-parsers`, `pi`.

Both styles are valid.
The problem appears when a product spans several artifact types.
The `music-player` product has a desktop app, an Android app, Rust engine code, Kotlin logic,
and obvious shared native-code opportunities.
If the desktop and Android apps lived under separate artifact categories,
shared code would have to live somewhere distant and artificial.

The plan below treats a category as the **ownership boundary** for code sharing.
Use artifact-type categories only when packages are genuinely unrelated except for artifact type.
Use product or subsystem categories when packages are adapters, variants, plugins, fixtures, or shared cores for
one product or host.

## Rush precedent

This layout is based on Rushstack's category-folder model.
The primary source is `microsoft/rushstack` at commit `0e46b84a4f62134298365f49bbe03b609ab09f7e`.
In `rush.json`, Rushstack recommends that buildable project folders be exactly two levels below the repository root;
the parent folder acts as the category.
It gives examples such as `apps`, `libraries`, `tools`, and `prototypes`.
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
`https://github.com/microsoft/rushstack/blob/0e46b84a4f62134298365f49bbe03b609ab09f7e/libraries/rush-lib/src/api/RushConfigurationProject.ts#L223-L235`.

The key lesson is not the literal folder name `packages`.
The lesson is that depth stays fixed, and category names are periodically rebalanced through discussion.
Rushstack's own current category set includes `apps`, `libraries`, `build-tests`, `heft-plugins`, `rush-plugins`,
`rigs`, `vscode-extensions`, and others.
That proves the first segment can be a product area, a plugin host, a test family, or a tool family.

## Current repository constraints

### Workspace and task roots

Current measured state from the active tree:

- `packages/` contains 27 direct categories.
- `packages/` contains 105 directories with `package.json`.
- `packages/` contains 109 directories with `mise.toml`.
- `packages-deprecated/` contains 1 package directory.
- `packages-paused/` contains 11 package directories.

Important nuance:
not every `packages/*/*` directory is an npm workspace package.
Some are Rust, Gradle, or tooling islands with `mise.toml` but no `package.json`.
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

### Status trees

The repository has separate trees for package lifecycle state:

- `packages/`:
  active projects.
- `packages-deprecated/`:
  packages that remain installable or referenceable but are no longer maintained.
- `packages-paused/`:
  packages intentionally removed from active workspace and task fanout.

Do not solve status by inventing category names such as `old`, `paused`, or `deprecated` under `packages/`.
Use the status trees.

## Terms used in this plan

### Category

The first segment under `packages/`.
It is the ownership and grouping boundary.
Examples:
`music-player`, `claude-code-plugins`, `module`, `config`, `mvm`, `oxlint`.

### Project

The second segment under `packages/`.
It is a buildable or task-addressable unit.
It may be an npm package, a Rust crate, a Gradle project, a fixture package, or a mise-only tool root.

### Adapter

A project that exposes a shared core through one host or interface.
Examples:
CLI adapter, MCP adapter, Pi extension, Claude Code plugin shim, Android app shell.

### Core

A project that owns shared logic consumed by multiple adapters or apps.
Examples:
`claude-code-plugins/source`, future `music-player/native-core`, future `mvm/core`.

### Variant

A project that implements the same product against a different framework, renderer, build pipeline, or experiment.
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

Use a product category when a product has multiple adapters, platforms, variants, or shared internals.

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
packages/oxlint-plugins/tsdoc/
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

## Recommended target state by package set

## Music-player

### Current state

Current active roots:

```text
packages/music-player/
  desktop-app/
  android-app/
```

This is already the right category shape.
Both roots are project roots with `mise.toml`, but neither is an npm package.
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

- `decode.rs`: 2,827 lines.
- `opus.rs`: 1,386 lines.
- `truepeak.rs`: 1,122 lines.
- `engine.rs`: 1,805 lines.

The product glossary already recognizes the shared product language:

- `packages/music-player/desktop-app/CONTEXT.md`
- `packages/music-player/android-app/CONTEXT.md`

Relevant cross-platform decisions already apply to both roots:

- `docs/decisions/music-player-android-port.md`
- `docs/decisions/music-player-session-source-root.md`
- `docs/decisions/music-player-live-update-rescan.md`

### Target shape

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

### What belongs in `native-core`

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

### Migration sketch

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
7. Repeat for `opus`, `decode`, and shared error surfaces only after `truepeak` is stable.

### Verification

Run at minimum:

```sh
mise run //packages/music-player/desktop-app:test
mise run //packages/music-player/desktop-app:lint
mise run //packages/music-player/android-app:test:unit
mise run //packages/music-player/android-app:lint
```

For Android native changes,
run the package's native build task and a device boundary check before declaring the extraction done.

## Claude Code plugins

### Current state

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

### Target shape

Keep:

```text
packages/claude-code-plugins/
  source/
  hook-types/
  <plugin>/
```

Future shared logic should continue to land in `source/` or another second-level project in this category,
not in `module/` unless the logic is genuinely host-neutral.

### Cleanup questions

Three active directories under this category do not have `package.json`:

- `research-agent`
- `statusline`
- `verbose-tool-output`

Decide for each whether it is:

- a real project root that should have `mise.toml` and documentation,
- package content that should live under another project,
- paused or abandoned content that should move to `packages-paused/`,
- obsolete content that should be deleted after reading it.

## Pi extensions

### Current state

Current active roots:

```text
packages/pi/
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

- `packages/pi/advisor`
- `packages/pi/auto-mode`
- `packages/pi/thinking-defaults`

### Recommendation

Consider collapsing `pi-shared` into `pi`:

```text
packages/pi/
  advisor/
  auto-mode/
  model-selection/
  thinking-defaults/
  ...
```

Reason:
with only one `pi-shared` package and only Pi consumers,
`pi-shared` adds an extra taxonomy distinction without improving ownership.
The package is still shared infrastructure after the move;
its role is expressed by the second segment and README,
not by a separate first segment.

### Keep `pi-shared` only if this becomes true

Keep or expand `pi-shared` if the package is expected to be consumed by non-Pi hosts.
Examples:

- Claude Code plugins import the same model-selection logic.
- A standalone CLI imports the same model-scope code.
- A generic LLM provider package imports it without depending on Pi runtime concepts.

If that happens,
`pi-shared` may still be too narrow.
A better category might be `llm` or `agent-runtime`,
but only after real consumers exist.

### Migration sketch

1. `git mv packages/pi-shared/model-selection packages/pi/model-selection`.
2. Update `package.json` `repository.directory`.
3. Keep the package name temporarily unless all consumers are private and easy to update.
4. Update imports only if the package name changes.
5. Update README language from `pi-shared` to `pi/model-selection`.
6. Remove empty `packages/pi-shared/` after the move.
7. Run Pi package builds and tests for the three consumers.

## Mvm

### Current state

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

### Target shape

If MVM stays small,
the current split is tolerable.
If it grows,
move to a product cluster:

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

### What belongs in `core`

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

### Migration sketch

1. Extract `core` under the existing path first if that is lower risk,
   or create `packages/mvm/core` directly if the path move is already accepted.
2. Move backend logic from `cli/mvm` into `core`.
3. Make `cli/mvm` a thin adapter over `core`.
4. Make `mcp/mvm` call `core` directly rather than CLI internals.
5. Move paths to `packages/mvm/{cli,mcp,core}` once the dependency direction is clean.
6. Update docs and task names.

### Verification

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

## Oxlint subsystem

### Current state

Current active roots:

```text
packages/config/oxlint/
packages/oxlint-plugins/no-restricted-syntax/
packages/oxlint-plugins/stylistic/
packages/oxlint-plugins/tsdoc/
packages/test-fixture/oxlint-no-restricted-syntax/
packages/test-fixture/oxlint-stylistic/
packages/test-fixture/oxlint-tsdoc/
```

`packages/config/oxlint/README.md` says the config package depends on the three plugin packages,
and its built entry bundles plugin sidecars.
The plugin READMEs point at matching fixture packages.

This is a subsystem cluster split across three first-level categories.
The split is understandable historically:
config packages under `config`, plugins under `oxlint-plugins`, fixtures under `test-fixture`.
But ownership is now oxlint-specific.

### Target shape

If the oxlint subsystem keeps growing,
move to:

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
The current names under `@monochromatic-dev/config-oxlint-*` may be worth keeping if publication compatibility matters.

### Alternative: move fixtures inside plugin packages

Before making fixture packages first-class `packages/oxlint/fixture-*` projects,
ask whether each fixture needs to be a workspace package.
If a fixture is only data for one plugin,
it may be clearer as package-local test data:

```text
packages/oxlint/plugin-tsdoc/test-fixtures/
```

Keep fixture packages only when they need their own package boundary,
independent build task,
or import identity.

### Migration sketch

1. Move `config/oxlint` only after plugin import paths are stable.
2. Move one plugin and its fixture first,
   probably `tsdoc`,
   because it has a clear config-to-plugin-to-fixture chain.
3. Update config package dependencies and sidecar entry imports.
4. Update README related-package sections.
5. Update tests that reference fixture paths.
6. Run oxlint package builds before moving the next plugin.

### Verification

Minimum checks after each plugin move:

```sh
mise run //packages/config/oxlint:build
mise run //packages/config/oxlint:test:unit
mise run //packages/oxlint-plugins/tsdoc:test:unit
mise run //packages/oxlint-plugins/tsdoc:lint
```

After path moves,
replace task paths with the new `packages/oxlint/...` paths.
Also run a root oxlint check because the root config consumes the built config package.

## Done product and comparison variants

### Current state

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

### Target shape

If Done remains one canonical app plus a small comparison variant,
leave it where it is.

If more variants appear,
move to a product cluster:

```text
packages/done/
  app/
  variant-postcss/
  variant-tailwind/
  fixture-data/
```

Use `app` for the canonical shipped product only if the category name is the product name.
Do not call the canonical project `done` under `packages/done/done`.

### What belongs in the cluster

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

Those stay in `build-tool`, `module`, or `dev-script`.

### Migration sketch

1. Decide whether `done-postcss` still has comparison value.
2. If no,
   delete it after recording the decision.
3. If yes and more variants are expected,
   move the canonical app to `packages/done/app`.
4. Move `done-postcss` to `packages/done/variant-postcss`.
5. Update README cross-links from `../done` to `../app`.
6. Update deployment and root convenience tasks that mention the old path.

## Figma parsers

### Current state

Current roots:

```text
packages/figma-parsers/kiwi/
packages/figma-parsers/penpot/
```

`penpot` depends on `kiwi`.
The READMEs describe a clear domain pipeline:
parse Figma export formats,
then convert parsed output to Penpot.

### Recommendation

Keep as-is.
This is already a domain category.

Potential future shape:

```text
packages/figma-parsers/
  kiwi/
  penpot/
  cli/
  fixtures/
```

Only add `cli` if command-line behavior becomes more than a script inside `penpot`.
Only add `fixtures` if shared fixtures need an independent workspace boundary.

## Current-time-context packages

### Current state

Current relevant roots:

```text
packages/module/current-time-context/
packages/pi/current-time-context/
packages/claude-code-plugins/source/
```

`packages/module/current-time-context/README.md` says the module exists because Claude Code hooks and Pi extensions
inject the same coarse local time context.
The Pi extension consumes the neutral module.
Claude Code plugin logic lives in the Claude Code plugin source cluster.

### Recommendation

Keep the neutral module in `module/current-time-context`.
It is host-neutral and shared across at least two host systems.
Keep host adapters in their host categories:

```text
packages/module/current-time-context/
packages/pi/current-time-context/
packages/claude-code-plugins/source/
```

Do not create a `current-time-context` product category unless it grows beyond a tiny formatter plus host adapters.
This is a good example of a dependency edge that should not force a product cluster.

## Broad utility categories

### Module

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

### Config

Keep `packages/config/*` broad for host-neutral tool presets.
Examples:
TypeScript, tsdown, dprint, stylelint, cosign, tofu.

Exception:
`config/oxlint` may move into an `oxlint` subsystem because its config is tightly coupled to local oxlint plugin
packages and fixtures.

### Dev-script

Keep `packages/dev-script/*` broad for independent repository automation.
Do not move a script into a product cluster unless it only serves that product.

Example:
`file-enforcer` stays in `dev-script` because it serves the repository.
A hypothetical `music-player-release-prep` should live under `music-player` if it only serves that product.

### Test-fixture

Keep `packages/test-fixture/*` for cross-cutting fixture packages.
Move fixtures closer to owners when ownership is specific.

Likely owner-specific fixture candidates:

- `test-fixture/oxlint-*`:
  owned by the oxlint subsystem.
- `test-fixture/toml-edit`:
  owned by `module/toml-edit`, unless it must stay package-like for fuzz workflows.
- `test-fixture/file-enforcer-perf`:
  owned by `dev-script/file-enforcer`, unless it must stay package-like for benchmark isolation.

Do not move fixtures just to make the tree look tidy.
Move them when test ownership or path clarity improves.

### Shim and stub

Keep `packages/shim/*` and `packages/stub/*` broad.
They describe dependency-management roles,
not product ownership.

## Migration phases

Each phase should be independently reviewable.
Do not attempt all moves in one commit.

### Phase 0: Adopt the policy

This document is Phase 0.
Before moving code,
agree on these rules:

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
   `research-agent`, `statusline`, `verbose-tool-output`.
3. Decide whether every active `packages/*/*` directory must have one of:
   `package.json`, `Cargo.toml`, Gradle settings, or `mise.toml`.
4. Document accepted npm-name exceptions.

This phase should not rename packages or move large source trees.
It makes the inventory trustworthy before bigger moves.

### Phase 2: Extract `music-player/native-core`

Do this before any other product-cluster migration because it solves the immediate code-sharing pain.

Recommended order:

1. Create `packages/music-player/native-core`.
2. Extract `truepeak` first.
3. Prove both desktop and Android consume it.
4. Extract `opus` only after the first shared crate lands cleanly.
5. Extract `decode` after the error and audio-spec types are stable.
6. Revisit engine sharing last.

Do not move platform output or UI code into the core.

### Phase 3: Collapse or justify `pi-shared`

Decision point:

- If only Pi packages consume `model-selection`, move it to `packages/pi/model-selection`.
- If non-Pi consumers are planned soon, keep it and document the expected consumers.
- If the concept is broader than Pi, rename the category to a broader category only after real consumers exist.

This phase is mostly path and documentation cleanup.

### Phase 4: Create an MVM product cluster if needed

Trigger this phase when MVM needs another adapter or when CLI internals become awkward for MCP consumption.

Preferred end state:

```text
packages/mvm/
  core/
  cli/
  mcp/
```

Do the core extraction before the path move if that lowers risk.

### Phase 5: Create an oxlint subsystem cluster if needed

Trigger this phase when oxlint plugins or fixtures continue growing.

Preferred end state:

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
Do not rename every package at once.

### Phase 6: Decide Done variant lifecycle

Decision point:

- If `done-postcss` is no longer useful,
  delete it after recording the rejection reason.
- If Done variants are still useful and more are expected,
  move to `packages/done/{app,variant-postcss}`.
- If there will only ever be one comparison variant,
  keep the current path and avoid churn.

### Phase 7: Reconcile package names

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

- `package.json` `repository.directory`, when present,
- README install and task examples,
- docs under `docs/decisions`, `docs/planning`, `docs/troubleshooting`, and `docs/handover`,
- root `package.json` dependencies only if package names change,
- workspace dependencies only if package names change,
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
- Each first-level category has a one-sentence ownership explanation in either a category README or this plan's
  successor policy doc.
- Product clusters own their shared cores and adapters together.
- Artifact-type categories contain independent utilities,
  not product fragments that change together.
- No active project requires a third-level package root.
- `packages-deprecated/` and `packages-paused/` remain the only status trees.
- Package names either match the new category or have documented compatibility reasons.
- Root generated files are in sync.
- Package-specific tests pass for every moved package and every direct dependent.
- Documentation references do not point at old paths except in historical sections that explicitly say they are
  historical.

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

1. Is this part of an existing product, plugin host, or subsystem?
   If yes,
   put it under that category.
2. Is this a shared core for adapters in that category?
   If yes,
   keep it beside the adapters.
3. Is this an independent reusable utility?
   If yes,
   use `module`, `config`, `dev-script`, `shim`, or `stub` as appropriate.
4. Is this a fixture for one owner?
   If yes,
   keep it near the owner unless it needs a workspace boundary.
5. Is this paused or deprecated?
   If yes,
   use `packages-paused/` or `packages-deprecated/`, not a category name under `packages/`.
6. Would the package path need three segments below `packages/`?
   If yes,
   rename the second segment instead of adding depth.
