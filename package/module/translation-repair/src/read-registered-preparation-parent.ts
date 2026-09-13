import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { alignDocumentSections, } from './chunk-document.ts';
import { hashContent, } from './document-node.ts';
import { parseDocument, } from './parse-document.ts';
import type { PreparationParentExpectation, RegisteredPreparationParent, } from './preparation-occurrence-model.ts';
import { PreparationReceiptError, } from './preparation-receipt-error.ts';

//region Registered parent preflight shared by planning and receipt reconstruction

/**
 * Reconstructs a registered parent from complete current documents without requiring or inventing a receipt.
 * This establishes mechanical identity only, not semantic pairing, acquisition approval or final writing scope.
 * The phase owner derives expected target hashes from permitted deterministic transitions.
 *
 * @param expected - independent complete document hashes and current combined/side indexes
 * @param sourceText - complete current source under the registered corpus-reader semantics
 * @param targetText - complete current target, never an unbound parent fragment
 * @param l - caller logger retaining planning or occurrence scope
 * @returns Owned current parsing and parent selection, including valid structural dispatch
 * @throws PreparationReceiptError when documents or registered parent identities disagree
 * @example
 * ```ts
 * const parent = readRegisteredPreparationParent({ expected, sourceText, targetText, l });
 * ```
 */
export function readRegisteredPreparationParent({ expected, sourceText, targetText, l, }: {
  readonly expected: PreparationParentExpectation;
  readonly sourceText: string;
  readonly targetText: string;
  readonly l: Logger;
},): RegisteredPreparationParent {
  /** Callbacks cannot alter the expectations being checked. */
  const fixed = structuredClone(expected,);
  /** Preflight does not create model clients or read question outcomes. */
  const pl = tagged({ tag: readRegisteredPreparationParent.name, l, },);
  pl.debug('checking registered complete documents and parent coordinates',);
  if ((hashContent({ content: sourceText, },) !== fixed.sourceHash)
    || (hashContent({ content: targetText, },) !== fixed.targetHash))
    throw new PreparationReceiptError({ kind: 'documents', },);
  if ([fixed.pairIndex, fixed.sourceIndex, fixed.targetIndex,].some(function invalid(index,): boolean {
    return (!Number.isSafeInteger(index,)) || (index < 0);
  },))
    throw new PreparationReceiptError({ kind: 'parent', },);
  /** Current full parsing owns source coordinates and definition membership. */
  const source = parseDocument({ text: sourceText, },);
  /** Target parsing remains complete even when only one parent will be acquired. */
  const target = parseDocument({ text: targetText, },);
  /** Optional section correspondence is explicitly registered, never inferred from later evidence. */
  const alignment = alignDocumentSections({ source, target, ...((fixed.sectionPairing === undefined) ? {} : { sectionPairing: fixed.sectionPairing, }), },);
  /** Combined position and both side identities must all select the registered parent. */
  const pair = alignment.pairs[fixed.pairIndex];
  if ((pair === undefined) || (pair.source.sliceIndex !== fixed.sourceIndex) || (pair.target.sliceIndex !== fixed.targetIndex))
    throw new PreparationReceiptError({ kind: 'parent', },);
  pl.info(`selected registered parent ${String(fixed.pairIndex,)} without acquisition or qualification`,);
  return structuredClone({ scope: 'registered-preparation-parent', source, target, pair, alignmentFindings: alignment.findings, },);
}

//endregion Registered parent preflight shared by planning and receipt reconstruction
