# Renaming the settled artifact's chunk vocabulary to slice (`#94`)

Proposal, not a decision.
Written 2026-08-24, after measuring the objection the task carried and finding it overstated.

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

## Proposed shape

Two passes, in this order, each with its own verification.

### Pass one: the three arrays, and a version 3

Rename, in the artifact and in the code that writes and reads it:

-   `shippedChunkIndices` becomes `changedSliceIndices`.
    Not `shippedSliceIndices`:
    the incumbent text ships whenever the archive wording stands,
    so "shipped" reads ambiguously,
    while both arrays actually identify slices whose returned text DIFFERS from the archive.
-   `withdrawnChunkIndices` becomes `withdrawnSliceIndices`.
-   `chunkCritics` becomes `sliceCritics`.

317 occurrences across 21 source files and 20 test files.

`artifact-schema-version.ts` states the rule that decides the version:
a version that does not move on a shape change
is the failure that field exists to end.
So this is version 3, not a compatible addition.

### Keep the version 2 reader, and give both ONE internal vocabulary

The version 2 reader stays and keeps reading the old keys,
because those 48 artifacts are evidence
and cost is not the constraint on this project.

It does NOT stay as a duplicated reader family.
The two readers differ only in the lines that name JSON keys:
the version 2 path reads `record.shippedChunkIndices`
and the version 3 path reads `record.changedSliceIndices`,
and both return `changedSliceIndices`.
Everything downstream of the parse sees one vocabulary.

That is version-dispatched reading rather than a fallback shim:
the recorded version selects which key to read,
so no reader ever guesses,
and no file is accepted under two spellings at once.

### Pass two: `chunkIndex`

1731 occurrences in 194 files, five times the rest put together,
and it reaches cache keys.
Mechanical, but it wants its own change and its own verification
rather than riding along with pass one.

## What would change the recommendation

If the 48 version 2 artifacts turn out to matter for a decision still open,
keeping the version 2 reader is not merely cheap insurance but required,
which is already the proposal.

If the owner would rather not carry a second reader at all,
dropping it is defensible on the measurement above:
all 48 are scratch, and the files stay on disk for a resurrected reader to claim later.
That is the one point in this proposal where a different answer leads to different work.
