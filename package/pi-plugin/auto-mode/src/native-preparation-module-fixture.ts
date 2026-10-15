/** Independent built preparation contracts preserve native member and selection identities. @module */
import type { FixtureSelection } from './native-selection-fixture.ts';
import type { ExecutionFixtureMember } from './native-execution-fixture.ts';

/** Original root records share canonical question bindings with native execution. */
export type PreparationFixtureRecord = {
  readonly prepared: ExecutionFixtureMember;
  readonly effectiveSignal: AbortSignal;
  readonly binding: Readonly<{
    identity: object;
    projection: Readonly<{ memberOrdinal: number }>;
  }>;
  execution?: unknown;
  parent?: unknown;
  program?: unknown;
};

/** Native preparation retains original failure and publication state for later owners. */
export type FixturePreparation = Readonly<{
  state: {
    prepared: boolean;
    preparing: boolean;
    preparationFailed: boolean;
    preparationFailure?: unknown;
    handle?: object;
    selection?: FixtureSelection;
  };
  prepare: (members: unknown) => void;
  knownSelection: () => FixtureSelection;
}>;

/** Consumer capabilities are supplied independently of source implementation types. */
type PreparationModule = Readonly<{
  createJudgmentPreparation: (input: Readonly<Record<string, unknown>>) => FixturePreparation;
}>;

/**
 Require the built original preparation factory before constructing fixture capabilities.

 @param value - unknown copied native namespace

 @returns assertion exposing the independent consumer contract

 @throws Error when the original preparation factory is unavailable
 */
function assertPreparationModule(value: unknown): asserts value is PreparationModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createJudgmentPreparation' in value))
    || ((typeof value.createJudgmentPreparation) !== 'function')) throw new Error('Built judgment preparation export is unavailable');
}

/** Native import uses the same artifact as the original judgment constructor. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-preparation.ts',
  import.meta.url,
).href);
assertPreparationModule(loaded);
/** Original factory remains fixed while each test supplies its own lifetime. */
export const preparationModule: PreparationModule = loaded;
