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

### Confirmed and fixed, second round

Landed as `306fad00e`, which closes every item in this section and the one below it.

`LaneSliceText` now states an `outcome` of `decided`, `not-evaluated`, `unfilled` or `incumbent-fallback`,
beside an `incumbentKind` saying whether the archive holds any wording at the slice at all.
`SliceDeliveryRecord` carries that outcome and a separate `delivery` naming what the document ends up with
(`replacement-shipped`, `replacement-withdrawn`, `incumbent-retained`, `gap-remains`),
so the `anchored` inference is gone from the decision and survives only as the fact it can actually answer.
`compareDocumentLanes` reports both lane outcomes and a `decisionComparison` beside the delivery verdict,
and its verdict vocabulary gained `gap-remains`.
`buildSliceDelivery` also refuses a shipped replacement on a blocked run,
and checks index sets against the prepared indices rather than against a numeric range.

The delivery ledger's three index contracts landed earlier, as `0c17123bf`, with guards shown to fail first.

### The state each item was in when it was found

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

    The fix is an explicit outcome discriminant on `LaneSliceText`,
    so both consumers read a stated fact.
    Blast radius measured:
    three source files consume `acceptedText`, three call `buildLaneSliceTexts`, nine files including tests.

-   **A FOURTH state exists and the driver already knows about it.**
    `translate-document.ts:381` warns when `record.stageResult.heardTranslators === 0`,
    keeps the incumbent for that run and refuses to cache the slice,
    and line 431 collects those slices as `unheard`.
    They still enter `settled`,
    so `buildLaneSliceTexts` stamps them with `acceptedText` equal to the incumbent,
    and every consumer reads that as the lane having examined the slice and chosen to leave it alone.

    This is the window trial's lost-judge defect in the translate lane's producing stage:
    **a stage that heard nobody is recorded as a deliberate keep.**
    Any lane comparison run today counts unheard slices as agreement with the archive.

    So the outcome union needs four members, not three,
    and they separate on two questions rather than one:

    -   `decided`, the lane produced a wording.
    -   `not-evaluated`, the lane never reached the slice.
    -   `unfilled`, reached, no output, and NO incumbent to fall back on.
    -   `incumbent-fallback`, reached, no output, and an incumbent that therefore stands by default.

-   **Naming: the discriminant is `outcome`, not `reach`.**
    Three of the four states mean the lane reached the slice,
    so a field called `reach` invites the next reader to write `reach === 'decided'`
    and re-introduce exactly the defect above.

-   **Whether an incumbent exists is a SEPARATE axis, and cannot be inferred from blank text.**
    A content chunk may legitimately be blank, so `incumbentText === ''` does not mean the archive has nothing there.
    `LaneSliceText` needs `incumbentKind: 'present' | 'absent'` beside the outcome.
    This is the same critique as the `anchored` proxy, applied to the incumbent side.

-   **`SliceShipment` mixes evaluation with delivery, and one `kind` cannot hold both.**
    A blocked repair at an anchor is `not-evaluated` AND the gap remains;
    today it must pick one word for both facts.
    The two axes are evaluation (the four outcomes above) and delivery
    (replacement shipped, replacement withdrawn, incumbent retained, gap remains).

-   **The comparison answers a different question from the one it was built for.**
    `lane-slice-text.ts` opens by saying the point is whether both lanes produce the SAME ENGLISH,
    and `judgeSlice` compares what the documents CARRY.
    Two lanes accepting different replacements that are both withdrawn read as `archive-stands`;
    two lanes accepting the same replacement where only one ships read as `repair-only`.
    Both are true delivery facts and neither answers lane agreement,
    so the persisted comparison needs both verdicts rather than one word doing duty as both.

-   **The stopped-prefix invariant has a hole.**
    `buildLaneSliceTexts` rejects a slice decided after an undecided one,
    but an `unfilled` slice after a `not-evaluated` one passes,
    which asserts the lane resumed after stopping.
    The invariant should reject any later REACHED outcome, not only a later decision.

