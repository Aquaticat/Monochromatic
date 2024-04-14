export const notNullishOrThrow = function notNullishOrThrow<T>(potentiallyNullish: T): Exclude<T, null | undefined> {
  if (potentiallyNullish === null || typeof potentiallyNullish === 'undefined') {
    throw new TypeError(`${potentiallyNullish} is nullish`);
  }
  return potentiallyNullish as Exclude<T, null | undefined>;
};
export const notUndefinedOrThrow = function notUndefinedOrThrow<T>(potentiallyUndefined: T): Exclude<T, undefined> {
  if (typeof potentiallyUndefined === 'undefined') {
    throw new TypeError(`${potentiallyUndefined} is undefined`);
  }
  return potentiallyUndefined as Exclude<T, undefined>;
};
export const notNullOrThrow = function notNullOrThrow<T>(potentiallyNull: T): Exclude<T, null> {
  if (potentiallyNull === null) {
    throw new TypeError(`${potentiallyNull} is null`);
  }
  return potentiallyNull as Exclude<T, null>;
};

export type falsy = false | null | 0 | -0 | 0n | '';

export const notFalsyOrThrow = function notFalsyOrThrow<T>(potentiallyFalsy: T): Exclude<T, falsy> {
  if (!potentiallyFalsy) {
    throw new TypeError(`${potentiallyFalsy} is null`);
  }
  return potentiallyFalsy as Exclude<T, falsy>;
};
