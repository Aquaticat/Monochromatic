//region Refinement barrel
// Naturalness-lane surface: eligibility, protected atoms and the structural
// gate, the rewriter wire and prompt, and the stage itself. Split from the
// pipeline barrel so each stays under the file-size budget.

export {
  collectDefinitions,
  deriveRefinableEnvelopes,
  type RefinableSlice,
} from './refine-envelope.ts';
export {
  isRefineReportWire,
  REFINE_RESPONSE_FORMAT,
  type RefineReportWire,
  type RefineResolution,
  type RefineRewriteWire,
  resolveRefineRewrites,
} from './refine-wire.ts';
export {
  buildRefineMessages,
  type RefinePromptPlan,
} from './refine-prompt.ts';
export {
  type RefineStageResult,
  runRefineStage,
} from './refine-stage.ts';
export {
  type AtomGateVerdict,
  gateParagraphRewrite,
  inspectParagraph,
  type InspectionRejection,
  type ParagraphInspection,
} from './inspect-paragraph.ts';
export {
  type AtomKind,
  type ProtectedAtom,
  scanTextAtoms,
} from './protected-atom.ts';
export {
  type IneligibleReason,
  type ParagraphEligibility,
  selectRefinableParagraphs,
} from './refine-eligibility.ts';

export {
  type RefinePhaseResult,
  runRefinePhase,
} from './refine-phase.ts';
export { repairReplacements, } from './repair-replacements.ts';
export { wrapRepairOutcomes, } from './repair-wrap.ts';
export { wrapReplacementText, } from './semantic-wrap.ts';
export {
  type SliceReplacement,
  spliceSlices,
} from './splice-slices.ts';

//endregion Refinement barrel
