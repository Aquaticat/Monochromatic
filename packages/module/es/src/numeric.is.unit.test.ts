import {
  bigint0,
  isBigint,
  isFiniteNumber,
  isFloat,
  isInfinity,
  isInt,
  isIntBigint,
  isInteger,
  isNan,
  isNegativeFloat,
  isNegativeInfinity,
  isNegativeInt,
  isNonNanNumber,
  isNonNegativeInt,
  isNumber,
  isNumeric,
  isObjectDate,
  isPositiveFloat,
  isPositiveInfinity,
  isPositiveInt,
  isPositiveNumber,
  isSafeNumber,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('isNumber', () => {
  test('should return true for numbers', () => {
    expect(isNumber(42)).toBe(true);
    expect(isNumber(0)).toBe(true);
    expect(isNumber(-42)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(NaN)).toBe(true);
    expect(isNumber(Infinity)).toBe(true);
    expect(isNumber(-Infinity)).toBe(true);
  });

  test('should return false for non-numbers', () => {
    expect(isNumber('42')).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber({})).toBe(false);
    expect(isNumber([])).toBe(false);
    expect(isNumber(true)).toBe(false);
    expect(isNumber(BigInt(42))).toBe(false);
  });
});

describe('isNan', () => {
  test('should return true only for NaN', () => {
    expect(isNan(NaN)).toBe(true);
    expect(isNan(Number.NaN)).toBe(true);
    expect(isNan(0 / 0)).toBe(true);
    expect(isNan(Math.sqrt(-1))).toBe(true);
  });

  test('should return false for non-NaN values', () => {
    expect(isNan(42)).toBe(false);
    expect(isNan(0)).toBe(false);
    expect(isNan(Infinity)).toBe(false);
    expect(isNan(-Infinity)).toBe(false);
    expect(isNan('NaN')).toBe(false);
    expect(isNan('hello')).toBe(false);
    expect(isNan(null)).toBe(false);
    expect(isNan(undefined)).toBe(false);
  });
});

describe('isInteger', () => {
  test('should return true for integers', () => {
    expect(isInteger(42)).toBe(true);
    expect(isInteger(0)).toBe(true);
    expect(isInteger(-42)).toBe(true);
    expect(isInteger(42.0)).toBe(true);
  });

  test('should return false for non-integers', () => {
    expect(isInteger(3.14)).toBe(false);
    expect(isInteger(NaN)).toBe(false);
    expect(isInteger(Infinity)).toBe(false);
    expect(isInteger(-Infinity)).toBe(false);
    expect(isInteger('42')).toBe(false);
    expect(isInteger(null)).toBe(false);
  });
});

