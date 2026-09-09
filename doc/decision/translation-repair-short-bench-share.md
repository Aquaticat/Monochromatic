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

Recorded here before the build;
the build commit fills this section.
