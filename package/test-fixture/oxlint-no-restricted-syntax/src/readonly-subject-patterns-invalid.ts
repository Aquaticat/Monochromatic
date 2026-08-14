//region Shared shape

/**
 * Mutable value used by binding-pattern subjects.
 */
type PatternValue = {
  writable: number;
};

//endregion Shared shape

//region Identifier and object bindings

/**
 * Reads identifier parameter.
 *
 * @param value - Mutable value read by function.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * identifierSubject({ writable: 1 });
 * ```
 */
export function identifierSubject(value: PatternValue,): number {
  return value.writable;
}

/**
 * Reads object binding and object rest binding.
 *
 * @param raw - Directly bound mutable value.
 *
 * @param rest - Remaining mutable property.
 *
 * @returns sum of current numbers.
 *
 * @example
 * ```ts
 * objectSubject({ raw: { writable: 1 }, other: { writable: 2 } });
 * ```
 */
export function objectSubject(
  {
    raw,
    ...rest
  }: {
    raw: PatternValue;
    other: PatternValue;
  },
): number {
  return raw.writable + rest.other.writable;
}

/**
 * Reads aliased object binding.
 *
 * @param local - Local name for source property.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * aliasedSubject({ source: { writable: 1 } });
 * ```
 */
export function aliasedSubject(
  {
    source: local,
  }: {
    source: PatternValue;
  },
): number {
  return local.writable;
}

/**
 * Reads defaulted object binding.
 *
 * @param raw - Local value after default.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * defaultedSubject({});
 * ```
 */
export function defaultedSubject(
  {
    raw = { writable: 0, },
  }: {
    raw?: PatternValue;
  },
): number {
  return raw.writable;
}

/**
 * Reads nested object binding.
 *
 * @param inner - Nested local value.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * nestedSubject({ outer: { inner: { writable: 1 } } });
 * ```
 */
export function nestedSubject(
  {
    outer: {
      inner,
    },
  }: {
    outer: {
      inner: PatternValue;
    };
  },
): number {
  return inner.writable;
}

/**
 * Reads string-keyed aliased binding.
 *
 * @param local - Local name for string-keyed property.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * stringKeySubject({ 'a-b': { writable: 1 } });
 * ```
 */
export function stringKeySubject(
  {
    'a-b': local,
  }: {
    'a-b': PatternValue;
  },
): number {
  return local.writable;
}

/**
 * Reads sole object-rest binding.
 *
 * @param rest - Collected mutable values.
 *
 * @returns current number.
 *
 * @example
 * ```ts
 * restOnlySubject({ value: { writable: 1 } });
 * ```
 */
export function restOnlySubject(
  {
    ...rest
  }: Record<string, PatternValue>,
): number {
  return rest.value?.writable ?? 0;
}

//endregion Identifier and object bindings

//region Array and empty bindings

/**
 * Reads array binding with hole and rest.
 *
 * @param first - First mutable value.
 *
 * @param rest - Remaining numbers after hole.
 *
 * @returns current total.
 *
 * @mutates first - Deliberately stale contract for array-pattern subject.
 *
 * @example
 * ```ts
 * arraySubject([1, undefined, 2]);
 * ```
 */
export function arraySubject(
  [
    first,
    ,
    ...rest
  ]: readonly [
    number,
    undefined,
    ...number[],
  ],
): number {
  return first + (rest[0] ?? 0);
}

/**
 * Reads no binding from mutable indexed input.
 *
 * @returns fixed number.
 *
 * @example
 * ```ts
 * emptySubject({});
 * ```
 */
export function emptySubject({}: Record<string, PatternValue>,): number {
  return 0;
}

//endregion Array and empty bindings
