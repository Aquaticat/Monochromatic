/**
 Original judgment source ownership and collection capabilities. @module
 */
import type {
  JudgmentPreparationInput,
  JudgmentPreparationSources
} from './judgment-preparation-types.ts';

/**
 Original native request retains the same body and source collection received by preparation.
 */
export type JudgmentSourceReceipt<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = JudgmentPreparationInput['receipt'] & Readonly<{
  sources: Source;
}>;

/**
 Observer handoff binds one source collection to its exact original request receipt.
 */
export type JudgmentSourceBinding<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = Readonly<{
  request: JudgmentSourceReceipt<Source>;
  sources: Source;
}>;

/**
 Original collection capability validates its caller without granting policy authority.
 */
export type JudgmentSourceCollector<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = Readonly<{
  capture: (input: Readonly<{ signal: AbortSignal }>) => Source;
  assertObservedFresh: (snapshot: Source) => void;
}>;

/**
 Source handoff remains synchronous and precedes original request authentication.
 */
export type JudgmentSourcesInput<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = Readonly<{
  observer: Readonly<{
    beginJudgmentSources?: (response: object) => JudgmentSourceBinding<Source>;
    bindJudgmentSources?: (response: object) => JudgmentSourceBinding<Source>;
  }>;
  response: object;
  readOriginalRequest: () => JudgmentSourceReceipt<Source>;
  signal: AbortSignal;
  collector: Pick<JudgmentSourceCollector<Source>, 'assertObservedFresh'>;
  assertDependenciesCurrent: () => void;
}>;

/**
 Current source reads and preparation publication share the original collection identity.
 */
export type JudgmentSources<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = Readonly<{
  receipt: JudgmentSourceReceipt<Source>;
  collector: JudgmentSourceCollector<Source>;
  readSourceSnapshot: () => Source;
  publishJudgmentSources: (sources: Source) => void;
  readCurrentSourceBinding: () => JudgmentSourceBinding<Source>;
}>;
