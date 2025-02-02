import type {
  NegativeInfinity,
  PositiveInfinity,
} from 'type-fest';
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

// Can't really do : value is int here
// unless we resort to branded types which I'm hesitant about.
/* @__NO_SIDE_EFFECTS__ */ export function isInteger<T,>(
  value: T,
): value is T extends number ? T : never {
  return Number.isInteger(value);
}

// Can't really do : value is int here
// unless we resort to branded types which I'm hesitant about.
/* @__NO_SIDE_EFFECTS__ */ export function isFloat<T,>(
  value: T,
): value is T extends number ? T : never {
  return isNonNanNumber(value) && !Number.isInteger(value);
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
  return value === Number.POSITIVE_INFINITY;
}

/* @__NO_SIDE_EFFECTS__ */ export function isInfinity<T_value,>(
  value: T_value | unknown,
): value is T_value extends PositiveInfinity ? PositiveInfinity
  : T_value extends NegativeInfinity ? NegativeInfinity
  : never
{
  return isPositiveInfinity(value) || isNegativeInfinity(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function // biome-ignore lint/suspicious/noShadowRestrictedNames: You shouldn't use the builtin isFinite anyway.
isFinite<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return !isInfinity(value);
}

// Can't type that range.
/* @__NO_SIDE_EFFECTS__ */ export function isSafeNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return isFinite(value)
    && (Number.MAX_SAFE_INTEGER <= value && value <= Number.MAX_SAFE_INTEGER);
}

/* @__NO_SIDE_EFFECTS__ */ export function isPositiveNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return isPositiveInfinity(value) || isSafeNumber(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isObjectDate(value: any): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]';
}
