/** Original judgment source ownership and collection capabilities. @module */
import type { JudgmentPreparationInput, JudgmentPreparationSources } from './judgment-preparation-types.ts';

/** Original native request retains the same body and source collection received by preparation. */
export type JudgmentSourceReceipt = JudgmentPreparationInput['receipt'] & Readonly<{
  sources: JudgmentPreparationSources;
}>;

/** Observer handoff binds one source collection to its exact original request receipt. */
export type JudgmentSourceBinding = Readonly<{
  request: JudgmentSourceReceipt;
  sources: JudgmentPreparationSources;
}>;

/** Original collection capability validates its caller without granting policy authority. */
export type JudgmentSourceCollector = Readonly<{
  capture: (input: Readonly<{ signal: AbortSignal }>) => JudgmentPreparationSources;
  assertObservedFresh: (snapshot: JudgmentPreparationSources) => void;
}>;

/** Source handoff remains synchronous and precedes original request authentication. */
export type JudgmentSourcesInput = Readonly<{
  observer: Readonly<{
    beginJudgmentSources?: (response: object) => JudgmentSourceBinding;
    bindJudgmentSources?: (response: object) => JudgmentSourceBinding;
  }>;
  response: object;
  readOriginalRequest: () => JudgmentSourceReceipt;
  signal: AbortSignal;
  collector: Pick<JudgmentSourceCollector, 'assertObservedFresh'>;
  assertDependenciesCurrent: () => void;
}>;

/** Current source reads and preparation publication share the original collection identity. */
export type JudgmentSources = Readonly<{
  receipt: JudgmentSourceReceipt;
  collector: JudgmentSourceCollector;
  readSourceSnapshot: () => JudgmentPreparationSources;
  publishJudgmentSources: (sources: JudgmentPreparationSources) => void;
  readCurrentSourceBinding: () => JudgmentSourceBinding;
}>;
