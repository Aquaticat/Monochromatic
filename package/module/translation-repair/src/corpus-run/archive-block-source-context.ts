import { alignDocumentSections, } from '../chunk-document.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { parseDocument, } from '../parse-document.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import { photoReferences, } from '../photo-reference.ts';
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
 * @param pictureReadings - completed entry evidence, restricted to each section's references
 *
 * @returns Exact block identity to source-section text and corroborated picture support
 *
 * @example
 * ```ts
 * const contexts = archiveBlockSourceContexts({ prepared, });
 * ```
 */
export function archiveBlockSourceContexts(
  {
    prepared,
    pictureReadings = new Map(),
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly pictureReadings?: ReadonlyMap<string, PairedReading>;
  },
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
    /**
     * Names this source section alone authorizes, each once.
     */
    const names = new Set(photoReferences({ text: sourceContext, },)
      .map(function asset(reference,): string {
        return reference.assetName;
      },),);
    /**
     * Every corroborating reader's text, never unrelated or unavailable evidence.
     */
    const support = [...names,].flatMap(function pictureSupport(assetName,): readonly string[] {
      /**
       * Completed reading for this section's reference.
       */
      const reading = pictureReadings.get(assetName,);
      if (reading?.kind !== 'corroborated')
        return [];
      return [
        `CORROBORATED PICTURE SOURCE SUPPORT ${assetName}\n${reading.readings
          .map(function transcript(one,): string {
          return `${one.modelId}:\n${one.text}`;
        },)
          .join('\n\n',)}`,
      ];
    },);
    return [
      archiveBlockIdentity({
        block,
        targetText: prepared.targetText,
      },),
      [
        sourceContext,
        ...support,
      ].join('\n\n',),
    ] as const;
  },),);
}

//endregion Archive block source context
