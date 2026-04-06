/**
 * Tests for sinon sandbox via TestContext and asymmetric matchers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  name: 'sinon via context',
  children: [
    it({
      name: 'stub and spy work with expect matchers',
      fn: async ({ sinon, },) => {
        const obj = { greet: (_name: string,): string => 'hi', };
        const stub = sinon.stub(obj, 'greet',).returns('hello',);

        obj.greet('world',);

        expect(stub,).toHaveBeenCalled();
        expect(stub,).toHaveBeenCalledTimes(1,);
        expect(stub,).toHaveBeenCalledWith('world',);
      },
    },),

    it({
      name: 'sandbox restores automatically between tests',
      fn: async ({ sinon, },) => {
        const obj = { getValue: (): number => 42, };
        const ORIGINAL = 42;
        const STUBBED = 99;

        sinon.stub(obj, 'getValue',).returns(STUBBED,);
        expect(obj.getValue(),).toBe(STUBBED,);

        // restore manually to verify the mechanism works within a test
        sinon.restore();
        expect(obj.getValue(),).toBe(ORIGINAL,);
      },
    },),

    it({
      name: 'asymmetric matchers work inside toHaveBeenCalledWith',
      fn: async ({ sinon, },) => {
        const spy = sinon.spy();

        spy('hello world', { id: 1, name: 'test', },);

        expect(spy,).toHaveBeenCalledWith(
          expect.stringContaining('hello',),
          expect.objectContaining({ id: 1, },),
        );
      },
    },),

    it({
      name: 'expect.anything matches any value',
      fn: async ({ sinon, },) => {
        const spy = sinon.spy();

        spy('specific', { deeply: 'nested', },);

        expect(spy,).toHaveBeenCalledWith('specific', expect.anything(),);
      },
    },),

    it({
      name: 'expect.any matches by constructor',
      fn: async ({ sinon, },) => {
        const spy = sinon.spy();

        spy(new Error('test',),);

        expect(spy,).toHaveBeenCalledWith(expect.any(Error,),);
      },
    },),

    it({
      name: 'expect.arrayContaining matches subset',
      fn: async ({ sinon, },) => {
        const spy = sinon.spy();

        spy([1, 2, 3, 4, 5,],);

        expect(spy,).toHaveBeenCalledWith(expect.arrayContaining([2, 4,],),);
      },
    },),

    it({
      name: 'expect.stringMatching matches by regex',
      fn: async ({ sinon, },) => {
        const spy = sinon.spy();

        spy('hello world',);

        expect(spy,).toHaveBeenCalledWith(expect.stringMatching(/^hello/,),);
      },
    },),

    it({
      name: 'toHaveReturnedWith checks return value',
      fn: async ({ sinon, },) => {
        const RETURN_VALUE = 42;
        const obj = { getValue: (): number => RETURN_VALUE, };
        const spy = sinon.spy(obj, 'getValue',);

        obj.getValue();

        expect(spy,).toHaveReturnedWith(RETURN_VALUE,);
      },
    },),
  ],
},);
