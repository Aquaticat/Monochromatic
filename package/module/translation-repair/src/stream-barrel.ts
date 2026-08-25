//region Stream barrel
// Everything that watches a model's response WHILE IT ARRIVES: the delta scan
// that splits the two channels, the degeneration ratio, the recurrence watch,
// the overrun bound, and the runaway watch that composes them.
//
// Split out of `index.ts` when that file reached its line budget, on the same
// audience grounds the barrels before it used. These symbols answer one
// question, "is this stream still doing useful work", and every one of them is
// finished with before a reply becomes a value the pipeline reads.

export { extractStreamedCompletion, } from './stream-completion.ts';
export { drainBody, } from './stream-drain.ts';
export {
  reportStreamProgress,
  StreamCutShortError,
  type StreamOutcome,
} from './stream-cut.ts';
export {
  type DegenerationDetector,
  type DegenerationVerdict,
  watchForDegeneration,
} from './stream-degeneration.ts';
export {
  type ChannelDelta,
  type DeltaScanner,
  scanStreamDeltas,
  type StreamChannel,
} from './stream-delta-scan.ts';
export {
  type RunawayVerdict,
  type RunawayWatch,
  StreamDegenerateError,
  watchRunaway,
} from './stream-runaway-watch.ts';
export {
  type RecurrenceDetector,
  type RecurrenceVerdict,
  watchForRecurrence,
} from './stream-recurrence-watch.ts';
export {
  isSelfEndedStream,
  StreamOverrunError,
} from './stream-overrun.ts';
export {
  armIdleGuard,
  type IdleGuard,
  STREAM_FIRST_BYTE_MS,
  STREAM_IDLE_MS,
  type StreamProgress,
  StreamStalledError,
} from './stream-idle-guard.ts';

//endregion Stream barrel
