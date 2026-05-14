# cli-git

Git wrapper that enforces safety rules before forwarding to the real git binary.

## Rules

**Require root**: when the effective working directory is inside a git
repository, rejects commands unless that directory is the repository root
(where `.git` lives). The effective directory is `process.cwd()` with every
pre-subcommand `-C <path>` applied in order, matching git's own resolution,
so `git -C /repo status` from anywhere passes the check. When no `.git` is
found up the tree from the effective directory, the command passes through
to real git untouched, so git itself reports the missing-repo error if
relevant. Exempt subcommands: `init`, `clone`, `version`, `help`, and
`config` with `--global`/`--system`/`--list`.

**Atomic push**: injects `--atomic` into bare `git push` commands automatically
when `push` is the first argv token, ensuring all refs update together or none do.
Override with `--no-atomic`. Current limitation: pre-subcommand global options such
as `git -C /repo push` bypass this rule.

**Commit only**: injects `-o` (a.k.a. `--only`) into `git commit` commands so
every commit must name the paths it includes rather than picking up whatever is
staged. Skipped when `-o`, `--only`, or `--no-only` is already present (the user
has made an explicit choice). Escape hatch for a single invocation: pass
`--not-only`, which is stripped before forwarding to real git. Current limitation:
pre-subcommand global options such as `git -C /repo commit` bypass this rule.

## How it works

The wrapper shadows the system `git` binary on PATH (via mise bin linkage).
It scans PATH to find the real git binary, skipping its own entry.
Arguments pass through a rule pipeline that may reject or transform them,
then the real git is spawned with full stdio inheritance.

## Adding rules

Rules are functions with the signature
`(args: readonly string[]) => readonly string[] | Promise<readonly string[]>`.
A rule can return modified args or throw to reject the command.
Add new rules to the `RULES` array in `src/index.ts`.
