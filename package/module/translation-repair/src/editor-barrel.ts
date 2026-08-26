//region Editor barrel
// The editing side of the repair lane, exported as one surface.
//
// Split out of `pipeline-barrel.ts` when that file reached its line budget,
// grouped by what a consumer actually reaches for together: the editor prompt
// and wire, the proposals a fan-out produces, the two judged selection stages,
// what those stages decided, and the ballots they cast.

export {
  buildEditorMessages,
  type EditorPromptPlan,
} from './edit-prompt.ts';
export {
  EDITOR_RESPONSE_FORMAT,
  type EditorEditResolution,
  type EditorEditWire,
  type EditorReportWire,
  isEditorReportWire,
  resolveEditorEdits,
} from './edit-wire.ts';
export { collectEnvelopeProposals, } from './editor-proposals.ts';
export { buildLicensedQuotes, } from './licensed-quotes.ts';
export {
  applyCandidate,
  selectChunkPatch,
  selectPerEnvelope,
} from './editor-ensemble.ts';
export {
  type ChunkPatchSelection,
  type EditorCandidate,
  type EnvelopeSelection,
  NOBODY_WROTE_IT,
  type ShippedProducer,
} from './editor-selection-result.ts';
export {
  coverageGapLines,
  readStandingCoverage,
  type SeatAnswers,
  type StandingCoverage,
  UnseatedStandingError,
} from './producer-silence.ts';
export {
  rankStandings,
  standingLine,
} from './producer-standing-report.ts';
export {
  EDITOR_ROUND_STAGES,
  REFINER_ROUND_STAGES,
  selectionRoundOf,
  selectionRoundsFor,
  SlatePositionsError,
} from './repair-selection-rounds.ts';
export {
  CHUNK_SCOPE_ENVELOPE,
  describeJudgedRound,
  describeRepairSlate,
  type RepairJudgedRound,
  type RepairRoundStage,
  type RepairSlateEntry,
} from './repair-round-record.ts';
export {
  buildChunkCandidates,
  buildEditorCandidates,
  type ChunkCandidateSet,
  chunkCandidateOf,
  type EditorCandidateSet,
  pickFallbackCandidate,
} from './editor-candidates.ts';
export {
  gatherWidthInput,
  type WidthInputOutcome,
  type WidthProbeInput,
} from './corpus-run/editor-width-input.ts';
export {
  type ArmOutcome,
  runArm,
} from './corpus-run/editor-width-arm.ts';
export { bothOrders, } from './corpus-run/editor-width-contest.ts';
export { runWidthSlice, } from './corpus-run/editor-width-slice.ts';

//endregion Editor barrel
