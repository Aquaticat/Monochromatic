# Wiring both lanes into the corpus pass

Tracks `#89`, and carries the parts of `#96` and `#102` that only the artifact write is waiting on.

The pass runs the repair lane and writes a repair-only artifact.
`runDocumentLanes` already runs both lanes over one preparation and returns both,
and `openTranslateSliceCache` already exists,
so what is missing is the pass calling the driver and an artifact able to hold two lanes.

## What the launch is gated on

Not written down anywhere before now,
so writing it down is the point of this section.

The window trial (`#108`) is live against the same six models and is losing a voice on roughly a third of its arms.
A two-lane pass over 92 entries is thousands of competing calls,
and it would raise that loss rate in the middle of an experiment whose whole validity argument is that degradation lands symmetrically.
The trial reads its own record and revises from the ledger,
so nothing needs re-buying,
but the rate it reads has to be the trial's own rate and not one this pass caused.

**Build now, launch after the trial finishes.**

## The artifact goes into a fresh runs directory, and the guard already forces it

Measured 2026-08-16, not assumed:
104 artifacts across ten runs directories,
and **every one of them is unversioned**.
`artifactSchemaVersion` appears in none of them,
so schema version 1 has an empty population on disk despite being what the writer emits today.

Two mechanisms already make an in-place upgrade impossible,
which is the desired outcome rather than an obstacle:

-   `assertResumableGeneration` refuses a directory whose settled entries record a different pipeline digest,
    and any change to what runs moves the digest.
-   `settledEntryIds` counts an existing artifact as settled whatever wrote it,
    so a pass pointed at an old directory would skip those entries rather than rewrite them.

So the two-lane generation accumulates in a new `TRANSLATION_REPAIR_RUNS_DIR`,
and the 104 existing artifacts stay readable as what they are.

## Verified defects, with what each would have recorded

Every item here was checked against source before being believed,
including the ones a reviewer raised that turned out to be wrong.

### Confirmed and fixed

-   **Cache cleanup relabelled a settled entry as an error.**
    The discard ran inside the same `try` as the pipeline,
    so a failed unlink logged `TALLY status=ERROR` after the success line for an entry whose artifact was already on disk.
    Any reader counting statuses saw one entry in both counts.
    Fixed in `9b4c121fc`,
    together with two faults sharing the same block:
    the cache opened outside the `try`, so one unreadable cache directory ended the whole pass,
    and the deadline was armed after that open, so a resumed entry ran against a slightly different ceiling from a fresh one.

### Confirmed and still open

-   **`LaneSliceText` collapses two different states into one absence.**
    `acceptedText` absent is documented as "the lane never reached this slice",
    and the translate lane also uses it for a slice it REACHED and could not fill:
    `translate-document.ts` passes those indices to `buildLaneSliceTexts` as `unfilledChunkIndices`,
    whose own comment says the lane reached them.
    `lane-comparison.ts` then reads `translateReached: theirs.acceptedText !== undefined`,
    so an unfilled passage is recorded as never examined.
    `carriedText` falls back to the blank incumbent, neither lane reads as having moved,
    and `judgeSlice` returns `archive-stands`:
    the record asserts the archive's translation stands at a passage where the archive has no translation and the lane looked and failed.
    Both halves of that row are false.

    `buildSliceDelivery` gets the common case right,
    but by inferring from whether the slice is `anchored` rather than from anything a lane reported,
    and that proxy fails in the other direction:
    a repair lane blocking at an anchored slice is `not-evaluated` in truth and `unfilled` by the proxy.

    The fix under review is an explicit `reach` discriminant on `LaneSliceText`,
    so both consumers read a stated fact.
    Blast radius measured:
    three source files consume `acceptedText`, three call `buildLaneSliceTexts`, nine files including tests.

-   **The verdict vocabulary is a second, separate lie.**
    `judgeSlice` compares what the two documents CARRY while `reach` describes what the lanes DID,
    so both are needed;
    but `archive-stands` over an empty incumbent asserts a translation that does not exist.
    It needs splitting into a wording-stands case and a gap-stands case.
    Not by dropping rows:
    a comparison whose row count stops equalling the slice count is invisible absence again.

