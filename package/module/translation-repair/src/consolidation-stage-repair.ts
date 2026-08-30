import {
  type CandidateProducer,
  producerModelIds,
} from './candidate-select-model.ts';
import type { ConsolidationSettlement, } from './consolidate-settle.ts';
import type {
  ConsolidationFailureEvidence,
  ConsolidationFailureProducer,
} from './consolidate-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation stage repair

/**
 * Assigns stable role alias without exposing provider identity.
 *
 * @param aliases - identities already assigned in evidence order
 *
 * @param modelId - provider identity to anonymize
 *
 * @returns Existing or newly assigned alias
 */
function roleAlias(
  {
    aliases,
    modelId,
  }: {
    readonly aliases: Map<RosterModelId, string>;
    readonly modelId: RosterModelId;
  },
): string {
  /**
   * Alias already linking this role across evidence.
   */
  const existing = aliases.get(modelId,);
  if (existing !== undefined)
    return existing;
  /**
   * Next evidence-local role name.
   */
  const assigned = `role/${String(aliases.size + 1,)}`;
  aliases.set(
    modelId,
    assigned,
  );
  return assigned;
}

/**
 * Rewrites candidate provenance to stable role aliases.
 *
 * @param producer - raw candidate provenance
 *
 * @param aliases - evidence-local alias registry
 *
 * @returns Equivalent provenance without model identity
 */
function anonymizeProducer(
  {
    producer,
    aliases,
  }: {
    readonly producer: CandidateProducer;
    readonly aliases: Map<RosterModelId, string>;
  },
): ConsolidationFailureProducer {
  if (producer.kind === 'model') {
    return {
      kind: 'model',
      alias: roleAlias({
        aliases,
        modelId: producer.modelId,
      }),
    };
  }
  if (producer.kind === 'incumbent') {
    return {
      kind: 'incumbent',
      matchedAliases: producer.matched
        .map(function toAlias(modelId,): string {
        return roleAlias({
          aliases,
          modelId,
        });
      },),
    };
  }
  return {
    kind: 'composite',
    aliases: producer.contributors
      .map(function toAlias(modelId,): string {
      return roleAlias({
        aliases,
        modelId,
      });
    },),
  };
}

/**
 * Replaces known provider identities in free-form evidence text.
 *
 * @param text - candidate, reason, or finding text
 *
 * @param aliases - complete evidence-local alias registry
 *
 * @returns Text naming only role aliases
 */
function anonymizeText(
  {
    text,
    aliases,
  }: {
    readonly text: string;
    readonly aliases: ReadonlyMap<RosterModelId, string>;
  },
): string {
  return [...aliases.entries()].reduce(
    function replaceIdentity(
    current,
    [modelId, alias,],
  ): string {
    return current.split(modelId,)
      .join(alias,);
  },
    text,
  );
}

/**
 * Reports whether settlement still leaves unendorsed standing wording.
 *
 * @param settlement - latest consolidation outcome
 *
 * @param standingMayShip - whether contest endorsed standing baseline
 *
 * @returns Whether another stage-local strategy is required
 *
 * @example
 * ```ts
 * const retry = consolidationNeedsRecovery({ settlement, standingMayShip: false, });
 * ```
 */
export function consolidationNeedsRecovery(
  {
    settlement,
    standingMayShip,
  }: {
    readonly settlement: ConsolidationSettlement;
    readonly standingMayShip: boolean;
  },
): boolean {
  return (!standingMayShip) && (settlement.terminal !== 'consolidated');
}

/**
 * Extracts failed strategy evidence without inventing a new verdict.
 *
 * @param settlement - latest consolidation outcome retaining unsafe standing
 *
 * @returns Structured evidence for next producer responsibility
 *
 * @example
 * ```ts
 * const evidence = consolidationFailureEvidence({ settlement, });
 * ```
 */
export function consolidationFailureEvidence(
  { settlement, }: { readonly settlement: ConsolidationSettlement; },
): ConsolidationFailureEvidence {
  /**
   * Selection round when any candidate slate reached judges.
   */
  const { decided, } = settlement;
  /**
   * Fidelity gate when fresh candidate reached it.
   */
  const { gate, } = settlement;
  /**
   * Evidence-local model aliases shared by slate and ballots.
   */
  const aliases = new Map<RosterModelId, string>();
  for (const entry of decided?.slate ?? []) {
    for (const modelId of producerModelIds(entry.producer,)) {
      roleAlias({
        aliases,
        modelId,
      },);
    }
  }
  for (const ballot of decided?.ballots ?? []) {
    roleAlias({
      aliases,
      modelId: ballot.modelId,
    },);
  }
  /**
   * Candidate slate with aliased provenance and free-form text.
   */
  const selectionSlate = decided?.slate
    .map(function anonymize(entry,) {
    return {
      ...entry,
      text: anonymizeText({
        text: entry.text,
        aliases,
      }),
      producer: anonymizeProducer({
        producer: entry.producer,
        aliases,
      }),
    };
  },)
    ?? [];
  /**
   * Selection ballots with aliased judges and reasons.
   */
  const selectionBallots = decided?.ballots
    .map(function anonymize(ballot,) {
    /**
     * Ballot reading after provider identity is removed.
     */
    const {
      modelId,
      reason,
      ...reading
    } = ballot;
    return {
      judgeAlias: roleAlias({
        aliases,
        modelId,
      }),
      reason: anonymizeText({
        text: reason,
        aliases,
      }),
      ...reading,
    };
  },)
    ?? [];
  /**
   * Gate ballots with free-form fields stripped of known identities.
   */
  const gateBallots = (gate?.ballots ?? []).map(function anonymize(ballot,) {
    return {
      ...ballot,
      unsupportedRaw: ballot.unsupportedRaw
        .map(function clean(text,): string {
        return anonymizeText({
          text,
          aliases,
        });
      },),
      droppedRaw: ballot.droppedRaw
        .map(function clean(text,): string {
        return anonymizeText({
          text,
          aliases,
        });
      },),
      reason: anonymizeText({
        text: ballot.reason,
        aliases,
      }),
    };
  },);
  return {
    terminal: settlement.terminal,
    ...((decided === undefined) ? {} : { selectionDecision: decided.decision, }),
    selectionSlate,
    selectionBallots,
    gateBallots,
    findings: [...new Set(settlement.findings
      .map(function clean(text,): string {
      return anonymizeText({
        text,
        aliases,
      });
    },),)],
  };
}

//endregion Consolidation stage repair
