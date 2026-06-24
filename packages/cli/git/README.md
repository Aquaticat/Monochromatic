# cli-git

Git wrapper that enforces safety rules before forwarding to the real git binary.

## Rules

**Require root**:
 when the effective working directory is inside a git
repository,
 rejects commands unless that directory is the repository root
(where `.git` lives).
 `.git` may be a directory or a file,
 so linked worktrees
and submodules are checked the same way normal repositories are.
 The effective
directory is `process.cwd()` with every pre-subcommand `-C <path>` applied in
order,
 matching git's own resolution,
 so `git -C /repo status` from anywhere
passes the check.
 When no `.git` is found up the tree from the effective
directory,
 the command passes through to real git untouched,
 so git itself
reports the missing-repo error if relevant.
 Exempt subcommands:
 `init`,
`clone`,
 `version`,
 `help`,
 and `config` with `--global`/`--system`/`--list`.

**Linked worktree only for risky worktree commands**:
 rejects guarded commands
unless the effective working directory is a linked git worktree root.
 Guarded
forms are all `git stash`,
 state-changing `git clean`,
 and destructive
`git reset` modes (`--hard`,
 `--merge`,
 `--keep`).
 This blocks the main
worktree and `--git-dir` / `--work-tree` forms launched from unrelated
directories,
 because these commands can revert,
 delete,
 or rewrite filesystem
state outside what the caller expects from current cwd.
 `git clean -n` and
`git clean --dry-run` pass through because Git documents them as inspection
only;
 `git clean -i` remains guarded because interactive mode can delete
selected paths.
 Clean dry-run,
 no-dry-run,
 interactive,
 and no-interactive
options are evaluated in argv order to match Git's last-option-wins behavior.
Run guarded commands from a linked worktree root,
 or pass
`-C <linked-worktree-root>` before the subcommand.
 Pass
`--no-enforce-worktree` after the guarded subcommand and before any `--`
pathspec separator to bypass linked-worktree enforcement for one invocation;
the wrapper strips the flag before forwarding to real git.
 The existing
require-root rule still rejects linked-worktree subdirectories.

Repositories under a baked-in tool-cache directory are exempt from this rule.
A third-party tool (currently uv,
 whose git cache resolves from `UV_CACHE_DIR`,
`$XDG_CACHE_HOME/uv`,
 or `~/.cache/uv`) owns disposable clones there and runs
destructive git against them itself,
 so `git reset --hard` and the other
guarded forms pass through instead of being rejected as a main worktree.
 The
exempt set is `DEFAULT_ALLOWED_WORKTREE_DIRS` in `src/allowed-worktree-dirs.ts`;
both the configured directory and the repository's git-dir are realpath-resolved
before a segment-aware containment check,
 so symlinks such as `/home` aliasing
`/var/home` do not defeat the match.
 Add sibling tool caches there when a new
tool needs the same exemption.

**Branch worktree only**:
 rejects branch creation in the current worktree and
redirects to creating the branch together with its own linked worktree.
 Guarded
forms are `git branch <name>`,
 `git branch -c` / `git branch -C` /
`git branch --copy`,
 `git checkout -b` / `git checkout -B`,
`git checkout --orphan`,
 `git checkout --track`,
 `git switch -c` /
`git switch -C`,
 `git switch --create` / `git switch --force-create`,
`git switch --orphan`,
 and `git switch --track`.
 The wrapper also
rejects the implicit remote-tracking branch guess that `git switch <name>` and
`git checkout <name>` perform when exactly one matching remote branch exists and
no local branch exists.
 Listing,
 deletion,
 rename,
 upstream edits,
 detached
checkouts,
 path checkouts,
 and `git worktree add -b <branch> <path> [<start-point>]`
pass through.
 Pass
`--no-enforce-worktree-branch` after the guarded subcommand and before any `--`
pathspec separator to bypass for one invocation;
 the wrapper strips the flag
before forwarding to real git.

**Add explicit**:
 rejects `git add` invocations that use bulk-staging
patterns (`.`,
 `./`,
 `*`,
 `:/`,
 `-A`/`--all`,
 `-u`/`--update`),
 which sweep
up paths the caller did not intend to stage and leave the index in a state
that does not match a single logical change.
 Pathspecs after `--` are still
scanned for broad pathspecs such as `.` and `*`,
 so `git add -- .` is rejected
for the same reason as `git add .`.
 Name the paths explicitly,
 or pass
`--no-enforce-bulk-add` to bypass for one invocation;
 the flag is stripped
before forwarding to real git.
 The rule walks pre-subcommand global options
the same way atomic-push does.

**Atomic push**:
 injects `--atomic` into `git push` commands automatically,
ensuring all refs update together or none do.
 Override with `--no-atomic`.
The rule walks pre-subcommand global options (`-C <path>`,
 `-c key=val`,
`--git-dir <path>`,
 etc.) so forms like `git -C /repo push` still fire.

**Commit only**:
 injects `-o` (a.
k.
a.
 `--only`) into `git commit` commands so
every commit must name the paths it includes rather than picking up whatever is
staged.
 `git commit -m <msg>` without paths is rejected by the wrapper before
