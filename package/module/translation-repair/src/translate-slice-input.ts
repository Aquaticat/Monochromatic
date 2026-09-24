import type {
  ChunkPair,
  SliceSyntax,
} from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { DeclaredNamePair, } from './linked-title-declared-name.ts';
import { attestedDetailLines, } from './reference-attest-match.ts';
import { splitTargetOnlyRun, } from './target-only-run.ts';
import type { IncumbentKind, } from './translate-absence.ts';

//region Deterministic pre-stage surface
// Production settlement and calibration share inputs without sharing publication-disposition guards.

/**
 Text and governance supplied before the translation stage computes its messages and seat windows.
 Provider clients, electorates, deadlines and publication disposition remain caller-owned.
 
 @example
 ```ts
 const result = await runTranslateStage({ ...surface.stageInput, client, translatorModelIds, judgeModelIds, signal, perCallTimeoutMs, l });
 ```
 */
export type TranslateSliceStageInput = {
  /**
   Canonical source passage, not its presentation-only writer display.
   */
  readonly sourceText: string;
  /**
   Incumbent wording remaining after the existing structural protection.
   */
  readonly incumbentText: string;
  /**
   Target chunk variant, not a guess based on string length.
   */
  readonly incumbentKind: IncumbentKind;
  /**
   Existing document-level declarations and vocabulary context.
   */
  readonly identityContext?: string;
  /**
   What the pages the original cites say, when it cites any.
   */
  readonly referenceContext?: string;
  /**
   Archive details a cited reference states, one sheet line each, present
   only when the entry attested any (class thirty-nine).
   */
  readonly attestedLines?: readonly string[];
  /**
   Why the incumbent is the repair lane's stand-in and which details are
   accepted additions, present only on a disputed slice (class one hundred
   eight).
   */
  readonly archiveDisputeNote?: string;
  /**
   Supplied source neighbors retain their context-only role.
   */
  readonly neighbouringSourceText?: string;
  /**
   Supplied archive neighbors retain their existing comparison role.
   */
  readonly neighbouringIncumbentText?: string;
  /**
   Previously acquired picture evidence, never bought by this projection.
   */
  readonly pictureContext?: string;
  /**
   Existing syntax role for metadata-aware stages.
   */
  readonly syntax?: SliceSyntax;
  /**
   Production child-level governance, including inherited parent treatment.
   */
  readonly lineStructured: boolean;
  /**
   Name pairs the front matter declares, for the publication rule's
   declared-name floor (class one hundred fourteen).
   */
  readonly declared?: readonly DeclaredNamePair[];
};

/**
 Rewritable stage inputs beside archive content the stage must not grade or regenerate.
 
 @example
 ```ts
 const { stageInput, protectedText, } = translateSliceInput({ slice, prepared });
 ```
 */
export type TranslateSliceInput = {
  /**
   Complete original incumbent span retained for publication restoration.
   */
  readonly archiveText: string;
  /**
   Existing target-only run held outside writing and judging.
   */
  readonly protectedText: string;
  /**
   Exact data supplied to the unchanged translation-stage operation.
   */
  readonly stageInput: TranslateSliceStageInput;
};

/**
 Projects a prepared slice through the existing target-only protection and input-governance rules.
 Performs no I/O, model call, publication decision or new context lookup.
 Protection excludes a known target-only run from both writing and judging;
 reattaching it only after selection would still put protected material into the comparison.
 Callers retain logging, restore protected text and decide separately whether wording may publish.
 
 @param slice - prepared source/target pair whose target index selects governance
 
 @param prepared - owning preparation supplying identity context and child line flags
 
 @param neighbouringSourceText - already-built source context passed through unchanged
 
 @param neighbouringIncumbentText - already-built incumbent context passed through unchanged
 
 @param pictureContext - already-acquired corroborated picture context passed through unchanged
 
 @param archiveStandIn - repair lane's text standing in for a disputed archive
 rendering (class one hundred seven), judged and restored as though it were
 the archive so the disputed wording is neither a candidate nor the fallback

 @param archiveDisputeNote - sheet note naming the accepted additions the
 stand-in answers for, so no writer or judge reads them as page content
 (class one hundred eight)
 
 @returns Stage surface and protected archive material without changing the operation being measured
 
 @example
 ```ts
 const surface = translateSliceInput({ slice, prepared, pictureContext });
 ```
 */
export function translateSliceInput(
  {
    slice,
    prepared,
    neighbouringSourceText,
    neighbouringIncumbentText,
    pictureContext,
    archiveStandIn,
    archiveDisputeNote,
  }: {
    readonly slice: ChunkPair;
    readonly prepared: PreparedDocumentPair;
    readonly archiveStandIn?: string;
    readonly archiveDisputeNote?: string;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
    readonly pictureContext?: string;
  },
): TranslateSliceInput {
  /**
   Complete archive wording before target-only protection.
   */
  const pageWording = slice.target
    .text;
  /**
   Wording the stage judges as the archive: the stand-in on a disputed slice
   (class one hundred seven), the archive's own elsewhere.
   */
  const archiveText = archiveStandIn ?? pageWording;
  /**
   Canonical original this slice renders.
   */
  const sourceText = slice.source
    .text;
  /**
   Existing transcript protection applied before either writing or judging.
   */
  const {
    judgedText,
    protectedText,
  } = splitTargetOnlyRun({
    sourceText,
    incumbentText: archiveText,
  },);
  /**
   Attested lines the translators are shown, none when nothing was attested
   (class thirty-nine).
   */
  const attestedLines = attestedDetailLines({ details: prepared.attestedDetails ?? [], },);
  return {
    archiveText,
    protectedText,
    stageInput: {
      sourceText,
      incumbentText: judgedText,
      incumbentKind: isInsertionChunk(slice.target,) ? 'absent' : 'present',
      lineStructured: prepared.lineStructuredSliceIndices
        .has(slice.target
          .sliceIndex,),
      ...((prepared.identityContext === undefined) ? {} : { identityContext: prepared.identityContext, }),
      ...((prepared.referenceContext === undefined) ? {} : { referenceContext: prepared.referenceContext, }),
      ...((attestedLines.length === 0) ? {} : { attestedLines, }),
      ...((archiveDisputeNote === undefined) ? {} : { archiveDisputeNote, }),
      ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
      ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
      ...((pictureContext === undefined) ? {} : { pictureContext, }),
      ...((slice.syntax === undefined) ? {} : { syntax: slice.syntax, }),
      declared: prepared.declaredNamePairs ?? [],
    },
  };
}

//endregion Deterministic pre-stage surface
