/**
 Load the copied native resource module through its independent consumer contract.

 @module
 */

/**
 Reload fixtures preserve arbitrary original options and return values for identity assertions.
 */
export type ReloadFixture = { readonly reload: (options?: unknown) => Promise<unknown> };

/**
 Only original loader and policy-reload identities are needed by this boundary.
 */
export type ReloadRecord = {
  readonly loader: ReloadFixture;
  readonly policyInput: ReloadFixture;
};

/**
 Built native module exposes the same registration and reload functions used by generated Pi services.
 */
type ReloadModule = {
  readonly registerHostResource: (input: ReloadRecord) => void;
  readonly readHostResource: (loader: ReloadFixture) => ReloadRecord;
  readonly reloadHostResource: (input: {
    readonly loader: ReloadFixture;
    readonly options?: unknown
  }) => Promise<unknown>;
};

/**
 Require callable built exports before exercising the independent consumer contract.

 @param value - copied native module namespace

 @returns assertion narrowing to the independently exercised consumer contract

 @throws Error when an expected native export is unavailable
 */
function assertReloadModule(value: unknown): asserts value is ReloadModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('registerHostResource' in value))
    || ((typeof value.registerHostResource) !== 'function')
    || (!('readHostResource' in value))
    || ((typeof value.readHostResource) !== 'function')
    || (!('reloadHostResource' in value))
    || ((typeof value.reloadHostResource) !== 'function'))
    throw new Error('Built native resource reload exports are unavailable');
}

/**
 Tests import the same copied artifact selected by native source generation.
 */
const built: unknown = await import(new URL(
  '../dist/native/contract/integration/native-host/resource-reload.ts',
  import.meta.url
).href);
assertReloadModule(built);

/**
 Checked exports provide all behavior under test.
 */
export const nativeResourceReload: ReloadModule = built;
