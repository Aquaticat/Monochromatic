# Migrating mise task execution from nushell to Node

Status: not yet approved.
This document is a plan for discussion only.
Do not begin implementation until the tracking issue is explicitly approved.

## Why

The team is migrating the repo's primary runtime to Node.
The open question is whether to set mise's task shell to Node and migrate every task body off nushell.
This plan records what that migration actually entails, the load-bearing constraint that shapes it,
and a recommended sequencing.

## The constraint that shapes everything: `node -e` is a JS evaluator, not a command shell

mise runs an inline task body as `<inline-shell-args> "<body>"`.
Today that is `nu -c "<body>"` (`mise.no-env.toml:187`).
Setting the inline shell to Node makes it `node -e "<body>"`, which evaluates the body as JavaScript.

This was verified empirically on Node `v26.3.0` against a throwaway mise project:

- Type annotations in an inline body are stripped and run (`const x: number = 41` worked).
- ESM static `import { readFileSync } from 'node:fs'` works inline;
  dynamic `import()` works; top-level `await` works; multiline bodies work.
- Fail-fast works and is stricter than nushell: a `throw` exits the task nonzero,
  and in a `run = [...]` array a throwing step stops the remaining steps.
  This removes the class of workaround the repo currently carries because nushell `;` is not fail-fast
  (for example `packages/desktop-app/terminal/mise.toml:138`).

The catch is the common case.
A body like `run = "cargo build --release"` is a shell command line, not JavaScript.
Under `node -e` it raises `cargo is not defined`.
The same applies to `podman build ...`, `bun src/x.ts`, `dprint fmt src`, `mise run build; mise run test:unit`,
and nushell builtins such as `print` (`packages/audit/oph-common-look-and-feel/mise.toml:5`).
Migrating these to a Node inline shell means routing each command through `node:child_process`
(for example `execSync('cargo build --release', { stdio: 'inherit' })`), which is a real ergonomic regression
for what are mostly one-line command runners.

So the migration splits cleanly into two populations:

- Logic bodies: orchestration and data handling that genuinely benefit from a real language.
- Command-runner bodies: a single external command, where a shell is the right tool and JS is the wrong one.

## Scope inventory (measured)

All counts from `rg` over the working tree on the migration date.

- `mise.toml` files total: 121.
- Files with at least one inline `run =`: 74.
- Inline `run` bodies total: 263.
- Lines using nushell structured-data builtins
  (`from json`, `where`, `get`, `reduce`, `str *`, `split row`, `path *`, `complete`, `lines`, `error make`): 106.

The 106 logic lines are concentrated, not spread evenly:

- `mise.toml` (root, generated): 39
- `packages/desktop-app/terminal/mise.toml`: 18
- `packages/config/tofu/mise.toml`: 12
- `packages/desktop-app/music-player/mise.toml`: 10
- `packages/fuzz/forbidden-strings/mise.toml`: 8
- `packages/linter/rust/mise.toml`: 4
- a tail of about ten files with a single trivial builtin each (usually one `path join` or `split row`).

The practical reading: roughly eight files carry real nushell logic.
The other roughly sixty-six files with `run` bodies are plain command runners.

### Root shared infrastructure (the hardest part)

The root source is `mise.no-env.toml`.
The committed `mise.toml` is generated from it by file-enforcer (see "Source of truth" below),
so all root edits happen in `mise.no-env.toml`.

Load-bearing nushell in the root that any flip must rewrite first:

- Settings: `unix_default_file_shell_args`, `windows_default_file_shell_args`,
  `unix_default_inline_shell_args`, `windows_default_inline_shell_args` (`mise.no-env.toml:185-188`).
- Tool pin: `"aqua:nushell/nushell" = "latest"` (`mise.no-env.toml:70`).
- `[hooks].enter`: runs `mise install`/`mise upgrade` and filters output with `complete`, `lines`, `where`
  (`mise.no-env.toml`, the `enter` block).
- `[vars].fanout`: discovers direct child tasks via `mise tasks --all --json | from json | get name | where ...`
  and runs them in parallel (`mise.no-env.toml`, the `fanout` block).
- `[vars].monorepo_root_setup`, `[vars].workspace_node_dispatch`, `[vars].ensure_oxlint_config`:
  path handling and bootstrap dispatch (`workspace_node_dispatch` already shells out to `node`).
- Orchestration tasks with `usage_args` parsing, `par-each`, `glob`, `from json | any`, `try/catch`,
  and a `nu -c $"echo ($args)"` re-eval trick: `test`, `buildAndTest`, `watch:test:unit`, the `test:*` family
  (`mise.no-env.toml:367-469` and nearby).

These are the tasks that bootstrap fresh trees and run CI-shaped work.
They are the highest risk and must be migrated and verified before the default shell changes.

## Migration options

### Option B: hybrid, logic to TS files, command runners stay shell (recommended)

Move the eight logic-heavy files and the root orchestration into Node-run `mise.<action>.ts` files
(the pattern already sanctioned by AGENTS.md `SCR` and already used in about thirteen places, run via `node`).
Leave plain command-runner bodies as shell command lines.

- Pros: puts Node where it earns its keep (real logic, types, testability);
  avoids wrapping sixty-plus trivial command lines in `child_process`;
  no global flip required, so it can land incrementally without breaking the tree.