git can emit its opaque `No paths with --include/--only` fatal.
 `git commit -a`
and `git commit --all` are rejected because they stage tracked modifications
implicitly.
 Pathless commits remain valid when git permits them with `--amend`,
`--allow-empty`,
 or `--pathspec-from-file`.
 Because a pathless only-mode commit reuses HEAD's existing tree (git documents
that `git commit --only` with no pathspec ignores the index),
 pathless `--amend`
and `--allow-empty` forms get one more check before `-o` is injected:
 when the
index differs from HEAD,
 the wrapper rejects the command instead of letting an
injected `-o` silently ignore the staged changes,
 which would otherwise turn
`git add <path>` followed by `git commit --amend --no-edit` into a silent no-op
(new commit hash,
 old tree,
 change left staged,
 no warning).
 The rejection
message names the explicit choices:
 pass pathspecs to include those paths
(`git commit --amend <path>`),
 pass `--only` to proceed without them,
 or pass
`--no-only` to commit the entire index.
 When the index matches HEAD,
 or git
cannot answer (for example before the first commit),
 the pathless form passes
through with `-o` injected as before.
 Skipped when `-o`,
 `--only`,
 or
`--no-only` is already present (the user has made an explicit choice),
 and
when `-i`/`--include` (any accepted abbreviation) is present,
 because git
forbids combining include mode with `--only` and the user already chose how
paths combine with the index.
 Pathless commits during a merge,
 cherry-pick,
or revert conclusion pass through without `-o`:
 git forbids partial commits
in those states ("cannot do a partial commit during a merge"),
 so the
pathless `git commit` that records the resolution works unchanged instead of
being rejected with advice that would dead-end.
 The pathless rejection
message also names `--no-only` as the commit-the-entire-index choice.
 Escape
hatch for a single invocation:
 pass `--no-enforce-only`,
 which is stripped
before forwarding to real git.
 Pathspec detection uses a scanner for known
separated-value commit options,
 so no-value flags such as `-q` and `--dry-run`
do not consume the following pathspec while wrapper-only validation runs.
 The
rule walks pre-subcommand global options the same way atomic-push does.

**Status hints off**:
 injects `-c advice.statusHints=false` before `git status`
so git suppresses its stock hints,
 which suggest patterns the wrapper rejects
(`git add` with bulk patterns,
 `git commit -a` colliding with commit-only's
`-o`).
 A cli-git note prints after the status output describing the wrapper's
constraints.
 Skipped when the user has already set `advice.statusHints` via
`-c` (the user's explicit choice wins);
 both the valued form
(`-c advice.statusHints=true`) and git's bare boolean-true form
(`-c advice.statusHints`) count,
 matched case-insensitively the way git
matches config keys.

## Post-commit auto-push

After a successful `git commit`,
 the wrapper backs up the new commit by
pushing it.
 Dry runs do not push:
 besides `--dry-run` itself,
 git documents
`--short`,
 `--porcelain`,
 `--long`,
 and `-z`/`--null` as implying a dry run,
and the wrapper recognises all of them (in any accepted long-option
abbreviation) via the same parsed commit region the commit-only rule uses.
 A
branch that already has a configured upstream is pushed with a plain
`git push`,
 following that upstream wherever it lives;
 only a branch with no
upstream yet is pushed with `git push --set-upstream origin HEAD`,
 so a
branch tracking another remote never has its tracking configuration silently
re-pointed to origin.
 The push runs against the real git binary
in the same directory the commit landed in (respecting pre-subcommand
`-C <path>`),
 so it does not re-enter the wrapper yet still fires git's native
pre-push hook.

The push output is filtered:
 on a clean push only the GitHub `remote:` lines are
shown;
 on a failed push the full output is shown so a rejection,
 a pre-push
block,
 or an offline error stays diagnosable.
 Auto-push is skipped silently
when there is nowhere to back up to (no upstream and no `origin` remote),
 and
skipped with a printed note when HEAD is detached (mid-rebase,
mid-cherry-pick,
 or a detached checkout),
 where pushing `HEAD` cannot name a
branch and previously produced a confusing guaranteed failure.

Because git ignores a post-commit hook's exit status,
 a failed backup push is
surfaced but never changes the commit command's own exit code:
 the commit stays
saved locally and a later `git push` retries it.

## How it works

The wrapper shadows the system `git` binary on PATH (via mise bin linkage).
It scans PATH to find the real git binary,
 skipping its own entry.
Self-shim detection checks both the package name and the bundled entry path
`packages/cli/git/dist/final/node/index.mjs`,
 because pnpm-generated shims can
point at the built file without naming the package.
Arguments pass through a rule pipeline that may reject or transform them,
then the real git is spawned with full stdio inheritance.
 After a successful
commit,
 the new commit is auto-pushed to origin as described above.

## Adding rules

Rules are functions with the signature
`(args: readonly string[]) => readonly string[] | Promise<readonly string[]>`.
A rule can return modified args or throw to reject the command.
Add new rules to the `RULES` array in `src/index.ts`.
