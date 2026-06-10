# Migrating mise task execution from nushell to Node

Status:
 approved.
The open questions were resolved in a grilling session on 2026-06-10 (issue #246).
This document now records the decided design,
 not a menu of options.
Implementation has not started.

## Why

Two motivations drive this work.

- The team is migrating the repo's primary runtime to Node.
  Bun removal is a separate,
   later session;
  this session only replaces nushell with Node where a real language is needed.
- First-time setup friction.
  The `enter` hook is nushell,
   so on a fresh clone it errors before any tool is installed,
  forcing the documented "run `mise install` manually once" step (`README.md:114-122`).
  nushell is a tool that must itself be bootstrapped,
   which is the root of that friction.

## Scope of this session

In scope:
 remove nushell from mise task execution and replace it with Node where logic is needed.

Out of scope (deferred to the Bun-removal session):

- Swapping file-enforcer's own `bun .../cli.ts` invocation to `node`.
  Its body is already a cross-platform single command-runner,
   so the nushell migration does not need it.
- Any other `bun` to `node` runtime swap.
- `bunfig.toml` `shell = 'bun'`,
   which concerns Bun's own shell,
   not mise task execution.

## The decided design

The plan's original Option A/B/C framing is superseded.
The chosen approach uses mise's own task features instead of forcing a single inline shell.

### 1. No global shell flip; let mise use its platform defaults

Do not set a repo-wide inline shell to `node -e`.
Leave the default so trivial single-command bodies run under mise's platform defaults:
`sh -c -o errexit` on unix and `cmd /c` on Windows.
A genuinely trivial body such as `cargo build --release` runs identically under both,
so it needs no shell declaration at all.

The four `*_default_*_shell_args = "nu..."` settings (`mise.no-env.toml:203-206`) are removed,
which reverts to those defaults.
This removal is the last step,
 after every nushell body is converted (see sequencing).

### 2. Use mise's array `run` form for sequencing, never `;`-chaining

The `run = "mise run build; mise run test:unit"` pattern must not exist.
The `;` separator is sh-specific and breaks under `cmd /c`,
 which uses `&`.
Replace it with mise's array form:

```toml
# packages/<pkg>/mise.toml
[tasks.test]
run = ["mise run build", "mise run test:unit"]
```

mise runs each element as its own bare command and stops on the first failure.
This gives cross-platform sequencing and fail-fast without any shell-specific chaining.
Verified:
 an array `["echo a", "false", "echo c"]` runs `a`,
 fails at `false`,
 and never runs `c`.

### 3. Override `shell = "node -e"` only where a body would choke under sh or cmd

A body that uses logic,
 structured data,
 a nushell builtin (for example `print`),
environment interpolation,
 or a conditional cannot run portably under both `sh` and `cmd`.
Those bodies,
 and only those,
 declare the Node inline shell:

```toml
# packages/<pkg>/mise.toml
[tasks.some-logic]
shell = "node -e"
run = """
const count: number = 41
const { readdirSync } = await import('node:fs')
// logic here
"""
```

Verified:
 per-task `shell = "node -e"` overrides the default for inline bodies,
and `node -e` strips TypeScript annotations,
 runs ESM imports,
 and supports top-level await.

### 4. No `.ts` task helper files

There are no `mise.*.ts` files,
 and no `.ts` files created solely to hold task logic.
Substantial logic lives inline in a `node -e` body.
The existing thirteen `mise.*.ts` files migrate to inline `node -e`,
or,
 case by case,
 are reclassified as a package's normal bin invoked as a command-runner.

Accepted tradeoff:
 inline `node -e` strips types but does not type-check,
and inline JS in a TOML string is invisible to oxlint,
 the TSDoc rules,
 `max-lines`,
 tsgo,
 and the test harness.
Escape valve:
 if a given inline body becomes ugly or large enough to need those gates,
 change course for that body.

### 5. prefix-dev/shell was evaluated and dropped

`prefix-dev/shell` (a cross-platform,
 bash-compatible Rust shell descended from `deno_task_shell`)
was considered as the inline shell for command-runners.
It supports `-c` inline evaluation,
 is fail-fast by default (`ExitOnError` defaults to true),
and installs through the repo's existing git cargo precedent
(`cargo:https://github.com/...` with a pinned rev,
 as used for `slint-lsp` at `mise.no-env.toml:142`).

It was dropped because the array-`run` decision removes its only real advantage
(cross-platform readable chaining),
 so it earns nothing the design does not already have,
 and it carries cost:

- Alpha (v0.2.0,
   last released 2025-02-02,
   `publish = false`).
- Built from cargo source,
   which adds a rust-toolchain and slow-compile step to first-time setup,
  working against the friction motivation.
- It is not Node,
   so it does not serve this session's goal.
- Adopting it as a daily-driver dev shell is a separate question from the mise task shell;
  this decision does not preclude that.

## The enter hook and the bootstrap friction

The `enter` hook is the one task that runs at first `cd`,
 before any tool is installed,
and it must be cross-platform.
Putting it on `node -e` would reproduce the friction exactly,
 because Node is not installed yet either.
So the hook is the deliberate exception to "node -e everywhere".

It delegates to a task that runs bare commands under mise's default shell:

```toml
# mise.no-env.toml
[hooks]
enter = { task = "bootstrap" }

[tasks.bootstrap]
run = ["mise install", "mise upgrade"]
```

`sh` and `cmd` are both present at first `cd`,
 and `mise` itself is the one guaranteed prerequisite,
so this runs on a fresh clone with no manual step.
The nushell output-filtering (`complete`,
 `lines`,
 `where`,
 `str join`) is dropped.
Its noise suppression can be restored later with a portable `mise` flag if wanted,
 never with nushell or `node -e`.
Note:
 hooks cannot use array `run` directly (mise requires a string there),
which is why the hook references a task and the task carries the array.

After this change,
 the README first-setup section (`README.md:114-122`) is rewritten:
the hook no longer errors on a missing nushell,
 leaving only `mise trust` as an inherent first step.

## Scope inventory (measured)

Counts from `rg` over the working tree on the migration date.

- `mise.toml` files total:
   121.
- Files with at least one inline `run =`:
   74.
- Inline `run` bodies total:
   263.
- Lines using nushell structured-data builtins:
   106,
   concentrated in about eight files.

The eight logic-heavy files (root `mise.no-env.toml`,
 terminal,
 tofu,
 music-player,
 forbidden-strings,
 rust,
and a tail of trivial-builtin files) carry the bodies that need `shell = "node -e"`.
The remaining roughly sixty-six files with `run` bodies are command-runners that need only
the bare-command or array-`run` treatment.

### Root shared infrastructure (the hardest part)

The root source is `mise.no-env.toml`;
the committed `mise.toml` is generated from it by file-enforcer,
 so all root edits happen in the source.
Load-bearing nushell to convert,
 highest risk first:

- `[hooks].enter`:
   handled above (simplified to a bootstrap task).
- `[vars].fanout`:
   discovers direct child tasks via `mise tasks --all --json` and runs them in parallel.
  Becomes an inline `node -e` body that shells the JSON,
   parses it,
   and spawns the children concurrently.
  This is substantial;
   watch the escape valve.
- `[vars].monorepo_root_setup`,
   `[vars].workspace_node_dispatch`,
   `[vars].ensure_oxlint_config`:
  path handling and bootstrap dispatch.
- Orchestration tasks with `usage_args` parsing,
   `par-each`,
   `glob`,
   and a `nu -c $"echo ($args)"`
  re-eval trick:
   `test`,
   `buildAndTest`,
   `watch:test:unit`,
   the `test:*` family.

These bootstrap fresh trees and run CI-shaped work.
Verify each on a fresh-clone throwaway before removing the nushell default.

## Recommended sequencing

The per-task and array-`run` mechanisms make this incremental,
 with no big-bang flip.

1. Migrate the root `enter` hook to the `bootstrap` task (array `run`).
   Regenerate `mise.toml` and verify on a fresh-clone throwaway.
2. Migrate the root orchestration (`fanout`,
    the `test`/`buildAndTest`/`watch:test:unit` family)
   to inline `node -e` bodies,
    reproducing the `usage_args` unescaping deliberately.
3. Convert the `;`-chained command-runners to array `run` form across packages.
4. Migrate the seven remaining logic-heavy package files to inline `node -e`.
5. Convert the nushell-builtin command-runners (for example `print '...'`) to portable forms or `node -e`.
6. Only after no body relies on the nushell default,
    remove the four `*_default_*_shell_args`
   settings (revert to mise defaults) and remove the `nushell` tool pin (`mise.no-env.toml:69`).
7. Update the stale comments and the AGENTS.
   md rules (below).

Before step 6,
 confirm the tree is clean:

```sh
rg -n 'nu -c|nushell|\bnu\b' mise.no-env.toml mise.toml packages
```

## AGENTS.md rule rewrites

These rules currently mandate nushell and `mise.*.ts`,
 so they must change as part of the migration.

- `CM2` currently says mise task `run` commands use nushell and chain sequentially with `;`.
  Rewrite:
   mise tasks use mise's default shell (`sh`/`cmd`) for single bare commands;
  sequence with the array `run` form (mise stops on first failure),
   never `;`-chaining;
  override `shell = "node -e"` for logic or non-portable bodies.
- `SCR` currently says to use inline nushell or TypeScript files named `mise.<action>.ts`.
  Rewrite:
   never write bash/powershell scripts or nushell;
  put task logic inline in a `node -e` body,
   or in a package's normal bin invoked as a command-runner;
  never create `mise.*.ts` files.
- `AP4` (the `#!/usr/bin/env bun` shebang for CLI bin entries) is unchanged this session;
  it concerns CLI package bins and Bun,
   which stays.

## Stale comments and pins to update

- `mise.toml` and `mise.no-env.toml`:
   the `# Primary runtime` label above `bun`,
  and the comment describing `node` as merely needed by some packages.
- `mise.no-env.toml:203-206`:
   the comments asserting nushell is used for all task execution.
- `mise.no-env.toml:69`:
   the nushell tool pin,
   removed once nothing references `nu`.

## Cross-platform (Windows) requirement

Every mise task must run on Windows.
The design satisfies this by construction:
 bare single commands run under both `sh` and `cmd`,
array `run` is sequenced by mise itself,
 and `node -e` is identical across platforms.

There is currently no CI that runs mise tasks on Windows;
the `windows-latest` job in `.github/workflows/cargo-publish.yml` runs `cargo`/`7z`
through GitHub Actions `shell: bash` steps,
 not `mise run`.
A Windows CI smoke job that exercises the migrated tasks is tracked in a separate issue,
not this session.

## Risks

- Bootstrap and CI tasks (`enter`/`bootstrap`,
   `fanout`,
   the `test` family) run on fresh clones and in CI.
  A regression blocks everyone.
  Verify each on a fresh-clone throwaway before removing the nushell default.
- `usage_args` arrives shell-escaped;
  the current code re-evaluates it with `nu -c`.
  The `node -e` replacement must reproduce that unescaping deliberately,
   not assume whitespace splitting.
- `fanout`'s parallel `par-each` becomes inline `node -e` spawning concurrent children;
  it is substantial inline logic and the most likely candidate for the escape valve.
- The Windows requirement is unverified in CI this session;
  the smoke-job issue closes that gap.

## Decisions resolved (2026-06-10 grilling session)

- Premise:
   the Node migration is real;
   Bun removal is deferred;
   this session replaces nushell with Node only.
- Approach:
   mise platform defaults for trivial bodies,
   array `run` for sequencing,
  `shell = "node -e"` only where `sh`/`cmd` would choke.
   The A/B/C options are superseded.
- No `.ts` task helper files;
   logic inline as `node -e`,
   with a per-body escape valve.
- File-task interpreter policy (the issue's second open decision):
   moot.
   With no `.ts` task files,
   there is no file-task interpreter to choose
   (no shebang,
   `use_file_shell_for_executable_tasks`,
   or non-executable policy is needed).
- prefix-dev/shell:
   dropped (array `run` removes its advantage;
   alpha and from-source cost remain).
- Enter hook:
   simplified to a bootstrap task running bare `mise install`/`mise upgrade`;
   friction eliminated.
- file-enforcer's `bun` invocation:
   deferred to the Bun-removal session.
- Windows CI smoke job:
   tracked in a separate new issue,
   not this session.
