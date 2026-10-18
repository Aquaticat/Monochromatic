/** Built policy-slot errors preserve ordinary and inherited JavaScript behavior. @module */
import assert from 'node:assert/strict';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

//region Built constructor identity and native Error semantics remain consumer observations.
/**
 Read the built facade without inventing a substitute constructor type.

 @returns original built error constructor for the consumer to narrow

 @throws AssertionError when the built namespace has lost its named capability
 */
async function loadConstructor(): Promise<unknown> {
  /** The consumer loads the same stable facade used by original policy callers. */
  const namespace: unknown = await import(new URL(
    '../dist/native/contract/integration/policy-source/system-slot-error.mjs',
    import.meta.url,
  ).href);
  assert.ok((namespace !== null) && ((typeof namespace) === 'object')
    && ('PolicySlotBindingError' in namespace));
  return namespace.PolicySlotBindingError;
}

await describe({
  name: 'built policy-slot error',
  children: [
    it({
      name: 'retains constructor arity, native prototypes, messages and optional cause identity',
      fn: async function nativeErrorValues(): Promise<void> {
        /** The actual built export must be constructable by its existing JavaScript consumers. */
        const constructor = await loadConstructor();
        assert.ok(typeof constructor === 'function');
        /** Cause identity must survive without copying or string conversion. */
        const cause = new Error('original policy cause');
        /** Reflect.construct invokes the actual built class with its original argument convention. */
        const withCause: unknown = Reflect.construct(constructor, ['original policy failure', { cause }]);
        assert.ok(Error.isError(withCause));
        expect(constructor.length).toBe(2);
        expect(withCause instanceof constructor).toBe(true);
        expect(withCause.message).toBe('original policy failure');
        expect(withCause.cause).toBe(cause);
        expect(withCause.name).toBe('PolicySlotBindingError');
        /** An omitted options argument must not manufacture a cause property. */
        const withoutCause: unknown = Reflect.construct(constructor, ['uncorrelated policy failure']);
        assert.ok(Error.isError(withoutCause));
        expect(withoutCause.message).toBe('uncorrelated policy failure');
        expect(Object.hasOwn(withoutCause, 'cause')).toBe(false);
      },
    }),
    it({
      name: 'invokes an inherited name setter without shadowing it with a declared class field',
      fn: async function inheritedNameSetter(): Promise<void> {
        /** No constructor or global prototype is replaced for this test. */
        const constructor = await loadConstructor();
        assert.ok(typeof constructor === 'function');
        /** Only the owned consumer subclass links to the original built prototype. */
        const prototype: unknown = Reflect.get(constructor, 'prototype');
        assert.ok((prototype !== null) && ((typeof prototype) === 'object'));
        /** A class prototype has no native Error data; inspect its inheritance directly. */
        const parent: unknown = Object.getPrototypeOf(prototype);
        expect(parent).toBe(Error.prototype);
        /** Record actual setter execution instead of merely checking the final error string. */
        const received: string[] = [];
        /** Reflect.construct must execute the built constructor, never its caller-owned new.target body. */
        function consumerConstructor(): never {
          assert.fail('The new.target body must not replace the built policy error constructor');
        }
        /** Only this fixture-owned prototype receives the consumer's name accessor. */
        const consumerPrototype: unknown = Reflect.get(consumerConstructor, 'prototype');
        assert.ok((consumerPrototype !== null) && ((typeof consumerPrototype) === 'object'));
        Object.setPrototypeOf(consumerPrototype, prototype);
        Object.defineProperty(consumerPrototype, 'name', {
          configurable: true,
          /** Preserve the consumer's accessor result after construction. */
          get(): string {
            return 'consumer-owned name';
          },
          /** @param value - original constructor name observed by the consumer */
          set(value: string): void {
            received.push(value);
          },
        });
        /** The actual built constructor runs with this test-owned subclass as new.target. */
        const error: unknown = Reflect.construct(constructor, ['consumer policy failure'], consumerConstructor);
        assert.ok(Error.isError(error));
        expect(error instanceof constructor).toBe(true);
        expect(received).toEqual([consumerConstructor.name]);
        expect(error.name).toBe('consumer-owned name');
        expect(Object.hasOwn(error, 'name')).toBe(false);
      },
    }),
    it({
      name: 'shares the constructor between the stable JavaScript facade and built typed implementation',
      fn: async function facadeIdentity(): Promise<void> {
        /** Both module paths must expose one constructor, not structurally similar replacements. */
        const constructor = await loadConstructor();
        /** The emitted typed module is loaded as shipped, without a source import substitute. */
        const implementation: unknown = await import(new URL(
          '../dist/native/contract/integration/policy-source/system-slot-error.ts',
          import.meta.url,
        ).href);
        assert.ok((implementation !== null) && ((typeof implementation) === 'object')
          && ('PolicySlotBindingError' in implementation));
        expect(implementation.PolicySlotBindingError).toBe(constructor);
      },
    }),
  ],
});
//endregion
