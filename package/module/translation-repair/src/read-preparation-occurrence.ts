import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { BoundPreparationOccurrence, PreparationOccurrenceExpectation, } from './preparation-occurrence-model.ts';
import { finishPreparedBlockPairing, } from './prepare-block-pairing-finish.ts';
import { queriedBlockPairingDetails, } from './queried-block-pairing-details.ts';
import { readPreparationEvidenceOccurrence, } from './read-preparation-evidence-occurrence.ts';

//region Full current occurrence handoff after receipt reconstruction

/**
 * Reconstructs a current receipt occurrence and then applies the complete native body/media handoff.
 * This buys no calls and grants neither whole-parent qualification nor writer admission.
 * Definition-only consumers use the evidence core instead of inheriting this handoff's failure paths.
 * The owning journal still establishes provenance, actual configuration and allowed target transitions.
 *
 * @param expected - independent complete document, parent, attempt and request expectations
 * @param receipt - unknown terminal data selected by its preregistered reference
 * @param sourceText - complete current source under corpus-reader semantics
 * @param targetText - complete current target after the owner's permitted transition
 * @param l - caller logger retaining full-parent scope
 * @returns Owned current occurrence with native media, findings, definition separation and fallback handoff
 * @throws PreparationReceiptError when documents, parent or receipt do not match
 * @throws PairingEvidenceError when configured or asked seats cannot represent independent identities
 * @throws Error when native structural media or handoff reconstruction fails
 * @example
 * ```ts
 * const current = readPreparationOccurrence({ expected, receipt, sourceText, targetText, l });
 * ```
 */
export function readPreparationOccurrence({ expected, receipt, sourceText, targetText, l, }: {
  readonly expected: PreparationOccurrenceExpectation;
  readonly receipt: unknown;
  readonly sourceText: string;
  readonly targetText: string;
  readonly l: Logger;
},): BoundPreparationOccurrence {
  /** Full handoff telemetry remains distinct from the shared evidence-only reconstruction. */
  const pl = tagged({ tag: readPreparationOccurrence.name, l, },);
  /** The core owns all current parsing and independently checked terminal evidence. */
  const current = readPreparationEvidenceOccurrence({ expected, receipt, sourceText, targetText, l: pl, },);
  /** Media ownership, coverage, cache and fallback findings belong only to this full consumer. */
  const details = queriedBlockPairingDetails({ outcome: current.evidence.outcome, pair: current.pair,
    pairIndex: current.expected.pairIndex, targetContainers: current.target.containers,
  },);
  /** Native definition separation and fallback complete the body-oriented production handoff. */
  const prepared = finishPreparedBlockPairing({ pairs: details.pairs, findings: details.findings, evidence: current.evidence,
    pair: current.pair, pairIndex: current.expected.pairIndex, l: pl,
  },);
  pl.info(`reconstructed registered parent ${String(current.expected.pairIndex,)} from ${String(current.evidence.outcome.outcomes.length,)} final seat records without calls`,);
  return structuredClone({ scope: 'receipt-bound-occurrence', expected: current.expected, source: current.source, target: current.target,
    pair: current.pair, alignmentFindings: current.alignmentFindings, prepared,
  },);
}

//endregion Full current occurrence handoff after receipt reconstruction
