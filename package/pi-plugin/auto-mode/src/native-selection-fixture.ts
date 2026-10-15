/**
 Independent consumer contract for original question selection in the built native artifact. @module
 */
import { createHash } from 'node:crypto';

/**
 Consumer observes terminal markers and original answer values.
 */
type SelectionAnswer = Readonly<{
  status: string;
  value?: unknown;
  reason?: string
}>;

/**
 Retained diagnostics expose lifecycle state without granting usable evidence.
 */
type SelectionRecord = Readonly<{
  answers: readonly SelectionAnswer[];
  failure: unknown;
  malformed: boolean;
  discarded: boolean;
  raw?: string;
}>;

/**
 Original evidence must remain frozen, canonical, and unqualified.
 */
type SelectionEvidence = Readonly<{
  definitionId: string;
  definition: unknown;
  binding: unknown;
  envelope: unknown;
  answer?: SelectionAnswer;
  model?: string;
  semanticQualification: string;
  instructionAuthority: string;
  permission: boolean;
}>;

/**
 Exact published request exposes stable membership and contextual projections.
 */
type SelectionRequest = Readonly<{
  envelope: unknown;
  catalogSHA256: string;
  questions: readonly Readonly<{
    id: string;
    definitionId: string;
    definition: unknown;
    binding: unknown
  }>[];
  semanticQualification: string;
  instructionAuthority: string;
}>;

/**
 Consumer expectations are declared independently of source implementation types.
 */
export type FixtureSelection = Readonly<{
  declare: (input: Readonly<{
    definitionId: unknown;
    bindingHandle: unknown
  }>) => object;
  issue: (handles: unknown) => object;
  requestFor: (handle: unknown) => SelectionRequest;
  settle: (input: Readonly<{
    batch: unknown;
    answerText: unknown;
    model?: unknown
  }>) => SelectionRecord;
  answerFor: (handle: unknown) => Readonly<{
    issued: boolean;
    answer?: SelectionAnswer;
    semanticQualification: string
  }>;
  resultFor: (handle: unknown) => SelectionRecord;
  inspectClaim: (handle: unknown) => Readonly<{
    retainedOnly: true;
    issued: boolean;
    answer?: SelectionAnswer
  }>;
  inspectBatch: (handle: unknown) => Readonly<{
    retainedOnly: true;
    settled: boolean;
    record?: SelectionRecord
  }>;
  discard: (input: Readonly<{
    batch: unknown;
    error: unknown
  }>) => SelectionRecord;
  captureEvidence: (handle: unknown) => SelectionEvidence;
  captureBatchEvidence: (handle: unknown) => readonly SelectionEvidence[];
  assertCapturableBatch: (handle: unknown) => void;
  assertCapturedBatchIdentity: (evidence: unknown) => void;
  assertCapturedIdentity: (input: Readonly<{
    claim: unknown;
    evidence: unknown
  }>) => void;
}>;

/**
 Construction preserves runtime admission of catalog and occurrence inputs.
 */
type SelectionModule = Readonly<{
  createQuestionSelection: (input: Readonly<{
    catalogText: string;
    catalogSHA256: string;
    budget: Readonly<{ checkpoint: () => void }>;
    resolveBinding: (handle: unknown) => unknown;
    envelope?: unknown;
  }>) => FixtureSelection;
}>;

/**
 Require the original entry export before supplying fixture-owned callbacks.

 @param value - unknown built namespace

 @returns assertion exposing the independent consumer contract

 @throws Error when original selection export is absent
 */
function assertSelectionModule(value: unknown): asserts value is SelectionModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createQuestionSelection' in value))
    || ((typeof value.createQuestionSelection) !== 'function')) throw new Error('Built question selection export is unavailable');
}

/**
 The consumer reaches the same entry used by original native judgment construction.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/claim-evidence-batch-selection/selection.mjs',
  import.meta.url,
).href);
assertSelectionModule(loaded);
/**
 Named fixture helpers retain the established callable contract.
 */
const selectionModule: SelectionModule = loaded;

/**
 Fixture budgets stay current unless a case supplies an exact failure point.
 */
function currentBudget(): void { 
  return undefined; 
}

/**
 Fixture bindings are their own original occurrence handles.

 @param handle - exact caller-owned occurrence record

 @returns original record without normalization
 */
function originalBinding(handle: unknown): unknown { 
  return handle; 
}

/**
 Create an original immutable occurrence with a separately owned identity.

 @param projection - fixture-visible occurrence content

 @returns frozen original resolver record

 @example createSelectionBinding('original');
 */
export function createSelectionBinding(projection: unknown = 'original'): Readonly<{
  identity: object;
  projection: unknown
}> {
  return Object.freeze({
    identity: Object.freeze({}),
    projection
  });
}

/**
 Create disposable judgment ownership with controllable budget and resolver callbacks.

 @param checkpoint - optional exact lifetime failure point

 @param resolveBinding - optional changed or reentrant occurrence resolver

 @param envelope - original frozen context projection

 @returns independent consumer of the built selection boundary

 @example createSelectionFixture();
 */
export function createSelectionFixture({
  checkpoint = currentBudget,
  resolveBinding = originalBinding,
  envelope = Object.freeze({ context: 'original' }),
}: Readonly<{
  checkpoint?: () => void;
  resolveBinding?: (handle: unknown) => unknown;
  envelope?: unknown;
}> = {}): FixtureSelection {
  /**
   Distinct predicates prove canonicalization is per definition, not only per binding.
   */
  const catalogText = JSON.stringify({
    first: {
      type: 'noul',
      instructions: 'First fixed predicate',
      criteria: { true: 'holds', false: 'does not hold' }
    },
    second: {
      type: 'noul',
      instructions: 'Second fixed predicate',
      criteria: { true: 'holds', false: 'does not hold' }
    },
  });
  return selectionModule.createQuestionSelection({
    catalogText,
    catalogSHA256: createHash('sha256')
      .update(catalogText)
      .digest('hex'),
    budget: { checkpoint },
    resolveBinding,
    envelope,
  });
}

/**
 Exact emitted diagnostics distinguish the intended guard from an incidental exception.

 @param message - expected original selection diagnostic

 @returns predicate for original question-selection errors

 @example selectionError('Claim handle is not owned by this judgment');
 */
export function selectionError(message: string): (error: unknown) => boolean {
  return function matchesOriginalSelectionError(error: unknown): boolean {
    return Error.isError(error) && (error.name === 'QuestionSelectionError')
      && (error.message === message);
  };
}
