# Handover: the lane outcome vocabulary and what is mid-flight

Written 2026-08-16 because the user's machine is stuttering and a hard reboot would otherwise lose the state.
Updated after every step from here rather than at the end.
Companion to `doc/planning/two-lane-corpus-pass.md`, which holds the design record;
this file holds the WORKING STATE.

Worktree: `/var/home/user/worktrees/translation-repair`, branch `translation-repair-rebased`.
All commands below assume it, not the main worktree.

## The one sentence

Every defect in this stretch is the same shape:
**an absence recorded as a deliberate choice**,
and the fix is always to give the absence its own name rather than let it borrow a decision's.

## Landed, pushed, safe

-   `92539977f` read the unreached slice on the axis that separates it (test).
-   `494723d8d` pin the stage that heard nobody, and the rules around it (tests + barrel exports).
    Exports added: `LaneSliceOutcome`, `DecisionComparison`, `translateLaneWordings`.
-   `d14a06bca` pin the gap verdict, the decision axis, and the blocked run's shipped index (tests).

All three were shown to fail without their guards before being trusted (GFP), by stripping the
guard, rebuilding, running, and restoring with `git checkout --`.
The strip scripts are in the scratchpad as `unheard.mjs` and `ungap.mjs`.

## The vocabulary change landed

`c2779c737`, the whole thing as one commit,
because the coherence rule cannot land without the repair-exit fix:
`buildSliceDelivery` asserts coherence, and the repair lane would otherwise throw at every anchor.
Full suite green, lint clean, types clean.

New files it added:

-   `src/wording-coherence.ts`, the cross-axis rule, plus `src/wording-coherence.unit.test.ts`.
-   `src/lane-slice-sets.ts`, the five checks every named index list has to pass, shared by all three lists.
-   `src/lane-slice-coverage-error.ts`, the error class moved out so the builder and the set checks can share it
    without importing each other.
-   `src/repair-lane-wordings.ts`, the repair lane's adapter, mirroring `translate-lane-wordings.ts`.

Two existing tests moved with it, and neither was weakened:
the pairwise contradiction message is now one message for any two lists,
and the delivery fixture's anchor became `not-applicable` where it used to be `decided ''`.

## The decision taken while the user was away

**A fifth outcome member, `not-applicable`.**
Adopted rather than asked, because the evidence determines one answer (QGR);
recorded here and in the planning doc so it can be reversed on sight.

The repair lane skips a passage the archive never translated:
it mends existing English and there is none.
`notApplicableRepair` returns `repairedText: ''`,
and `repair-assemble.ts` fed every outcome to the builder as a DECISION,
so the lane reported "I decided the empty string here" at every gap in the archive.
`compareDecisions` then read that against a translate lane that actually filled the passage
and reported `{ kind: 'comparable', verdict: 'different' }`:
a row asserting the two lanes chose different wordings where one of them never had an opinion.

Both reviewers ranked the options A > B > C independently and for the same reason:

-   **A, the fifth member.** Chosen.
-   **B, report anchors as `unfilled`.** Rejected: `unfilled` means the lane tried and produced nothing,
    which is a rate worth measuring, and folding these in would make the repair lane's decline rate
    equal the count of gaps in the archive, a constant of the document that measures nothing about the lane.
    `#105` wants exactly that rate.
-   **C, keep `decided ''`.** Rejected: it is the defect.

Mechanics, agreed by both reviewers and implemented:

-   Coherence requires `not-applicable` to sit at an `absent` incumbent, and refuses it at a `present` one.
-   `decideDelivery` needs no new member: a non-decision at an absent incumbent already returns `gap-remains`,
    and the shipped/withdrawn refusal already covers it.
-   `not-applicable` is a REACHED outcome, so the stopped-prefix rule still refuses it after a `not-evaluated`.
    The blocked exit therefore intersects anchors with the outcomes prefix:
    an anchor before the crossing is `not-applicable`, one after it stays `not-evaluated`.

## Also landed since

