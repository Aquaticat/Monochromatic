# Depot Windows harness checkout encounters Git's long-path limit

## Symptom

Depot Windows desktop jobs `117578793896` and `117578794032`
in [run `39094767696`](https://github.com/Aquaticats/Monochromatic/actions/runs/39094767696)
stop in `Checkout frozen trial provenance harness`.
Git for Windows `2.55.0.windows.5` emits `Filename too long`
for deeply nested Git-policy fixture objects and exits with code `1`.
The affected jobs do not execute the desktop consumers.
The unchanged GitHub ARM row checks out the same harness revision successfully.

The complete original logs and artifact digest checks are retained in the private
`depot-native-followup-artifacts/desktop.windows/collection.json` receipt.
The original source case remains unchanged.

## Cause and verification boundary

The immediate failing operation is Git's working-tree checkout.
The [Git for Windows documentation][long-paths]
states that long-path support is disabled by default
and that `core.longpaths=true` enables support in C-based Git commands.
The prior run did not probe its effective configuration,
so an unset or false setting on those particular runners is not yet a measured fact.
Do not generalize this checkout failure to Windows build or test compatibility.

## Recovery under execution

The recovery harness starts with a Node command before either checkout.
It queries the effective `core.longpaths` value and origin,
enables the option in the disposable runner's user configuration,
and verifies that the effective value is `true`.
The [Git configuration documentation][git-config]
defines the user configuration scope used by `--global`.

Harness revision `20b7e331ad5a4e29bd493aba1829fff5f07d27a8`
preserves every existing consumer step value and every matrix row.
The recovery adds only the bootstrap and changes the workflow name.
Its historical source-case manifest hashes are unchanged.
The first failed allocations remain part of the evaluation cost.

The real recovery checkout and its consumer outcomes are pending.
The configuration readback alone will not establish that checkout or the desktop consumers pass.
The declared `depot-windows-2025-4` label is retained.
The original full checkout is retained as the positive control for the reported path failure.

## Limits and upstream disposition

Git's documented opt-in is not evidence of an upstream Git defect.
The documentation also limits its claim to supported Git operations;
other tools still need their own real consumer verification.
No Windows registry or account setting is changed.
No upstream issue is filed while the supported configuration is being exercised.

[long-paths]: https://gitforwindows.org/git-cannot-create-a-file-or-directory-with-a-long-path
[git-config]: https://git-scm.com/docs/git-config