### Raised by review and refuted

Recorded so a later session does not re-derive them.

-   **"No abort check after `refineSettledSlices`."**
    False.
    The check is in the callee, `repair-refine-step.ts:129`,
    with `stage-round.ts:311` behind it,
    and `repair-translation.unit.test.ts` already carries a case that aborts on the first rewrite request and asserts the run rejects.
    The reviewer read the caller only.

-   **"Two cache roots will make `listResumableEntries` treat `repair` and `translate` as entry ids."**
    False, because there are no two roots.
    A lane namespace is a FILENAME PREFIX inside one per-entry directory,
    and `discardNamespace` is prefix-scoped,
    so both lanes share `slice-cache/<entry>/`,
    a generation mismatch in one lane leaves the other's slices alone,
    and `listResumableEntries` needs no change.

## Decisions taken

-   **One artifact holding both lanes, not two files.**
    Two files admit a torn pair, one lane present and the other missing or from another attempt,
    and every reader would have to join by id and re-validate generation, corpus revision and slicing.
    The directory scanners already treat one JSON stem as one settled entry.

-   **Both lanes nested, neither at the top level.**
    Leaving the repair fields where they are and appending a translate block would answer Question 5 invisibly:
    a later reader would take top-level `repairedText` as "the output" and never learn a second lane existed.
    That is the failure `document-lanes.ts` exists to prevent, stated in its own opening comment.
    The cost is a version dispatch in each of the five artifact readers, which is what the version field was added for.

-   **The two-lane fields are REQUIRED at the new version, not optional.**
    The new writer always has both lanes, so an optional field could only ever be absent by accident,
    and absence-ambiguity is what `#96` bought the version machinery to end.

-   **The per-call deadline stays out of both cache keys.**
    It changes nothing any model is asked, only how long this side waits.
    Recorded at both keys in `351f53656`;
    the translate key had already decided it and the repair key had only omitted it.

-   **Both translate roles take the whole roster.**
    The lane has a producing stage and a ranking stage and no third,
    so the editor and checker exclusions have nothing to exclude,
    and it is the width the judge-fidelity probe and the window trial both measured.
    Landed as `RUN_TRANSLATE_MODELS` in `e161bc7f7`.

## Still to build

1.  The `reach` discriminant and the verdict split, before either reaches a persisted field.
2.  `buildSettledArtifact` taking one `DocumentLanesResult` and DERIVING its counts,
    rather than accepting a status and two counts beside a result that can contradict them.
3.  `RUN_CALL_CONFIG` recording both rosters, without which the artifact cannot say what produced the translate lane.
4.  `settleEntry` calling `prepareDocumentPair` and `runDocumentLanes`,
    with `sliceCharBudget` passed explicitly since calling the preparation directly bypasses the default `repairTranslation` supplied.
5.  One deadline for the whole two-lane computation, and `throwIfAborted()` between the driver returning and the artifact being built.
    Not a gate BETWEEN the lanes: both drivers deliberately let a fully cached lane finish after an abort.
6.  Tests for `settleEntry`, once it has its final shape:
    the settled path, the failed path, and the cleanup failure that must log `CLEANUP` and never a second `TALLY`.

## Open questions for the user

1.  Should the artifact store `sourceText` and `targetText` in full?
    It stores neither today and measures both.
    Storing them makes every artifact self-contained for re-analysis without a corpus checkout at the pinned commit,
    at roughly the corpus size again per generation.
    Taking the standing instruction about disk space at face value, the answer is yes, and that is what will be built unless you say otherwise.
2.  A two-lane entry costs roughly twice a one-lane entry, and `HARD_CAP_MINUTES` is 180, tuned for one lane.
    Raise it for this campaign, or accept a higher rate of entries cut mid-run and resumed?
    This will be read against a measured two-lane entry before the full launch rather than pre-tuned.
