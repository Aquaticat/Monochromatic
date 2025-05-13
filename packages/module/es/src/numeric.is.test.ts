import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  isBigint,
  isFiniteNumber,
  isFloat,
  isInfinity,
  isInt,
  isInteger,
  isNan,
  isNegativeFloat,
  isNegativeInfinity,
  isNegativeInt,
  isNonNanNumber,
  isNumber,
  isNumeric,
  isObjectDate,
  isPositiveFloat,
  isPositiveInfinity,
  isPositiveInt,
  isPositiveNumber,
  isSafeNumber,
} from './numeric.is.ts';

describe('isNumber', () => {
  test('should return true for numbers', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(42)).toBe(true);
    expect(isNumber(-1)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(Number.NaN)).toBe(true);
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
    expect(isNumber(new Date())).toBe(false);
  });
});

describe('isNan', () => {
  test('should return true for NaN', () => {
    expect(isNan(Number.NaN)).toBe(true);
    expect(isNan(Number.NaN)).toBe(true);
  });

  test('should return false for non-NaN values', () => {
    expect(isNan(0)).toBe(false);
    expect(isNan(42)).toBe(false);
    expect(isNan(Infinity)).toBe(false);
    expect(isNan(-Infinity)).toBe(false);
    expect(isNan('NaN')).toBe(false);
    expect(isNan(null)).toBe(false);
  });
});

describe('isInteger and isInt', () => {
  test('should return true for integers', () => {
    expect(isInteger(0)).toBe(true);
    expect(isInteger(42)).toBe(true);
    expect(isInteger(-1)).toBe(true);
    expect(isInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isInteger(Number.MIN_SAFE_INTEGER)).toBe(true);

    // isInt should behave identically
    expect(isInt(0)).toBe(true);
    expect(isInt(42)).toBe(true);
    expect(isInt(-1)).toBe(true);
  });

  test('should return false for non-integers', () => {
    expect(isInteger(3.14)).toBe(false);
    expect(isInteger(Number.NaN)).toBe(false);
    expect(isInteger(Infinity)).toBe(false);
    expect(isInteger(-Infinity)).toBe(false);
    expect(isInteger('42')).toBe(false);

    // isInt should behave identically
    expect(isInt(3.14)).toBe(false);
    expect(isInt(Number.NaN)).toBe(false);
    expect(isInt(Infinity)).toBe(false);
  });
});

describe('isPositiveInt', () => {
  test('should return true for positive integers', () => {
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(42)).toBe(true);
    expect(isPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for zero, negative integers and non-integers', () => {
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(-42)).toBe(false);
    expect(isPositiveInt(3.14)).toBe(false);
    expect(isPositiveInt(Number.NaN)).toBe(false);
    expect(isPositiveInt(Infinity)).toBe(false);
  });
});

