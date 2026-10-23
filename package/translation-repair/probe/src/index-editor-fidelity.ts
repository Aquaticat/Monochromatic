//region Editor fidelity exports
// The editor fidelity probe's trials, score, arguments, ceiling, spend guard, client, trial, plan and run.
// Re-exported by `index.ts`, which is the package's one public entry.

export {
  DEFAULT_EDITOR_MAX_USD,
  DEFAULT_EDITOR_TRIAL_CAP,
  readEditorFidelityArguments,
} from './corpus-run/editor-fidelity-args.ts';
export {
  callCeilingUsd,
  ceilingLine,
  type EditorCeiling,
  editorCeilings,
  MAX_ASKS_PER_TRIAL,
  messageChars,
  pricesOf,
  tierFor,
  usdText,
} from './corpus-run/editor-fidelity-ceiling.ts';
export {
  cardsOnlyClient,
  editorProbeEnv,
} from './corpus-run/editor-fidelity-client.ts';
export { poolLine, } from './corpus-run/editor-fidelity-pool-line.ts';
export {
  type EditorCardTally,
  type EditorFidelityPlan,
  editorFidelityPlan,
  type EditorFidelityRow,
  editorFidelityRow,
  editorKeptLine,
  editorKeptRun,
  type EditorPair,
  type EditorPlannedRow,
  editorPreflightLine,
  editorTallyLine,
  editorTallyOf,
} from './corpus-run/editor-fidelity-plan.ts';
export {
  pairName,
  readingWord,
  seatedCardsOf,
  sheetCharsOf,
} from './corpus-run/editor-fidelity-probe-read.ts';
export {
  type EditorProbeSink,
  runEditorFidelityProbe,
} from './corpus-run/editor-fidelity-probe-run.ts';
export {
  guardLine,
  measuredUsd,
  spendGuardedClient,
} from './corpus-run/editor-fidelity-spend-guard.ts';
export {
  type EditorTrialReading,
  runEditorTrial,
} from './corpus-run/editor-fidelity-trial.ts';
export { EDITOR_FIDELITY_POOL, } from './editor-fidelity-pool-manifest.ts';
export {
  type EditorFidelityScore,
  type EditorFixKind,
  scoreEditedText,
} from './editor-fidelity-score.ts';
export {
  EDITOR_DAMAGE_KINDS,
  type EditorDamageKind,
  type EditorFidelityTrial,
  editorFidelityTrials,
} from './editor-fidelity-trials.ts';

//endregion Editor fidelity exports
