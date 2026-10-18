# Git policy wrapper disappears from a replacement launcher PATH

## User boundary and observed failure

The user requires reasonable consumers to use the tool correctly without unexpected behavior.
Documentation alone does not satisfy that requirement.

A Pi RPC investigation launcher supplied a replacement `PATH` containing fixture binaries,
user-local binaries and system directories.
It omitted the repository's `.cache/cli-git-bin` directory.
Measured inside the running container,
ordinary `git` resolved to `/usr/bin/git`.
This was the supervising agent's launcher defect,
not an intentional bypass by the worker.

The worker separately recomputed an unstaged path list after staging it.
The list became empty.
Commit `8b34f75c03b65edc6fdfc575c48f22e44a9def77` consequently included concurrent documents.
The command-construction failure and inactive wrapper are distinct defects.
The wrapper could reject that operation only if invoked.

## Controlled verification

The installed wrapper link identifies version `0.1.6`.
The underlying Git reports `2.56.0`.
Disposable repositories inside a network-disabled container have fixture-local identity,
2 GiB memory and two CPUs.
No probe mutates the real repository.

Each fixture has committed `owned.txt` and `concurrent.txt` files.
A concurrent change is staged first.
The probe captures the nonempty list for `owned.txt`,
stages it and proves that recomputing the unstaged list yields no paths.

- The wrapper rejects `commit --message ... --` with exit 1 and diagnostic
  `commit-only/pathspec-required`.
  `HEAD` remains unchanged.
- The wrapper accepts the captured explicit path list with exit 0.
  Only `owned.txt` is committed;
  the concurrent change remains staged.
- System Git accepts the empty list with exit 0 and commits both files.
- Both executable paths print `git version 2.56.0` for `--version`.
  That version probe does not establish that policy enforcement is active.

The retained receipt is
`${HOME}/temp/agent/pi-mimo-preparation-failure-20261018/git-wrapper-empty-pathspec-probe.json`.
The first harness attempt expected the wrong diagnostic suffix,
`no-pathspec`.
The corrected assertion uses the observed `pathspec-required` code;
both attempt logs are retained.

## Remedy and ownership

### Separate missing-helper failure

The source worker subsequently hit Git's diagnostic
`git-lfs filter-process: line 1: git-lfs: command not found`.
An unrelated tracked PNG required its clean filter while Git prepared a scoped commit.
The replacement PATH omitted the helper as well as the original wrapper directory.

A separate disposable fixture compares raw Git and the wrapper,
each with and without the same qualified LFS helper.
The fixture stages only `owned.txt` and changes an unrelated LFS-tracked PNG.
Both executables exit 128 without the helper and leave `HEAD` unchanged.
Both exit 0 with the helper and commit only `owned.txt`.
This reproduces valid Git filter behavior exposing the launcher defect;
it does not establish a wrapper-specific LFS bug.
The receipt is
`${HOME}/temp/agent/pi-mimo-preparation-failure-20261018/git-wrapper-lfs-environment-probe.json`.

Future launcher construction preserves the complete resolved mise PATH,
mounts qualified `git-lfs` explicitly and retains the policy wrapper first.
Checking both tools inside the final child environment remains part of launch acceptance.

### Qualified wrapper invocation

The live disposable container now has `/fixture-bin/git` linked to the repository's actual wrapper.
A subsequent `command -v git` returns `/fixture-bin/git`.
Invoking `git cli-git --help` in that same container confirms the policy namespace is active.

Future fixture launches mount the qualified wrapper executable directly at `/fixture-bin/git`
and reject a missing executable or unexpected policy-help response during setup.
This avoids depending on incidental shell activation.
The main agent's subsequent repository commits invoke `.cache/cli-git-bin/git` explicitly.

The repository installation and generated path are owned by `mise.no-env.toml`
and `file-enforcer.config.ts`.
The commit-only decision is in `package/git-policy/cli/src/native/rule_commit_only.rs`;
its diagnostic is in `rule_commit_only_message.rs` beside it.
The wrapper README already describes the PATH bypass.
The required durable remedy is an observable launcher preflight,
not another documentation-only warning.

[Issue 1768](https://github.com/Aquaticats/Monochromatic/issues/1768) records this UX and integration gap.
[Issue 575](https://github.com/Aquaticats/Monochromatic/issues/575) covers related explicit real-Git invocations.
Recognizing only absolute paths would miss this incident's ordinary `git` spelling.
