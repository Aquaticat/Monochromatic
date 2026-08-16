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

## Next actions, in order

1.  GFP the new guards: strip the `not-applicable` classification in `repair-lane-wordings.ts`
    (feed anchors back through `decided`), rebuild, show the delivery and comparison tests fail, restore.
2.  Add the consequence test both reviewers asked for:
    anchor slice, translate `decided` with a real fill, repair `not-applicable`,
    assert `decisionComparison` is `not-comparable` with `undecidedLanes: ['repair']` and verdict `translate-only`.
3.  Add the blocked-exit test: one anchor before the crossing, one after, assert
    `not-applicable` and `not-evaluated` respectively.
4.  Then the artifact at schema version 2, with the preparation identity folded into the same bump.
    The design for both is in the planning doc.

## Still queued behind that

Sol's finding that `translate-document.ts` does not enforce
"no translator heard implies `outputText === incumbentText` and `changed === false`",
and that the resumed branch would accept an unheard cached record written by an older build.
Same defect family, cheap, and it belongs in the commit after the vocabulary one.

## The launch gate has not moved

No corpus pass while the window trial is live:
it measures the same six models, and competing calls would raise its short-panel rate mid-experiment.
Trial progress is watched by a monitor and was at 82 arms of 327 when this was written.
**Build now, launch after the trial finishes.**
