import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  alignmentRefusalFinding,
  assessSliceAlignment,
} from './translate-alignment.ts';
import {
  type TranslateModels,
  type TranslateSliceRecord,
  TRANSLATE_SLICE_CACHE_VERSION,
} from './translate-document-contract.ts';
import { runTranslateStage, } from './translate-stage.ts';

//region Translate slice
// One slice from prepared pair to settled record: translate it, judge it, and
// decide whether the archive text may be replaced by what won.
//
// The alignment guard runs AFTER the stage rather than instead of it. Running
// it first would make the lane skip slices, and a skipped slice is
// indistinguishable in every artifact from a slice the judges left alone. It
// also throws away the evidence: what the judges chose for a mispaired slice is
// exactly what says the pairing was wrong.

/**
 * Translates one slice and settles what the driver accepts for it.
 *
 * @param client - injected model client
 *
 * @param slice - prepared slice pair
 *
 * @param prepared - document the slice came from, for declared names and
 * governance
 *
 * @param models - translator and judge rosters
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns Settled record, whether the stage's text was accepted or refused
 *
 * @example
 * ```ts
 * const record = await settleTranslateSlice({ client, slice, prepared, models, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function settleTranslateSlice(
  {
    client,
    slice,
    prepared,
    models,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateSliceRecord> {
  /**
   * Global slice index every record and replacement names.
   */
  const { chunkIndex, } = slice.target;

  /**
   * Translation already in the archive for this slice.
   */
  const incumbentText = slice.target
    .text;

  /**
   * Original this slice renders.
   */
  const sourceText = slice.source
    .text;

  /**
   * What the translators wrote and the judges decided.
   */
  const stageResult = await runTranslateStage({
    client,
    translatorModelIds: models.translatorModelIds,
    judgeModelIds: models.judgeModelIds,
    sourceText,
    incumbentText,
    ...((prepared.identityContext === undefined)
      ? {}
      : { identityContext: prepared.identityContext, }),
    lineStructured: prepared.lineStructuredSliceIndices
      .has(chunkIndex,),
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Whether this slice's two sides can be the same passage.
   */
  const alignment = assessSliceAlignment({
    sourceText,
    incumbentText,
  },);

  /**
   * Whether the stage wants to change the archive text at all.
   */
  const wantsReplacement = stageResult.text !== incumbentText;

  /**
   * Whether the guard stands in the way of that.
   *
   * Only a REPLACEMENT can be refused. A slice the judges left alone needs no
   * permission to stay as it is, and refusing it would report a protection that
   * protected nothing.
   */
  const refused = wantsReplacement
    && (alignment.kind === 'incumbent-dominates-source');
  if (refused) {
    l.warn(
      `translate slice ${String(chunkIndex,)}: keeping the archive text, `
        + `${String(alignment.incumbentCodePoints,)} code points against a `
        + `source of ${String(alignment.sourceCodePoints,)}`,
    );
    return {
      kind: 'translate-slice',
      schemaVersion: TRANSLATE_SLICE_CACHE_VERSION,
      chunkIndex,
      stageResult,
      outputText: incumbentText,
      changed: false,
      disposition: 'refused-alignment',
      alignment,
      findings: [
        ...stageResult.findings,
        alignmentRefusalFinding({
          chunkIndex,
          assessment: alignment,
        },),
      ],
    };
  }

  return {
    kind: 'translate-slice',
    schemaVersion: TRANSLATE_SLICE_CACHE_VERSION,
    chunkIndex,
    stageResult,
    outputText: stageResult.text,
    changed: wantsReplacement,
    disposition: 'stage-result',
    alignment,
    findings: stageResult.findings,
  };
}

//endregion Translate slice
