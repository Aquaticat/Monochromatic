import { alignDocumentSections, } from '../chunk-document.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { parseDocument, } from '../parse-document.ts';
import { archiveBlockIdentity, } from './archive-block-repair.ts';

//region Archive block source context

/**
 * Maps each unclaimed archive block to source section it was expected to render.
 *
 * Target-only sections map to empty context because no source section can license
 * factual wording there.
 *
 * @param prepared - current paired preparation
 *
 * @returns Exact block identity to source-section text
 *
 * @example
 * ```ts
 * const contexts = archiveBlockSourceContexts({ prepared, });
 * ```
 */
export function archiveBlockSourceContexts(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): ReadonlyMap<string, string> {
  /**
   * Section alignment preparation consumed.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: prepared.sourceText, },),
    target: parseDocument({ text: prepared.targetText, },),
    ...((prepared.sectionPairing === undefined)
      ? {}
      : { sectionPairing: prepared.sectionPairing, }),
  },);
  return new Map(prepared.unclaimedTargetBlocks
    .map(function toContext(block,): readonly [
      string,
      string
    ] {
    /**
     * Source section paired with archive block location.
     */
    const sourceContext = block.location
      .kind
      === 'aligned-pair'
      ? (alignment.pairs
        .at(block.location
          .pairIndex,)
        ?.source
        .text
        ?? '')
      : '';
    return [
      archiveBlockIdentity({
      block,
      targetText: prepared.targetText,
    },),
      sourceContext,
    ] as const;
  },),);
}

//endregion Archive block source context
