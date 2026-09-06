/** Factory failure must not leave adapter descriptors or unregistered partial fakes. @module */
import { describe, expect, it, type TestContext, } from '@monochromatic-dev/module-test';
import { createSandbox, } from 'sinon';

await describe({
  name: 'Sinon installation failure',
  children: [
    it({
      name: 'failed contextual construction preserves an existing direct-Sinon wrapper immediately',
      fn: async ({ sinon, }: TestContext,): Promise<void> => {
        const external = createSandbox();
        using cleanup = { [Symbol.dispose]: (): void => external.restore(), };
        const target = { method: (): string => 'original', };
        external.stub(target, 'method',).returns('external',);
        const before = Object.getOwnPropertyDescriptor(target, 'method',);
        expect(() => sinon.stub(target, 'method',),).toThrow('already wrapped',);
        expect(Object.getOwnPropertyDescriptor(target, 'method',),).toEqual(before,);
        expect(target.method(),).toBe('external',);
        external.restore();
        sinon.stub(target, 'method',).returns('new owner',);
        expect(target.method(),).toBe('new owner',);
      },
    },),
    ...(['stub', 'spy',] as const).map(operation => it({
      name: `failed whole-object ${operation} restores only newly introduced descriptors`,
      fn: async ({ sinon, }: TestContext,): Promise<void> => {
        const external = createSandbox();
        using cleanup = { [Symbol.dispose]: (): void => external.restore(), };
        const other = { method: (): string => 'external', };
        const target = { first: (): string => 'original', second: external.stub(other, 'method',), };
        const independent = { method: (): string => 'untouched', };
        sinon.stub(independent, 'method',).returns('existing replacement',);
        const before = Object.getOwnPropertyDescriptors(target,);
        expect(() => sinon[operation](target,),).toThrow('already wrapped',);
        expect(Object.getOwnPropertyDescriptors(target,),).toEqual(before,);
        expect(target.first(),).toBe('original',);
        expect(independent.method(),).toBe('existing replacement',);
        sinon.stub(target, 'first',).returns('fresh',);
        expect(target.first(),).toBe('fresh',);
      },
    },)),
  ],
},);