-   The consequence tests both reviewers asked for, and the blocked-exit intersection
    (an anchor before the crossing is `not-applicable`, one after it is `not-evaluated`).
    GFP run: reverting the classification fails both adapter tests, and restoring clears them.
-   What hearing nobody has to mean, which three readers already assumed and nothing checked:
    the record's text must be the archive's and it must claim no change,
    the resumed branch now discards an unheard cached record rather than trusting it,
    and the predicate is named once instead of spelled out in each reader.
    GFP run on that guard too.
-   The translate driver crossed the line cap on the way, so its assembly tail moved to
    `translate-assemble.ts` and the refusal sentences to `translate-alignment-refusals.ts`,
    mirroring the repair lane's split on the same seam. The cap was never raised.

## The preparation identity landed

`preparation-identity.ts`, with eight tests and a GFP run.
It names a slicing and nothing about the run, so a resumed pass over the same slicing gets the same name
however the commit, cache state or roster differed.
Fields are length prefixed rather than delimited, because slice text is arbitrary document content
and can hold any separator anyone might pick.
The brand is built through `assertPreparationIdentity`, which is also what a version 2 reader
will use on a value read back from disk.

Stripping the target placement kind fails the blank-content-versus-anchor case;
stripping the whole-document texts fails the difference-outside-every-slice case.
Both restored, suite green.

## The comparison moved onto the ledger

The last of the reviewer's ship blockers. It took each lane's wordings and its shipped index set,
and read absence from that set as the archive being retained,
so a changed decision left out of the set compared as a deliberate keep:
the same defect the outcome union was split to end, in the one place that reports on both lanes.

It now takes the two delivery ledgers `runDocumentLanes` already builds,
which have already refused a decided slice that is neither shipped, withdrawn nor blocked.
The result carries the preparation identity, so rows cannot be persisted without the slicing that numbers them.
Nothing called the comparison yet, so no production caller had to change; its tests were rewritten to the new boundary.

Three guards from the vocabulary commit were also pinned and GFP'd:
the incumbent-kind disagreement at EQUAL empty text,
the withdrawal by assembly on a run that never assembled,
and the two coherence assertions at the comparison's call sites.

Two corrections landed on top: a fourth spelling of hearing nobody in the extracted assembler,
and the identity framing only the target's slice index while the source's was equal by assumption.

## A note on stripping guards while the trial runs

Measured, not assumed: the window trial is ONE long-lived process (started 12:51),
its bundle contains zero dynamic imports, and nothing restarts it,
so every module was resolved at startup and rebuilding `dist` cannot reach it.
That is why the GFP strips here were safe.
If the trial is ever restarted, or a bundle gains a dynamic import, that reasoning expires:
strip in a throwaway worktree instead.

## The ledger boundary was strengthened again after a second review

Each ledger now carries the slicing it was built over, rather than one identity passed beside both:
two ledgers loaded from different artifacts of one entry line up perfectly and number different passages,
and that is the pair the comparison exists to refuse.
It also checks that both ledgers agree about which slice sits at each POSITION,
about each slice's ORIGINAL as well as its archive wording,
and that every row survives the four-case delivery rule (`delivery-coherence.ts`, eight tests).
A record reaching the comparison is a structural type, not proof the ledger builder made it.

The version 2 parser contract is written up in the planning doc under
"What the version 2 parser must require, and what it may tolerate".
Read that before writing the parser rather than re-deriving it.

## The version 2 artifact landed

Three files under `src/corpus-run/`:
`artifact-v2-contract.ts` (the shape), `artifact-v2-vocabulary.ts` (the frozen dispatch unions),
and `artifact-v2-build.ts` (the builder), with six tests.

Both lanes nest and neither is at the top level.
The builder takes only what cannot be computed from the run:
the identity comes off the preparation and the whole comparison off the two ledgers,
so neither can be supplied wrong.
`laneSelection` states `pending-human-decision` rather than leaving the winner absent.

