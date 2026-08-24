# Renaming the settled artifact's chunk vocabulary to slice (`#94`)

Proposal, not a decision.
Written 2026-08-24, after measuring the objection the task carried and finding it overstated.
Revised the same day, after reconnaissance killed the two-pass split the first draft proposed.

## What is wrong

The settled artifact mixes both vocabularies inside one object.
Keys matching chunk or slice, read off a settled artifact:

```text
changedSliceCount  chunkCritics  chunkIndex  refusedSliceCount  resumedSliceCount
shippedChunkIndices  sliceCount  sliceSelections  sliceTexts  slices
withdrawnChunkIndices  withdrawnSliceCount
```

`withdrawnChunkIndices` sits beside `withdrawnSliceCount` in the same record,
and they are about the same things.
`artifact-v2-read-evidence.ts` reads the first at line 124 and the second at line 196,
so the contradiction is in the shipped format
rather than only in comments.

## The objection, measured and found wrong

The task carried the note that 921 settled artifacts are on disk
and that renaming keys makes every one of them unreadable by the new reader.

Measured 2026-08-24 across the worktree and the agent scratch root:

-   1260 artifact files exist.
-   48 carry `artifactSchemaVersion: 2`.
-   1212 carry no version field at all, so they predate version 1
    and no current reader claims them.
-   258 carry at least one of the three arrays.

So the population a rename could strand is 48, not 921.
All 48 sit in throwaway run directories under the agent scratch root:
verification runs, width probes, pairing checks, meter samples.
None is a kept deliverable.
The deliverable is the published tree of fixed `*.en.md` pages.

## What reconnaissance changed

Four facts, measured 2026-08-24, that the first draft did not have.

### Production writes version 2 only

`pass-entry.ts` calls `buildSettledArtifactV2`.
The version 1 writer `buildSettledArtifact` has no production caller;
it survives through `corpus-barrel.ts` and the sheet tooling that reads older artifacts.
So the bump is version 2 to version 3.

### The wire boundary is narrow, and the compiler owns the rest

317 sites across 41 files, but only a handful read a raw JSON key:

-   version 1 root keys in `artifact-change-sets.ts`,
    at lines 171, 179, 264, 272, 276 and 327.
-   version 2 per-lane keys in `artifact-v2-read-evidence.ts`,
    inside `parseRepairEvidenceV2` and `parseTranslateEvidenceV2`.
-   `chunkCritics` in `attribution-read.ts` and `attribution-decode.ts`.

Everything else is typed property access that the compiler follows through the rename.

### The version 2 parse chain is two hops

`parseSettledArtifactV2` calls `parseLanesV2`,
which calls `parseRepairEvidenceV2` and `parseTranslateEvidenceV2`.
A named vocabulary value threaded down that chain costs two parameters.
It does not cost a parallel reader family,
which is what the first draft was written to avoid.

### The writer passes lane results through whole, so there is no separable internal rename

`artifact-v2-build.ts` writes `lanes.repair` and `lanes.translate` as `result` without mapping.
The internal field names ARE the wire keys.

This kills the split the first draft proposed,
where an internal-only rename would land first with the bytes unchanged.
Holding the bytes still would mean writing a mapping layer
whose only purpose is to be deleted by the change immediately after it.
The rename and the version bump are one change or they are a detour.

## Proposed shape

### The three arrays, and a version 3

Rename, in the artifact and in the code that writes and reads it:

-   `shippedChunkIndices` becomes `changedSliceIndices`.
    Not `shippedSliceIndices`:
    the incumbent text ships whenever the archive wording stands,
    so "shipped" reads ambiguously,
    while both arrays actually identify slices whose returned text DIFFERS from the archive.
-   `withdrawnChunkIndices` becomes `withdrawnSliceIndices`.
-   `chunkCritics` becomes `sliceCritics`,
    with the names tied to it: `ChunkCriticRecord`, `buildChunkCriticRecords`,
    `decodeChunkCritics` and `ChunkCriticView`.

`artifact-schema-version.ts` states the rule that decides the version:
a version that does not move on a shape change
is the failure that field exists to end.
So this is version 3, not a compatible addition.

### Keep the version 2 reader, and give both ONE internal vocabulary

The version 2 reader stays and keeps reading the old keys,
because those 48 artifacts are evidence
and cost is not the constraint on this project.

It does NOT stay as a duplicated reader family.
A named vocabulary value threaded through the two hops
selects which key each read names,
and both generations land in one internal shape.
Everything downstream of the parse sees one vocabulary.

That is version-dispatched reading rather than a fallback shim:
the recorded version selects which key to read,
so no reader ever guesses,
and no file is accepted under two spellings at once.

### The symbol family keeps its version 2 names, and that is deliberate

63 distinct symbols carry a `V2` suffix, at 808 sites across 63 files,
and 37 files are named `artifact-v2-*`.
Chasing the integer with the symbols costs two and a half times the rename it would serve,
lands 6 days before the release date,
and changes no behaviour.

`V2` in those names denotes the TWO-LANE artifact family:
the generation of shape that records two lanes, a comparison and a lane selection.
The integer denotes the key vocabulary within it.
The contract file says so, so a reader meeting `artifact-v2-read.ts` reading a version 3 file
is told why rather than left to guess.

Renaming that family to something version-free is worth doing and is not worth doing now.
It is tracked separately.

### Version 1 keeps its keys

`artifact-change-sets.ts` and `artifact-build.ts` describe a frozen past generation
that production stopped writing.
Their internal names join the one vocabulary;
the bytes they read and write keep the version 1 spellings,
because rewriting the spelling of a generation nobody writes any more
strands the files that generation left behind and buys nothing.

## Pass two: `chunkIndex`

1731 occurrences in 194 files, five times the rest put together,
and it reaches cache keys.
Mechanical, but it wants its own change and its own verification
rather than riding along with the vocabulary rename.

## What would change the recommendation

If the owner would rather not carry a version 2 reader at all,
dropping it is defensible on the measurement above:
all 48 are scratch, and the files stay on disk for a resurrected reader to claim later.
That is the one point in this proposal where a different answer leads to different work.
