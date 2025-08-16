import {
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
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isPositiveIntString, () => {
  test('identifies positive integer strings including zero', () => {
    expect(isPositiveIntString('0')).toBe(true);
    expect(isPositiveIntString('1')).toBe(true);
    expect(isPositiveIntString('9')).toBe(true);
    expect(isPositiveIntString('10')).toBe(true);
    expect(isPositiveIntString('123')).toBe(true);
    expect(isPositiveIntString('999')).toBe(true);
    expect(isPositiveIntString('1000')).toBe(true);
    expect(isPositiveIntString('12345')).toBe(true);
  });

  test('rejects negative integers', () => {
    expect(isPositiveIntString('-1')).toBe(false);
    expect(isPositiveIntString('-0')).toBe(false);
    expect(isPositiveIntString('-123')).toBe(false);
  });

  test('rejects float strings', () => {
    expect(isPositiveIntString('1.0')).toBe(false);
    expect(isPositiveIntString('1.5')).toBe(false);
    expect(isPositiveIntString('0.1')).toBe(false);
  });

  test('rejects leading zeros', () => {
    expect(isPositiveIntString('01')).toBe(false);
    expect(isPositiveIntString('001')).toBe(false);
    expect(isPositiveIntString('0123')).toBe(false);
  });

  test('rejects non-numeric strings', () => {
    expect(isPositiveIntString('')).toBe(false);
    expect(isPositiveIntString('abc')).toBe(false);
    expect(isPositiveIntString('1a')).toBe(false);
    expect(isPositiveIntString('a1')).toBe(false);
    expect(isPositiveIntString(' 1')).toBe(false);
    expect(isPositiveIntString('1 ')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isPositiveIntString(123)).toBe(false);
    expect(isPositiveIntString(0)).toBe(false);
    expect(isPositiveIntString(true)).toBe(false);
    expect(isPositiveIntString(null)).toBe(false);
    expect(isPositiveIntString(undefined)).toBe(false);
  });
});

describe(isNegativeIntString, () => {
  test('identifies negative integer strings including negative zero', () => {
    expect(isNegativeIntString('-0')).toBe(true);
    expect(isNegativeIntString('-1')).toBe(true);
    expect(isNegativeIntString('-9')).toBe(true);
    expect(isNegativeIntString('-10')).toBe(true);
    expect(isNegativeIntString('-123')).toBe(true);
    expect(isNegativeIntString('-999')).toBe(true);
    expect(isNegativeIntString('-1000')).toBe(true);
    expect(isNegativeIntString('-12345')).toBe(true);
  });

  test('rejects positive integers', () => {
    expect(isNegativeIntString('0')).toBe(false);
    expect(isNegativeIntString('1')).toBe(false);
    expect(isNegativeIntString('123')).toBe(false);
  });

  test('rejects float strings', () => {
    expect(isNegativeIntString('-1.0')).toBe(false);
    expect(isNegativeIntString('-1.5')).toBe(false);
    expect(isNegativeIntString('-0.1')).toBe(false);
  });

  test('rejects leading zeros after minus', () => {
    expect(isNegativeIntString('-01')).toBe(false);
    expect(isNegativeIntString('-001')).toBe(false);
    expect(isNegativeIntString('-0123')).toBe(false);
  });

  test('rejects non-numeric strings', () => {
    expect(isNegativeIntString('')).toBe(false);
    expect(isNegativeIntString('-')).toBe(false);
    expect(isNegativeIntString('-abc')).toBe(false);
    expect(isNegativeIntString('-1a')).toBe(false);
    expect(isNegativeIntString('-a1')).toBe(false);
    expect(isNegativeIntString(' -1')).toBe(false);
    expect(isNegativeIntString('-1 ')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isNegativeIntString(-123)).toBe(false);
    expect(isNegativeIntString(-1)).toBe(false);
    expect(isNegativeIntString(false)).toBe(false);
    expect(isNegativeIntString(null)).toBe(false);
    expect(isNegativeIntString(undefined)).toBe(false);
  });
});

describe(isIntString, () => {
  test('identifies both positive and negative integer strings', () => {
    expect(isIntString('0')).toBe(true);
    expect(isIntString('-0')).toBe(true);
    expect(isIntString('1')).toBe(true);
    expect(isIntString('-1')).toBe(true);
    expect(isIntString('123')).toBe(true);
    expect(isIntString('-123')).toBe(true);
    expect(isIntString('1000')).toBe(true);
    expect(isIntString('-1000')).toBe(true);
  });

  test('rejects float strings', () => {
    expect(isIntString('1.0')).toBe(false);
    expect(isIntString('-1.0')).toBe(false);
    expect(isIntString('1.5')).toBe(false);
    expect(isIntString('-1.5')).toBe(false);
  });
});

describe(isPositiveFloatString, () => {
  test('identifies positive float strings', () => {
    expect(isPositiveFloatString('0.1')).toBe(true);
    expect(isPositiveFloatString('0.01')).toBe(true);
    expect(isPositiveFloatString('0.123')).toBe(true);
    expect(isPositiveFloatString('1.0')).toBe(true);
    expect(isPositiveFloatString('1.5')).toBe(true);
    expect(isPositiveFloatString('123.456')).toBe(true);
    expect(isPositiveFloatString('999.999')).toBe(true);
  });

  test('rejects integer strings', () => {
    expect(isPositiveFloatString('0')).toBe(false);
    expect(isPositiveFloatString('1')).toBe(false);
    expect(isPositiveFloatString('123')).toBe(false);
  });

  test('rejects negative float strings', () => {
    expect(isPositiveFloatString('-0.1')).toBe(false);
    expect(isPositiveFloatString('-1.0')).toBe(false);
    expect(isPositiveFloatString('-1.5')).toBe(false);
  });

  test('rejects invalid decimal formats', () => {
    expect(isPositiveFloatString('.')).toBe(false);
    expect(isPositiveFloatString('1.')).toBe(false);
    expect(isPositiveFloatString('.5')).toBe(false);
    expect(isPositiveFloatString('1..')).toBe(false);
    expect(isPositiveFloatString('1.2.3')).toBe(false);
  });

  test('rejects non-numeric strings', () => {
    expect(isPositiveFloatString('')).toBe(false);
    expect(isPositiveFloatString('abc')).toBe(false);
    expect(isPositiveFloatString('1.a')).toBe(false);
    expect(isPositiveFloatString('a.1')).toBe(false);
  });
});

