/** Descriptor authority on public behavior selectors and collection members. @module */
import { describe, expect, it, type TestContext, } from '@monochromatic-dev/module-test';
import type { SinonStub, } from 'sinon';

/** Ordinary object shape shared by the supported and fallback probes. */
type Target = { method: () => string; };

/** Produce the distinct public fake-returning operation families. */
function createReplacement({ sinon, mode, }: {
  readonly sinon: TestContext['sinon'];
  readonly mode: 'method' | 'object' | 'function-object' | 'instance';
},): { target: Target; fake: SinonStub; } {
  if (mode === 'instance') {
    class MethodSource {
      method(this: void,): string {
        return 'original';
      }
    }
    const target = sinon.createStubInstance(MethodSource,);
    return { target, fake: target.method, };
  }
  if (mode === 'function-object') {
    class FunctionTarget {
      static method(this: void,): string {
        return 'original';
      }
    }
    return { target: FunctionTarget, fake: sinon.stub(FunctionTarget,).method, };
  }
  const target = { method: (): string => 'original', };
  return { target, fake: mode === 'object' ? sinon.stub(target,).method : sinon.stub(target, 'method',), };
}

await describe({
  name: 'returned Sinon descriptor authority',
  children: [
    ...(['onCall', 'onFirstCall', 'onSecondCall', 'onThirdCall',] as const).map(selector => it({
      name: `${selector} preserves private configuration and rejects setter conversion`,
      fn: async ({ sinon, }: TestContext,): Promise<void> => {
        const target = { method: (): string => 'original', };
        const fake = sinon.stub(target, 'method',);
        const behavior = fake[selector](0,);
        behavior.value(() => 'private',);
        expect(target.method(),).toBe('private',);
        await it({ name: 'unowned reader', fn: async (): Promise<void> => {
          expect(target.method(),).toBe('original',);
        }, },);
        expect(() => behavior.set(() => {},),).toThrow('context-owned data-method',);
        expect(target.method(),).toBe('private',);
        fake.restore();
        sinon.stub(target, 'method',).returns('fresh',);
        expect(() => behavior.value(() => 'stale',),).toThrow('restored',);
        expect(target.method(),).toBe('fresh',);
      },
    },)),
    ...(['method', 'object', 'function-object', 'instance',] as const).map(mode => it({
      name: `${mode} members and behavior objects cannot mutate a later generation`,
      fn: async (): Promise<void> => {
        const entries: { target: Target; fake: SinonStub; behavior: SinonStub; }[] = [];
        await it({ name: 'old owner', fn: async ({ sinon, }: TestContext,): Promise<void> => {
          const replacement = createReplacement({ sinon, mode, },);
          replacement.fake.returns('owned',);
          expect(replacement.target.method(),).toBe('owned',);
          entries.push({ ...replacement, behavior: replacement.fake.onCall(0,), },);
        }, },);
        const [entry,] = entries;
        if (entry === undefined)
          throw new Error('Missing completed replacement',);
        await it({ name: 'new owner', fn: async ({ sinon, }: TestContext,): Promise<void> => {
          sinon.stub(entry.target, 'method',).returns('fresh',);
          const installed = Object.getOwnPropertyDescriptor(entry.target, 'method',);
          for (const controller of [entry.fake, entry.behavior,]) {
            for (const operation of ['get', 'set', 'value',] as const) {
              expect(() => controller[operation](() => 'stale',),).toThrow('completed',);
              expect(Object.getOwnPropertyDescriptor(entry.target, 'method',),).toEqual(installed,);
            }
          }
          entry.fake.restore();
          expect(entry.target.method(),).toBe('fresh',);
          expect(Object.getOwnPropertyDescriptor(entry.target, 'method',),).toEqual(installed,);
          entry.fake.onCall(entry.fake.callCount,).returns('local',);
          expect(entry.fake(),).toBe('local',);
        }, },);
      },
    },)),
  ],
},);
