# GitHub rejects a Git 2.56.0 push with GH009 while retaining the local commit

## Symptom

On 2026-10-15,
auto-pushing commit `634b29b15e99197040ad12529cce848258f5a57c` failed with:

```text
remote: error: GH009: Git LFS object integrity could not be checked. Please contact GitHub support.
 ! [remote rejected]       main -> main (pre-receive hook declined)
cli-git: commit saved locally, but auto-push to origin failed; run `git push` when ready.
```

The commit command completed successfully because the commit was saved locally.
A direct remote query still returned its parent,
`6d81bcc32121e4fc8c14ba6975b88c222d5ee0c4`.
This was an actual remote rejection,
separate from the advisory [push-wait notice](cli-git-push-wait-notice.md).

## Root cause boundary

The remote reported failure of its LFS integrity check.
The underlying GitHub server condition is unknown;
later success does not identify that cause.
A Git LFS maintainer attributes this diagnostic to GitHub in
[git-lfs/git-lfs issue 4787](https://github.com/git-lfs/git-lfs/issues/4787#issuecomment-995811913).
The deciding GitHub service implementation was not available for inspection.
No claim about its internal validation algorithm or a local LFS defect is established.

The local commit-preservation behavior is explicit in
`package/git-policy/cli/src/native/auto_push.rs:265`:

```rust
// package/git-policy/cli/src/native/auto_push.rs:265
///   The commit has happened by the time this runs and Git ignores a post-commit hook's status,
///  so a failed push or a failed coordination is printed and returned as `Failed`, and never fails the commit.
```

The failure note is declared separately in
`package/git-policy/cli/src/native/auto_push.rs:45`:

```rust
// package/git-policy/cli/src/native/auto_push.rs:45
pub const PUSH_FAILED_NOTE: &str =
    "cli-git: commit saved locally, but auto-push to origin failed; run `git push` when ready.";
```

The repository-owned wrapper source was inspected at the failed commit.
No third-party client patch was implicated by this evidence.

## Verification

The forwarded Git version was `2.56.0`.
The command entry was `.cache/cli-git-bin/git`.
GitHub's server version was not exposed.
The rejected commit changed only a TypeScript test and its Markdown handover.
That observation does not establish which historical LFS references the remote attempted to validate.

The following commands were run from the repository root:

```sh
# Repository root: read the actual remote instead of relying on a cached tracking ref.
git --version
git show --stat --oneline 634b29b15e
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Observed failure:

- The commit's automatic push returned `GH009` and a rejected remote update.
- The direct remote query still named the parent while local `HEAD` named the saved commit.

Observed success:

- One subsequent ordinary `git push origin main` exited zero.
- A fresh remote query and local `HEAD` both named
  `634b29b15e99197040ad12529cce848258f5a57c`.

No deliberate reproduction of the remote failure was available.
These are incident observations,
not a deterministic reproducer or a guarantee that retry always succeeds.

## Verified recovery

After verifying that the local commit was absent remotely,
the ordinary push succeeded without changing commits,
LFS configuration,
or repository history:

```sh
# Repository root: retry only the intended branch and verify the resulting ref.
git push origin main
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

The retry can transfer the pending branch updates and remains subject to concurrent branch movement.
It does not diagnose or repair an unknown service-side condition.

## What does not work

- A successful commit exit status alone did not prove successful backup to GitHub.
- The narrow tracker query containing both `GH009` and `integrity` returned no results.
  The broader exact phrase `LFS object integrity` found the existing Git LFS issue.
- No force push,
  history migration,
  LFS reinstall,
  or configuration bypass was tried or needed.
  Such changes are not justified by this incident's evidence.

## Upstream filing decision

The `.out-of-scope/` inventory contains no matching exemption.
The existing issue and its comments were read in full.
Its later commenter also reports eventual push success,
but that separate incident does not establish this incident's cause.
There is no new source diagnosis or deterministic reproduction to add.
No upstream message was sent.

1.  Fault: a remote rejection is observed;
    the responsible internal condition is unestablished.
2.  Fixability: the service implementation is unavailable,
    so no specific upstream fix is established.
3.  Supported use: an ordinary existing-branch push was attempted and subsequently accepted.
4.  Contribution policy: no client-code contribution or new report is proposed;
    the maintainer directs this diagnostic to GitHub support.
5.  Likely correction: the available thread gives no decision about this incident.
6.  Prototype: none;
    there is no identified source defect to patch.

The filing artifact is an explicit nothing-to-add record for
[issue 4787](https://github.com/git-lfs/git-lfs/issues/4787).