describe(isNegativeFloatString, () => {
  test('identifies negative float strings', () => {
    expect(isNegativeFloatString('-0.1')).toBe(true);
    expect(isNegativeFloatString('-0.01')).toBe(true);
    expect(isNegativeFloatString('-0.123')).toBe(true);
    expect(isNegativeFloatString('-1.0')).toBe(true);
    expect(isNegativeFloatString('-1.5')).toBe(true);
    expect(isNegativeFloatString('-123.456')).toBe(true);
    expect(isNegativeFloatString('-999.999')).toBe(true);
  });

  test('rejects integer strings', () => {
    expect(isNegativeFloatString('-0')).toBe(false);
    expect(isNegativeFloatString('-1')).toBe(false);
    expect(isNegativeFloatString('-123')).toBe(false);
  });

  test('rejects positive float strings', () => {
    expect(isNegativeFloatString('0.1')).toBe(false);
    expect(isNegativeFloatString('1.0')).toBe(false);
    expect(isNegativeFloatString('1.5')).toBe(false);
  });

  test('rejects invalid decimal formats', () => {
    expect(isNegativeFloatString('-.')).toBe(false);
    expect(isNegativeFloatString('-1.')).toBe(false);
    expect(isNegativeFloatString('-.5')).toBe(false);
    expect(isNegativeFloatString('-1..')).toBe(false);
    expect(isNegativeFloatString('-1.2.3')).toBe(false);
  });
});

describe(isFloatString, () => {
  test('identifies both positive and negative float strings', () => {
    expect(isFloatString('0.1')).toBe(true);
    expect(isFloatString('-0.1')).toBe(true);
    expect(isFloatString('1.5')).toBe(true);
    expect(isFloatString('-1.5')).toBe(true);
    expect(isFloatString('123.456')).toBe(true);
    expect(isFloatString('-123.456')).toBe(true);
  });

  test('rejects integer strings', () => {
    expect(isFloatString('0')).toBe(false);
    expect(isFloatString('-0')).toBe(false);
    expect(isFloatString('123')).toBe(false);
    expect(isFloatString('-123')).toBe(false);
  });
});

describe(isNumberString, () => {
  test('identifies all valid number formats', () => {
    // Positive integers
    expect(isNumberString('0')).toBe(true);
    expect(isNumberString('1')).toBe(true);
    expect(isNumberString('123')).toBe(true);
    
    // Negative integers
    expect(isNumberString('-0')).toBe(true);
    expect(isNumberString('-1')).toBe(true);
    expect(isNumberString('-123')).toBe(true);
    
    // Positive floats
    expect(isNumberString('0.1')).toBe(true);
    expect(isNumberString('1.5')).toBe(true);
    expect(isNumberString('123.456')).toBe(true);
    
    // Negative floats
    expect(isNumberString('-0.1')).toBe(true);
    expect(isNumberString('-1.5')).toBe(true);
    expect(isNumberString('-123.456')).toBe(true);
  });

  test('rejects invalid number formats', () => {
    expect(isNumberString('')).toBe(false);
    expect(isNumberString('abc')).toBe(false);
    expect(isNumberString('1.2.3')).toBe(false);
    expect(isNumberString('1.')).toBe(false);
    expect(isNumberString('.5')).toBe(false);
  });
});

describe(isPositiveNumberString, () => {
  test('identifies positive integers and floats', () => {
    expect(isPositiveNumberString('0')).toBe(true);
    expect(isPositiveNumberString('1')).toBe(true);
    expect(isPositiveNumberString('123')).toBe(true);
    expect(isPositiveNumberString('0.1')).toBe(true);
    expect(isPositiveNumberString('1.5')).toBe(true);
    expect(isPositiveNumberString('123.456')).toBe(true);
  });

  test('rejects negative numbers', () => {
    expect(isPositiveNumberString('-0')).toBe(false);
    expect(isPositiveNumberString('-1')).toBe(false);
    expect(isPositiveNumberString('-0.1')).toBe(false);
    expect(isPositiveNumberString('-1.5')).toBe(false);
  });
});

describe(isNegativeNumberString, () => {
  test('identifies negative integers and floats', () => {
    expect(isNegativeNumberString('-0')).toBe(true);
    expect(isNegativeNumberString('-1')).toBe(true);
    expect(isNegativeNumberString('-123')).toBe(true);
    expect(isNegativeNumberString('-0.1')).toBe(true);
    expect(isNegativeNumberString('-1.5')).toBe(true);
    expect(isNegativeNumberString('-123.456')).toBe(true);
  });

  test('rejects positive numbers', () => {
    expect(isNegativeNumberString('0')).toBe(false);
    expect(isNegativeNumberString('1')).toBe(false);
    expect(isNegativeNumberString('0.1')).toBe(false);
    expect(isNegativeNumberString('1.5')).toBe(false);
  });
});