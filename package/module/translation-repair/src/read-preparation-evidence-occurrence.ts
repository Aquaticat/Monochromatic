import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { blockPairingProtocol, } from './block-pairing-protocol.ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import { readBlockPairingOutcomes, } from './pair-blocks-read-outcomes.ts';
import type {
  PreparationEvidenceOccurrence,
  PreparationOccurrenceExpectation,
} from './preparation-occurrence-model.ts';
import { PreparationReceiptError, } from './preparation-receipt-error.ts';
import { readPreparationReceipt, } from './read-preparation-receipt.ts';
import { readRegisteredPreparationParent, } from './read-registered-preparation-parent.ts';

//region Owned receipt evidence without body/media handoff

/**
 * Checks a registered current occurrence and replays terminal raw outcomes without body normalization.
 * Full question text remains bound because it was sent to models, but media and fallback work have no veto here.
 * This internal core grants neither scope qualification nor acquisition/transition authority.
 *
 * @param expected - independent complete document, parent, attempt and request expectations
 *
 * @param receipt - unknown terminal data selected by its preregistered reference
 *
 * @param sourceText - complete current source under corpus-reader semantics
 *
 * @param targetText - complete current target after the owner's permitted transition
 *
 * @param l - caller logger retaining dependency scope
 *
 * @returns Owned current nodes and raw-evidence replay, without a prepared body handoff
 *
 * @throws PreparationReceiptError when documents, parent or receipt do not match
 *
 * @throws PairingEvidenceError when configured or asked seats cannot represent independent identities
 *
 * @example
 * ```ts
 * const current = readPreparationEvidenceOccurrence({ expected, receipt, sourceText, targetText, l });
 * ```
 */
export function readPreparationEvidenceOccurrence({
  expected,
  receipt,
  sourceText,
  targetText,
  l,
}: {
  readonly expected: PreparationOccurrenceExpectation;
  readonly receipt: unknown;
  readonly sourceText: string;
  readonly targetText: string;
  readonly l: Logger;
},): PreparationEvidenceOccurrence {
  /**
   * Caller-controlled receipt access cannot alter the expectations already being checked.
   */
  const fixed = structuredClone(expected,);
  /**
   * Evidence reconstruction is distinct from full-parent handoff and qualification.
   */
  const pl = tagged({
    tag: readPreparationEvidenceOccurrence.name,
    l,
  },);
  /**
   * The same document/parent preflight is used before phase materialization and receipt interpretation.
   */
  const {
    source,
    target,
    pair,
    alignmentFindings,
  } = readRegisteredPreparationParent({
    expected: fixed,
    sourceText,
    targetText,
    l: pl,
  },);
  // Structural planning is valid, but it cannot manufacture a terminal model receipt.
  if ((pair.source
    .nodes
    .length
    === 0) || (pair.target
      .nodes
      .length
      === 0)
    || ((pair.source
      .nodes
      .length
      === 1) && (pair.target
        .nodes
        .length
        === 1)))
    throw new PreparationReceiptError({ kind: 'parent', },);
  /**
   * Current definition exemptions affect local interpretation, not substantive payload equivalence.
   */
  const question = blockPairingQuestion({ pair, },);
  /**
   * Only raw terminal seat data crosses the receipt boundary; stored aggregates cannot supply authority.
   */
  const outcomes = readPreparationReceipt({
    value: receipt,
    binding: fixed.binding,
    l: pl,
    question: {
      sourceBlocks: question.sourceBlocks,
      targetBlocks: question.targetBlocks,
      protocol: blockPairingProtocol(question,),
    },
  },);
  /**
   * Native wire validation and independent agreement run before any scope-specific projection.
   */
  const outcome = readBlockPairingOutcomes({
    outcomes,
    modelIds: fixed.binding
      .modelIds,
    sourceCount: question.sourceBlocks
      .length,
    targetCount: question.targetBlocks
      .length,
    freeOrder: question.freeOrder,
    l: pl,
  },);
  pl.info(`reconstructed registered parent evidence ${String(fixed.pairIndex,)} from ${String(outcomes.length,)} final seat records without calls`,);
  return structuredClone({
    scope: 'receipt-bound-evidence',
    expected: fixed,
    source,
    target,
    pair,
    alignmentFindings,
    evidence: {
      kind: 'queried',
      key: question.key,
      outcome,
    },
  },);
}

//endregion Owned receipt evidence without body/media handoff