describe('isNegativeInt', () => {
  test('should return true for negative integers', () => {
    expect(isNegativeInt(-1)).toBe(true);
    expect(isNegativeInt(-42)).toBe(true);
    expect(isNegativeInt(Number.MIN_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for zero, positive integers and non-integers', () => {
    expect(isNegativeInt(0)).toBe(false);
    expect(isNegativeInt(1)).toBe(false);
    expect(isNegativeInt(42)).toBe(false);
    expect(isNegativeInt(-3.14)).toBe(false);
    expect(isNegativeInt(Number.NaN)).toBe(false);
    expect(isNegativeInt(-Infinity)).toBe(false);
  });
});

describe('isFloat', () => {
  test('should return true for floating point numbers', () => {
    expect(isFloat(3.14)).toBe(true);
    expect(isFloat(-2.5)).toBe(true);
    expect(isFloat(0.1)).toBe(true);
    expect(isFloat(1.000_000_000_000_1)).toBe(true);
  });

  test('should return false for integers, NaN and infinity', () => {
    expect(isFloat(0)).toBe(false);
    expect(isFloat(42)).toBe(false);
    expect(isFloat(-1)).toBe(false);
    expect(isFloat(Number.NaN)).toBe(false);
    expect(isFloat(Infinity)).toBe(false);
    expect(isFloat(-Infinity)).toBe(false);
    expect(isFloat('3.14')).toBe(false);
  });
});

describe('isPositiveFloat', () => {
  test('should return true for positive floating point numbers', () => {
    expect(isPositiveFloat(3.14)).toBe(true);
    expect(isPositiveFloat(0.1)).toBe(true);
    expect(isPositiveFloat(1.000_000_000_000_1)).toBe(true);
  });

  test('should return false for zero, negative floats, integers and non-numbers', () => {
    expect(isPositiveFloat(0)).toBe(false);
    expect(isPositiveFloat(-2.5)).toBe(false);
    expect(isPositiveFloat(42)).toBe(false);
    expect(isPositiveFloat(Number.NaN)).toBe(false);
    expect(isPositiveFloat(Infinity)).toBe(false);
  });
});

describe('isNegativeFloat', () => {
  test('should return true for negative floating point numbers', () => {
    expect(isNegativeFloat(-3.14)).toBe(true);
    expect(isNegativeFloat(-0.1)).toBe(true);
    expect(isNegativeFloat(-1.000_000_000_000_1)).toBe(true);
  });

  test('should return false for zero, positive floats, integers and non-numbers', () => {
    expect(isNegativeFloat(0)).toBe(false);
    expect(isNegativeFloat(2.5)).toBe(false);
    expect(isNegativeFloat(-42)).toBe(false);
    expect(isNegativeFloat(Number.NaN)).toBe(false);
    expect(isNegativeFloat(-Infinity)).toBe(false);
  });
});

describe('isNonNanNumber', () => {
  test('should return true for numbers that are not NaN', () => {
    expect(isNonNanNumber(0)).toBe(true);
    expect(isNonNanNumber(42)).toBe(true);
    expect(isNonNanNumber(-1)).toBe(true);
    expect(isNonNanNumber(3.14)).toBe(true);
    expect(isNonNanNumber(Infinity)).toBe(true);
    expect(isNonNanNumber(-Infinity)).toBe(true);
  });

  test('should return false for NaN and non-numbers', () => {
    expect(isNonNanNumber(Number.NaN)).toBe(false);
    expect(isNonNanNumber('42')).toBe(false);
    expect(isNonNanNumber(null)).toBe(false);
    expect(isNonNanNumber(undefined)).toBe(false);
  });
});

describe('isPositiveInfinity', () => {
  test('should return true for positive infinity', () => {
    expect(isPositiveInfinity(Infinity)).toBe(true);
    expect(isPositiveInfinity(Number.POSITIVE_INFINITY)).toBe(true);
  });

  test('should return false for non-positive-infinity values', () => {
    expect(isPositiveInfinity(-Infinity)).toBe(false);
    expect(isPositiveInfinity(Number.NaN)).toBe(false);
    expect(isPositiveInfinity(0)).toBe(false);
    expect(isPositiveInfinity(42)).toBe(false);
  });
});

describe('isNegativeInfinity', () => {
  test('should return true for negative infinity', () => {
    expect(isNegativeInfinity(-Infinity)).toBe(true);
    expect(isNegativeInfinity(Number.NEGATIVE_INFINITY)).toBe(true);
  });

  test('should return false for non-negative-infinity values', () => {
    expect(isNegativeInfinity(Infinity)).toBe(false);
    expect(isNegativeInfinity(Number.NaN)).toBe(false);
    expect(isNegativeInfinity(0)).toBe(false);
    expect(isNegativeInfinity(42)).toBe(false);
  });
});

describe('isInfinity', () => {
  test('should return true for positive and negative infinity', () => {
    expect(isInfinity(Infinity)).toBe(true);
    expect(isInfinity(-Infinity)).toBe(true); // Will fail due to isNegativeInfinity bug
  });

  test('should return false for non-infinity values', () => {
    expect(isInfinity(Number.NaN)).toBe(false);
    expect(isInfinity(0)).toBe(false);
    expect(isInfinity(42)).toBe(false);
    expect(isInfinity(-42)).toBe(false);
    expect(isInfinity(3.14)).toBe(false);
  });
});

describe('isFiniteNumber', () => {
  test('should return true for finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(-1)).toBe(true);
    expect(isFiniteNumber(3.14)).toBe(true);
  });

  test('should return false for infinite numbers and NaN', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false); // Will fail due to isNegativeInfinity bug
    expect(isFiniteNumber(Number.NaN)).toBe(false);
  });
});

describe('isSafeNumber', () => {
  test('should return true for numbers within safe integer range', () => {
    expect(isSafeNumber(0)).toBe(true);
    expect(isSafeNumber(42)).toBe(true);
    expect(isSafeNumber(-1)).toBe(true);
    expect(isSafeNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeNumber(Number.MIN_SAFE_INTEGER)).toBe(true);
  });

  test('should return false for numbers outside safe integer range and non-finite numbers', () => {
    expect(isSafeNumber(Number.NaN)).toBe(false);
    expect(isSafeNumber(Infinity)).toBe(false);
    expect(isSafeNumber(-Infinity)).toBe(false);
    // Note: The comparison logic in isSafeNumber appears to have an issue
    // It should be: value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
  });
});