- Cons: the inline shell is not literally Node for every task, so this does not satisfy a strict reading of
  "set mise's shell to Node"; two execution surfaces remain (a command shell plus TS files).

### Option A: literal flip, Node inline shell everywhere

Set `unix_default_inline_shell_args = "node -e"` and rewrite all 263 bodies as JavaScript,
routing every external command through `node:child_process`.

- Pros: one execution surface; satisfies the literal goal; node fail-fast throughout.
- Cons: about two hundred command-runner bodies become `execSync(...)` wrappers, which is verbose and worse to read
  than the command line it replaces; large blast radius if flipped before every body is converted.

### Option C: Node shell-in-JS layer (zx or execa) as the inline shell

Adopt a Node shell-helper (for example zx's `$`) and rewrite bodies to its tagged-template syntax.

- Pros: terse command ergonomics close to nushell, with TS and a single Node surface.
- Cons: adds an external dependency to the task layer; still requires rewriting every body;
  ties task execution to that library's lifecycle.

Ranking: B > C > A.
B over C because B reaches the same Node-for-logic outcome without taking a new dependency into the task layer,
and command runners do not need a shell-in-JS library to stay readable.
C over A because a tagged-template shell helper keeps command lines readable,
whereas A forces every command through `child_process` and produces the least readable result.

## Recommended sequencing (if approved)

1. Decide the file-task policy (next section) and the command-runner policy (Option B keeps a shell for those).
2. Migrate the root logic in `mise.no-env.toml` to Node-run `mise.<action>.ts` helpers:
   `fanout`, the `enter` hook, the `test`/`buildAndTest`/`watch:test:unit` family.
   Regenerate `mise.toml` and verify on a fresh-clone throwaway, not the working tree.
3. Migrate the seven remaining logic-heavy package files
   (terminal, tofu, music-player, forbidden-strings, rust, and the trivial-builtin tail).
4. Convert command-runner bodies per the chosen policy.
5. Only after the inline bodies no longer rely on nushell, flip the four `*_default_*_shell_args` settings.
6. Remove the `aqua:nushell/nushell` pin and update stale comments (see below).
7. Update AGENTS.md `CM2` and `SCR` (see below).

## File-task policy

mise resolves a file task's interpreter as: explicit `task.shell`, then shebang, then extension,
then `default_file_shell` (mise source `src/task/task_executor.rs`, `shell_from_extension`
and the executable short-circuit).

Two confirmed facts:

- `shell_from_extension` maps only `.ps1` to `pwsh`. There is no `.ts` mapping.
- An executable (`chmod +x`) `.ts` file with no shebang takes the direct-exec path,
  the kernel cannot exec it, and it falls back to `sh`, producing `const: command not found`. This was reproduced.

So pick one policy and apply it consistently:

- Add `#!/usr/bin/env node` to each `.ts` task file
  (mirrors AGENTS.md `AP4`, which currently mandates the `bun` shebang), or
- set `use_file_shell_for_executable_tasks = true` and `default_file_shell = "node"`, or
- keep `.ts` task files non-executable and rely on `default_file_shell = "node"` (runs `node file.ts`).

The shebang option is the most explicit and is closest to the existing `AP4` convention.

## Source of truth and regeneration

- Edit `mise.no-env.toml`, never the generated `mise.toml`.
  `mise.toml` is produced by file-enforcer (`file-enforcer.config.ts`, `dest: './mise.toml'`).
- Regenerate with `mise run file-enforcer` (alias defined in `mise.no-env.toml`,
  running `bun packages/dev-script/file-enforcer/src/cli.ts`).
  Note that file-enforcer itself runs via `bun` today; the runtime migration should revisit that invocation.

## Stale comments and pins to update

- `mise.toml:28-30` (source `mise.no-env.toml`): the `# Primary runtime` label sits above `bun`.
- `mise.no-env.toml:51-52`: node is described as merely "Needed by some packages that depend on Node APIs".
- `mise.no-env.toml:185-195`: the comments asserting nushell is used for all task execution.
- `bunfig.toml:14`: `shell = 'bun'` under `# Always use Bun's shell`.
- `mise.no-env.toml:70`: the nushell tool pin, removable once nothing references `nu`.

## AGENTS.md rule updates

Two rules will contradict the migration and must be rewritten as part of it, not left to drift:

- `CM2`: "Mise task run commands use nushell, not bash. Chain sequentially with `;`."
  Under Node, `;` is a JavaScript statement separator, and fail-fast comes from `throw`, not from chaining.
- `SCR`: "Never write bash/powershell scripts; use inline nushell or TypeScript files as `mise.<action>.ts`."
  The "inline nushell" half is replaced by Node.

## Risks

- Bootstrap tasks (`enter` hook, `fanout`, `workspace_node_dispatch`, the `test` family) run on fresh clones and in CI.
  A regression here blocks everyone. Verify each on a fresh-clone throwaway before flipping the default.
- A premature flip of `*_default_*_shell_args` breaks all 263 bodies at once, since they are nushell today.
  The flip must be the last step, after bodies are converted.
- `usage_args` arrives shell-escaped; the current code re-evaluates it with `nu -c`.
  The Node replacement must reproduce that unescaping deliberately, not assume naive whitespace splitting.

## Open questions

- Which option (A, B, or C) is approved?
- File-task policy: shebang, `use_file_shell_for_executable_tasks`, or non-executable?
- Does file-enforcer's own `bun` invocation move to `node` in the same migration or separately?