-   **"Same preparation" is not actually established by the comparison.**
    Equal slice counts, equal indices and equal incumbent text do not prove one preparation:
    two slices can carry the same target wording over different source passages,
    and every insertion incumbent is blank.
    A persisted comparison needs a preparation identity, or a per-slice identity covering source text and placement.

-   **Two more index-set gaps beyond the three now fixed.**
    `buildSliceDelivery` still lets a BLOCKED result claim a shipped replacement,
    and it range-checks indices rather than checking membership in the prepared set.

-   **The verdict vocabulary is a second, separate lie.**
    `judgeSlice` compares what the two documents CARRY while `reach` describes what the lanes DID,
    so both are needed;
    but `archive-stands` over an empty incumbent asserts a translation that does not exist.
    It needs splitting into a wording-stands case and a gap-stands case.
    Not by dropping rows:
    a comparison whose row count stops equalling the slice count is invisible absence again.

### Confirmed and fixed, third round

Landed 2026-08-16, after a review of the second round by both reviewers.
The working state, including what is mid-flight at any moment,
lives in `doc/handover/two-lane-outcome-vocabulary.md`.

-   **The repair lane decided the empty string at every gap in the archive.**
    It mends existing English, so at a passage the archive never translated it has nothing to work on:
    `repair-translation.ts` skips the slice, `notApplicableRepair` returns `repairedText: ''`,
    and `repair-assemble.ts` fed every outcome to the wording builder as a DECISION.
    `compareDecisions` then read that against a translate lane that had actually filled the passage
    and returned `{ kind: 'comparable', verdict: 'different' }`:
    a row asserting the two lanes chose different wordings where one of them never had an opinion.

    Fixed by a FIFTH outcome member, `not-applicable`, and a repair-side adapter
    (`repair-lane-wordings.ts`) mirroring the translate lane's.
    Both reviewers ranked the options the same way and for the same reason.
    Folding these into `unfilled` was rejected because `unfilled` is a lane that tried and produced
    nothing, which is a rate `#105` wants measured,
    and the fold would make the repair lane's decline rate equal the number of gaps in the archive:
    a constant of the document that measures nothing about the lane.

-   **The two axes could contradict each other and nothing checked.**
    Three combinations describe a slice that cannot exist,
    every field of each is individually well formed,
    and no later join or count could detect one.
    `wording-coherence.ts` now states the rule once,
    and the delivery ledger and the lane comparison each assert it for themselves
    rather than trusting whoever built the wordings.

-   **The comparison joined two lanes that disagreed about whether the archive translates a slice.**
    It compared incumbent TEXT only, which cannot separate a blank content slice from an anchor,
    and then took every row's `incumbentKind` from the repair lane.

-   **A blocked run could be told a slice was withdrawn by assembly.**
    That exit never assembles, so the withdrawal it reports is the block,
    and the two are the events a reader counting integrity damage has to tell apart.

-   **The non-comparability reason was a free string naming one lane.**
    A slice neither lane decided reported only the repair lane, since that was the first checked.
    It is now `undecidedLanes`, which holds both.

-   **The three named index lists were three copies of the same five checks.**
    That is how their pairwise disjointness came to be checked in one direction only.
    They now share `lane-slice-sets.ts` and differ by data.

-   **The resume-first comment claimed a progress guarantee that does not hold.**
    It said a cap-abort always completes at least one new slice.
    An abort can land before the first persistence, and the slices a lane deliberately leaves uncached,
    the unfilled and the unheard, produce no cache entry however long they took.
    What actually bounds it is that a stuck entry surfaces as a repeated same-entry ERROR line.

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

