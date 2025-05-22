/* @__NO_SIDE_EFFECTS__ */ import type {
  UnknownMap,
  UnknownRecord,
  UnknownSet,
} from 'type-fest';
import type { UnknownArrayOrTuple } from 'type-fest/source/internal';

export function notNullishOrThrow<T,>(
  potentiallyNullish: T,
): Exclude<T, null | undefined> {
  if (potentiallyNullish === null || potentiallyNullish === undefined) {
    throw new TypeError(`${potentiallyNullish} is nullish`);
  }
  return potentiallyNullish as Exclude<T, null | undefined>;
}

/* @__NO_SIDE_EFFECTS__ */ export function notUndefinedOrThrow<T,>(
  potentiallyUndefined: T,
): Exclude<T, undefined> {
  if (potentiallyUndefined === undefined) {
    throw new TypeError(`${potentiallyUndefined} is undefined`);
  }
  return potentiallyUndefined as Exclude<T, undefined>;
}

/* @__NO_SIDE_EFFECTS__ */ export function notNullOrThrow<T,>(
  potentiallyNull: T,
): Exclude<T, null> {
  if (potentiallyNull === null) {
    throw new TypeError(`${potentiallyNull} is null`);
  }
  return potentiallyNull as Exclude<T, null>;
}

/* @__NO_SIDE_EFFECTS__ */ export type falsy = false | null | 0 | 0n | '' | undefined;

/* @__NO_SIDE_EFFECTS__ */ export function notFalsyOrThrow<T,>(
  potentiallyFalsy: T,
): Exclude<T, falsy> {
  if (!potentiallyFalsy) {
    throw new TypeError(`${potentiallyFalsy} is null`);
  }
  return potentiallyFalsy as Exclude<T, falsy>;
}

/* @__NO_SIDE_EFFECTS__ */ export function notFalseOrThrow<T,>(
  potentiallyFalse: T,
): Exclude<T, false> {
  if (potentiallyFalse === false) {
    throw new TypeError(`${potentiallyFalse} is false`);
  }
  return potentiallyFalse as Exclude<T, false>;
}

export function notObjOrThrow<T,>(
  potentiallyObj: T,
): Exclude<T, object> {
  if (potentiallyObj !== null && typeof potentiallyObj === 'object') {
    throw new TypeError(`${potentiallyObj} is an object`);
  }
  return potentiallyObj as Exclude<T, object>;
}

export function notTrueOrThrow<T,>(
  potentiallyTrue: T,
): Exclude<T, true> {
  if (potentiallyTrue === true) {
    throw new TypeError(`${potentiallyTrue} is true`);
  }
  return potentiallyTrue as Exclude<T, true>;
}

export type truthy = Exclude<
  | true
  | number
  | bigint
  | string
  | UnknownArrayOrTuple
  | UnknownMap
  | UnknownSet
  | UnknownRecord
  // eslint-disable-next-line no-unsafe-function-type
  | Function,
  0 | ''
>;

export function notTruthyOrThrow<const T,>(
  potentiallyTruthy: T,
): Exclude<T, falsy> {
  if (potentiallyTruthy) {
    throw new TypeError(`${potentiallyTruthy} is truthy`);
  }
  return potentiallyTruthy as Exclude<T, falsy>;
}

export function notEmptyOrThrow<T extends string | any[] | object,>(
  potentiallyEmpty: T,
): T {
  if (
    (typeof potentiallyEmpty === 'string' && potentiallyEmpty === '')
    || (Array.isArray(potentiallyEmpty) && potentiallyEmpty.length === 0)
    || (typeof potentiallyEmpty === 'object'
      && potentiallyEmpty !== null
      && Object.keys(potentiallyEmpty).length === 0)
  ) {
    throw new TypeError(`${potentiallyEmpty} is empty`);
  }
  return potentiallyEmpty;
}

export function notArrayOrThrow<T,>(
  potentiallyArray: T,
): Exclude<T, any[]> {
  if (Array.isArray(potentiallyArray)) {
    throw new TypeError(`${potentiallyArray} is an array`);
  }
  return potentiallyArray as Exclude<T, any[]>;
}

export function notStringOrThrow<T,>(
  potentiallyString: T,
): Exclude<T, string> {
  if (typeof potentiallyString === 'string') {
    throw new TypeError(`${potentiallyString} is a string`);
  }
  return potentiallyString as Exclude<T, string>;
}
