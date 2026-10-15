/**
 Native input tests load the same copied modules consumed by the maintained host.

 @module
 */

//region Runtime assertions establish the built resource-copy interface

/**
 Only the original resource operations are exposed to these consumer tests.
 */
type NativeResourceInput = {
  /**
   Snapshot outputs remain unknown until each test inspects the selected native shape.
   */
  readonly snapshotInput: (input: {
    readonly kind: string;
    readonly value: unknown
  }) => unknown;
  /**
   Constructor option copies retain arbitrary opaque native dependencies.
   */
  readonly copyOptions: (input: unknown) => Record<string, unknown>;
};

/**
 Require the copied native resource module's original callables.

 @param value - built module imported through its artifact URL

 @returns no value; establishes the callable contract used by the consuming tests

 @throws Error when the artifact omits either resource operation
 */
function assertNativeResourceInput(value: unknown): asserts value is NativeResourceInput {
  if (((typeof value) !== 'object') || (value === null)
    || (!('snapshotInput' in value))
    || ((typeof value.snapshotInput) !== 'function')
    || (!('copyOptions' in value))
    || ((typeof value.copyOptions) !== 'function')) throw new Error('Built native resource input module lacks its callable exports');
}

/**
 The built host imports this copied resource module.
 */
const built: unknown = await import(new URL(
  '../dist/native/contract/collector/resource-input-custody/values.ts',
  import.meta.url
).href);
assertNativeResourceInput(built);

/**
 Consumer tests call the built operations without importing source implementations.
 */
export const nativeResourceInput: NativeResourceInput = built;

//endregion Runtime assertions establish the built resource-copy interface
