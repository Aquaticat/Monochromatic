//region Recall barrel
// Recall-measurement surface: planting seeds and asking whether they were
// derivable, the lexical restoration measure, the judge that rules on a
// restoration the words alone cannot settle, and the benchmark that scores a
// whole run. Split from the pipeline barrel so each stays under the file-size
// budget.

export {
  runDerivabilityProbe,
  type SeedDerivability,
} from './derivability-probe.ts';
export {
  buildDerivabilityMessages,
  DERIVABILITY_RESPONSE_FORMAT,
  DERIVABILITY_VERDICTS,
  type DerivabilityPlan,
  type DerivabilityVerdict,
  isDerivabilityVerdict,
  resolveDerivabilityJudgment,
} from './derivability-wire.ts';
export {
  contentWords,
  measureSeedRestoration,
  RESTORATION_WORD_THRESHOLD,
  type SeedRestoration,
} from './lexical-restoration.ts';
export {
  computeRepairScorecard,
  DEFAULT_JUDGE_MODEL_IDS,
  MIN_REPAIR_DISPATCH_BUDGET_MS,
  type RepairAttemptRecord,
  type RepairBenchmarkResult,
  type RepairScorecard,
  runRepairBenchmark,
} from './repair-benchmark.ts';
export {
  buildRestorationJudgeMessages,
  isRestorationJudgeWire,
  isRestorationVerdict,
  type JudgeReference,
  RESTORATION_JUDGE_RESPONSE_FORMAT,
  RESTORATION_JUDGE_VERDICTS,
  type RestorationJudgePlan,
  type RestorationJudgeWire,
  type RestorationJudgmentWire,
  type RestorationVerdict,
  resolveRestorationJudgment,
} from './restoration-judge-wire.ts';
export {
  runRestorationJudge,
  type SeedJudgment,
} from './restoration-judge.ts';
export {
  gradeSeedDetection,
  type SeedDetectionVerdict,
} from './seed-detection.ts';

//endregion Recall barrel
