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

/**
 Whether every usable contest ballot called the archive flawed on a contest
 that settled on neither lane.
 
 EVERY BALLOT, NOT THE SETTLED VERDICT. `settled-neither` with
 `archive: 'declined'` needs two flawed voices and a strict lead, which one
 publishable ballot among three still satisfies; the owner's rule is that no
 judge would publish the archive as it stands. A ballot that did not answer
 about the archive is not a flawed one.
 
 @param verdict - what the contest recorded for this slice
 
 @param ballots - every usable ballot of that contest
 
 @returns Whether the slate over this slice's standing is run off on a tie
 
 @example
 ```ts
 const runoffOverStanding = archiveFlawedByAll({ verdict: contest.verdict, ballots: contest.ballots, },);
 ```
 */
export function archiveFlawedByAll(
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

//endregion Consolidate archive flawed
