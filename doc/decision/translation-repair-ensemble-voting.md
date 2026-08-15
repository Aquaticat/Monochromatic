# Ensemble voting: who is waited for, who judges, and what a self-vote is worth

Decided by the user on 2026-08-14, in three separate rulings during the session
that built the translate lane.
Each one reverses or narrows an earlier choice recorded in
`doc/handover/translation-repair.md`, so this document is canonical for all
three and the older passages are history.

## No stage waits for its whole roster

`gatherStageVoices` retries lost voices and stops at QUORUM, at least half the
roster rounded up.
There is no other target.

The user's reason, verbatim:
"full roster should never be a retry target for anything, because that will
block everything even if only one or two model of the provider is degraded for
the day."

What this reverses:
the editor and refiner stages passed `retryTarget: 'full-roster'` from
2026-08-12, chosen on the belief that Kimi-K3 was permanently broken.
Under that target a stage re-asked a silent model for every retry round, so one
model degrading for a day cost four deadlines per gather, on every gather that
seated it, for as long as the degradation lasted.

Why removing it is safe rather than a loosening:
the target existed to stop a single model deciding a stage, and the quorum
arithmetic already prevents that on the rosters in use.
Editors, refiners and checkers each sit at three, so quorum is two, and two
independent voices are exactly what the ensemble is for.
The option is deleted rather than left unused, so it cannot return by default.

What is kept:
`stage-roster-incomplete (<stage> <heard>/<roster>)` is now emitted whenever a
roster ends short, not only under the retired target.
The per-model `stage-voice-lost` findings say WHO went quiet and this says how
much of the stage that cost.

## Producers judge

`selectBestCandidate` seats the whole judge roster, including every model that
produced a candidate in the set.

The user's reason:
"A model can both be a translator and a judge. Yes, a model judging its own
output would be worse than judging others' output, but its own judgement would
still be somewhat valuable", and separately, on why a narrow judge pool is the
wrong shape: "These models, each of them has different blank spots."

What this reverses:
selection removed every producer from the roster, which on a six-model roster
with three editors silenced half the panel to keep the other half
disinterested.
The readings thrown away were not replaced by anything.

## A self-vote counts half

`SELF_VOTE_WEIGHT` is `1 / 2`, `FULL_VOTE_WEIGHT` is `1`, and a winner needs
`MIN_SELECTION_WEIGHT`, which is 2.

The user's ruling:
"Self-judge and self-vote should always be allowed, just given less weight."

The arithmetic preserves the property the old exclusion protected.
A single-model candidate can draw at most one half from its own author, and a
composite with three contributors at most three halves, so no candidate reaches
2 on self-votes alone however the roster grows.
A producer can add to a case that disinterested judges already made, and can
never make one.

The same arithmetic sets a ceiling nobody chose deliberately and everyone
inherits:
selection can only ever succeed while two FULL-weight judges remain, so a
producing role can hold at most four of the six models the provider serves.

A half is not a measured figure and is not presented as one.
What the discount corrects is a TILT rather than a preference:
the judge sheet is anonymized and says so, so a producer cannot see which
candidate is its own and cannot set out to back it.
Measuring the real self-preference rate is `#84`'s work, and every self-vote is
recorded by name (`select-self-vote (<model>)`), weighed on its ballot, and
counted in `SelectionTally.selfVotes` so that measurement has a population.

## Judges never learn who wrote what

Stated by the user as a check rather than a change, and verified rather than
assumed.

`buildCandidateSelectMessages` renders candidates as `CANDIDATE 1` through
`CANDIDATE N` with fenced text, and the system message tells the judge it does
not know which system produced which candidate and must not guess.
No producer name, no role label, and no "incumbent" marker reaches a judge.

The translate lane holds to this in the one place it could have leaked:
the existing translation stands on the ballot unlabelled, and it is deliberately
NOT repeated in the evidence block, where a judge could have matched it against
a candidate and identified it.
Declared names travel as evidence because a judge cannot check terminology
without them, and they identify nobody.

## Consequences already applied

-   Slice cache version 25.
    Both behavioural rulings change who was heard and who decided while leaving
    every prompt identical, which is the class the structural guard cannot
    catch.
-   `SelectionOutcome` carries `voteWeight` rather than `votes`.
    The number is a weight, and a log line reading "won 2.5 votes" would be a
    lie about what was counted.
-   Every ballot leaves the selector with its model, choice, reason and weight.
    Reasons reached a log line and nothing durable before, and one lost pipe on
    2026-08-13 erased twenty minutes of them.

## What is still open

Roster width.
Editors and refiners sit at three because producers could not judge, and that
reason is gone.
Widening either, or the translator roster, to four is available under the weight
ceiling and is not decided here.
