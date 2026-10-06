//region Judge fidelity probe barrel
// The run and the shapes of the source-reviewed fidelity probe, moved out of its
// entry file so their tests can import them like every sibling's. The entry
// file keeps only its wiring.

export {
  type BoundedFidelityMatrix,
  boundFidelityMatrix,
  fidelityJudgedLine,
  fidelityKeptLine,
  fidelityKeptRun,
  fidelityPartialWarning,
  fidelityPlan,
  type FidelityPlan,
  type FidelityPlannedRow,
  fidelityPreflightLine,
  fidelityRowResult,
  type FidelityRowResult,
} from './corpus-run/judge-fidelity-probe-plan.ts';
export {
  type FidelityProbeSink,
  runFidelityProbe,
} from './corpus-run/judge-fidelity-probe-run.ts';

//endregion Judge fidelity probe barrel