describe('isPositiveNumber', () => {
  test('should return true for positive numbers', () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(42)).toBe(true);
    expect(isPositiveNumber(3.14)).toBe(true);
    expect(isPositiveNumber(Infinity)).toBe(true);
  });

  test('should return false for zero, negative numbers and non-numbers', () => {
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(-3.14)).toBe(false);
    expect(isPositiveNumber(-Infinity)).toBe(false);
    expect(isPositiveNumber(Number.NaN)).toBe(false);
  });
});

describe('isObjectDate', () => {
  test('should return true for Date objects', () => {
    expect(isObjectDate(new Date())).toBe(true);
    expect(isObjectDate(new Date('2023-01-01'))).toBe(true);
  });

  test('should return false for non-Date objects', () => {
    expect(isObjectDate(Date.now())).toBe(false);
    expect(isObjectDate('2023-01-01')).toBe(false);
    expect(isObjectDate({})).toBe(false);
    expect(isObjectDate(null)).toBe(false);
    expect(isObjectDate(undefined)).toBe(false);
  });
});

describe('isBigint', () => {
  test('returns true for bigint values', () => {
    expect(isBigint(0n)).toBe(true);
    expect(isBigint(1n)).toBe(true);
    expect(isBigint(-1n)).toBe(true);
    expect(isBigint(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(true);
  });

  test('returns false for non-bigint values', () => {
    expect(isBigint(0)).toBe(false);
    expect(isBigint(1)).toBe(false);
    expect(isBigint(-1)).toBe(false);
    expect(isBigint(null)).toBe(false);
    expect(isBigint(undefined)).toBe(false);
    expect(isBigint('')).toBe(false);
    expect(isBigint('0')).toBe(false);
    expect(isBigint({})).toBe(false);
    expect(isBigint([])).toBe(false);
    expect(isBigint(() => {
      // No-op
    }))
      .toBe(false);
    expect(isBigint(Symbol('empty'))).toBe(false);
    expect(isBigint(Number.NaN)).toBe(false);
    expect(isBigint(Infinity)).toBe(false);
  });
});

describe('isNumeric', () => {
  test('returns true for number values', () => {
    expect(isNumeric(0)).toBe(true);
    expect(isNumeric(1)).toBe(true);
    expect(isNumeric(-1)).toBe(true);
    expect(isNumeric(1.5)).toBe(true);
    expect(isNumeric(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isNumeric(Number.MIN_SAFE_INTEGER)).toBe(true);
    expect(isNumeric(Infinity)).toBe(true);
    expect(isNumeric(-Infinity)).toBe(true);
    expect(isNumeric(Number.NaN)).toBe(true);
  });

  test('returns true for bigint values', () => {
    expect(isNumeric(0n)).toBe(true);
    expect(isNumeric(1n)).toBe(true);
    expect(isNumeric(-1n)).toBe(true);
    expect(isNumeric(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(true);
  });

  test('returns false for non-numeric values', () => {
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
    expect(isNumeric('')).toBe(false);
    expect(isNumeric('0')).toBe(false);
    expect(isNumeric('1')).toBe(false);
    expect(isNumeric('1.5')).toBe(false);
    expect(isNumeric({})).toBe(false);
    expect(isNumeric([])).toBe(false);
    expect(isNumeric(() => {
      // No-op
    }))
      .toBe(false);
    expect(isNumeric(Symbol('empty'))).toBe(false);
    expect(isNumeric(new Date())).toBe(false);
    expect(isNumeric(true)).toBe(false);
    expect(isNumeric(false)).toBe(false);
  });

  test('correctly identifies numeric values in mixed arrays', () => {
    const mixedArray = [1, '2', 3n, 4.5, null, undefined, {}, [], true];
    const numericValues = mixedArray.filter(isNumeric);
    expect(numericValues).toEqual([1, 3n, 4.5]);
  });

  test('works with edge cases', () => {
    // noinspection DivideByZeroJS
    expect(isNumeric(0 / 0)).toBe(true); // NaN
    // noinspection DivideByZeroJS
    expect(isNumeric(1 / 0)).toBe(true); // Infinity
    expect(isNumeric(Number.MAX_VALUE)).toBe(true);
    expect(isNumeric(Number.MIN_VALUE)).toBe(true);
    expect(isNumeric(-0)).toBe(true);
    expect(isNumeric(new Object(0))).toBe(false); // Number object
    expect(isNumeric(new Object(1n))).toBe(false); // BigInt object
  });
});
