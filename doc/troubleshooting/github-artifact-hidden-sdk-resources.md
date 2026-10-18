# GitHub `upload-artifact` at `043fb46d` omits compiled SDK dot resources by default

## Symptom

The frozen-source native host build succeeded,
but its published artifact omitted a resource explicitly indexed by the producer.
The boundary was measured in GitHub Actions run `39119985290`,
using `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.

The producer indexed
`artifacts/package/pi-plugin/auto-mode/dist/native-release-E6DmsJ/pi/ai/dist/providers/data/.manifest.json`,
3,762 bytes with SHA-256 `a4c0a81f2cc4323b81d4c5d3886b343dc226939168f33e8eb731c928a81cfce9`.
That exact path was absent from the actual ZIP.
Every one of its 33,912 actual members was independently decompressed and hashed;
a deliberately corrupted extracted fixture was rejected.

This establishes an output-membership gap.
It does not establish that a runtime consumer needs that resource or fails without it.
The evidence and verification implementation are retained in
[`depot-complete-coverage-node-host-receipts.json.gz`](../planning/depot-complete-coverage-node-host-receipts.json.gz).

## Root cause

The exact uploader source was fetched in a disposable checkout of
[`actions/upload-artifact`](https://github.com/actions/upload-artifact)
at commit `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.
The integration omitted the hidden-file input.
The action's `action.yml:43` declares its default:

```yaml
# action.yml:43
include-hidden-files:
  description: >
    If true, hidden files will be included in the artifact.
    If false, hidden files will be excluded from the artifact.
  default: 'false'
```

`src/upload/input-helper.ts:12` reads that boolean input:

```typescript
// src/upload/input-helper.ts:12
const includeHiddenFiles = core.getBooleanInput(Inputs.IncludeHiddenFiles)
```

`src/upload/upload-artifact.ts:27` passes it to file discovery:

```typescript
// src/upload/upload-artifact.ts:27
const searchResult = await findFilesToUpload(
  inputs.searchPath,
  inputs.includeHiddenFiles
)
```

`src/shared/search.ts:82` creates the globber with the selected options:

```typescript
// src/shared/search.ts:82
export async function findFilesToUpload(
  searchPath: string,
  includeHiddenFiles?: boolean
): Promise<SearchResult> {
  const searchResults: string[] = []
  const globber = await glob.create(
    searchPath,
    getDefaultGlobOptions(includeHiddenFiles || false)
  )
```

`src/shared/search.ts:14` explicitly selects the exclusion:

```typescript
// src/shared/search.ts:14
function getDefaultGlobOptions(includeHiddenFiles: boolean): glob.GlobOptions {
  return {
    followSymbolicLinks: true,
    implicitDescendants: true,
    omitBrokenSymbolicLinks: true,
    excludeHiddenFiles: !includeHiddenFiles
  }
}
```

An explicitly named hidden ancestor and a genuinely hidden child are different boundaries.
Successful upload from a receipt directory inside a dot directory does not prove that
its descendant `.manifest.json` files are included.
No unsupported-hidden-files or uploader-defect claim follows from this result.

## Verification

The failing catalog is the indexed SDK resource omitted from the actual original ZIP.
The working catalog is the original ZIP's 33,912 independently verified actual members.
The archive verifier also rejects an altered extracted file and accepts its restored bytes.
These controls validate membership and byte comparison,
not a restored application's runtime behavior.

A separate immutable follow-up is dispatched as run `39124269347`,
harness `28bf38b0281f3bcace40b70d8b989d6e0ef7f875`,
against the same application source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
It requests explicit hidden-file inclusion,
then restores the one source-bound artifact into a fresh checkout without rebuilding the application.
Its actual domain owner retains the known `none` frontier assertion failure.
No successful inclusion or restored runtime result is credited until that run's receipts are validated.

## Verified workarounds

No replacement is yet runtime-qualified by this document.
The explicit-input follow-up separates uploader membership,
source and dependency admission,
restoration,
and actual host execution.
Broad hidden-file inclusion also requires keeping the upload path restricted to reviewed outputs;
enabling it for a whole checkout could include unrelated files.

## What does not work

- Treating artifact-created metadata as proof that every indexed output is present.
- Treating an explicit hidden ancestor as proof that hidden descendants are included.
- Silently dropping missing producer declarations from a verifier.
- Calling the omitted resource a runtime requirement before exercising that consumer boundary.

## Upstream filing decision

Nothing to add upstream for the observed default exclusion:
the integration omitted an input whose false default is explicit in the pinned action source.

- Upstream fault is not established;
  the measured boundary matches the declared input behavior.
- Upstream can change the filter,
  but the integration already has a documented control.
- No upstream change proposal is necessary for the measured omission.
- The failure is reproducible as an artifact-membership comparison,
  while restored runtime impact remains unmeasured.
- A repository-side explicit-input consumer is being tested without changing production workflows.
- No issue or comment was filed,
  and no defect-only duplicate search is represented as completed.
