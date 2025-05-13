import type {
  NegativeInfinity,
  PositiveInfinity,
} from 'type-fest';
import type {
  Float,
  Int,
  IntBigint,
  NegativeFloat,
  NegativeInt,
  NonNegativeInt,
  PositiveFloat,
  PositiveInt,
} from './numeric.type.int.ts';
import type { Nan } from './numeric.type.nan';

/* @__NO_SIDE_EFFECTS__ */ export function isNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return typeof value === 'number';
}

/* @__NO_SIDE_EFFECTS__ */ export function isNan(
  value: any,
): value is Nan {
  return Number.isNaN(value);
}

export function isInteger(
  value: unknown,
): value is Int {
  return Number.isInteger(value);
}

export function isInt(
  value: unknown,
): value is Int {
  return Number.isInteger(value);
}

export function isPositiveInt(value: unknown): value is PositiveInt {
  return isInt(value) && value > 0;
}

export function isNegativeInt(value: unknown): value is NegativeInt {
  return isInt(value) && value < 0;
}

export function isNonNegativeInt(value: unknown): value is NonNegativeInt {
  return isInt(value) && value >= 0;
}

export function isFloat(
  value: unknown,
): value is Float {
  return isNonNanNumber(value) && Number.isFinite(value) && !Number.isInteger(value);
}

export function isPositiveFloat(
  value: unknown,
): value is PositiveFloat {
  return isFloat(value) && value > 0;
}

export function isNegativeFloat(
  value: unknown,
): value is NegativeFloat {
  return isFloat(value) && value < 0;
}

/* @__NO_SIDE_EFFECTS__ */ export function isNonNanNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never, typeof Number.NaN> {
  return isNumber(value) && !isNan(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isPositiveInfinity(
  value: any,
): value is PositiveInfinity {
  return value === Number.POSITIVE_INFINITY;
}

/* @__NO_SIDE_EFFECTS__ */ export function isNegativeInfinity(
  value: any,
): value is PositiveInfinity {
  return value === Number.NEGATIVE_INFINITY;
}

/* @__NO_SIDE_EFFECTS__ */ export function isInfinity<T_value,>(
  value: T_value | unknown,
): value is T_value extends PositiveInfinity ? PositiveInfinity
  : T_value extends NegativeInfinity ? NegativeInfinity
  : never
{
  return isPositiveInfinity(value) || isNegativeInfinity(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isFiniteNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return !isInfinity(value) && isNonNanNumber(value);
}

// Can't type that range.
/* @__NO_SIDE_EFFECTS__ */ export function isSafeNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return isFiniteNumber(value)
    && (-Number.MAX_SAFE_INTEGER <= value && value <= Number.MAX_SAFE_INTEGER);
}

/* @__NO_SIDE_EFFECTS__ */ export function isPositiveNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return isPositiveInfinity(value) || isPositiveInt(value) || isPositiveFloat(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isObjectDate(value: any): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]';
}

export function isBigint(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

export function isNumeric(value: unknown): value is number | bigint {
  return isNumber(value) || isBigint(value);
}

export function isIntBigint(value: unknown): value is IntBigint {
  return isBigint(value)
    && value >= BigInt(Number.MIN_SAFE_INTEGER)
    && value <= BigInt(Number.MAX_SAFE_INTEGER);
}

export const bigint0 = 0n;
