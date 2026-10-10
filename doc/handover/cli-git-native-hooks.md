# cli-git native hook dispatch and hook lock (lane hooks)

## Purpose

This lane ports slice 4 of `doc/handover/cli-git-native-transactions.md` into the native wrapper:
the dispatch plan (`plan.json`), hook entries, the dispatcher entered by a start name inside a
transaction's `hooks` directory, the hook lock at `<git-common-dir>/cli-git/hook.lock`,
and the preparation lease checks used by nested invocations.
Branch `feat/cli-git-native-hooks`, worktree `.claude/worktrees/cli-git-lane-hooks`.
Paths starting with `src/`, `bin/`, `native-interop/` or `e2e/` are relative to `package/git-policy/cli/`.

## Probe

Question: does Git 2.56.0 start a `core.hooksPath` hook that is a symbolic link with the link's path as its start name?

Script: `${HOME}/temp/agent/hooks-probe/probe.sh`, a shell script that links `hooks/pre-commit` and
`hooks/commit-msg` to a printer script, sets `core.hooksPath`, and commits.
Run as `podman run --rm --init --network=none --memory=2g --cpus=2 --security-opt label=disable`
with image `6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`
(the gate's audited Git 2.56.0 base) and the script mounted read-only.

Output:

- `git version 2.56.0`
- `argv0=/work/hooks/pre-commit args=` (the commit's `pre-commit` hook, through the link)
- `argv0=/work/hooks/commit-msg args=.git/COMMIT_EDITMSG`
- `argv0=/work/hooks/pre-commit args=foo` (direct `git hook run --ignore-missing pre-commit -- foo`)

Conclusion: Git starts the hook with the path of the link (the `hooks` directory joined with the event name)
as argv[0], so the start name is the link path, not the resolved target.
The `Choices` and binary tests rely on this.

Git 2.55.0 (the host's `/usr/bin/git`, run with `PATH=/usr/bin:/bin` so the installed cli-git wrapper stays out)
gives the same three lines, with the probe directory under the scratch directory in place of `/work`:
`git version 2.55.0`, then `argv0=<hooks>/pre-commit args=`, `argv0=<hooks>/commit-msg args=.git/COMMIT_EDITMSG`,
and `argv0=<hooks>/pre-commit args=foo`.
No difference between 2.55.0 and 2.56.0 was found for the start name.
The plain host `git` on PATH is the installed cli-git wrapper, so a probe run through it proves nothing about Git;
the first host attempt was discarded for that reason.
