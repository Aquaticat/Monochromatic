/* @__NO_SIDE_EFFECTS__ */ export function notNullishOrThrow<T,>(
  potentiallyNullish: T,
): Exclude<T, null | undefined> {
  if (potentiallyNullish === null || typeof potentiallyNullish === 'undefined') {
    throw new TypeError(`${potentiallyNullish} is nullish`);
  }
  return potentiallyNullish as Exclude<T, null | undefined>;
}

/* @__NO_SIDE_EFFECTS__ */ export function notUndefinedOrThrow<T,>(
  potentiallyUndefined: T,
): Exclude<T, undefined> {
  if (typeof potentiallyUndefined === 'undefined') {
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

/* @__NO_SIDE_EFFECTS__ */ export type falsy = false | null | 0 | -0 | 0n | '';

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

// TODO: Add notObjOrThrow and other type-narrowing and throwing functions.