describe('isInt', () => {
  test('should return true for integers', () => {
    expect(isInt(42)).toBe(true);
    expect(isInt(0)).toBe(true);
    expect(isInt(-42)).toBe(true);
    expect(isInt(42.0)).toBe(true);
    expect(isInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isInt(Number.MIN_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for non-integers', () => {
    expect(isInt(3.14)).toBe(false);
    expect(isInt(0.5)).toBe(false);
    expect(isInt(NaN)).toBe(false);
    expect(isInt(Infinity)).toBe(false);
    expect(isInt(-Infinity)).toBe(false);
    expect(isInt('42')).toBe(false);
    expect(isInt(null)).toBe(false);
    expect(isInt(undefined)).toBe(false);
  });
});

describe('isPositiveInt', () => {
  test('should return true for positive integers', () => {
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(42)).toBe(true);
    expect(isPositiveInt(1000)).toBe(true);
    expect(isPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for zero, negative, and non-integers', () => {
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(-42)).toBe(false);
    expect(isPositiveInt(3.14)).toBe(false);
    expect(isPositiveInt(-3.14)).toBe(false);
    expect(isPositiveInt(NaN)).toBe(false);
    expect(isPositiveInt(Infinity)).toBe(false);
    expect(isPositiveInt('42')).toBe(false);
  });
});

describe('isNegativeInt', () => {
  test('should return true for negative integers', () => {
    expect(isNegativeInt(-1)).toBe(true);
    expect(isNegativeInt(-42)).toBe(true);
    expect(isNegativeInt(-1000)).toBe(true);
    expect(isNegativeInt(Number.MIN_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for zero, positive, and non-integers', () => {
    expect(isNegativeInt(0)).toBe(false);
    expect(isNegativeInt(1)).toBe(false);
    expect(isNegativeInt(42)).toBe(false);
    expect(isNegativeInt(-3.14)).toBe(false);
    expect(isNegativeInt(3.14)).toBe(false);
    expect(isNegativeInt(NaN)).toBe(false);
    expect(isNegativeInt(-Infinity)).toBe(false);
    expect(isNegativeInt('-42')).toBe(false);
  });
});

describe('isNonNegativeInt', () => {
  test('should return true for zero and positive integers', () => {
    expect(isNonNegativeInt(0)).toBe(true);
    expect(isNonNegativeInt(1)).toBe(true);
    expect(isNonNegativeInt(42)).toBe(true);
    expect(isNonNegativeInt(1000)).toBe(true);
    expect(isNonNegativeInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for negative numbers and non-integers', () => {
    expect(isNonNegativeInt(-1)).toBe(false);
    expect(isNonNegativeInt(-42)).toBe(false);
    expect(isNonNegativeInt(3.14)).toBe(false);
    expect(isNonNegativeInt(-3.14)).toBe(false);
    expect(isNonNegativeInt(NaN)).toBe(false);
    expect(isNonNegativeInt(Infinity)).toBe(false);
    expect(isNonNegativeInt('0')).toBe(false);
  });
});

describe('isFloat', () => {
  test('should return true for floating-point numbers', () => {
    expect(isFloat(3.14)).toBe(true);
    expect(isFloat(0.5)).toBe(true);
    expect(isFloat(-2.718)).toBe(true);
    expect(isFloat(0.1)).toBe(true);
    expect(isFloat(Number.EPSILON)).toBe(true);
  });

  test('should return false for integers, NaN, and infinity', () => {
    expect(isFloat(42)).toBe(false);
    expect(isFloat(0)).toBe(false);
    expect(isFloat(-42)).toBe(false);
    expect(isFloat(42.0)).toBe(false);
    expect(isFloat(NaN)).toBe(false);
    expect(isFloat(Infinity)).toBe(false);
    expect(isFloat(-Infinity)).toBe(false);
    expect(isFloat('3.14')).toBe(false);
  });
});

describe('isPositiveFloat', () => {
  test('should return true for positive floating-point numbers', () => {
    expect(isPositiveFloat(3.14)).toBe(true);
    expect(isPositiveFloat(0.1)).toBe(true);
    expect(isPositiveFloat(2.718)).toBe(true);
    expect(isPositiveFloat(Number.EPSILON)).toBe(true);
  });

  test('should return false for zero, negative, and non-floats', () => {
    expect(isPositiveFloat(0.0)).toBe(false);
    expect(isPositiveFloat(-3.14)).toBe(false);
    expect(isPositiveFloat(42)).toBe(false);
    expect(isPositiveFloat(-42)).toBe(false);
    expect(isPositiveFloat(NaN)).toBe(false);
    expect(isPositiveFloat(Infinity)).toBe(false);
    expect(isPositiveFloat('3.14')).toBe(false);
  });
});

describe('isNegativeFloat', () => {
  test('should return true for negative floating-point numbers', () => {
    expect(isNegativeFloat(-3.14)).toBe(true);
    expect(isNegativeFloat(-0.1)).toBe(true);
    expect(isNegativeFloat(-2.718)).toBe(true);
    expect(isNegativeFloat(-Number.EPSILON)).toBe(true);
  });

  test('should return false for zero, positive, and non-floats', () => {
    expect(isNegativeFloat(0.0)).toBe(false);
    expect(isNegativeFloat(3.14)).toBe(false);
    expect(isNegativeFloat(-42)).toBe(false);
    expect(isNegativeFloat(42)).toBe(false);
    expect(isNegativeFloat(NaN)).toBe(false);
    expect(isNegativeFloat(-Infinity)).toBe(false);
    expect(isNegativeFloat('-3.14')).toBe(false);
  });
});

describe('isNonNanNumber', () => {
  test('should return true for numbers that are not NaN', () => {
    expect(isNonNanNumber(42)).toBe(true);
    expect(isNonNanNumber(0)).toBe(true);
    expect(isNonNanNumber(-42)).toBe(true);
    expect(isNonNanNumber(3.14)).toBe(true);
    expect(isNonNanNumber(Infinity)).toBe(true);
    expect(isNonNanNumber(-Infinity)).toBe(true);
  });

  test('should return false for NaN and non-numbers', () => {
    expect(isNonNanNumber(NaN)).toBe(false);
    expect(isNonNanNumber(Number.NaN)).toBe(false);
    expect(isNonNanNumber(0 / 0)).toBe(false);
    expect(isNonNanNumber('42')).toBe(false);
    expect(isNonNanNumber(null)).toBe(false);
    expect(isNonNanNumber(undefined)).toBe(false);
  });
});

describe('isPositiveInfinity', () => {
  test('should return true for positive infinity', () => {
    expect(isPositiveInfinity(Infinity)).toBe(true);
    expect(isPositiveInfinity(Number.POSITIVE_INFINITY)).toBe(true);
    expect(isPositiveInfinity(1 / 0)).toBe(true);
  });

  test('should return false for other values', () => {
    expect(isPositiveInfinity(-Infinity)).toBe(false);
    expect(isPositiveInfinity(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isPositiveInfinity(42)).toBe(false);
    expect(isPositiveInfinity(Number.MAX_VALUE)).toBe(false);
    expect(isPositiveInfinity(NaN)).toBe(false);
    expect(isPositiveInfinity('Infinity')).toBe(false);
  });
});

describe('isNegativeInfinity', () => {
  test('should return true for negative infinity', () => {
    expect(isNegativeInfinity(-Infinity)).toBe(true);
    expect(isNegativeInfinity(Number.NEGATIVE_INFINITY)).toBe(true);
    expect(isNegativeInfinity(-1 / 0)).toBe(true);
  });

  test('should return false for other values', () => {
    expect(isNegativeInfinity(Infinity)).toBe(false);
    expect(isNegativeInfinity(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isNegativeInfinity(-42)).toBe(false);
    expect(isNegativeInfinity(-Number.MAX_VALUE)).toBe(false);
    expect(isNegativeInfinity(NaN)).toBe(false);
    expect(isNegativeInfinity('-Infinity')).toBe(false);
  });
});

describe('isInfinity', () => {
  test('should return true for any infinity', () => {
    expect(isInfinity(Infinity)).toBe(true);
    expect(isInfinity(-Infinity)).toBe(true);
    expect(isInfinity(Number.POSITIVE_INFINITY)).toBe(true);
    expect(isInfinity(Number.NEGATIVE_INFINITY)).toBe(true);
    expect(isInfinity(1 / 0)).toBe(true);
    expect(isInfinity(-1 / 0)).toBe(true);
  });

  test('should return false for finite numbers', () => {
    expect(isInfinity(42)).toBe(false);
    expect(isInfinity(-42)).toBe(false);
    expect(isInfinity(0)).toBe(false);
    expect(isInfinity(Number.MAX_VALUE)).toBe(false);
    expect(isInfinity(-Number.MAX_VALUE)).toBe(false);
    expect(isInfinity(NaN)).toBe(false);
    expect(isInfinity('Infinity')).toBe(false);
  });
});

describe('isFiniteNumber', () => {
  test('should return true for finite numbers', () => {
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(-42)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(3.14)).toBe(true);
    expect(isFiniteNumber(-3.14)).toBe(true);
    expect(isFiniteNumber(Number.MAX_VALUE)).toBe(true);
    expect(isFiniteNumber(-Number.MAX_VALUE)).toBe(true);
  });

  test('should return false for infinity, NaN, and non-numbers', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber('42')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe('isSafeNumber', () => {
  test('should return true for numbers within safe range', () => {
    expect(isSafeNumber(42)).toBe(true);
    expect(isSafeNumber(-42)).toBe(true);
    expect(isSafeNumber(0)).toBe(true);
    expect(isSafeNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeNumber(Number.MIN_SAFE_INTEGER)).toBe(true);
    expect(isSafeNumber(3.14)).toBe(true);
  });

  test('should return false for numbers outside safe range', () => {
    expect(isSafeNumber(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isSafeNumber(Number.MIN_SAFE_INTEGER - 1)).toBe(false);
    expect(isSafeNumber(Infinity)).toBe(false);
    expect(isSafeNumber(-Infinity)).toBe(false);
    expect(isSafeNumber(NaN)).toBe(false);
    expect(isSafeNumber('42')).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  test('should return true for positive numbers', () => {
    expect(isPositiveNumber(42)).toBe(true);
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(3.14)).toBe(true);
    expect(isPositiveNumber(0.1)).toBe(true);
    expect(isPositiveNumber(Infinity)).toBe(true);
  });

  test('should return false for zero, negative, and non-numbers', () => {
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(-42)).toBe(false);
    expect(isPositiveNumber(-3.14)).toBe(false);
    expect(isPositiveNumber(-Infinity)).toBe(false);
    expect(isPositiveNumber(NaN)).toBe(false);
    expect(isPositiveNumber('42')).toBe(false);
  });
});

describe('isObjectDate', () => {
  test('should return true for Date objects', () => {
    expect(isObjectDate(new Date())).toBe(true);
    expect(isObjectDate(new Date('2023-01-01'))).toBe(true);
    expect(isObjectDate(new Date(0))).toBe(true);
    expect(isObjectDate(new Date('invalid'))).toBe(true); // Invalid date is still a Date object
  });

  test('should return false for non-Date objects', () => {
    expect(isObjectDate('2023-01-01')).toBe(false);
    expect(isObjectDate(1234567890000)).toBe(false);
    expect(isObjectDate({})).toBe(false);
    expect(isObjectDate([])).toBe(false);
    expect(isObjectDate(null)).toBe(false);
    expect(isObjectDate(undefined)).toBe(false);
    expect(isObjectDate(Date.now())).toBe(false);
  });
});

describe('isBigint', () => {
  test('should return true for bigint values', () => {
    expect(isBigint(100n)).toBe(true);
    expect(isBigint(0n)).toBe(true);
    expect(isBigint(-100n)).toBe(true);
    expect(isBigint(BigInt(100))).toBe(true);
    expect(isBigint(BigInt('999999999999999999999'))).toBe(true);
  });

  test('should return false for non-bigint values', () => {
    expect(isBigint(100)).toBe(false);
    expect(isBigint('100n')).toBe(false);
    expect(isBigint('100')).toBe(false);
    expect(isBigint(null)).toBe(false);
    expect(isBigint(undefined)).toBe(false);
    expect(isBigint({})).toBe(false);
  });
});

describe('isNumeric', () => {
  test('should return true for numbers and bigints', () => {
    expect(isNumeric(42)).toBe(true);
    expect(isNumeric(3.14)).toBe(true);
    expect(isNumeric(0)).toBe(true);
    expect(isNumeric(-42)).toBe(true);
    expect(isNumeric(NaN)).toBe(true);
    expect(isNumeric(Infinity)).toBe(true);
    expect(isNumeric(100n)).toBe(true);
    expect(isNumeric(-100n)).toBe(true);
    expect(isNumeric(0n)).toBe(true);
  });

  test('should return false for non-numeric values', () => {
    expect(isNumeric('42')).toBe(false);
    expect(isNumeric('100n')).toBe(false);
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
    expect(isNumeric({})).toBe(false);
    expect(isNumeric([])).toBe(false);
    expect(isNumeric(true)).toBe(false);
  });
});

describe('isIntBigint', () => {
  test('should return true for bigints within safe integer range', () => {
    expect(isIntBigint(100n)).toBe(true);
    expect(isIntBigint(0n)).toBe(true);
    expect(isIntBigint(-100n)).toBe(true);
    expect(isIntBigint(BigInt(Number.MAX_SAFE_INTEGER))).toBe(true);
    expect(isIntBigint(BigInt(Number.MIN_SAFE_INTEGER))).toBe(true);
  });

  test('should return false for bigints outside safe range and non-bigints', () => {
    expect(isIntBigint(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(false);
    expect(isIntBigint(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toBe(false);
    expect(isIntBigint(100)).toBe(false);
    expect(isIntBigint('100n')).toBe(false);
    expect(isIntBigint(null)).toBe(false);
  });
});

describe('bigint0', () => {
  test('should be bigint zero', () => {
    expect(bigint0).toBe(0n);
    expect(typeof bigint0).toBe('bigint');
    expect(bigint0 === 0n).toBe(true);
  });

  test('should work in mathematical operations', () => {
    expect(bigint0 + 5n).toBe(5n);
    expect(bigint0 * 100n).toBe(0n);
    expect(bigint0 < 1n).toBe(true);
    expect(bigint0 > -1n).toBe(true);
  });
});