The frozen unions are worth knowing about:
they are copies of the live ones, and the copying is deliberate.
The builder assigns live values into them, so a live union that gains a member the snapshot does not list
STOPS COMPILING there, and the next person meets the version question as a build error
rather than as an artifact that quietly means something new.

`ArtifactJsonValue` deliberately excludes JSON's `null`:
it is absence spelled as a value, which is what this whole generation exists to stop recording.

## Two holes in the version 2 builder, found by review and closed

Both were the session's own defect class at the newest boundary, and both are
now committed (`b2478473d`, tests strengthened in `da426b2a2`).

**The identity binding was forgeable.** The builder computed one identity from
`prepared` and stamped it onto BOTH ledgers before comparing them, so the
comparison's unequal-identity refusal could never fire there: what it proved was
that the two ledgers agree with each other, and two ledgers built over some
other slicing agree with each other perfectly.

The identity is now stamped by `runDocumentLanes`, which is the only place
holding the preparation and the rows at once, so `DocumentLanesResult` carries
two `IdentifiedDeliveryLedger`s rather than two bare row arrays. The builder
recomputes what the name should be, refuses a ledger whose own name disagrees,
then checks the four per-slice facts a row carries over from preparation,
because an equal name is a hash claim and the rows are what every join uses. It
also checks each raw result's slice count, which no ledger check can see: a
structurally valid driver result could pair one lane's result with the other's
rows.

**The freeze was half a freeze, and the comment claimed the whole thing.**
Assignment into the frozen types fails when a live union gains a MEMBER. It does
not fail when a live record gains a FIELD: excess property checking applies to
object literals, so the wider object assigns cleanly and `JSON.stringify` writes
the new field into every artifact, which the version 2 parser then refuses for
carrying keys the schema does not name. Every row is now rebuilt through object
literals in `artifact-v2-project.ts`.

Worth keeping straight, because the correction has its own limit: the projection
does not make a new live FIELD fail compilation either, it simply leaves the
field out. What it buys is that the bytes stay what the schema says. An exact
-shape type test would turn field growth into a build error too; that is the gap
to close if an omitted field ever turns out to have mattered.

## Next actions, in order

1.  `settleEntry` calling `prepareDocumentPair` and `runDocumentLanes`,
    one deadline for both lanes, and `throwIfAborted()` between the driver returning
    and the artifact being built. Not a gate BETWEEN the lanes.
    Reviewer-supplied specifics, all of which have to hold:
    `sliceCharBudget` passed explicitly, since calling preparation directly bypasses
    the default `repairTranslation` supplied;
    separate cache namespaces per lane under the entry cache root, both retained
    when either lane fails and the root discarded only after the artifact is written;
    `RUN_TRANSLATE_MODELS` beside `RUN_MODELS`, and a `Logger` threaded through,
    because `runDocumentLanes` requires one.
2.  The TALLY line, which needs rework rather than transplanting: it reads
    `result.status` and `result.issues`, which are repair-only and now live under
    `lanes.repair.result`. A two-lane line reports settlement rather than either lane,
    keeps every repair-only count prefixed, and every consumer of `status=` has to move
    with it.
3.  Tests for `settleEntry` once it has its final shape, including an abort after both
    lanes return from cache: no artifact written, both caches kept.
4.  `artifact-read.ts` converting a discriminated `unrecorded` reading back into an absent
    optional property, which discards what its own parser established.

`buildSettledArtifact` (version 1) loses its last production caller at step 1.
Leave it: readers still parse version 1 artifacts, and the corpus directory holds them.

## The launch gate has not moved

No corpus pass while the window trial is live:
it measures the same six models, and competing calls would raise its short-panel rate mid-experiment.
Trial progress is watched by a monitor and was at 150 arms of 327 when this line was last updated,
with 56 of those on a short panel, the same rate the whole run has held.
**Build now, launch after the trial finishes.**

The GFP note above still holds and was re-verified at 150 arms:
same process (PID 2484929, started 12:51:54), and its bundle plus both chunks contain
zero dynamic imports, so rebuilding `dist` cannot reach it.
