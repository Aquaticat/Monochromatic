# cli-git

Git wrapper that enforces safety rules before forwarding to the real git binary.

## Rules

**Require root**: when the effective working directory is inside a git
repository, rejects commands unless that directory is the repository root
(where `.git` lives). `.git` may be a directory or a file, so linked worktrees
and submodules are checked the same way normal repositories are. The effective
directory is `process.cwd()` with every pre-subcommand `-C <path>` applied in
order, matching git's own resolution, so `git -C /repo status` from anywhere
passes the check. When no `.git` is found up the tree from the effective
directory, the command passes through to real git untouched, so git itself
reports the missing-repo error if relevant. Exempt subcommands: `init`,
`clone`, `version`, `help`, and `config` with `--global`/`--system`/`--list`.

**Add explicit**: rejects `git add` invocations that use bulk-staging
patterns (`.`, `./`, `*`, `:/`, `-A`/`--all`, `-u`/`--update`), which sweep
up paths the caller did not intend to stage and leave the index in a state
that does not match a single logical change. Name the paths explicitly, or
pass `--no-enforce-bulk-add` to bypass for one invocation; the flag is stripped
before forwarding to real git. The rule walks pre-subcommand global options
the same way atomic-push does.

**Atomic push**: injects `--atomic` into `git push` commands automatically,
ensuring all refs update together or none do. Override with `--no-atomic`.
The rule walks pre-subcommand global options (`-C <path>`, `-c key=val`,
`--git-dir <path>`, etc.) so forms like `git -C /repo push` still fire.

**Commit only**: injects `-o` (a.k.a. `--only`) into `git commit` commands so
every commit must name the paths it includes rather than picking up whatever is
staged. `git commit -m <msg>` without paths is rejected by the wrapper before
git can emit its opaque `No paths with --include/--only` fatal. `git commit -a`
and `git commit --all` are rejected because they stage tracked modifications
implicitly. Pathless commits remain valid when git permits them with `--amend`,
`--allow-empty`, or `--pathspec-from-file`. Skipped when `-o`, `--only`, or
`--no-only` is already present (the user has made an explicit choice). Escape
hatch for a single invocation: pass `--no-enforce-only`, which is stripped
before forwarding to real git. The rule walks pre-subcommand global options the
same way atomic-push does.

**Status hints off**: injects `-c advice.statusHints=false` before `git status`
so git suppresses its stock hints, which suggest patterns the wrapper rejects
(`git add` with bulk patterns, `git commit -a` colliding with commit-only's
`-o`). A cli-git note prints after the status output describing the wrapper's
constraints. Skipped when the user has already set `advice.statusHints=...` via
`-c` (the user's explicit choice wins).

## How it works

The wrapper shadows the system `git` binary on PATH (via mise bin linkage).
It scans PATH to find the real git binary, skipping its own entry.
Self-shim detection checks both the package name and the bundled entry path
`packages/cli/git/dist/final/node/index.mjs`, because pnpm-generated shims can
point at the built file without naming the package.
Arguments pass through a rule pipeline that may reject or transform them,
then the real git is spawned with full stdio inheritance.

## Adding rules

Rules are functions with the signature
`(args: readonly string[]) => readonly string[] | Promise<readonly string[]>`.
A rule can return modified args or throw to reject the command.
Add new rules to the `RULES` array in `src/index.ts`.
