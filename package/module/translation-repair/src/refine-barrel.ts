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
  buildRefineSelectionContext,
  type RefineSelectionContext,
  type RefineStageMode,
} from './refine-selection-context.ts';
export { refineProbeVerdict, } from './refine-probe-verdict.ts';
export {
  applyReply,
  inRosterOrder,
  resolveReply,
} from './refine-stage-replies.ts';
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
export { persistRefinePhaseSlice, } from './refine-phase-slice.ts';
export { refineSettledSlices, } from './repair-refine-step.ts';
export { assembleRepair, } from './repair-assemble.ts';
export { repairReplacements, } from './repair-replacements.ts';
export { wrapRepairOutcomes, } from './repair-wrap.ts';
export { wrapReplacementText, } from './semantic-wrap.ts';
export {
  refuseFailedRun,
  startProgram,
} from './lint-program.ts';
export { loneSurrogateIndex, } from './lone-surrogate.ts';
export {
  LINT_BINARY_NAME,
  PINNED_LINT_BINARY_VERSION,
} from './semantic-wrap-binary-constants.ts';
export {
  LintBinaryMissingError,
  LintBinaryVersionError,
  UNREADABLE_ANSWER,
  versionClause,
} from './semantic-wrap-binary-error.ts';
export { wrapWithLintBinary, } from './semantic-wrap-binary.ts';
export {
  countedCharacters,
  LintBinaryRunError,
  LintBinaryTextError,
} from './semantic-wrap-run-error.ts';
export {
  placeSlices,
  type SliceReplacement,
  SliceSpliceError,
  spliceSlices,
} from './splice-slices.ts';
export {
  contentWrite,
  type PlacedSlice,
  placementsOf,
  type Write,
  type Written,
} from './splice-slice-places.ts';

export {
  REFINE_CACHE_VERSION,
  refineRunShape,
  refineSliceKey,
} from './refine-slice-key.ts';

//endregion Refinement barrel
