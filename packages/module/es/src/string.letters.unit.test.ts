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

await logtapeConfigure(await logtapeConfiguration());

describe('LowercaseLetters type', () => {
  test('should accept individual lowercase letters', () => {
    expectTypeOf<'a'>().toEqualTypeOf<LowercaseLetters>();
    expectTypeOf<'z'>().toEqualTypeOf<LowercaseLetters>();
    expectTypeOf<'m'>().toEqualTypeOf<LowercaseLetters>();
  });

  test('should reject non-lowercase letters', () => {
    expectTypeOf<'A'>().not.toEqualTypeOf<LowercaseLetters>();
    expectTypeOf<'1'>().not.toEqualTypeOf<LowercaseLetters>();
    expectTypeOf<'@'>().not.toEqualTypeOf<LowercaseLetters>();
  });

  test('should work with string literals', () => {
    expectTypeOf<'a'>().toMatchTypeOf<LowercaseLetters>();
    expectTypeOf<'b'>().toMatchTypeOf<LowercaseLetters>();
    expectTypeOf<'c'>().toMatchTypeOf<LowercaseLetters>();
  });
});

describe('UppercaseLetters type', () => {
  test('should accept individual uppercase letters', () => {
    expectTypeOf<'A'>().toEqualTypeOf<UppercaseLetters>();
    expectTypeOf<'Z'>().toEqualTypeOf<UppercaseLetters>();
    expectTypeOf<'M'>().toEqualTypeOf<UppercaseLetters>();
  });

  test('should reject non-uppercase letters', () => {
    expectTypeOf<'a'>().not.toEqualTypeOf<UppercaseLetters>();
    expectTypeOf<'1'>().not.toEqualTypeOf<UppercaseLetters>();
    expectTypeOf<'@'>().not.toEqualTypeOf<UppercaseLetters>();
  });

  test('should work with string literals', () => {
    expectTypeOf<'A'>().toMatchTypeOf<UppercaseLetters>();
    expectTypeOf<'B'>().toMatchTypeOf<UppercaseLetters>();
    expectTypeOf<'C'>().toMatchTypeOf<UppercaseLetters>();
  });
});

describe('LowercaseLettersTuple type', () => {
  test('should be a tuple of exactly 26 lowercase letters', () => {
    expectTypeOf<LowercaseLettersTuple>().toEqualTypeOf<[
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
      'n', 'o', 'p', 'q', 'r', 's', 't', 'w', 'v', 'u', 'x', 'y', 'z'
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
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'W', 'V', 'U', 'X', 'Y', 'Z'
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

describe('lowercaseLetters runtime array', () => {
  test('should contain exactly 26 letters', () => {
    expect(lowercaseLetters).toHaveLength(26);
  });

  test('should start with "a" and end with "z"', () => {
    expect(lowercaseLetters[0]).toBe('a');
    expect(lowercaseLetters[25]).toBe('z');
  });

  test('should contain all lowercase letters in correct order', () => {
    const expected = 'abcdefghijklmnopqrstuvwxyz'.split('');
    expect(lowercaseLetters).toEqual(expected);
  });

  test('should be immutable by type', () => {
    expectTypeOf(lowercaseLetters).toEqualTypeOf<LowercaseLettersTuple>();
  });

  test('should contain only lowercase letters', () => {
    for (const letter of lowercaseLetters) {
      expect(letter).toMatch(/^[a-z]$/);
      expect(letter).toBe(letter.toLowerCase());
    }
  });

  test('should support iteration', () => {
    let count = 0;
    for (const letter of lowercaseLetters) {
      expect(typeof letter).toBe('string');
      expect(letter).toHaveLength(1);
      count++;
    }
    expect(count).toBe(26);
  });
});

describe('uppercaseLetters runtime array', () => {
  test('should contain exactly 26 letters', () => {
    expect(uppercaseLetters).toHaveLength(26);
  });

  test('should start with "A" and end with "Z"', () => {
    expect(uppercaseLetters[0]).toBe('A');
    expect(uppercaseLetters[25]).toBe('Z');
  });

  test('should contain all uppercase letters in correct order', () => {
    const expected = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    expect(uppercaseLetters).toEqual(expected);
  });

  test('should be immutable by type', () => {
    expectTypeOf(uppercaseLetters).toEqualTypeOf<UppercaseLettersTuple>();
  });

  test('should contain only uppercase letters', () => {
    for (const letter of uppercaseLetters) {
      expect(letter).toMatch(/^[A-Z]$/);
      expect(letter).toBe(letter.toUpperCase());
    }
  });

  test('should support iteration', () => {
    let count = 0;
    for (const letter of uppercaseLetters) {
      expect(typeof letter).toBe('string');
      expect(letter).toHaveLength(1);
      count++;
    }
    expect(count).toBe(26);
  });
});

describe('letter arrays correspondence', () => {
  test('should have matching lengths', () => {
    expect(lowercaseLetters).toHaveLength(uppercaseLetters.length);
  });

  test('should have corresponding case relationships', () => {
    for (let index = 0; index < lowercaseLetters.length; index++) {
      const lowercase = lowercaseLetters[index];
      const uppercase = uppercaseLetters[index];
      
      expect(lowercase.toUpperCase()).toBe(uppercase);
      expect(uppercase.toLowerCase()).toBe(lowercase);
    }
  });

  test('should maintain alphabetical order', () => {
    // Test that each letter comes after the previous one in alphabetical order
    for (let index = 1; index < lowercaseLetters.length; index++) {
      expect(lowercaseLetters[index] > lowercaseLetters[index - 1]).toBe(true);
      expect(uppercaseLetters[index] > uppercaseLetters[index - 1]).toBe(true);
    }
  });

  test('should contain unique elements', () => {
    expect(new Set(lowercaseLetters)).toHaveProperty('size', 26);
    expect(new Set(uppercaseLetters)).toHaveProperty('size', 26);
  });
});