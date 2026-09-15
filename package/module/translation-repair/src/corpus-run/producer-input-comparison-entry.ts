//region Dedicated inert comparison API, not an alternate input bootstrap or arbitrary command runner

export { runProducerInputComparison, } from './producer-input-comparison.ts';
export {
  ProducerInputComparisonError,
  type ProducerInputComparisonFailure,
} from './producer-input-comparison-error.ts';
export {
  BOOTSTRAP_TERMINATION_GRACE_MS,
  comparisonBootstrapInterruption,
  type ComparisonBootstrapInterruption,
} from './producer-input-comparison-interrupt.ts';
export {
  ownProducerInputComparisonSignal,
  type ProducerInputComparisonCancellation,
} from './producer-input-comparison-signal.ts';
export type {
  ProducerInputComparisonRequest,
  ProducerInputComparisonResult,
} from './producer-input-comparison-model.ts';

//endregion Dedicated inert comparison API, not an alternate input bootstrap or arbitrary command runner
