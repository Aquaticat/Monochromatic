import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import {
  BlankSelectionError,
  type IncumbentKind,
} from './translate-absence.ts';
import {
  restoreTargetOnlyRun,
  splitTargetOnlyRun,
} from './target-only-run.ts';
import { assessSliceAlignment, } from './translate-alignment.ts';
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
 * @param neighbouringSourceText - original of the sections either side, shown to
 * the judges as context they are not asked to render. Absent by default, so the
 * lane behaves exactly as it did; `#108` supplies it on the slices `#107`'s
 * screen flags, to read whether the replacement rate falls when a judge can see
 * that the archive put this slice's content next door
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns Settled record, whether the stage's text was accepted or refused
 *
 * @throws {@link import('./translate-absence.ts').TranslateAbsenceError} when
 * this slice has no translation in the archive and the stage produced none, so
 * there is no record to settle: the driver above records the slice as unfilled
 * and leaves the gap the archive already had
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
    neighbouringSourceText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly neighbouringSourceText?: string;
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
   * Translation already in the archive for this slice, whole.
   */
  const archiveText = slice.target
    .text;

  /**
   * Original this slice renders.
   */
  const sourceText = slice.source
    .text;

  /**
   * Archive wording split into the part this source can account for and the
   * part it cannot.
   *
   * ENGLISH THE CHINESE NEVER SAID IS HELD OUT OF THE WHOLE STAGE, not merely
   * spliced back at the end. A translator shown a transcript it has no source
   * for is being asked to reproduce text it cannot check, and an incumbent
   * carrying one enters the ballot several times longer than every fresh
   * candidate, which is not a comparison. Both sides see the same passage, and
   * the run is restored to whichever wording wins.
   */
  const { judgedText, protectedText, } = splitTargetOnlyRun({
    sourceText,
    incumbentText: archiveText,
  },);

  /**
   * Archive wording the stage sees, judges and may replace.
   */
  const incumbentText = judgedText;

  if (protectedText !== '')
    l.info(
      `translate slice ${String(chunkIndex,)}: holding ${
        String(protectedText.length,)
      } characters of target-only English out of translation, `
      + `judging ${String(incumbentText.length,)} of ${String(archiveText.length,)}`,
    );

  /**
   * Whether the archive holds a translation for this slice at all.
   *
   * DECIDED HERE AND ONCE, from what the target side IS rather than from what
   * its text happens to be. An anchor names a boundary where a rendering
   * belongs and none exists; a content span holding only whitespace is the
   * archive's own wording, thin as it is. Both carry a blank `text`, and every
   * fallback in the stage means something different for each.
   */
  const incumbentKind: IncumbentKind = isInsertionChunk(slice.target,)
    ? 'absent'
    : 'present';

  /**
   * What the translators wrote and the judges decided.
   */
  const stageResult = await runTranslateStage({
    client,
    translatorModelIds: models.translatorModelIds,
    judgeModelIds: models.judgeModelIds,
    sourceText,
    incumbentText,
    incumbentKind,
    ...((prepared.identityContext === undefined)
      ? {}
      : { identityContext: prepared.identityContext, }),
    ...((neighbouringSourceText === undefined)
      ? {}
      : { neighbouringSourceText, }),
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
   *
   * AND ONLY WHERE THERE IS SOMETHING TO PROTECT. The guard exists to stop a
   * short source replacing a long translation the source cannot account for; at
   * an anchor there is no translation to lose, so a refusal there would put the
   * empty string back over a rendering the judges chose and settle the slice as
   * an ordinary unchanged one, which is the exact wrong-success state absent
   * mode exists to remove.
   */
  const refused = (incumbentKind === 'present')
    && wantsReplacement
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
      // THE WHOLE ARCHIVE, protected run included, rather than the judged part.
      // A retention has to leave the document byte-identical, and the judged
      // part is a slice of the archive rather than the archive.
      outputText: archiveText,
      changed: false,
      disposition: 'refused-alignment',
      alignment,
      // NOT the refusal sentence, which names a slice by its index. This record
      // is STORED, and since translate version 2 its key no longer carries the
      // index, so the same record can be resumed at a different position and is
      // re-stamped when it is. A stored sentence saying `slice 7` would survive
      // that re-stamping and contradict the record carrying it. Nothing is lost
      // by leaving it out: `disposition` and `alignment` are both here, so the
      // driver derives the sentence from them and from the index the record was
      // actually stamped with.
      findings: stageResult.findings,
    };
  }

  // WHAT AN ABSENT SLICE MAY SETTLE ON, stated where the record is built rather
  // than trusted to the paths above. Every way of producing nothing has already
  // thrown by here, so this is unreachable; what it pins is that a record for a
  // passage the archive never translated always carries a translation, since
  // such a record is cached and read back as finished work.
  if ((incumbentKind === 'absent')
    && (stageResult.text
      .trim()
      === '')) {
    throw new BlankSelectionError({ findings: stageResult.findings, },);
  }

  /**
   * What this slice leaves the document with.
   *
   * THE ARCHIVE'S OWN BYTES WHEN NOTHING CHANGED, rather than a reconstruction
   * of them. Restoring a protected run onto an unchanged judged part rebuilds
   * the same passage, and a rebuild that differs by so much as a trailing
   * newline reports a change nobody made.
   */
  const outputText = wantsReplacement
    ? restoreTargetOnlyRun({
      text: stageResult.text,
      protectedText,
    },)
    : archiveText;

  return {
    kind: 'translate-slice',
    schemaVersion: TRANSLATE_SLICE_CACHE_VERSION,
    chunkIndex,
    stageResult,
    outputText,
    changed: wantsReplacement,
    disposition: 'stage-result',
    alignment,
    findings: stageResult.findings,
  };
}

//endregion Translate slice
