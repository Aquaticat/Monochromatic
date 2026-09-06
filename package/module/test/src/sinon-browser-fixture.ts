/** Browser consumer probes import the built neutral harness, not its source implementation. @module */
import { describe, expect, it, type TestContext, } from '../dist/final/neutral/index.mjs';

/** Serialized acceptance evidence returned across the Playwright page boundary. */
export type BrowserSandboxEvidence = {
  readonly restored: boolean;
  readonly contextCount: number;
  readonly nodeObserverInstalled: boolean;
  readonly processShim: boolean;
};

/**
 Exercises ordinary browser Sinon behavior and completed-attempt guards without Node globals.

 @param processShim - whether a non-Node process shim should be present
 @returns measured browser state after all attempts finish
 @example
 ```ts
 await runBrowserSandboxProbe({ processShim: false });
 ```
 */
export async function runBrowserSandboxProbe({ processShim, }: {
  readonly processShim: boolean;
},): Promise<BrowserSandboxEvidence> {
  if (processShim)
    Object.defineProperty(globalThis, 'process', { configurable: true, value: { env: {}, }, },);
  else
    expect(Reflect.has(globalThis, 'process',),).toBe(false,);
  /** Each page owns an independent target and browser storage context. */
  const target = { method(input: string,): string { return `original:${input}`; }, };
  /** Ordinary browser restoration must retain the exact original method descriptor. */
  const original = Object.getOwnPropertyDescriptor(target, 'method',);
  /** Factories are retained past successful, failing, and repeated attempts. */
  const late: (() => unknown)[] = [];
  /** Repeats must not reuse their sandbox context in the browser fallback either. */
  const contexts = new Set<TestContext>();
  await describe({
    name: 'browser sandbox fallback',
    concurrency: 1,
    children: [
      it({ name: 'ordinary method stub', fn: async ({ sinon, }: TestContext,): Promise<void> => {
        sinon.stub(target, 'method',).returns('stubbed',);
        expect(target.method('input',),).toBe('stubbed',);
        expect(Object.getOwnPropertyDescriptor(target, 'method',)?.get,).toBeUndefined();
        late.push(() => sinon.stub(target, 'method',),);
      }, },),
      it({ name: 'ordinary method spy', fn: async ({ sinon, }: TestContext,): Promise<void> => {
        /** The previous attempt has fully restored before this ordinary replacement. */
        const spy = sinon.spy(target, 'method',);
        expect(target.method('spy',),).toBe('original:spy',);
        expect(spy.callCount,).toBe(1,);
      }, },),
      it({ name: 'ordinary accessor configuration', fn: async ({ sinon, }: TestContext,): Promise<void> => {
        /** Non-method descriptor mutation remains a Sinon operation. */
        const data = { value: 'original', };
        /** Deferred setters must retain the same lifecycle guard in browsers. */
        const stub = sinon.stub(data, 'value',).value('replacement',);
        expect(data.value,).toBe('replacement',);
        late.push(() => stub.value('late',),);
      }, },),
      it({ name: 'failed body restores', fails: true, fn: async ({ sinon, }: TestContext,): Promise<void> => {
        sinon.stub(target, 'method',);
        throw new Error('Expected browser fixture failure',);
      }, },),
      it({ name: 'fresh repeated contexts', repeats: 1, fn: async (context: TestContext,): Promise<void> => {
        contexts.add(context,);
        context.sinon.stub(target, 'method',);
        late.push(() => context.sinon.fake.returns('late',),);
      }, },),
    ],
  },);
  for (const invoke of late)
    expect(invoke,).toThrow('completed',);
  expect(Object.getOwnPropertyDescriptor(target, 'method',),).toEqual(original,);
  expect(target.method('restored',),).toBe('original:restored',);
  return {
    restored: target.method('restored',) === 'original:restored',
    contextCount: contexts.size,
    nodeObserverInstalled: Reflect.has(globalThis, Symbol.for('@monochromatic-dev/module-test/async-failure-runtime/v1',),),
    processShim,
  };
}
