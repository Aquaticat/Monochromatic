# Divergent auto-push with concurrent worktree edits

## Observed failure

On 2026-10-18,
a scoped auto-mode commit lands locally through the native Git wrapper,
then its automatic push fails with Git's `main -> main (non-fast-forward)` rejection.
The wrapper prints:

```text
cli-git: commit saved locally, but auto-push to origin failed; run `git push` when ready.
```

An ordinary merge then refuses to overwrite concurrent uncommitted edits in
`doc/handover/slint-ide-0x.md` and `package/desktop-app/ide/README.md`.
Those edits are unrelated to the auto-mode commit and remain owned by concurrent work.
The rejected merge does not establish a conflicting committed history.

## Wrapper ownership

`package/git-policy/cli/src/native/auto_push.rs` defines the existing-upstream command as
`UPSTREAM_PUSH_ARGUMENTS = &["push"]`
and the fallback message as `PUSH_FAILED_NOTE`.
Repeating that command cannot itself integrate divergent histories.
The wrapper's successful commit exit and retained failure output do not establish successful publication.

[Issue 1769](https://github.com/Aquaticats/Monochromatic/issues/1769)
records the requested isolated reconciliation,
preservation of concurrent state,
upstream reachability check and bounded handling of further remote advancement.
The user explicitly requested the issue.
Searches across open and closed issues for divergent auto-push,
`non-fast-forward` and dirty auto-push,
plus the auto-push PR search,
return no matching report at filing time.
This is separate from [issue 1768](https://github.com/Aquaticats/Monochromatic/issues/1768),
which concerns launcher protection and executable resolution.
No wrapper implementation fix is claimed.

## Recovery evidence

The supervisor creates a detached sparse worktree under private agent scratch,
using the qualified wrapper for every Git mutation.
The original worktree's dirty paths are not stashed,
restored,
staged or overwritten by this recovery.
The first sparse setup still has an uninitialized checkout and its merge refuses missing paths.
Initializing only that disposable worktree at its captured commit produces clean tracked state.

At recovery's next fetch,
upstream `0def389909beb770a1054001c352bd3cdb2b9fb2` already contains the captured local
`ebefb4de83ca67ef8fbc11f189358338b8c2af92`.
The isolated worktree fast-forwards and its explicit non-forced push is up to date.
Ancestry checks confirm both captured histories reach upstream.
SHA-256 checks confirm both originally blocking dirty files remain unchanged.
The original branch is untouched.
Publication at that checkpoint is established;
the supervisor does not claim to have authored the already published reconciliation.

The retained receipt is
`${HOME}/temp/agent/pi-mimo-preparation-failure-20261018/divergent-auto-push-recovery.json`.
The same private directory contains the exact issue body and wrapper output.
Later commits require their own upstream reachability check.
An isolated publication worktree avoids disturbing concurrent edits,
but does not itself advance the original dirty checkout.
