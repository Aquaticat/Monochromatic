/**
 Independent consumer contracts for original native inspection. @module
 */

/**
 Original records expose only fields read by inspection.
 */
export type InspectionFixtureRecord = {
  prepared: { input: { path?: unknown } };
  effectiveSignal: AbortSignal;
  execution?: { state: string };
  preparedProgram?: { view: object };
  program?: { handle: object };
};

/**
 Diagnostic snapshots retain original identities and immutable ordered collections.
 */
export type InspectionFixtureView = Readonly<{
  prepared: boolean;
  preparationFailed: boolean;
  preparationFailure: unknown;
  finished: boolean;
  closeFailed: boolean;
  accounting: unknown;
  finalRecord: unknown;
  memberExecutions: readonly Readonly<{
    id: string;
    state: string
  }>[];
  preparedPrograms: readonly object[];
  rootPrograms: readonly object[];
  childGroups: readonly object[];
}>;

/**
 Independent built owner contract distinguishes current and retained reads.
 */
type InspectionModule = Readonly<{
  createJudgmentInspection: (input: Readonly<Record<string, unknown>>) => Readonly<{
    preparedMemberFor: (member: unknown) => Readonly<{
      prepared: InspectionFixtureRecord['prepared'];
      signal: AbortSignal;
      programInspection: unknown;
    }>;
    originalFileFor: (member: unknown) => unknown;
    inspect: () => InspectionFixtureView;
  }>;
}>;

/**
 Independent test lifetime exposes identities and observable capability boundaries.
 */
export type InspectionFixture = Readonly<{
  owner: ReturnType<InspectionModule['createJudgmentInspection']>;
  events: string[];
  failures: Map<string, Error>;
  state: { onStep?: (point: string) => void };
  controller: AbortController;
  byMember: Map<string, object>;
  bindings: WeakMap<object, InspectionFixtureRecord>;
  records: InspectionFixtureRecord[];
  preparedViews: readonly object[];
  views: Map<object, object>;
  childGroups: { handle: object }[];
  preparation: {
    prepared: boolean;
    preparationFailed: boolean;
    preparationFailure?: unknown;
    handle?: object
  };
  lifecycle: {
    finished: boolean;
    closeFailed: boolean;
    finalRecord?: unknown
  };
  accounting: object;
  file: object;
  fileCalls: Readonly<{
    handle: unknown;
    absolutePath: unknown
  }>[];
}>;

/**
 Require the original built export before supplying independent capabilities.

 @param value - copied native namespace

 @returns assertion exposing consumer contract

 @throws Error when inspection export is unavailable
 */
function assertInspectionModule(value: unknown): asserts value is InspectionModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentInspection' in value))
    || ((typeof value.createJudgmentInspection) !== 'function')) throw new Error('Built judgment inspection export is unavailable');
}

/**
 Consumer imports the same copied artifact as the native judgment constructor.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-inspection.ts',
  import.meta.url,
).href);
assertInspectionModule(loaded);
/**
 Original factory remains fixed across independent fixture lifetimes.
 */
export const inspectionModule: InspectionModule = loaded;
