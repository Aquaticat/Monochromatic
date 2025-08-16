import {
  BooleanNot,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(BooleanNot, () => {
  test('negates boolean values', () => {
    expect(BooleanNot(true,),).toBe(false,);
    expect(BooleanNot(false,),).toBe(true,);
  });

  test('converts falsy values to true', () => {
    expect(BooleanNot(0,),).toBe(true,);
    expect(BooleanNot('',),).toBe(true,);
    expect(BooleanNot(null,),).toBe(true,);
    expect(BooleanNot(undefined,),).toBe(true,);
    expect(BooleanNot(Number.NaN,),).toBe(true,);
  });

  test('converts truthy values to false', () => {
    expect(BooleanNot(1,),).toBe(false,);
    expect(BooleanNot('text',),).toBe(false,);
    expect(BooleanNot([],),).toBe(false,);
    expect(BooleanNot({},),).toBe(false,);
    expect(BooleanNot(() => {
      // no-op
    },),)
      .toBe(false,);
  });

  test('works with empty arrays and objects', () => {
    expect(BooleanNot([],),).toBe(false,);
    expect(BooleanNot({},),).toBe(false,);
  });

  test('works with non-empty arrays and objects', () => {
    expect(BooleanNot([1, 2, 3,],),).toBe(false,);
    expect(BooleanNot({ a: 1, },),).toBe(false,);
  });
},);
