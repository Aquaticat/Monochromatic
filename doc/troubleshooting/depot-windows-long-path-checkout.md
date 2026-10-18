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

The [measured checkout paths](../audit/depot-native-checkout-paths-2026-10-18.evidence.json)
explain why the rows differed without assuming different Git configuration:
the same fixture path occupies 260 characters under Depot's long harness directory,
247 under the GitHub ARM workspace,
and 243 under Depot's shorter native harness directory.
The longer Depot checkout fails;
the other original checkouts succeed.

## Verified recovery

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

The real recovery is complete in
[run `39095647113`](https://github.com/Aquaticats/Monochromatic/actions/runs/39095647113).
All matrix rows record an unset effective `core.longpaths` value before the bootstrap
and `true` afterward.
Both Depot desktop checkouts then succeed at the same 260-character fixture path.
Their original nextest consumers each pass 1432 executed cases,
with one additional summary skip.
The native binary,
PE inspection,
Bash runtime and launch checks succeed.
The original PowerShell file assertion remains failed;
the independent merged-stream and uncaptured-console probes verify the actual version.
The [consumer evidence](../audit/depot-native-consumers-and-variation-2026-10-18.evidence.json)
keeps those outcomes separate.

The unchanged full checkout and original consumers establish recovery beyond configuration readback.
The declared `depot-windows-2025-4` label is retained.
The original full checkout is retained as the positive control for the reported path failure.

## Limits and upstream disposition

Git's documented opt-in is not evidence of an upstream Git defect.
The documentation also limits its claim to supported Git operations;
other tools still need their own real consumer verification.
No Windows registry or account setting is changed.
The supported configuration and real consumers pass the checkout recovery boundary.
There is no upstream Git defect to file from this evidence.

[long-paths]: https://gitforwindows.org/git-cannot-create-a-file-or-directory-with-a-long-path
[git-config]: https://git-scm.com/docs/git-config
