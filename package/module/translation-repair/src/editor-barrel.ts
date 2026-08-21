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
export {
  applyCandidate,
  selectChunkPatch,
  selectPerEnvelope,
} from './editor-ensemble.ts';
export type {
  ChunkPatchSelection,
  EditorCandidate,
  EnvelopeSelection,
} from './editor-selection-result.ts';
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
  type EditorCandidateSet,
  pickFallbackPatch,
} from './editor-candidates.ts';

//endregion Editor barrel
