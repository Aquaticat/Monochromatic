//region Corpus pass barrel
// The corpus pass's limits, printers, ordering, guards, queue, selection and
// procedure, exported so each is tested where it is defined; the command that
// runs them is `corpus-run/corpus-pass.ts`.

export {
  CORPUS_PAIR_TARGET,
  HARD_CAP_MINUTES,
  PASS_MS_PER_MINUTE,
  PLAN_PREVIEW_COUNT,
  SOFT_BUDGET_MS,
} from './corpus-run/corpus-pass-limits.ts';
export {
  passDoneLine,
  passIncompleteLine,
  passLaunchLines,
  passOnlyLines,
  passPlanLine,
  passRequiredLines,
  passStartLine,
} from './corpus-run/corpus-pass-lines.ts';
export { orderPendingEntries, } from './corpus-run/corpus-pass-order.ts';
export { assertPassResumable, } from './corpus-run/corpus-pass-guards.ts';
export { runPassQueue, } from './corpus-run/corpus-pass-queue.ts';
export { selectPendingEntries, } from './corpus-run/corpus-pass-select.ts';
export {
  type CorpusPassInput,
} from './corpus-run/corpus-pass-input.ts';
export { runCorpusPassOver, } from './corpus-run/corpus-pass-run.ts';
export { republishRunPages, } from './corpus-run/pass-republish.ts';

//endregion Corpus pass barrel
