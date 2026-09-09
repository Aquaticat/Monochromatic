# A deciding bench short of quorum seats a winner by a share of the reachable weight

Decided by the owner on 2026-09-09 ("Share of reachable weight"),
asked with three options after the second `noname` and the sixth `Mio` ran on Bedrock alone
(2026-09-09,
12:22 to 12:33 UTC;
handover,
"The thin-bench questions").

## What happened

- Bedrock alone reaches three seats of the wide bench,
    every one of them also a writer.
- `MIN_SELECTION_WEIGHT` of 2 in `candidate-select-model.ts` is absolute,
    so on that bench a winner needed every reachable judge,
    or two disinterested ones where a producer sat.
- The second `noname` shipped with its `## 简介` heading unfilled and the sixth `Mio` stopped INCOMPLETE at slice 3.

## The rule

- The seated bench is what `judgeSeatsFor` passes to the stage:
    a seat no wet provider serves stays on the bench and is lost at call time as `NoProviderForModelError`.
    The reachable bench is the seated bench less the seats lost that way.
    Quorum is `rosterQuorumSize` over the seated bench,
    as in every other stage.
- At or above quorum nothing changes:
    plurality wins,
    a tie declines,
    and the winner needs `MIN_SELECTION_WEIGHT`.
- Short of quorum the minimum weight is `MIN_SELECTION_WEIGHT` times reachable over quorum:
    the share of the bench that 2 is of a quorum bench.
    The rule scales the existing minimum instead of choosing a new number.
- Two ballots naming the winner is the floor whatever the weight (`MIN_SELECTION_BALLOTS`):
    one judge never decides,
    which is what the absolute 2 was for.
- The round's findings say `select-short-bench (reachable r of n, minimum m)`,
    so a page seated this way is told apart in its findings.

## What this is not

- Not the fifteenth class widened:
    a deciding bench short of quorum keeps deciding,
    and the writing-bench floor (`translation-repair-writing-bench-floor.md`) still stops an entry with no writer.
- Not a change on any bench at quorum:
    the archive-block review's four seats,
    the fixtures and the full production bench keep the absolute 2 and the three-halves bound
    `runCollapsedSelection` pins.

## Options rejected

- Stop INCOMPLETE,
    the fifteenth class widened (ranked first when asked):
    no thin page ships and it is the shape the owner chose for the empty bench,
    but on one provider nothing ships,
    and one provider wet is normal operation by the owner's words.
- As now:
    a page three judges made lands in `fixed/` beside one the whole bench made,
    told apart only by its findings,
    and ships with insertions unfilled.
- Widening Bedrock's judge bench with `google.gemma-4-31b`:
    measured out on 2026-09-07 (6 of 12 against a seated median of 9.5).

## What landed

- `stage-call.ts`:
    a lost voice says whether the router refused the seat (`unreachable`,
    true on `NoProviderForModelError`),
    and `stage-quorum.ts` collects those seats on the gather as `unreachable`.
- `candidate-select-minimum.ts`:
    `selectionMinimum` (the weight,
    reachable count,
    quorum and whether the bench was short),
    `MIN_SELECTION_BALLOTS` and `shortBenchFinding`.
- `candidate-select.ts` applies it after the gather,
    declines a leader named by one ballot as `winner named by one judge alone`,
    and carries the finding;
    its ballot weighing and tally moved to `candidate-select-count.ts` at the line cap.
- `repair-contract.ts`'s capacity guard is unchanged:
    it reads the seated bench at stage entry,
    where every seat is still on it.
- Guards shown to fail on the build before the change:
    `candidate-select.unit.test.ts` ("selection on a bench short of quorum":
    three of eight reachable seats a producer-plus-one agreement at three halves,
    two of eight declines a lone full ballot,
    a bench at quorum keeps the absolute 2),
    `stage-quorum.unit.test.ts` (the gather names the refused seat apart from a transport loss),
    `candidate-select-minimum.unit.test.ts`.

## Addendum 2026-09-09: the share reaches every stage gather, not only the select round

The owner's answer was built into `candidate-select-minimum.ts` first,
which sizes the WEIGHT a winner needs.
The GATHER still sized its quorum on the seats the phase seated,
and on 2026-09-09 at 20:23 UTC that cost an entry:
the seat reader read Synthetic wet at 0.04 percent of its rolling week and seated Qwen3.8-27B and Kimi-K3,
the provider refused at 20:25,
the router named those two and the dark `glm-5.3` unreachable,
and `hulicaijia`'s archive block review needed 6 voices of an 11-seat bench,
heard 5,
spent four retry rounds re-asking the three seats no provider served,
and threw `provider-unavailable` at 382 seconds.
The entry stopped INCOMPLETE on a bench that had four seats able to answer.

Since `40aba2fdb` the same share sizes every gather (`stage-reachable-quorum.ts`):
`reachableQuorum({ benchSize, unreachable, })` keeps the bench quorum while the reachable seats can meet it,
and otherwise needs half the reachable seats rounded up,
never fewer than `MIN_STAGE_VOICES` of 2.
A seat the router refused is dropped from the pending list rather than re-asked,
since nothing changes between rounds for a seat no wet provider serves.
A short gather warns `<stage>: bench short of quorum, reachable r of n; closing on q voices` and carries
`stage-short-bench (<stage> reachable r of n, quorum q)` into the artifact whatever the verdict.
A bench with one reachable seat,
or none,
still reads as an outage,
which is what the two-voice floor is for.
