import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  ConsolidationSettlement,
  ConsolidationSubject,
} from './consolidate-settle.ts';
import {
  type ConsolidationPolishConfig,
  polishConsolidation,
} from './consolidation-polish.ts';

//region Final consolidation polish application

/**
 * Applies final body naturalness stage to whichever approved wording survived
 * consolidation, including standing text retained before consolidation gate.
 *
 * @param client - provider client final naturalness rounds borrow
 *
 * @param settlement - consolidation answer before final naturalness stage
 *
 * @param subject - original and archive evidence anchoring fidelity
 *
 * @param lineStructured - whether source line boundaries must survive
 *
 * @param sliceIndex - prepared position retained in polish records
 *
 * @param polishConfig - measured naturalness roles and document facts
 *
 * @param eligible - whether baseline has approval to cross publication boundary
 *
 * @param signal - cancellation for whole settlement
 *
 * @param perCallTimeoutMs - bound on any single exchange
 *
 * @param l - stage logger
 *
 * @returns Settlement carrying auditable final polish and final wording
 *
 * @example
 * ```ts
 * const final = await applyFinalPolish({ client, settlement, subject, lineStructured, sliceIndex, polishConfig, eligible: true, signal, perCallTimeoutMs, l, });
 * ```
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
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationSettlement> {
  /**
   * Final naturalness decision over approved surviving baseline.
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
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { config: polishConfig, }),
    eligible,
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
