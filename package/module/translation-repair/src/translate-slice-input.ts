import type { ChunkPair, SliceSyntax, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import { splitTargetOnlyRun, } from './target-only-run.ts';
import type { IncumbentKind, } from './translate-absence.ts';

//region Deterministic pre-stage surface
// Production settlement and calibration share inputs without sharing publication-disposition guards.

/**
 * Text and governance supplied before the translation stage computes its messages and seat windows.
 * Provider clients, electorates, deadlines and publication disposition remain caller-owned.
 *
 * @example
 * ```ts
 * const result = await runTranslateStage({ ...surface.stageInput, client, translatorModelIds, judgeModelIds, signal, perCallTimeoutMs, l });
 * ```
 */
export type TranslateSliceStageInput = {
  /** Canonical source passage, not its presentation-only writer display. */
  readonly sourceText: string;
  /** Incumbent wording remaining after the existing structural protection. */
  readonly incumbentText: string;
  /** Target chunk variant, not a guess based on string length. */
  readonly incumbentKind: IncumbentKind;
  /** Existing document-level declarations and vocabulary context. */
  readonly identityContext?: string;
  /** Supplied source neighbors retain their context-only role. */
  readonly neighbouringSourceText?: string;
  /** Supplied archive neighbors retain their existing comparison role. */
  readonly neighbouringIncumbentText?: string;
  /** Previously acquired picture evidence, never bought by this projection. */
  readonly pictureContext?: string;
  /** Existing syntax role for metadata-aware stages. */
  readonly syntax?: SliceSyntax;
  /** Production child-level governance, including inherited parent treatment. */
  readonly lineStructured: boolean;
};

/**
 * Rewritable stage inputs beside archive content the stage must not grade or regenerate.
 *
 * @example
 * ```ts
 * const { stageInput, protectedText, } = translateSliceInput({ slice, prepared });
 * ```
 */
export type TranslateSliceInput = {
  /** Complete original incumbent span retained for publication restoration. */
  readonly archiveText: string;
  /** Existing target-only run held outside writing and judging. */
  readonly protectedText: string;
  /** Exact data supplied to the unchanged translation-stage operation. */
  readonly stageInput: TranslateSliceStageInput;
};

/**
 * Projects a prepared slice through the existing target-only protection and input-governance rules.
 * Performs no I/O, model call, publication decision or new context lookup.
 * Protection excludes a known target-only run from both writing and judging;
 * reattaching it only after selection would still put protected material into the comparison.
 * Callers retain logging, restore protected text and decide separately whether wording may publish.
 *
 * @param slice - prepared source/target pair whose target index selects governance
 * @param prepared - owning preparation supplying identity context and child line flags
 * @param neighbouringSourceText - already-built source context passed through unchanged
 * @param neighbouringIncumbentText - already-built incumbent context passed through unchanged
 * @param pictureContext - already-acquired corroborated picture context passed through unchanged
 * @returns Stage surface and protected archive material without changing the operation being measured
 * @example
 * ```ts
 * const surface = translateSliceInput({ slice, prepared, pictureContext });
 * ```
 */
export function translateSliceInput(
  {
    slice,
    prepared,
    neighbouringSourceText,
    neighbouringIncumbentText,
    pictureContext,
  }: {
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
    readonly pictureContext?: string;
  },
): TranslateSliceInput {
  /** Complete archive wording before target-only protection. */
  const archiveText = slice.target.text;
  /** Canonical original this slice renders. */
  const sourceText = slice.source.text;
  /** Existing transcript protection applied before either writing or judging. */
  const { judgedText, protectedText, } = splitTargetOnlyRun({ sourceText, incumbentText: archiveText, },);
  return {
    archiveText,
    protectedText,
    stageInput: {
      sourceText,
      incumbentText: judgedText,
      incumbentKind: isInsertionChunk(slice.target,) ? 'absent' : 'present',
      lineStructured: prepared.lineStructuredSliceIndices.has(slice.target.sliceIndex,),
      ...((prepared.identityContext === undefined) ? {} : { identityContext: prepared.identityContext, }),
      ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
      ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
      ...((pictureContext === undefined) ? {} : { pictureContext, }),
      ...((slice.syntax === undefined) ? {} : { syntax: slice.syntax, }),
    },
  };
}

//endregion Deterministic pre-stage surface
