import type { IntroducedDefectReport, } from './introduced-defect-probe.ts';

//region Refine probe verdict
// What the damage probe's report over one rewrite comes to for the rollback
// the naturalness lane now takes on it (ledger L11). Its own file because the
// slice settlement is at its line budget.

/**
 Claims the screen admitted against one rewrite, by direction.

 @example
 ```ts
 const counts: AdmittedClaimCounts = { added: 1, dropped: 0, };
 ```
 */
export type AdmittedClaimCounts = {
  /**
   Claims of added damage whose quote is in the rewrite and absent before it.
   */
  readonly added: number;

  /**
   Claims of dropped content whose quote is in the text before the rewrite
   and absent after it.
   */
  readonly dropped: number;
};

/**
 Sums the claims the screen admitted across a report's regions.

 ADMITTED, NOT AGREED: a claim counts when the deterministic differential
 bears out its quote, whichever prober made it. Requiring two probers'
 claims on one rewrite would have caught 9 of the 175 flagged over every run.

 @param report - probe report over the rewrite

 @returns Admitted claims, by direction

 @example
 ```ts
 const admitted = admittedClaimCounts({ report: refinementDefects, },);
 ```
 */
export function admittedClaimCounts(
  { report, }: { readonly report: IntroducedDefectReport; },
): AdmittedClaimCounts {
  return report.regions
    .reduce<AdmittedClaimCounts>(
    function addRegion(
      running,
      region,
    ): AdmittedClaimCounts {
      return {
        added: running.added + region.corroborated,
        dropped: running.dropped + region.removalCorroborated,
      };
    },
    {
      added: 0,
      dropped: 0,
    },
  );
}

//endregion Refine probe verdict
