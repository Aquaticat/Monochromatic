/** Built policy-input capabilities authenticate original objects and borrowed receivers. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';

//region Original built modules create the capability before counterfeit consumers exercise its interface.
/** The namespace is loaded from the same stable facade used by native callers. */
const loadedPolicy: unknown = await import(new URL(
  '../dist/native/contract/integration/policy-source/system-slot.mjs',
  import.meta.url,
).href);
assert.ok((loadedPolicy !== null) && ((typeof loadedPolicy) === 'object'));
/** Explicit namespace ownership remains available inside the independent test callbacks. */
const policy: object = loadedPolicy;
/** The real disposable native environment supplies an issued and loaded capability. */
const environmentModule: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/environment.mjs',
  import.meta.url,
).href);
assert.ok((environmentModule !== null) && ((typeof environmentModule) === 'object'));
/** Only the original environment constructor may establish resource ownership. */
const createEnvironment: unknown = Reflect.get(environmentModule, 'createEnvironment');
assert.ok((typeof createEnvironment) === 'function');
/** The actual async constructor must finish before its capability is inspected. */
const construction: unknown = Reflect.apply(createEnvironment, undefined, [{}]);
assert.ok(construction instanceof Promise);
/** This environment and its filesystem resources belong exclusively to this test process. */
const environment: unknown = await construction;
assert.ok((environment !== null) && ((typeof environment) === 'object'));
/** Native resource cleanup remains mandatory when a later assertion fails. */
const drain: unknown = Reflect.get(environment, 'drain');
assert.ok((typeof drain) === 'function');
/** Cleanup observes the real owner instead of silencing shutdown failures. */
await using lifetime = {
  async [Symbol.asyncDispose]() {
    /** The owner reports completed resource shutdown through its original async operation. */
    const completion: unknown = Reflect.apply(drain, environment, []);
    assert.ok(completion instanceof Promise);
    await completion;
  },
};
/** The genuine capability is never replaced with a caller-authored state object. */
const loadedInput: unknown = Reflect.get(environment, 'policyInput');
assert.ok((loadedInput !== null) && ((typeof loadedInput) === 'object'));
/** Explicit issued-object identity remains available inside the independent test callbacks. */
const input: object = loadedInput;
/** Public operations accept either the capability or their original aggregate argument. */
const readers = [
  { name: 'readPolicyInput', field: undefined },
  { name: 'readSystemPolicyInput', field: undefined },
  { name: 'readAuthorityRegistration', field: undefined },
  { name: 'readHostPromptInput', field: undefined },
  { name: 'assertPolicyInput', field: 'binding' },
  { name: 'assertSystemPolicyInput', field: 'binding' },
  { name: 'bindPolicyCollector', field: 'context' },
  { name: 'bindPolicySessionCollector', field: 'session' },
] as const;

/**
 Invoke the actual public function without inventing a typed return contract.

 @param options - built namespace, original export name and caller argument

 @returns original uninspected result
 */
function invoke({ namespace, name, argument }: Readonly<{
  namespace: object;
  name: string;
  argument: unknown;
}>): unknown {
  /** Each export is independently checked before its JavaScript call boundary. */
  const operation: unknown = Reflect.get(namespace, name);
  assert.ok((typeof operation) === 'function');
  assert.equal(operation.length, 1);
  /** Results remain unknown until a consumer actually observes them. */
  const result: unknown = Reflect.apply(operation, undefined, [argument]);
  return result;
}

/**
 Find a published member across the original class and replacement factory representations.

 @param options - original issued capability and public member name

 @returns original callable getter or method
 */
function member({ capability, name }: Readonly<{ capability: object; name: string }>): PropertyDescriptor {
  /** Prototype lookup inspects only the genuine object, never a counterfeit receiver. */
  const prototype: unknown = Object.getPrototypeOf(capability);
  assert.ok((prototype !== null) && ((typeof prototype) === 'object'));
  /** Both representations expose the same member through ordinary property access. */
  const descriptor = Object.getOwnPropertyDescriptor(capability, name)
    ?? Object.getOwnPropertyDescriptor(prototype, name);
  assert.ok(descriptor !== undefined);
  return descriptor;
}
//endregion Original built modules create the capability before counterfeit consumers exercise its interface.

