/**
 Original SDK result copying retains data identity and rejects accessors without invoking them.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/** Independent consumer contract permits malformed JavaScript inputs at the runtime boundary. */
type ResultModule = {
  readonly prepareSdkResult: (result: unknown) => Readonly<Record<string, unknown>>;
};

/**
 Require the built function before testing its runtime boundary independently of SDK types.

 @param value - built native module namespace
 @returns assertion exposing the runtime consumer contract
 @throws Error when the built result-copy export is absent
 */
function assertResultModule(value: unknown): asserts value is ResultModule {
  if (value === null || typeof value !== 'object' || !('prepareSdkResult' in value)
    || typeof value.prepareSdkResult !== 'function')
    throw new Error('Built native SDK result-copy function is unavailable');
}

/** The test imports the artifact consumed by the generated native host. */
const built: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/session-root-result.ts',
  import.meta.url,
).href);
assertResultModule(built);

//region Preserve original data fields and optional field presence

await describe({ name: '', children: [
  ...['absent', 'message', 'undefined'].map(function fallbackCase(fallback) {
    return it({ name: `retains original data identities and ${fallback} fallback presence`, fn: function originalData() {
      /** Borrowed native capabilities must remain mutable and retain their identities. */
      const session = { original: 'session' };
      /** Extension results remain the same original object after the outer result is frozen. */
      const extensionsResult = { original: 'extensions' };
      /** Unknown SDK result fields do not become construction-owned return fields. */
      const original = { session, extensionsResult, extra: 'excluded' };
      if (fallback !== 'absent') Object.defineProperty(original, 'modelFallbackMessage', {
        value: fallback === 'message' ? 'original fallback' : undefined,
        enumerable: true,
      });
      /** The copied result retains only the original public SDK fields. */
      const result = built.prepareSdkResult(original);
      expect(result.session).toBe(session);
      expect(result.extensionsResult).toBe(extensionsResult);
      expect(Object.hasOwn(result, 'extra')).toBe(false);
      expect(Object.hasOwn(result, 'modelFallbackMessage')).toBe(fallback !== 'absent');
      expect(result.modelFallbackMessage).toBe(fallback === 'message' ? 'original fallback' : undefined);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(session)).toBe(false);
      expect(Object.isFrozen(extensionsResult)).toBe(false);
    } });
  }),
  it({ name: 'observes each original own descriptor once without reading property values', fn: function descriptorObservations() {
    /** Trap records distinguish descriptor copying from getter or spread-based copying. */
    const descriptors: PropertyKey[] = [];
    /** Proxy fixtures remain local to this test and never wrap shared state. */
    const original = new Proxy({ session: {}, extensionsResult: {}, modelFallbackMessage: 'original' }, {
      getOwnPropertyDescriptor(target, property) {
        descriptors.push(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      get() { throw new Error('SDK result copying must not read original properties'); },
    });
    built.prepareSdkResult(original);
    expect(descriptors).toEqual(['session', 'extensionsResult', 'modelFallbackMessage']);
  } }),

  //endregion Preserve original data fields and optional field presence

  //region Reject malformed result records without invoking their accessors

  ...[null, undefined, [], Object.create(null), 'invalid'].map(function nonordinaryCase(value, index) {
    return it({ name: `rejects nonordinary SDK result ${index}`, fn: function nonordinaryResult() {
      expect(function copyInvalid() { return built.prepareSdkResult(value); }).toThrow('SDK construction requires its ordinary original result');
    } });
  }),
  ...['session', 'extensionsResult'].map(function missingFieldCase(field) {
    return it({ name: `rejects missing original ${field} data`, fn: function missingRequiredField() {
      /** The other required field remains present so this failure isolates the selected omission. */
      const original = field === 'session' ? { extensionsResult: {} } : { session: {} };
      expect(function copyMissing() { return built.prepareSdkResult(original); }).toThrow(`SDK result lacks original data field ${field}`);
    } });
  }),
  ...['session', 'extensionsResult', 'modelFallbackMessage'].map(function accessorCase(field) {
    return it({ name: `rejects accessor-backed ${field} without invoking it`, fn: function accessorField() {
      /** No accessor call is permitted during construction result preparation. */
      const calls: string[] = [];
      /** Required fields start valid before one selected field becomes an accessor. */
      const original = { session: {}, extensionsResult: {} };
      Object.defineProperty(original, field, { get() { calls.push(field); return {}; } });
      expect(function copyAccessor() { return built.prepareSdkResult(original); }).toThrow(`SDK result lacks original data field ${field}`);
      expect(calls).toHaveLength(0);
    } });
  }),

  //endregion Reject malformed result records without invoking their accessors
] });
