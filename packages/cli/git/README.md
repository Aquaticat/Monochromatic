# cli-git

Git wrapper that enforces safety rules before forwarding to the real git binary.

## Rules

**Require root**: when the working directory is inside a git repository,
rejects commands unless it is the repository root (where `.git` lives). When
no `.git` is found up the directory tree, the command passes through to real
git untouched, so git itself reports the missing-repo error if relevant.
Exempt subcommands: `init`, `clone`, `version`, `help`, and `config` with
`--global`/`--system`/`--list`.

**Atomic push**: injects `--atomic` into `git push` commands automatically,
ensuring all refs update together or none do. Override with `--no-atomic`.

## How it works

The wrapper shadows the system `git` binary on PATH (via mise bin linkage).
It scans PATH to find the real git binary, skipping its own entry.
Arguments pass through a rule pipeline that may reject or transform them,
then the real git is spawned with full stdio inheritance.

## Adding rules

Rules are functions with the signature `(args: readonly string[]) => readonly string[]`.
A rule can return modified args or throw to reject the command.
Add new rules to the `RULES` array in `src/index.ts`.
