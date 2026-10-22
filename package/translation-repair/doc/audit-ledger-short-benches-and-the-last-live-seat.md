# Audit ledger: short benches and the last live seat

Quorums sized on the seats that could answer,
and how long a round waits on the last of them.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B816: a short bench waited on its last live seat, so one stream that held without content held the whole round

Status:
fixed on 2026-10-22 (UTC) in `tr-w277`,
on the owner's answer "Let the grace open",
red `42855d2266`,
fix `1ed1690ab6`,
artifact generation 20 in `19dc276377`,
cache versions in `eb4db609ff`,
TSDocs in `9ed9b5d14a`.
The pins in other packages that the version and generation moves left behind moved in `205eed4f57` and `aed73b727b`,
and the TSDoc and scan fixes are in `8de619e404` (M287).

What B809 showed:
26 of the 27 rounds that took 250 s or more in `XingZ6017` waited on one comment-only stream,
and the grace never applied,
because a consolidation bench of 7 with 3 seats unreachable needs 4 voices,
which is every live seat,
and the grace opens only once the quorum stands.

The question and the answer:
B809 left open whether a short bench that needs every live seat should wait on its last seat at all
(the rule of 2026-09-09).
The owner was asked with two options.
"Keep current rule (Recommended)":
a short bench still waits on every live seat;
pro,
no verdict decided on fewer voices,
quality first;
con,
a stuck seat costs wall-clock.
"Let the grace open":
allow a short bench to close on a quorum below every live seat once the grace ends;
pro,
faster rounds;
con,
some verdicts decided with one voice fewer.
The owner chose "Let the grace open" on 2026-10-22,
against the recommendation.

The rule:
`reachableQuorum` (`stage/src/stage-reachable-quorum.ts`) takes `lastSeatGrace`,
true by default.
Where the reachable seats equal the bench quorum and that quorum is above `MIN_STAGE_VOICES` (2),
it returns `needed: benchQuorum - 1` and `short: true`,
and the findings carry `stage-short-bench` as for any short bench.
Every other shape keeps the rule of 2026-09-09.
Seven seats with three dark leave four,
which now close on three;
eleven seats with five dark leave six,
which close on five.
The round hears the reduced quorum and then the straggler grace runs for the last live seat,
so a verdict is decided with one voice fewer only when that seat does not answer inside the grace.

Refusals inside a round:
round 0 is sized before the router has named any seat,
so a bench the refusals leave with exactly its quorum would still have waited on every live seat.
`runGatherRound` (`stage/src/stage-round.ts`) takes `heardNeededAfterRefusals`,
and the wait reads the need again at every settled ask and at every router refusal,
reserve seats included.
A refusal that hands its place to a reserve seat settles no ask,
so it wakes the wait itself through a one-shot signal per stretch between refusals.
The gather (`stage-quorum.ts`) and the windowed rounds (`stage-windowed-rounds.ts`) pass a function of the refusal count,
and the round records the need it ended on.
Three cases in `stage-round-refill.unit.test.ts` run it for the gather,
a windowed stage and a whole-bench round,
and the refill case for a seat lost in transport now scripts two failing seats,
since two answering seats close the reduced quorum in the first round.

The shape the rule does not reach:
a bench of 3 with 1 unreachable (`{3,1}`) still needs 2 of 2 live seats.
Its quorum is 2,
and the first branch needs a quorum above the floor of two voices,
so `reachableQuorum` returns `needed: 2, short: false` as before.
The repair checker and probe benches with Kimi-K3 unreachable are this shape (B809).
A stuck seat there is bounded by the stream guards of B804 and B809 and by the call deadline,
not by the grace.

Artifact generation 20:
a reader recomputes each naturalness round's verdict from its seats and refuses a record whose stored verdict differs
(`parseNaturalnessReviewRound`).
A stored round whose live seats equal its quorum reads `acceptable` under the new rule and `quorum-not-met` under the old,
so the reader gates the rule on the generation the file records
(`artifactGenerationLetsGraceOpenOnLastSeat`,
`ARTIFACT_SCHEMA_VERSION_V20` in `artifact/src/corpus-run/artifact-two-lane-contract.ts`),
and `reachableQuorum` takes `lastSeatGrace: false` for a record of generation 19 or older.
`1ed1690ab6` landed with that gap stated in its message,
and `19dc276377` closed it.
The pass writes 20,
`page-check` reads its own rounds under the new rule,
and a build of 20 refuses to resume a run directory stamped 19 or earlier
(`assertResumableSchemaGeneration`,
`slice-cache/src/corpus-run/pass-schema-guard.ts`).
`readSettledArtifact` still reads those files,
each under its own generation's rules.

Cache versions:
every stage that caches a gather runs through the rule,
and no key holds the rule.
Consolidate moved from 31 to 32,
lane contest from 15 to 16,
translate slice from 24 to 25,
repair slice from 42 to 43,
refine from 13 to 14,
consistency from 6 to 7
and page title from 5 to 6.
Pairing rides inside 3 under its account of 2026-10-18.
Run zheermao23 is armed for 2026-10-22 19:16 UTC on `65e8325303`,
which holds the previous numbers,
so records may stand at them and the change could not ride inside them.
Each version's TSDoc gives its account.

Not verified:
how often the reduced quorum decides a verdict,
and how much wall-clock it saves,
since no run has gathered under it.
The `19dc276377` message says the corpus-pass suite was still running when it was committed.

Open to the owner:
whether the floor of two voices should give way on a bench of three,
which the answer did not reach and which was not changed.
