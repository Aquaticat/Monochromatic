/**
 Independent built consumer contract for prepared argument sealing. @module
 */

/**
 Opaque input admission retains the original dispatcher error constructor.
 */
type SealModule = Readonly<{
  sealPreparedInput: (input: Readonly<{
    input: unknown;
    PreparedBatchContractError: new (message: string) => Error
  }>) => unknown;
}>;

/** Require the callable built export before observing argument mutation.
 @param value - built namespace
 
 @returns narrowed independent consumer contract
 
 @throws Error when the built sealing export is absent
 */
function assertSealModule(value: unknown): asserts value is SealModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('sealPreparedInput' in value))
    || ((typeof value.sealPreparedInput) !== 'function')) throw new Error('Built prepared input sealing export is unavailable');
}

/**
 Original error identity remains independently loaded from the public dispatcher.
 */
type DispatcherModule = Readonly<{ PreparedBatchContractError: new (message: string) => Error }>;

/** Require the original runtime constructor without importing implementation declarations.
 @param value - built dispatcher namespace
 
 @returns narrowed original constructor
 
 @throws Error when the dispatcher constructor is absent
 */
function assertDispatcherModule(value: unknown): asserts value is DispatcherModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('PreparedBatchContractError' in value))
    || ((typeof value.PreparedBatchContractError) !== 'function')) throw new Error('Built prepared dispatcher error is unavailable');
}

/**
 Built sealing artifact is consumed after native rebuild.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-input-seal.ts',
  import.meta.url
).href);
assertSealModule(loaded);
/**
 Runtime callable retains an explicit independent contract after narrowing.
 */
const sealing: SealModule = loaded;
/**
 Built dispatcher owns error metadata and identity.
 */
const dispatcher: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs',
  import.meta.url
).href);
assertDispatcherModule(dispatcher);
/**
 Original error constructor is exposed for exact consumer assertions.
 */
export const PreparedBatchContractError: new (message: string) => Error = dispatcher.PreparedBatchContractError;

/** Seal disposable fixture arguments through the built artifact.
 @param input - disposable prepared argument
 
 @returns original input after sealing
 
 @throws Error for original admission failures

 @example seal({ value: true });
 */
export function seal(input: unknown): unknown {
  return sealing.sealPreparedInput({
    input,
    PreparedBatchContractError
  });
}
