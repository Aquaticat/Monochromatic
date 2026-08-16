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

## Next actions, in order

1.  The artifact at schema version 2. The identity it needs is DONE and exported.
    Both designs are written out in the planning doc under
    "The artifact at version 2, as designed";
    start there rather than re-deriving them.
2.  `settleEntry` calling `prepareDocumentPair` and `runDocumentLanes`,
    one deadline for both lanes, and `throwIfAborted()` between the driver returning
    and the artifact being built. Not a gate BETWEEN the lanes.
3.  Tests for `settleEntry` once it has its final shape.
4.  `artifact-read.ts` converting a discriminated `unrecorded` reading back into an absent
    optional property, which discards what its own parser established.

## The launch gate has not moved

No corpus pass while the window trial is live:
it measures the same six models, and competing calls would raise its short-panel rate mid-experiment.
Trial progress is watched by a monitor and was at 82 arms of 327 when this was written.
**Build now, launch after the trial finishes.**
