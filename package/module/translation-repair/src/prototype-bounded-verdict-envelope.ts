// PROTOTYPE ONLY: Candidate H admitted verifier completion-headroom witness.

import { hashContent, } from './document-node.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  type BoundedCandidate,
  type BoundedVerifierResponse,
} from './prototype-bounded-verdict-model.ts';
import { boundedVerifierResponseGuard, } from './prototype-bounded-verdict-verifier-guard.ts';
import {
  MAX_REALIZATION_FINDING_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';

/**
 * Current project-wide Hyper maximum output-token request.
 */
export const BOUNDED_HYPER_COMPLETION_CEILING = 32_000;

/**
 * Conservative project byte-to-token estimate used before exact tokenizers.
 */
const BOUNDED_ESTIMATE_BYTES_PER_TOKEN = 3;

/**
 * Compact verifier witness measurement.
 */
export type BoundedEnvelopeMeasurement = {
  readonly bytes: number;
  readonly estimatedTokens: number;
  readonly estimatedHeadroomTokens: number;
  readonly compactWire: string;
};

/**
 * Finds longest candidate slot for high-offset exact anchors.
 *
 * @returns Longest slot key and text with stable lexical tie-break
 */
function longestSlot({ candidate, }: {
  readonly candidate: BoundedCandidate;
}): {
  readonly slotKey: string;
  readonly text: string
} {
  /**
   * Candidate slots ordered from longest to shortest.
   */
  const entries = Object.entries(candidate.slots,)
    .toSorted(function length(
    left,
    right,
  ) {
    return (right[1]
      .length
      - left[1]
      .length)
      || left[0]
      .localeCompare(right[0],);
  },);
  /**
   * Longest slot used to maximize serialized offsets.
   */
  const [selected,] = entries;
  if ((selected === undefined)
    || (selected[1]
      .length
      < MAX_REALIZATION_FINDING_ANCHORS))
    throw new Error('bounded envelope candidate lacks three anchor characters');
  return {
    slotKey: selected[0],
    text: selected[1],
  };
}

/**
 * Builds disjoint one-character anchors at highest offsets.
 *
 * @returns Exact maximum-count target anchor list
 */
function maximalAnchors({ candidate, }: {
  readonly candidate: BoundedCandidate;
}): readonly RealizationTargetAnchor[] {
  /**
   * Longest candidate slot and text for high-offset evidence.
   */
  const {
    slotKey,
    text,
  } = longestSlot({ candidate, });
  return [
    0,
    1,
    2,
  ].map(function anchor(distance,) {
    /**
     * Half-open anchor start near end of candidate slot.
     */
    const startOffset = (text.length - MAX_REALIZATION_FINDING_ANCHORS)
      + distance;
    /**
     * One-code-unit exclusive endpoint.
     */
    const endOffset = startOffset + 1;
    return {
      slotKey,
      startOffset,
      endOffset,
      digest: hashContent({
        content: text.slice(
          startOffset,
          endOffset,
        ),
      },),
    };
  },);
}

/**
 * Builds field-count-maximum admitted overflow response for candidate set.
 *
 * @returns Structurally valid response reaching finding and anchor counts
 *
 * @example
 * ```ts
 * const response = maximalBoundedVerifierResponse({ ledger, candidates, });
 * ```
 */
export function maximalBoundedVerifierResponse({
  ledger,
  candidates,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
}): BoundedVerifierResponse {
  /**
   * Canonical grammar finding index used for located non-omission evidence.
   */
  const grammarIndex = CONDITIONAL_DEFECT_CLASSES.indexOf('grammar-usage',);
  if (grammarIndex === (-1))
    throw new Error('bounded envelope grammar defect class is absent');
  if (REALIZATION_GLOBAL_CRITERIA.length <= BOUNDED_VERDICT_FINDING_CAP)
    throw new Error('bounded envelope lacks overflow global criterion');

  /**
   * Complete response maximizing every bounded finding field count.
   */
  const response: BoundedVerifierResponse = {
    candidates: candidates.map(function row(candidate,) {
      /**
       * Maximum-count exact anchors for this candidate.
       */
      const anchors = maximalAnchors({ candidate, });
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        obligationStatuses: ledger.obligations
          .map(function preserved() {
          return 'p' as const;
        },),
        globalStatuses: REALIZATION_GLOBAL_CRITERIA.map(function defect(
          _criterion,
          index,
        ) {
          return index <= BOUNDED_VERDICT_FINDING_CAP
            ? 'd' as const
            : 'c' as const;
        },),
        overflow: true,
        findings: Array.from(
          { length: BOUNDED_VERDICT_FINDING_CAP, },
          function finding(
            _value,
            index,
          ) {
            return {
              scope: 'g' as const,
              manifestIndex: index,
              defectClassIndex: grammarIndex,
              targetAnchors: anchors,
            };
          },
        ),
      };
    },),
  };
  if (!boundedVerifierResponseGuard({
    ledger,
    candidates,
  })(response,))
    throw new Error('bounded envelope maximum response failed structural guard');
  return response;
}

/**
 * Measures compact admitted Candidate H verifier completion witness.
 *
 * @returns Compact wire and byte-estimate arithmetic
 *
 * @example
 * ```ts
 * const measurement = measureBoundedVerifierEnvelope({
 *   ledger,
 *   candidates,
 *   response,
 * });
 * ```
 */
export function measureBoundedVerifierEnvelope({
  ledger,
  candidates,
  response,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
  readonly response: BoundedVerifierResponse;
}): BoundedEnvelopeMeasurement {
  if (!boundedVerifierResponseGuard({
    ledger,
    candidates,
  })(response,))
    throw new Error('bounded envelope response failed structural guard');
  /**
   * Compact provider-answer text.
   */
  const compactWire = JSON.stringify(response,);
  /**
   * UTF-8 bytes in compact provider answer.
   */
  const bytes = Buffer.byteLength(compactWire,);
  /**
   * Conservative project estimate before exact model tokenizer.
   */
  const estimatedTokens = Math.ceil(
    bytes / BOUNDED_ESTIMATE_BYTES_PER_TOKEN,
  );
  return {
    bytes,
    estimatedTokens,
    estimatedHeadroomTokens: BOUNDED_HYPER_COMPLETION_CEILING - estimatedTokens,
    compactWire,
  };
}
