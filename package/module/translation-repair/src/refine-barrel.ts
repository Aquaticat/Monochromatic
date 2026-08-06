//region Refinement barrel
// Naturalness-lane surface: eligibility, protected atoms and the structural
// gate, the rewriter wire and prompt, and the stage itself. Split from the
// pipeline barrel so each stays under the file-size budget.

export {
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

//endregion Refinement barrel
