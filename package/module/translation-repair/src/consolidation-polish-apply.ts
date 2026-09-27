import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { droppedContributorNameForms, } from './contributor-name-authority.ts';
import type {
  ConsolidationSettlement,
  ConsolidationSubject,
} from './consolidate-settle.ts';
import {
  type ConsolidationPolishConfig,
  polishConsolidation,
} from './consolidation-polish.ts';
import { NaturalnessRepairInterruptedError, } from './naturalness-repair-interrupted-error.ts';
import type { ObjectionGroup, } from './refine-selection-context.ts';

//region Final consolidation polish application

/**
 Applies final body naturalness stage to whichever approved wording survived
 consolidation, including standing text retained before consolidation gate.
 
 @param client - provider client final naturalness rounds borrow
 
 @param settlement - consolidation answer before final naturalness stage
 
 @param subject - original and archive evidence anchoring fidelity
 
 @param lineStructured - whether source line boundaries must survive
 
 @param sliceIndex - prepared position retained in polish records
 
 @param polishConfig - measured naturalness roles and document facts
 
 @param eligible - whether baseline has approval to cross publication boundary

 @param objections - what the gate or slate judges held against the text
 over a standing the deterministic rule refused, by the judges it comes
 from, corrected where the ORIGINAL supports it (owner, 2026-09-27); omitted,
 or no group carrying an objection, keeps the comparative polish

 @param signal - cancellation for whole settlement
 
 @param perCallTimeoutMs - bound on any single exchange
 
 @param l - stage logger
 
 @returns Settlement carrying auditable final polish and final wording
 
 @example
 ```ts
 const final = await applyFinalPolish({ client, settlement, subject, lineStructured, sliceIndex, polishConfig, eligible: true, signal, perCallTimeoutMs, l, });
 ```
 */
export async function applyFinalPolish(
  {
    client,
    settlement,
    subject,
    lineStructured,
    sliceIndex,
    polishConfig,
    eligible,
    objections,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly settlement: ConsolidationSettlement;
    readonly subject: ConsolidationSubject;
    readonly lineStructured: boolean;
    readonly sliceIndex: number;
    readonly polishConfig?: ConsolidationPolishConfig;
    readonly eligible: boolean;
    readonly objections?: readonly ObjectionGroup[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationSettlement> {
  // FRESH PRODUCTION BASES REACH HERE THROUGH TWO EARLIER FLOORS. Lane standing
  // is admitted by lane-contest winner validation; a consolidated replacement
  // is admitted by producer validation. This check is an invariant backstop for
  // stale/corrupt data, never ordinary quality settlement.
  /**
   Target-authoritative contributor forms baseline lost before polish.
   */
  const droppedContributors = droppedContributorNameForms({
    archiveText: subject.incumbentText,
    candidateText: settlement.text,
  },);
  if (droppedContributors.length > 0) {
    throw new NaturalnessRepairInterruptedError({
      reason: 'contributor-structure',
    },);
  }
  /**
   Sets of judges that objected with at least one reason.
   */
  const objectionGroups = (objections ?? []).filter(function objected(group,): boolean {
    /**
     What this set of judges raised.
     */
    const { objections: raised, } = group;
    return raised.length > 0;
  },);
  /**
   Final naturalness decision over approved surviving baseline.
   */
  const polish = await polishConsolidation({
    client,
    sourceText: subject.sourceText,
    archiveText: subject.incumbentText,
    baseText: settlement.text,
    ...((subject.syntax === undefined) ? {} : { syntax: subject.syntax, }),
    lineStructured,
    ...((subject.identityContext === undefined)
      ? {}
      : { identityContext: subject.identityContext, }),
    ...((subject.referenceContext === undefined)
      ? {}
      : { referenceContext: subject.referenceContext, }),
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { config: polishConfig, }),
    eligible,
    ...((objectionGroups.length === 0)
      ? {}
      : {
        mode: {
          kind: 'objection-correction',
          groups: objectionGroups,
        },
      }),
    signal,
    perCallTimeoutMs,
    l,
  },);
  return {
    ...settlement,
    text: (polish.kind === 'settled') ? polish.text : settlement.text,
    polish,
    findings: (polish.kind === 'not-run')
      ? settlement.findings
      : [
        ...settlement.findings,
        ...polish.findings,
      ],
  };
}

//endregion Final consolidation polish application
