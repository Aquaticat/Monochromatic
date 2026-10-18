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
/** Independent native resource ownership verifies genuine getter results without a caller-created state. */
const loadedResource: unknown = await import(new URL(
  '../dist/native/contract/collector/rule-relevance-sdk-copy/input/resource-owner.mjs',
  import.meta.url,
).href);
assert.ok((loadedResource !== null) && ((typeof loadedResource) === 'object'));
/** Explicit namespace identity remains available inside independent test callbacks. */
const resource: object = loadedResource;
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
  concurrency: 1,
  children: [
    it({
      name: 'keeps capability operations out of implicit property enumeration',
      fn: async function opaqueEnumeration() {
        assert.deepEqual(Object.keys(input), []);
      },
    }),
    it({
      name: 'serializes as an opaque capability without reading its loader state',
      fn: async function opaqueSerialization() {
        /** Complete serialization remains local; failure output reports only its length. */
        const serialized = JSON.stringify(input);
        assert.ok(serialized !== undefined);
        assert.equal(serialized.length, 2);
        assert.equal(serialized, '{}');
      },
    }),
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
    it({
      name: 'genuine getters retain the native loader and its actual resource-frame identity',
      fn: async function originalGetterResults() {
        /** Only the native resource owner can authenticate this loader and binding pair. */
        const loader: unknown = Reflect.get(input, 'loader');
        assert.ok((loader !== null) && ((typeof loader) === 'object'));
        /** The binding must be the same original object recognized outside the capability module. */
        const nativeBinding: unknown = Reflect.get(input, 'nativeBinding');
        assert.ok((nativeBinding !== null) && ((typeof nativeBinding) === 'object'));
        /** Public policy reading independently identifies the currently bound native frame. */
        const binding = invoke({ namespace: policy, name: 'readPolicyInput', argument: input });
        assert.ok((binding !== null) && ((typeof binding) === 'object'));
        assert.equal(invoke({
          namespace: resource,
          name: 'readBoundResourceFrame',
          argument: { binding: nativeBinding, loader },
        }), Reflect.get(binding, 'frame'));
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
            /** Valid arguments isolate receiver ownership from unrelated binding validation. */
            const arguments_: readonly unknown[] = name === 'assertCurrent'
              ? [invoke({ namespace: policy, name: 'readPolicyInput', argument: input })]
              : [];
            await assert.rejects(async function invokeBorrowedMember() {
              /** A copied operation must reject the receiver even when its arguments are valid. */
              const result: unknown = Reflect.apply(operation, receiver, arguments_);
              if (result instanceof Promise) await result;
            }, function originalFailure(error: unknown): boolean {
              return Error.isError(error);
            });
          });
        },
      });
    }),
    it({
      name: 'genuine instance methods reload and revalidate through the original publication owner',
      fn: async function originalMethodResults() {
        /** Method values remain unknown until their actual callable kind is observed. */
        const read: unknown = Reflect.get(input, 'readCurrent');
        assert.ok((typeof read) === 'function');
        /** The original assertion function must accept only its currently published binding. */
        const check: unknown = Reflect.get(input, 'assertCurrent');
        assert.ok((typeof check) === 'function');
        /** The original async reload must publish a fresh binding rather than silently doing nothing. */
        const reload: unknown = Reflect.get(input, 'reload');
        assert.ok((typeof reload) === 'function');
        /** The instance reader and exported reader must observe the same current publication. */
        const before = invoke({ namespace: policy, name: 'readPolicyInput', argument: input });
        assert.equal(Reflect.apply(read, input, []), before);
        assert.equal(Reflect.apply(check, input, [before]), undefined);
        await Reflect.apply(reload, input, []);
        /** The reload's actual new publication invalidates the previous identity. */
        const after = invoke({ namespace: policy, name: 'readPolicyInput', argument: input });
        assert.notEqual(after, before);
        assert.equal(Reflect.apply(read, input, []), after);
        assert.equal(Reflect.apply(check, input, [after]), undefined);
        assert.throws(function staleBinding() {
          Reflect.apply(check, input, [before]);
        }, { name: 'PolicySlotBindingError', message: 'Policy input link is not this loader original binding' });
      },
    }),
  ],
});
//endregion Positive native ownership and counterfeit rejection use the same shipped module.
