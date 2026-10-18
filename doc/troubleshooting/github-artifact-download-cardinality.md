# actions/download-artifact changes the extraction directory when one artifact matches

## Symptom

With `actions/download-artifact` at `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c`,
a workflow that downloads a pattern into `receipts/` and then expects an artifact-named subdirectory
fails when only one artifact matches.
Node 22.23.3 reports:

```text
Error: ENOTDIR: not a directory, open 'receipts/routing-receipt.json/routing-receipt.json'
```

The two-provider routing fixture passes,
but the GitHub-only and Depot-only fixtures fail in the final consumer after their worker jobs succeed.
The original failed runs are
[39099183237](https://github.com/Aquaticats/Monochromatic/actions/runs/39099183237)
and [39099184929](https://github.com/Aquaticats/Monochromatic/actions/runs/39099184929).
This is an incorrect consumer assumption,
not a failed runner allocation or application test.

## Root cause

In the pinned upstream `src/download-artifact.ts:189`,
the extraction target depends on the number of selected artifacts as well as explicit inputs:

```ts
// actions/download-artifact/src/download-artifact.ts:189
path:
  isSingleArtifactDownload ||
  inputs.mergeMultiple ||
  artifacts.length === 1
    ? resolvedPath
    : path.join(resolvedPath, artifact.name),
```

One pattern match extracts the receipt directly into `receipts/`.
Multiple matches with the default merge setting extract into artifact-named subdirectories.
The consumer treated the direct receipt file as a directory.
Its assumption that the default merge setting guarantees subdirectories was wrong.

## Verification

The initial harness is the isolated research commit
`02d1d845baf27a3613fc44f5382866d930ffe1f3`,
at `.github/workflows/music-player-windows.yml`.
Its comparison run
[39099180101](https://github.com/Aquaticats/Monochromatic/actions/runs/39099180101)
passes with two artifacts.
Its intentional worker-failure control
[39099181740](https://github.com/Aquaticats/Monochromatic/actions/runs/39099181740)
fails the final gate as intended.
The single-provider runs reproduce the consumer failure quoted in `Symptom`.

The consumer-side correction will use pool-specific receipt filenames and explicit merged extraction,
then check the complete expected filename set.
The corrected single-provider and two-provider cases must all be exercised before this workaround is verified.

## Verified workarounds

Workaround verification is pending the corrected isolated workflow runs.
No production workflow has changed.

## What does not work

Leaving `merge-multiple` at its default and always adding an artifact-named directory fails
when the pattern selects one artifact.
The successful two-artifact fixture cannot validate the single-artifact consumer path.

## Upstream filing decision

No upstream message is proposed.
The deciding source implements the observed behavior explicitly;
the authored receipt consumer must handle the action's extraction contract.
Source-clone inspection,
duplicate search,
the remaining filing checks,
and corrected-run evidence will be retained with the completed workaround.