//region Positive native ownership and counterfeit rejection use the same shipped module.
await describe({
  name: 'built policy-input identity',
  children: [
    it({
      name: 'reads and revalidates the original native capability without replacing its binding',
      fn: async function originalCapability() {
        /** The native loader has already published its real current binding. */
        const binding = invoke({ namespace: policy, name: 'readPolicyInput', argument: input });
        assert.ok((binding !== null) && ((typeof binding) === 'object'));
        assert.equal(Reflect.get(binding, 'slot'), 'governing-policy');
        assert.equal(Object.isFrozen(input), true);
        assert.equal(invoke({ namespace: policy, name: 'readPolicyInput', argument: input }), binding);
        assert.equal(invoke({ namespace: policy, name: 'assertPolicyInput', argument: { input, binding } }), undefined);
        assert.throws(function wrongPlacement() {
          invoke({ namespace: policy, name: 'readSystemPolicyInput', argument: input });
        }, { name: 'PolicySlotBindingError', message: 'Original policy input is not a system-prompt carrier' });
        assert.throws(function foreignBinding() {
          invoke({ namespace: policy, name: 'assertPolicyInput', argument: { input, binding: {} } });
        }, { name: 'PolicySlotBindingError', message: 'Policy input link is not this loader original binding' });
      },
    }),
    ...readers.map(function readerCase(reader) {
      return it({
        name: `${reader.name} rejects counterfeit objects before invoking public property traps`,
        fn: async function counterfeitCapability() {
          /** Traps distinguish private ownership checks from public-property authentication. */
          const observations = { traps: 0 };
          /** Public property operations cannot establish ownership or leak a retained state. */
          const proxy = new Proxy(input, {
            get(): never {
              observations.traps += 1;
              throw new Error('Counterfeit property getter ran');
            },
            has(): never {
              observations.traps += 1;
              throw new Error('Counterfeit property membership trap ran');
            },
          });
          /** Counterfeits remain unknown even when built-in prototype construction returns any. */
          const candidates: readonly unknown[] = [undefined, null, false, '', [], {}, { '#state': {} }, { ...input }, Object.create(input), proxy];
          for (const candidate of candidates) {
            /** Aggregates preserve the public function's original argument shape. */
            const argument: unknown = reader.field === undefined ? candidate : { input: candidate, [reader.field]: undefined };
            assert.throws(function rejectCounterfeit() {
              invoke({ namespace: policy, name: reader.name, argument });
            }, { name: 'PolicySlotBindingError', message: 'Requires original policy-input capability' });
          }
          assert.equal(observations.traps, 0);
        },
      });
    }),
    ...['loader', 'nativeBinding', 'reload', 'readCurrent', 'assertCurrent'].map(function memberCase(name) {
      return it({
        name: `${name} cannot reveal original state through a borrowed receiver`,
        fn: async function borrowedReceiver() {
          /** The genuine descriptor provides the exact getter or method a consumer can borrow. */
          const descriptor = member({ capability: input, name });
          /** Descriptor values remain untrusted until their callable kind is checked. */
          const operation: unknown = Reflect.get(descriptor, 'get') ?? Reflect.get(descriptor, 'value');
          assert.ok((typeof operation) === 'function');
          /** Receiver identity remains uninspected until the built operation authenticates it. */
          const receivers: readonly unknown[] = [{}, { ...input }, Object.create(input), new Proxy(input, {})];
          await Array.fromAsync(receivers, async function rejectReceiver(receiver) {
            await assert.rejects(async function invokeBorrowedMember() {
              /** A copied operation receives only the counterfeit receiver and an invalid binding. */
              const result: unknown = Reflect.apply(operation, receiver, [{}]);
              if (result instanceof Promise) await result;
            }, function originalFailure(error: unknown): boolean {
              return Error.isError(error);
            });
          });
        },
      });
    }),
  ],
});
//endregion Positive native ownership and counterfeit rejection use the same shipped module.
