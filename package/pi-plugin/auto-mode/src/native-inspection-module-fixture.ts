/** Independent consumer contracts for original native inspection. @module */

/** Original records expose only fields read by inspection. */
export type InspectionFixtureRecord = {
  prepared: { input: { path?: unknown } };
  effectiveSignal: AbortSignal;
  execution?: { state: string };
  preparedProgram?: { view: object };
  program?: { handle: object };
};

/** Diagnostic snapshots retain original identities and immutable ordered collections. */
export type InspectionFixtureView = Readonly<{
  prepared: boolean;
  preparationFailed: boolean;
  preparationFailure: unknown;
  finished: boolean;
  closeFailed: boolean;
  accounting: unknown;
  finalRecord: unknown;
  memberExecutions: readonly Readonly<{ id: string; state: string }>[];
  preparedPrograms: readonly object[];
  rootPrograms: readonly object[];
  childGroups: readonly object[];
}>;

/** Independent built owner contract distinguishes current and retained reads. */
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

/** Consumer imports the same copied artifact as the native judgment constructor. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-inspection.ts',
  import.meta.url,
).href);
assertInspectionModule(loaded);
/** Original factory remains fixed across independent fixture lifetimes. */
export const inspectionModule: InspectionModule = loaded;
