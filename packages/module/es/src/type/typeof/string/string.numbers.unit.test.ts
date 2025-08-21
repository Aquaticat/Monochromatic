import {
  type DoubleDigitIntString,
  type FloatString,
  type IntString,
  isFloatString,
  isIntString,
  isNegativeFloatString,
  isNegativeIntString,
  isNegativeNumberString,
  isNumberString,
  isPositiveFloatString,
  isPositiveIntString,
  isPositiveNumberString,
  logtapeConfiguration,
  logtapeConfigure,
  type NegativeFloatString,
  type NegativeIntString,
  type NegativeNumberString,
  type OneToFourDigitsIntString,
  type PositiveFloatString,
  type PositiveIntString,
  type PositiveNumberString,
  type QuadrupleDigitIntString,
  type SingleDigitIntString,
  type TripleDigitIntString,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('string.numbers', () => {
  describe('type tests', () => {
    test('SingleDigitIntString', () => {
      expectTypeOf<SingleDigitIntString>().toEqualTypeOf<
        '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
      >();

      // Valid single digit types
      expectTypeOf<'0'>().toExtend<SingleDigitIntString>();
      expectTypeOf<'5'>().toExtend<SingleDigitIntString>();
      expectTypeOf<'9'>().toExtend<SingleDigitIntString>();
    });

    test('DoubleDigitIntString', () => {
      // Valid double digit types (no leading zeros)
      expectTypeOf<'10'>().toExtend<DoubleDigitIntString>();
      expectTypeOf<'42'>().toExtend<DoubleDigitIntString>();
      expectTypeOf<'99'>().toExtend<DoubleDigitIntString>();
    });

    test('TripleDigitIntString', () => {
      // Valid triple digit types (no leading zeros)
      expectTypeOf<'100'>().toExtend<TripleDigitIntString>();
      expectTypeOf<'123'>().toExtend<TripleDigitIntString>();
      expectTypeOf<'999'>().toExtend<TripleDigitIntString>();
    });

    test('QuadrupleDigitIntString', () => {
      // Valid quadruple digit types (no leading zeros)
      expectTypeOf<'1000'>().toExtend<QuadrupleDigitIntString>();
      expectTypeOf<'2024'>().toExtend<QuadrupleDigitIntString>();
      expectTypeOf<'9999'>().toExtend<QuadrupleDigitIntString>();
    });

    test('OneToFourDigitsIntString', () => {
      expectTypeOf<'5'>().toExtend<OneToFourDigitsIntString>();
      expectTypeOf<'42'>().toExtend<OneToFourDigitsIntString>();
      expectTypeOf<'123'>().toExtend<OneToFourDigitsIntString>();
      expectTypeOf<'1234'>().toExtend<OneToFourDigitsIntString>();
    });

    test('PositiveIntString branded type', () => {
      expectTypeOf<'0'>().toExtend<PositiveIntString>();
      expectTypeOf<PositiveIntString>().toHaveProperty('__brand',);
    });

    test('PositiveFloatString branded type', () => {
      expectTypeOf<PositiveFloatString>().toHaveProperty('__brand',);
    });

    test('IntString union type', () => {
      expectTypeOf<IntString>().toEqualTypeOf<PositiveIntString | NegativeIntString>();
    });

    test('FloatString union type', () => {
      expectTypeOf<FloatString>().toEqualTypeOf<
        PositiveFloatString | NegativeFloatString
      >();
    });

    test('PositiveNumberString union type', () => {
      expectTypeOf<PositiveNumberString>().toEqualTypeOf<
        PositiveIntString | PositiveFloatString
      >();
    });
  });

  describe('isPositiveIntString', () => {
    test('returns true for valid positive integers', () => {
      expect(isPositiveIntString('0',),).toBe(true,);
      expect(isPositiveIntString('1',),).toBe(true,);
      expect(isPositiveIntString('5',),).toBe(true,);
      expect(isPositiveIntString('9',),).toBe(true,);
      expect(isPositiveIntString('10',),).toBe(true,);
      expect(isPositiveIntString('42',),).toBe(true,);
      expect(isPositiveIntString('123',),).toBe(true,);
      expect(isPositiveIntString('999',),).toBe(true,);
      expect(isPositiveIntString('1000',),).toBe(true,);
      expect(isPositiveIntString('123456',),).toBe(true,);
    });

    test('returns false for strings with leading zeros', () => {
      expect(isPositiveIntString('01',),).toBe(false,);
      expect(isPositiveIntString('007',),).toBe(false,);
      expect(isPositiveIntString('0123',),).toBe(false,);
      expect(isPositiveIntString('00',),).toBe(false,);
    });

    test('returns false for negative numbers', () => {
      expect(isPositiveIntString('-1',),).toBe(false,);
      expect(isPositiveIntString('-42',),).toBe(false,);
      expect(isPositiveIntString('-0',),).toBe(false,);
      expect(isPositiveIntString('-123',),).toBe(false,);
    });

    test('returns false for decimal numbers', () => {
      expect(isPositiveIntString('12.3',),).toBe(false,);
      expect(isPositiveIntString('0.5',),).toBe(false,);
      expect(isPositiveIntString('123.456',),).toBe(false,);
      expect(isPositiveIntString('1.0',),).toBe(false,);
    });

    test('returns false for non-numeric strings', () => {
      expect(isPositiveIntString('abc',),).toBe(false,);
      expect(isPositiveIntString('12a',),).toBe(false,);
      expect(isPositiveIntString('a12',),).toBe(false,);
      expect(isPositiveIntString('',),).toBe(false,);
      expect(isPositiveIntString(' ',),).toBe(false,);
      expect(isPositiveIntString('1 2',),).toBe(false,);
    });

    test('returns false for non-string values', () => {
      expect(isPositiveIntString(123,),).toBe(false,);
      expect(isPositiveIntString(null,),).toBe(false,);
      expect(isPositiveIntString(undefined,),).toBe(false,);
      expect(isPositiveIntString({},),).toBe(false,);
      expect(isPositiveIntString([],),).toBe(false,);
      expect(isPositiveIntString(true,),).toBe(false,);
    });
  });

  describe('isNegativeIntString', () => {
    test('returns true for valid negative integers', () => {
      expect(isNegativeIntString('-1',),).toBe(true,);
      expect(isNegativeIntString('-5',),).toBe(true,);
      expect(isNegativeIntString('-42',),).toBe(true,);
      expect(isNegativeIntString('-123',),).toBe(true,);
      expect(isNegativeIntString('-999',),).toBe(true,);
      expect(isNegativeIntString('-1000',),).toBe(true,);
      expect(isNegativeIntString('-123456',),).toBe(true,);
    });

    test('returns true for negative zero', () => {
      expect(isNegativeIntString('-0',),).toBe(true,);
    });

    test('returns false for negative numbers with leading zeros', () => {
      expect(isNegativeIntString('-01',),).toBe(false,);
      expect(isNegativeIntString('-007',),).toBe(false,);
      expect(isNegativeIntString('-0123',),).toBe(false,);
      expect(isNegativeIntString('-00',),).toBe(false,);
    });

    test('returns false for positive numbers', () => {
      expect(isNegativeIntString('1',),).toBe(false,);
      expect(isNegativeIntString('42',),).toBe(false,);
      expect(isNegativeIntString('0',),).toBe(false,);
      expect(isNegativeIntString('123',),).toBe(false,);
    });

    test('returns false for negative decimal numbers', () => {
      expect(isNegativeIntString('-12.3',),).toBe(false,);
      expect(isNegativeIntString('-0.5',),).toBe(false,);
      expect(isNegativeIntString('-123.456',),).toBe(false,);
      expect(isNegativeIntString('-1.0',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isNegativeIntString('-',),).toBe(false,);
      expect(isNegativeIntString('--1',),).toBe(false,);
      expect(isNegativeIntString('-abc',),).toBe(false,);
      expect(isNegativeIntString('-12a',),).toBe(false,);
      expect(isNegativeIntString('',),).toBe(false,);
      expect(isNegativeIntString('- 5',),).toBe(false,);
    });

    test('returns false for non-string values', () => {
      expect(isNegativeIntString(-123,),).toBe(false,);
      expect(isNegativeIntString(null,),).toBe(false,);
      expect(isNegativeIntString(undefined,),).toBe(false,);
      expect(isNegativeIntString({},),).toBe(false,);
      expect(isNegativeIntString([],),).toBe(false,);
      expect(isNegativeIntString(false,),).toBe(false,);
    });
  });

  describe('isPositiveFloatString', () => {
    test('returns true for valid positive floats', () => {
      expect(isPositiveFloatString('0.5',),).toBe(true,);
      expect(isPositiveFloatString('1.5',),).toBe(true,);
      expect(isPositiveFloatString('12.34',),).toBe(true,);
      expect(isPositiveFloatString('123.456',),).toBe(true,);
      expect(isPositiveFloatString('0.123',),).toBe(true,);
      expect(isPositiveFloatString('999.999',),).toBe(true,);
      expect(isPositiveFloatString('1.23456789',),).toBe(true,);
    });

    test('returns false for effectively integer values', () => {
      expect(isPositiveFloatString('12.0',),).toBe(false,);
      expect(isPositiveFloatString('0.0',),).toBe(false,);
      expect(isPositiveFloatString('123.00',),).toBe(false,);
      expect(isPositiveFloatString('1.000',),).toBe(false,);
      expect(isPositiveFloatString('999.0000',),).toBe(false,);
    });

    test('returns false for integers without decimal point', () => {
      expect(isPositiveFloatString('12',),).toBe(false,);
      expect(isPositiveFloatString('0',),).toBe(false,);
      expect(isPositiveFloatString('123',),).toBe(false,);
      expect(isPositiveFloatString('1',),).toBe(false,);
    });

    test('returns false for negative floats', () => {
      expect(isPositiveFloatString('-12.34',),).toBe(false,);
      expect(isPositiveFloatString('-0.5',),).toBe(false,);
      expect(isPositiveFloatString('-123.456',),).toBe(false,);
    });

    test('returns false for strings too short', () => {
      expect(isPositiveFloatString('1.',),).toBe(false,);
      expect(isPositiveFloatString('.5',),).toBe(false,);
      expect(isPositiveFloatString('.',),).toBe(false,);
      expect(isPositiveFloatString('12',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isPositiveFloatString('12.34.56',),).toBe(false,);
      expect(isPositiveFloatString('abc.def',),).toBe(false,);
      expect(isPositiveFloatString('12.3a',),).toBe(false,);
      expect(isPositiveFloatString('12a.34',),).toBe(false,);
      expect(isPositiveFloatString('',),).toBe(false,);
      expect(isPositiveFloatString('12 .34',),).toBe(false,);
    });

    test('returns false for non-string values', () => {
      expect(isPositiveFloatString(12.34,),).toBe(false,);
      expect(isPositiveFloatString(null,),).toBe(false,);
      expect(isPositiveFloatString(undefined,),).toBe(false,);
      expect(isPositiveFloatString({},),).toBe(false,);
      expect(isPositiveFloatString([],),).toBe(false,);
      expect(isPositiveFloatString(true,),).toBe(false,);
    });
  });

  describe('isNegativeFloatString', () => {
    test('returns true for valid negative floats', () => {
      expect(isNegativeFloatString('-0.5',),).toBe(true,);
      expect(isNegativeFloatString('-1.5',),).toBe(true,);
      expect(isNegativeFloatString('-12.34',),).toBe(true,);
      expect(isNegativeFloatString('-123.456',),).toBe(true,);
      expect(isNegativeFloatString('-0.123',),).toBe(true,);
      expect(isNegativeFloatString('-999.999',),).toBe(true,);
      expect(isNegativeFloatString('-1.23456789',),).toBe(true,);
    });

    test('returns false for effectively integer values', () => {
      expect(isNegativeFloatString('-12.0',),).toBe(false,);
      expect(isNegativeFloatString('-0.0',),).toBe(false,);
      expect(isNegativeFloatString('-123.00',),).toBe(false,);
      expect(isNegativeFloatString('-1.000',),).toBe(false,);
      expect(isNegativeFloatString('-999.0000',),).toBe(false,);
    });

    test('returns false for positive floats', () => {
      expect(isNegativeFloatString('12.34',),).toBe(false,);
      expect(isNegativeFloatString('0.5',),).toBe(false,);
      expect(isNegativeFloatString('123.456',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isNegativeFloatString('-',),).toBe(false,);
      expect(isNegativeFloatString('--12.34',),).toBe(false,);
      expect(isNegativeFloatString('-12.34.56',),).toBe(false,);
      expect(isNegativeFloatString('-abc.def',),).toBe(false,);
      expect(isNegativeFloatString('-12.3a',),).toBe(false,);
      expect(isNegativeFloatString('',),).toBe(false,);
    });

    test('returns false for non-string values', () => {
      expect(isNegativeFloatString(-12.34,),).toBe(false,);
      expect(isNegativeFloatString(null,),).toBe(false,);
      expect(isNegativeFloatString(undefined,),).toBe(false,);
      expect(isNegativeFloatString({},),).toBe(false,);
      expect(isNegativeFloatString([],),).toBe(false,);
      expect(isNegativeFloatString(false,),).toBe(false,);
    });
  });

  describe('isIntString', () => {
    test('returns true for positive integers', () => {
      expect(isIntString('0',),).toBe(true,);
      expect(isIntString('1',),).toBe(true,);
      expect(isIntString('42',),).toBe(true,);
      expect(isIntString('123',),).toBe(true,);
      expect(isIntString('999',),).toBe(true,);
    });

    test('returns true for negative integers', () => {
      expect(isIntString('-1',),).toBe(true,);
      expect(isIntString('-42',),).toBe(true,);
      expect(isIntString('-123',),).toBe(true,);
      expect(isIntString('-0',),).toBe(true,);
      expect(isIntString('-999',),).toBe(true,);
    });

    test('returns false for decimal numbers', () => {
      expect(isIntString('12.3',),).toBe(false,);
      expect(isIntString('-56.78',),).toBe(false,);
      expect(isIntString('0.5',),).toBe(false,);
      expect(isIntString('12.0',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isIntString('abc',),).toBe(false,);
      expect(isIntString('007',),).toBe(false,);
      expect(isIntString('-007',),).toBe(false,);
      expect(isIntString('',),).toBe(false,);
      expect(isIntString('12a',),).toBe(false,);
    });
  });

  describe('isFloatString', () => {
    test('returns true for positive floats', () => {
      expect(isFloatString('12.34',),).toBe(true,);
      expect(isFloatString('0.5',),).toBe(true,);
      expect(isFloatString('123.456',),).toBe(true,);
      expect(isFloatString('999.999',),).toBe(true,);
    });

    test('returns true for negative floats', () => {
      expect(isFloatString('-12.34',),).toBe(true,);
      expect(isFloatString('-0.5',),).toBe(true,);
      expect(isFloatString('-123.456',),).toBe(true,);
      expect(isFloatString('-999.999',),).toBe(true,);
    });

    test('returns false for integers', () => {
      expect(isFloatString('12',),).toBe(false,);
      expect(isFloatString('-42',),).toBe(false,);
      expect(isFloatString('0',),).toBe(false,);
    });

    test('returns false for effectively integer values', () => {
      expect(isFloatString('12.0',),).toBe(false,);
      expect(isFloatString('-12.0',),).toBe(false,);
      expect(isFloatString('0.0',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isFloatString('abc',),).toBe(false,);
      expect(isFloatString('12.34.56',),).toBe(false,);
      expect(isFloatString('',),).toBe(false,);
      expect(isFloatString('12a.34',),).toBe(false,);
    });
  });

  describe('isPositiveNumberString', () => {
    test('returns true for positive integers', () => {
      expect(isPositiveNumberString('0',),).toBe(true,);
      expect(isPositiveNumberString('1',),).toBe(true,);
      expect(isPositiveNumberString('42',),).toBe(true,);
      expect(isPositiveNumberString('123',),).toBe(true,);
    });

    test('returns true for positive floats', () => {
      expect(isPositiveNumberString('12.34',),).toBe(true,);
      expect(isPositiveNumberString('0.5',),).toBe(true,);
      expect(isPositiveNumberString('123.456',),).toBe(true,);
    });

    test('returns false for negative numbers', () => {
      expect(isPositiveNumberString('-123',),).toBe(false,);
      expect(isPositiveNumberString('-12.34',),).toBe(false,);
      expect(isPositiveNumberString('-0',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isPositiveNumberString('abc',),).toBe(false,);
      expect(isPositiveNumberString('12.0',),).toBe(false,);
      expect(isPositiveNumberString('007',),).toBe(false,);
      expect(isPositiveNumberString('',),).toBe(false,);
    });
  });

  describe('isNegativeNumberString', () => {
    test('returns true for negative integers', () => {
      expect(isNegativeNumberString('-1',),).toBe(true,);
      expect(isNegativeNumberString('-42',),).toBe(true,);
      expect(isNegativeNumberString('-123',),).toBe(true,);
      expect(isNegativeNumberString('-0',),).toBe(true,);
    });

    test('returns true for negative floats', () => {
      expect(isNegativeNumberString('-12.34',),).toBe(true,);
      expect(isNegativeNumberString('-0.5',),).toBe(true,);
      expect(isNegativeNumberString('-123.456',),).toBe(true,);
    });

    test('returns false for positive numbers', () => {
      expect(isNegativeNumberString('123',),).toBe(false,);
      expect(isNegativeNumberString('12.34',),).toBe(false,);
      expect(isNegativeNumberString('0',),).toBe(false,);
    });

    test('returns false for invalid formats', () => {
      expect(isNegativeNumberString('abc',),).toBe(false,);
      expect(isNegativeNumberString('-12.0',),).toBe(false,);
      expect(isNegativeNumberString('-007',),).toBe(false,);
      expect(isNegativeNumberString('',),).toBe(false,);
    });
  });

  describe('isNumberString', () => {
    test('returns true for positive integers', () => {
      expect(isNumberString('0',),).toBe(true,);
      expect(isNumberString('1',),).toBe(true,);
      expect(isNumberString('42',),).toBe(true,);
      expect(isNumberString('123',),).toBe(true,);
    });

    test('returns true for negative integers', () => {
      expect(isNumberString('-1',),).toBe(true,);
      expect(isNumberString('-42',),).toBe(true,);
      expect(isNumberString('-123',),).toBe(true,);
      expect(isNumberString('-0',),).toBe(true,);
    });

    test('returns true for positive floats', () => {
      expect(isNumberString('12.34',),).toBe(true,);
      expect(isNumberString('0.5',),).toBe(true,);
      expect(isNumberString('123.456',),).toBe(true,);
    });

    test('returns true for negative floats', () => {
      expect(isNumberString('-12.34',),).toBe(true,);
      expect(isNumberString('-0.5',),).toBe(true,);
      expect(isNumberString('-123.456',),).toBe(true,);
    });

    test('returns false for non-numeric strings', () => {
      expect(isNumberString('abc',),).toBe(false,);
      expect(isNumberString('12a',),).toBe(false,);
      expect(isNumberString('a12',),).toBe(false,);
      expect(isNumberString('',),).toBe(false,);
      expect(isNumberString('12 34',),).toBe(false,);
    });

    test('returns false for invalid number formats', () => {
      expect(isNumberString('12.0',),).toBe(false,);
      expect(isNumberString('-12.0',),).toBe(false,);
      expect(isNumberString('007',),).toBe(false,);
      expect(isNumberString('-007',),).toBe(false,);
      expect(isNumberString('12.34.56',),).toBe(false,);
    });

    test('returns false for non-string values', () => {
      expect(isNumberString(123,),).toBe(false,);
      expect(isNumberString(-123,),).toBe(false,);
      expect(isNumberString(12.34,),).toBe(false,);
      expect(isNumberString(null,),).toBe(false,);
      expect(isNumberString(undefined,),).toBe(false,);
      expect(isNumberString({},),).toBe(false,);
      expect(isNumberString([],),).toBe(false,);
      expect(isNumberString(true,),).toBe(false,);
      expect(isNumberString(false,),).toBe(false,);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('handles very large numbers', () => {
      const largePositiveInt = '999999999999999999999999999999';
      const largeNegativeInt = '-999999999999999999999999999999';
      const largePositiveFloat = '999999999999999999999999999999.123456789';
      const largeNegativeFloat = '-999999999999999999999999999999.123456789';

      expect(isPositiveIntString(largePositiveInt,),).toBe(true,);
      expect(isNegativeIntString(largeNegativeInt,),).toBe(true,);
      expect(isPositiveFloatString(largePositiveFloat,),).toBe(true,);
      expect(isNegativeFloatString(largeNegativeFloat,),).toBe(true,);
    });

    test('handles numbers with many decimal places', () => {
      const manyDecimals = '123.123456789012345678901234567890';
      const negManyDecimals = '-123.123456789012345678901234567890';

      expect(isPositiveFloatString(manyDecimals,),).toBe(true,);
      expect(isNegativeFloatString(negManyDecimals,),).toBe(true,);
      expect(isFloatString(manyDecimals,),).toBe(true,);
      expect(isFloatString(negManyDecimals,),).toBe(true,);
    });

    test('handles edge cases with dots', () => {
      expect(isPositiveFloatString('.',),).toBe(false,);
      expect(isPositiveFloatString('.123',),).toBe(false,);
      expect(isPositiveFloatString('123.',),).toBe(false,);
      expect(isNegativeFloatString('-.',),).toBe(false,);
      expect(isNegativeFloatString('-.123',),).toBe(false,);
      expect(isNegativeFloatString('-123.',),).toBe(false,);
    });

    test('scientific notation is not supported', () => {
      expect(isNumberString('1e5',),).toBe(false,);
      expect(isNumberString('1.23e-4',),).toBe(false,);
      expect(isNumberString('-1e5',),).toBe(false,);
      expect(isNumberString('1E5',),).toBe(false,);
    });

    test('hexadecimal and other number bases are not supported', () => {
      expect(isNumberString('0x1A',),).toBe(false,);
      expect(isNumberString('0b101',),).toBe(false,);
      expect(isNumberString('0o777',),).toBe(false,);
    });
  });

  describe('comprehensive integration tests', () => {
    test('validates that all number functions work together correctly', () => {
      const testCases = [
        { value: '42', expectedResults: { pos: true, int: true, number: true, }, },
        { value: '-42', expectedResults: { neg: true, int: true, number: true, }, },
        { value: '12.34', expectedResults: { pos: true, float: true, number: true, }, },
        { value: '-12.34', expectedResults: { neg: true, float: true, number: true, }, },
        { value: '0', expectedResults: { pos: true, int: true, number: true, }, },
        { value: '-0', expectedResults: { neg: true, int: true, number: true, }, },
        { value: 'abc', expectedResults: {}, },
        { value: '12.0', expectedResults: {}, },
        { value: '007', expectedResults: {}, },
      ];

      for (const { value, expectedResults, } of testCases) {
        expect(isPositiveNumberString(value,),).toBe(expectedResults.pos === true,);
        expect(isNegativeNumberString(value,),).toBe(expectedResults.neg === true,);
        expect(isIntString(value,),).toBe(expectedResults.int === true,);
        expect(isFloatString(value,),).toBe(expectedResults.float === true,);
        expect(isNumberString(value,),).toBe(expectedResults.number === true,);
      }
    });
  });
});
