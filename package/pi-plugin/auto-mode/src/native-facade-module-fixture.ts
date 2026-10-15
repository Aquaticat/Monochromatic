/** Independent consumer contracts for original mechanical dependency ownership. @module */

/** Projection values distinguish live deadline checks from retained dependency inspection. */
export type FacadeFixtureProjection = Readonly<{
  mechanicalDependenciesCurrent: true;
  decisionDeadlineChecked: boolean;
  unqualifiedCoverage: unknown;
  instructionAuthority: 'not-established';
  humanWitness: 'not-established';
  currentEligibilityEstablished: false;
  productionPermission: false;
  actualSDKRootAdapterQualified: false;
}>;

/** Inert original file results remain independent of production type declarations. */
export type FacadeFixtureFile = Readonly<{
  kind: string;
  absolutePath?: unknown;
  relativePath?: string;
  dev?: string;
  ino?: string;
  mode?: number;
  bytesBase64?: string;
}>;

/** Built native operations retain opaque ownership and original synchronous results. */
export type FacadeFixtureOwner = Readonly<{
  prepare: (input: Readonly<{ signal: AbortSignal }>) => object;
  finalize: (handle: unknown) => FacadeFixtureProjection;
  checkRetained: (handle: unknown) => FacadeFixtureProjection;
  originalFile: (input: Readonly<{ handle: unknown; absolutePath: unknown }>) => FacadeFixtureFile;
}>;

/** Native bridge accepts independently supplied bootstrap capabilities. */
type FacadeModule = Readonly<{
  createDependencyFacade: (input: Readonly<Record<string, unknown>>) => FacadeFixtureOwner;
}>;

/**
 Require the original built native entry before supplying independent capabilities.

 @param value - copied native namespace

 @returns assertion exposing independent facade contract

 @throws Error when the original dependency factory is unavailable
 */
function assertFacadeModule(value: unknown): asserts value is FacadeModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createDependencyFacade' in value))
    || ((typeof value.createDependencyFacade) !== 'function')) throw new Error('Built original dependency facade is unavailable');
}

/** Stable bridge is consumed by the actual judgment constructor. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/native-text-read-contract/dependencies.mjs',
  import.meta.url,
).href);
assertFacadeModule(loaded);
/** Explicit namespace narrowing remains available inside concurrent test callbacks. */
export const facadeModule: FacadeModule = loaded;
