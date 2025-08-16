import {
  logtapeConfiguration,
  logtapeConfigure,
  lowercaseLetters,
  uppercaseLetters,
} from '@monochromatic-dev/module-es';
import type {
  LowercaseLetters,
  LowercaseLettersTuple,
  UppercaseLetters,
  UppercaseLettersTuple,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('LowercaseLetters type', () => {
  test('should accept individual lowercase letters', () => {
    expectTypeOf<'a'>().toExtend<LowercaseLetters>();
    expectTypeOf<'z'>().toExtend<LowercaseLetters>();
    expectTypeOf<'m'>().toExtend<LowercaseLetters>();
  });

  test('should reject non-lowercase letters', () => {
    expectTypeOf<'A'>().not.toExtend<LowercaseLetters>();
    expectTypeOf<'1'>().not.toExtend<LowercaseLetters>();
    expectTypeOf<'@'>().not.toExtend<LowercaseLetters>();
  });

  test('should work with string literals', () => {
    expectTypeOf<'a'>().toExtend<LowercaseLetters>();
    expectTypeOf<'b'>().toExtend<LowercaseLetters>();
    expectTypeOf<'c'>().toExtend<LowercaseLetters>();
  });
});

describe('UppercaseLetters type', () => {
  test('should accept individual uppercase letters', () => {
    expectTypeOf<'A'>().toExtend<UppercaseLetters>();
    expectTypeOf<'Z'>().toExtend<UppercaseLetters>();
    expectTypeOf<'M'>().toExtend<UppercaseLetters>();
  });

  test('should reject non-uppercase letters', () => {
    expectTypeOf<'a'>().not.toExtend<UppercaseLetters>();
    expectTypeOf<'1'>().not.toExtend<UppercaseLetters>();
    expectTypeOf<'@'>().not.toExtend<UppercaseLetters>();
  });

  test('should work with string literals', () => {
    expectTypeOf<'A'>().toExtend<UppercaseLetters>();
    expectTypeOf<'B'>().toExtend<UppercaseLetters>();
    expectTypeOf<'C'>().toExtend<UppercaseLetters>();
  });
});

describe('LowercaseLettersTuple type', () => {
  test('should be a tuple of exactly 26 lowercase letters', () => {
    expectTypeOf<LowercaseLettersTuple>().toEqualTypeOf<[
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
    ]>();
  });

  test('should have correct length type', () => {
    expectTypeOf<LowercaseLettersTuple['length']>().toEqualTypeOf<26>();
  });

  test('should support indexed access', () => {
    expectTypeOf<LowercaseLettersTuple[0]>().toEqualTypeOf<'a'>();
    expectTypeOf<LowercaseLettersTuple[25]>().toEqualTypeOf<'z'>();
  });
});

describe('UppercaseLettersTuple type', () => {
  test('should be a tuple of exactly 26 uppercase letters', () => {
    expectTypeOf<UppercaseLettersTuple>().toEqualTypeOf<[
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
      'N',
      'O',
      'P',
      'Q',
      'R',
      'S',
      'T',
      'U',
      'V',
      'W',
      'X',
      'Y',
      'Z',
    ]>();
  });

  test('should have correct length type', () => {
    expectTypeOf<UppercaseLettersTuple['length']>().toEqualTypeOf<26>();
  });

  test('should support indexed access', () => {
    expectTypeOf<UppercaseLettersTuple[0]>().toEqualTypeOf<'A'>();
    expectTypeOf<UppercaseLettersTuple[25]>().toEqualTypeOf<'Z'>();
  });
});