-   **A lane that had no work to do says so, rather than deciding nothing.**
    Adopted 2026-08-16 without asking, because the evidence determines one answer:
    the alternative corrupts a rate `#105` exists to measure.
    Recorded here and in the handover so it can be reversed on sight.
    `not-applicable` means the lane reached the slice and its work has no input there;
    it is legal only where the archive holds no wording,
    it is a REACHED outcome so the stopped-prefix rule still refuses it after an unexamined slice,
    and the blocked exit therefore intersects anchors with the prefix it actually settled.

-   **Both translate roles take the whole roster.**
    The lane has a producing stage and a ranking stage and no third,
    so the editor and checker exclusions have nothing to exclude,
    and it is the width the judge-fidelity probe and the window trial both measured.
    Landed as `RUN_TRANSLATE_MODELS` in `e161bc7f7`.

## The artifact at version 2, as designed

Both reviewers converged on this shape.
It is written down here rather than held in a session, because it is the next commit.

One shared `preparation` block, one nested `lanes` object, and no top-level lane fields at all:
keeping `status`, `issues` or `repairedText` at the top would silently make repair the default lane,
which is the question `runDocumentLanes` exists to leave open.

-   `artifactSchemaVersion: 2`, required and read FIRST,
    so a reader dispatches on the version rather than on which fields it recognizes.
    Unversioned artifacts stay explicitly legacy; they are not relabelled version 1.
-   `provenance`: tip, pipeline digest, corpus commit.
-   `execution`: timestamp, duration, lane order, call configuration.
    Call TIMING lives here; rosters do not, because they are a lane's own.
-   `preparation`: the identity below, plus the shared slice manifest,
    the source and incumbent text of every slice, placement kind and offsets,
    the line-structured flag, identity context as a present-or-absent value,
    and the alignment findings and pair count for audit.
    Putting the text here rather than under both lanes stops it being stored twice
    and gives the reader one authoritative incumbent kind.
-   `lanes.repair` and `lanes.translate`: each with its own roster arrays, effective configuration,
    status, final document text, per-slice `outcome` and `delivery`,
    shipped and withdrawn evidence, findings, and lane-specific evidence.
    Counts are derived where possible and asserted against their arrays where stored.
-   `comparison`: bound explicitly to the preparation identity, built from validated delivery rows,
    carrying both outcomes, both deliveries, and structured non-comparability.
    Recomputed at artifact build time and refused if it disagrees with the persisted copy.
-   `laneSelection: { kind: 'pending-human-decision' }`.
    An omitted winner field would be absence encoding a meaningful state, which is the defect class again.

The unions serialize as tagged objects, never flattened to strings:
readers dispatch on `kind`, which is what the discriminants bought.

### The preparation identity

Computed over a versioned canonical manifest of the preparation itself,
never over the artifact, the run, or the cache.
Payload: a domain separator and manifest version, the source and target document digests,
and one ordered row per slice carrying the global index,
both sides' placement kind, offsets and exact text, their pairing through the shared row,
and the line-structured flag, plus identity context stated as present-with-text or absent.

The TARGET PLACEMENT KIND is the field that earns this:
without it a blank content slice and an anchor hash identically,
which is exactly the pair the whole vocabulary change exists to separate.

Framing must be unambiguous under arbitrary slice text,
so fields are length-prefixed rather than separated by a byte the text is assumed not to contain.

Excluded on purpose: tip, pipeline digest, corpus commit, schema version, rosters, call configuration,
timestamps, durations, cache keys, resumed counts, lane outputs, findings and comparison results.
That gives the two properties wanted:
changing boundaries, pairing, ordering, placement kind, offsets, text or governance changes the identity,
while resuming the same manifest under a different commit, cache state or roster leaves it alone.
`pipelineDigest` stays the separate execution-generation identity.

### What the version 2 parser must require, and what it may tolerate

Every field is REQUIRED, including empty arrays, zero counts, both lanes, both ledgers,
the recorded comparison and the lane selection.
Within the discriminated unions, a member's fields are required only for that member
(`acceptedText` only when decided, `reason` only on an assembly withdrawal,
`verdict` only on a comparable decision, `undecidedLanes` only on a non-comparable one),
and a field belonging to an inactive member is refused rather than ignored.

