import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { blockPairingProtocol, } from './block-pairing-protocol.ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import { alignDocumentSections, } from './chunk-document.ts';
import { hashContent, } from './document-node.ts';
import { readBlockPairingOutcomes, } from './pair-blocks-read-outcomes.ts';
import { parseDocument, } from './parse-document.ts';
import type { BoundPreparationOccurrence, PreparationOccurrenceExpectation, } from './preparation-occurrence-model.ts';
import { PreparationReceiptError, } from './preparation-receipt-error.ts';
import { finishPreparedBlockPairing, } from './prepare-block-pairing-finish.ts';
import { queriedBlockPairingDetails, } from './queried-block-pairing-details.ts';
import { readPreparationReceipt, } from './read-preparation-receipt.ts';

//region Fresh occurrence reconstruction
// Reusing a terminal question never reuses prior node metadata, definition exemptions, aggregates or preparation handoffs.

/**
 * Binds terminal receipt data to fresh full-document parsing and replays current preparation semantics.
 * This buys no calls and deliberately returns neither semantic qualification nor writer admission.
 * The owning journal must establish receipt provenance, derive actual configuration and validate document rewrite lineage.
 *
 * @param expected - independent current document, parent, namespace and configuration expectations
 * @param receipt - unknown terminal question data from the owner's explicitly authorized receipt reference
 * @param sourceText - complete current source, not a parent snippet padded into a document
 * @param targetText - complete current target after an allowed deterministic transition
 * @param l - caller logger retaining the frozen-parent scope
 * @returns Owned fresh occurrence and replayed production handoff
 * @throws PreparationReceiptError when documents, parent, receipt state, binding or question do not match
 * @throws PairingEvidenceError when seat identities cannot represent the configured independent electorate
 * @example
 * ```ts
 * const occurrence = readPreparationOccurrence({ expected, receipt, sourceText, targetText, l });
 * ```
 */
export function readPreparationOccurrence({ expected, receipt, sourceText, targetText, l, }: {
  readonly expected: PreparationOccurrenceExpectation;
  readonly receipt: unknown;
  readonly sourceText: string;
  readonly targetText: string;
  readonly l: Logger;
},): BoundPreparationOccurrence {
  /** Current reconstruction lifecycle, with no private source or reply text in messages. */
  const pl = tagged({ tag: readPreparationOccurrence.name, l, },);
  pl.debug('checking registered documents and parent before receipt interpretation',);
  if ((hashContent({ content: sourceText, },) !== expected.sourceHash)
    || (hashContent({ content: targetText, },) !== expected.targetHash))
    throw new PreparationReceiptError({ kind: 'documents', },);
  if ([expected.pairIndex, expected.sourceIndex, expected.targetIndex].some(function invalid(index,): boolean {
    return (!Number.isSafeInteger(index,)) || (index < 0);
  },))
    throw new PreparationReceiptError({ kind: 'parent', },);
  /** Full current original parse; no receipt-provided nodes or offsets are accepted. */
  const source = parseDocument({ text: sourceText, },);
  /** Full target parse supplies current containers, namespaces and absolute coordinates. */
  const target = parseDocument({ text: targetText, },);
  /** Same native pre-block alignment, including explicitly registered section correspondence. */
  const alignment = alignDocumentSections({ source, target,
    ...((expected.sectionPairing === undefined) ? {} : { sectionPairing: expected.sectionPairing, }), },);
  /** Current combined alignment must retain both independently registered side identities. */
  const pair = alignment.pairs[expected.pairIndex];
  if ((pair === undefined)
    || (pair.source.sliceIndex !== expected.sourceIndex)
    || (pair.target.sliceIndex !== expected.targetIndex)
    || (pair.source.nodes.length === 0)
    || (pair.target.nodes.length === 0)
    || ((pair.source.nodes.length === 1) && (pair.target.nodes.length === 1)))
    throw new PreparationReceiptError({ kind: 'parent', },);
  /** Definition exemptions are reconstructed locally and excluded from payload equivalence. */
  const question = blockPairingQuestion({ pair, },);
  /** Only final seat data survives the receipt boundary; no persisted aggregate is consumed. */
  const outcomes = readPreparationReceipt({
    value: receipt,
    binding: expected.binding,
    l: pl,
    question: { sourceBlocks: question.sourceBlocks, targetBlocks: question.targetBlocks, protocol: blockPairingProtocol(question,), },
  },);
  /** Existing reader rechecks usable wires and independent relations under current definition roles. */
  const outcome = readBlockPairingOutcomes({
    outcomes,
    modelIds: expected.binding.modelIds,
    sourceCount: question.sourceBlocks.length,
    targetCount: question.targetBlocks.length,
    freeOrder: question.freeOrder,
    l: pl,
  },);
  /** Current media ownership and every ordered production finding are rebuilt together. */
  const details = queriedBlockPairingDetails({ outcome, pair, pairIndex: expected.pairIndex, targetContainers: target.containers, },);
  /** Definition separation and fallback remain existing production behavior, not receipt-selected summaries. */
  const prepared = finishPreparedBlockPairing({
    pairs: details.pairs,
    findings: details.findings,
    evidence: { kind: 'queried', key: question.key, outcome, },
    pair,
    pairIndex: expected.pairIndex,
    l: pl,
  },);
  pl.info(`reconstructed registered parent ${String(expected.pairIndex,)} from ${String(outcomes.length,)} final seat records without calls`,);
  return structuredClone({ scope: 'receipt-bound-occurrence', expected, source, target, pair,
    alignmentFindings: alignment.findings, prepared, },);
}

//endregion Fresh occurrence reconstruction
