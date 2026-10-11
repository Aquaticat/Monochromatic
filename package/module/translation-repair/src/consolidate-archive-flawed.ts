import type { ArtifactContestVerdict, } from './corpus-run/artifact-two-lane-contest.ts';
import type { LaneContestBallot, } from './lane-contest-wire.ts';

//region Consolidate archive flawed
// When a consolidation slate over an ELIGIBLE standing is run off rather than
// left to its single round (class one hundred six, zheermao8 slice 9,
// 2026-09-24). The contest split 2 to 2 with every ballot calling the archive
// flawed, the slate split 1/1/1 with both lane texts on offer, and the
// archive's own wording shipped: an eligible standing keeps its single round
// (the ineligible-standing decision's addenda). The owner's answer of
// 2026-09-24: "Run-off only when every contest ballot called the archive
// flawed". A tie among texts that all correct the archive is then decided
// rather than defaulted, and the standing still ships if the run-off ends
// undecided.
//
// The owner's answer of 2026-10-11, "Majority flawed yes", moved the run-off
// trigger to a strict majority of the usable ballots (`archiveFlawedByMajority`).
// The forfeit of an eligible standing past an undecided gate still reads every
// ballot (`archiveFlawedByEveryBallot`, owner answer 2026-09-27, "Slate's
// choice"), so the two predicates answer two different questions.

/**
 Whether a strict majority of the usable contest ballots call the archive
 flawed on a contest that settled on neither lane, which runs off a tied slate
 over an eligible standing (owner answer 2026-10-11, "Majority flawed yes").

 A STRICT MAJORITY OF EVERY USABLE BALLOT, NOT OF THE ANSWERS. A ballot that
 did not answer about the archive is not a flawed one, and it still counts in
 the denominator, so five ballots need three flawed voices and four need three
 as well: two of four is a tie and does not run off.

 @param verdict - what the contest recorded for this slice

 @param ballots - every usable ballot of that contest

 @returns Whether a tied slate over this slice's standing is run off

 @example
 ```ts
 const runoffOverStanding = archiveFlawedByMajority({ verdict: contest.verdict, ballots: contest.ballots, },);
 ```
 */
export function archiveFlawedByMajority(
  {
    verdict,
    ballots,
  }: {
    readonly verdict: ArtifactContestVerdict;
    readonly ballots: readonly LaneContestBallot[];
  },
): boolean {
  if (verdict.kind !== 'settled-neither')
    return false;
  /**
   Usable ballots that called the archive flawed.
   */
  const flawed = ballots.filter(function calledFlawed(ballot,): boolean {
    return ballot.archive === 'flawed';
  },);
  return (flawed.length * 2) > ballots.length;
}

/**
 Whether every usable contest ballot called the archive flawed on a contest
 that settled on neither lane (owner answer 2026-09-27, "Slate's choice"),
 which decides whether an eligible standing is forfeit past an undecided gate.

 EVERY BALLOT, NOT THE SETTLED VERDICT. `settled-neither` with
 `archive: 'declined'` needs two flawed voices and a strict lead, which one
 publishable ballot among three still satisfies; the owner's rule is that no
 judge would publish the archive as it stands. A ballot that did not answer
 about the archive is not a flawed one. The run-off trigger does not read this
 predicate (`archiveFlawedByMajority`).

 @param verdict - what the contest recorded for this slice

 @param ballots - every usable ballot of that contest

 @returns Whether the standing is condemned by the whole contest

 @example
 ```ts
 const standingFlawedByAll = archiveFlawedByEveryBallot({ verdict: contest.verdict, ballots: contest.ballots, },);
 ```
 */
export function archiveFlawedByEveryBallot(
  {
    verdict,
    ballots,
  }: {
    readonly verdict: ArtifactContestVerdict;
    readonly ballots: readonly LaneContestBallot[];
  },
): boolean {
  if (verdict.kind !== 'settled-neither')
    return false;
  if (ballots.length === 0)
    return false;
  return ballots.every(function calledFlawed(ballot,): boolean {
    return ballot.archive === 'flawed';
  },);
}

/**
 The two flags a consolidation over one contest's slice carries: the run-off
 trigger, which reads a majority, and the forfeit, which reads every ballot.
 Both come from the same ballots, so the driver takes them as one pair.

 @param verdict - what the contest recorded for this slice

 @param ballots - every usable ballot of that contest

 @returns Whether a tied slate is run off, and whether the forfeit reads the whole contest

 @example
 ```ts
 const flags = archiveFlagsOf({ verdict: contest.verdict, ballots: contest.ballots, },);
 ```
 */
export function archiveFlagsOf(
  {
    verdict,
    ballots,
  }: {
    readonly verdict: ArtifactContestVerdict;
    readonly ballots: readonly LaneContestBallot[];
  },
): {
  readonly runoffOverStanding: boolean;
  readonly standingFlawedByAll: boolean;
} {
  return {
    runoffOverStanding: archiveFlawedByMajority({
      verdict,
      ballots,
    },),
    standingFlawedByAll: archiveFlawedByEveryBallot({
      verdict,
      ballots,
    },),
  };
}

//endregion Consolidate archive flawed
