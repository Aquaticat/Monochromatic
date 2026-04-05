/**
 * Tests for `createSinon` and asymmetric matchers.
 *
 * @module
 */

import {
  createSinon,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  name: 'createSinon',
  children: [
    it({
      name: 'stub and spy work with expect matchers',
      fn: async () => {
        await using sandbox = createSinon();
        const obj = { greet: (_name: string,): string => 'hi', };
        const stub = sandbox.stub(obj, 'greet',).returns('hello',);

        obj.greet('world',);

        expect(stub,).toHaveBeenCalled();
        expect(stub,).toHaveBeenCalledTimes(1,);
        expect(stub,).toHaveBeenCalledWith('world',);
      },
    }),

    it({
      name: 'sandbox restores on dispose',
      fn: async () => {
        const obj = { getValue: (): number => 42, };
        const ORIGINAL = 42;
        const STUBBED = 99;

        {
          await using sandbox = createSinon();
          sandbox.stub(obj, 'getValue',).returns(STUBBED,);
          expect(obj.getValue(),).toBe(STUBBED,);
        }

        expect(obj.getValue(),).toBe(ORIGINAL,);
      },
    }),

    it({
      name: 'asymmetric matchers work inside toHaveBeenCalledWith',
      fn: async () => {
        await using sandbox = createSinon();
        const spy = sandbox.spy();

        spy('hello world', { id: 1, name: 'test', },);

        expect(spy,).toHaveBeenCalledWith(
          expect.stringContaining('hello',),
          expect.objectContaining({ id: 1, },),
        );
      },
    }),

    it({
      name: 'expect.anything matches any value',
      fn: async () => {
        await using sandbox = createSinon();
        const spy = sandbox.spy();

        spy('specific', { deeply: 'nested', },);

        expect(spy,).toHaveBeenCalledWith('specific', expect.anything(),);
      },
    }),

    it({
      name: 'expect.any matches by constructor',
      fn: async () => {
        await using sandbox = createSinon();
        const spy = sandbox.spy();

        spy(new Error('test',),);

        expect(spy,).toHaveBeenCalledWith(expect.any(Error,),);
      },
    }),

    it({
      name: 'expect.arrayContaining matches subset',
      fn: async () => {
        await using sandbox = createSinon();
        const spy = sandbox.spy();

        spy([1, 2, 3, 4, 5,],);

        expect(spy,).toHaveBeenCalledWith(expect.arrayContaining([2, 4,],),);
      },
    }),

    it({
      name: 'expect.stringMatching matches by regex',
      fn: async () => {
        await using sandbox = createSinon();
        const spy = sandbox.spy();

        spy('hello world',);

        expect(spy,).toHaveBeenCalledWith(expect.stringMatching(/^hello/,),);
      },
    }),

    it({
      name: 'toHaveReturnedWith checks return value',
      fn: async () => {
        await using sandbox = createSinon();
        const RETURN_VALUE = 42;
        const obj = { getValue: (): number => RETURN_VALUE, };
        const spy = sandbox.spy(obj, 'getValue',);

        obj.getValue();

        expect(spy,).toHaveReturnedWith(RETURN_VALUE,);
      },
    }),
  ],
},);