Unknown keys are refused in schema-owned records:
an addition is a version 3, not a tolerated extra.
The deliberate tolerances are the inside of `callConfig`,
the free-text category and finding strings the domain already allows,
and anything a leaf contract explicitly defines as opaque evidence.
A version 2 object carrying a legacy top-level alias
(`status`, `issues`, `repairedText`, `shippedChunkIndices`)
is refused rather than read.

The reader RECOMPUTES rather than trusts, and refuses on disagreement:
each lane's slice count against the preparation's,
each ledger's length against both,
each `sliceTexts` row against the ledger row at its index,
each raw index set against the ledger rows that would produce it,
the translate lane's changed, withdrawn and refused counts against their own lists,
its `unfilled` status against whether anything is unfilled,
the repair lane's blocked status against the deliveries it allows,
and the whole comparison, field by field, against the persisted copy.

A standalone reader can only check the SYNTAX of the recorded identity;
it cannot recompute it, because version 2 stores measurements rather than the canonical manifest.
A corpus-aware reader re-prepares the texts at the recorded corpus commit,
recomputes the identity, and refuses a mismatch.
That asymmetry is stated here so nobody later reads a syntax check as a verification.

Version dispatch has three cases and no fallback:
a missing version is LEGACY, version 2 is version 2, and anything else is refused.
An explicit version 1 is refused rather than treated as legacy,
however empty its population happens to be.

## Still to build

1.  The artifact at version 2, to the design above,
    with the preparation identity folded into the SAME bump rather than added later:
    a persisted comparison without it is joinable across slicings from day one.
2.  ~~`buildSettledArtifact` deriving its counts~~, landed as `e4f857c83`:
    it takes the result and reads the status and both counts off it,
    where all three used to arrive as parameters beside it and could contradict it.
3.  The preparation identity the comparison needs before it is persisted.
    Equal slice counts, equal indices and equal incumbent text do not prove one preparation,
    and every insertion incumbent is blank, so two different slicings can be joined silently.
4.  `settleEntry` calling `prepareDocumentPair` and `runDocumentLanes`,
    with `sliceCharBudget` passed explicitly since calling the preparation directly bypasses the default `repairTranslation` supplied.
5.  One deadline for the whole two-lane computation, and `throwIfAborted()` between the driver returning and the artifact being built.
    Not a gate BETWEEN the lanes: both drivers deliberately let a fully cached lane finish after an abort.
6.  Tests for `settleEntry`, once it has its final shape:
    the settled path, the failed path, and the cleanup failure that must log `CLEANUP` and never a second `TALLY`.
7.  The translate lane does not enforce what an unheard stage means.
    Nothing requires that hearing no translator implies `outputText === incumbentText` and `changed === false`,
    and the resumed branch would accept an unheard cached record written by an older build,
    which contradicts the stated invariant that such a slice is never cached.
    Same defect family as everything above, and cheap.
8.  `artifact-read.ts` keeps a discriminated `unrecorded` reading and then converts it back into an
    absent optional property, discarding the distinction its own parser established.

## Open questions for the user

1.  Should the artifact store `sourceText` and `targetText` in full?
    It stores neither today and measures both.
    Storing them makes every artifact self-contained for re-analysis without a corpus checkout at the pinned commit,
    at roughly the corpus size again per generation.
    Taking the standing instruction about disk space at face value, the answer is yes, and that is what will be built unless you say otherwise.
2.  A two-lane entry costs roughly twice a one-lane entry, and `HARD_CAP_MINUTES` is 180, tuned for one lane.
    Raise it for this campaign, or accept a higher rate of entries cut mid-run and resumed?
    This will be read against a measured two-lane entry before the full launch rather than pre-tuned.
