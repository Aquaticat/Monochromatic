/**
 Independent consumer contract for the built question settlement boundary. @module
 */

/** Original claims carry only the fields this consumer allows settlement to update. */
export type FixtureClaim = {
  readonly definition: Readonly<{ type: string; criteria: Readonly<Record<string, string>> }>;
  answer?: Readonly<{ status: string; value?: unknown; reason?: string }>;
  model?: string;
};

/** Retained raw diagnostics are optional; failure keeps the original caught value. */
type SettlementRecord = Readonly<{
  answers: readonly Readonly<{ status: string; value?: unknown; reason?: string }>[];
  raw?: string;
  malformed: boolean;
  discarded: boolean;
  failure: unknown;
  model?: string;
  semanticQualification: 'not-established';
  instructionAuthority: 'not-established';
}>;

/** Original selection owns terminal writes and membership. */
type FixtureBatch = {
  readonly selected: readonly FixtureClaim[];
  settled: boolean;
  record?: SettlementRecord;
};

/** The caller submits untrusted transport data through its original batch handle. */
type Settle = (input: { batch: unknown; answerText: unknown; model?: unknown }) => SettlementRecord;

/** Consumer expectations are independent of the implementation's type declarations. */
type SettlementModule = {
  createQuestionSettlement: (input: {
    knownBatch: (handle: unknown) => FixtureBatch;
    retainedOperation: <Result>(operation: () => Result) => Result;
    budget: { checkpoint: () => void };
    current: (claim: FixtureClaim) => void;
  }) => Settle;
};

/**
 Require the built callable before handing it original owner capabilities.
 @param value - unknown built namespace
 @throws Error when settlement is absent from the artifact
 */
function assertSettlementModule(value: unknown): asserts value is SettlementModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createQuestionSettlement' in value))
    || ((typeof value.createQuestionSettlement) !== 'function')) throw new Error('Built question settlement export is unavailable');
}

/** The consumer exercises the copied native artifact directly. */
const loaded: unknown = await import(new URL('../dist/native/contract/lifecycle/claim-evidence-batch-selection/selection-settlement.ts', import.meta.url).href);
assertSettlementModule(loaded);
/** Named fixture functions retain this established callable contract. */
const settlementModule: SettlementModule = loaded;

/**
 Create disposable original claims with controllable owner lifetime checks.
 @param checkpoint - optional enclosing budget failure point
 @param current - optional original binding failure point
 @param definitions - pinned definitions for this fixture's selected claims
 @returns original owner records and its bound settlement operation
 */
export function createSettlementFixture({
  checkpoint = function currentBudget() {},
  current = function currentBinding() {},
  definitions = [
    { type: 'noul', criteria: { true: 'holds', false: 'does not hold' } },
    { type: 'noul', criteria: { true: 'holds', false: 'does not hold' } },
  ],
}: {
  readonly checkpoint?: () => void;
  readonly current?: (claim: FixtureClaim) => void;
  readonly definitions?: readonly FixtureClaim['definition'][];
} = {}): { batch: FixtureBatch; settle: Settle; handle: object } {
  /** The fixture retains each original claim so partial publication is observable. */
  const selected: FixtureClaim[] = definitions.map(function originalClaim(definition) {
    return { definition };
  });
  /** Opaque handle is distinct from the mutable owner record. */
  const handle = Object.freeze({});
  /** This is the only record the fixture's owner recognizes. */
  const batch: FixtureBatch = { selected, settled: false };
  /** The production function receives exactly the original owner callbacks. */
  const settle = settlementModule.createQuestionSettlement({
    knownBatch(candidate) {
      if (candidate !== handle) throw new Error('Foreign fixture batch');
      return batch;
    },
    retainedOperation(operation) { return operation(); },
    budget: { checkpoint },
    current,
  });
  return { batch, settle, handle };
}
