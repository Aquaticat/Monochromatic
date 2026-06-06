/**
 * `satisfiesOrThrow`: assert custom predicate satisfaction, return candidate or throw.
 *
 * @module
 */

/**
 * Parameters passed to custom `satisfiesOrThrow` predicates.
 *
 * @typeParam Candidate - Candidate value being judged
 *
 * @typeParam Value - Expected value configured on assertion factory
 *
 * @example
 * ```ts
 * const parameters: SatisfiesOrThrowPredicateParameters<string, string> = {
 *   candidate: 'READY',
 *   value: 'ready',
 * };
 * ```
 */
export type SatisfiesOrThrowPredicateParameters<Candidate, Value,> = {
  readonly candidate: Candidate;
  readonly value: Value;
};

/**
 * Synchronous custom predicate used by `satisfiesOrThrow`.
 *
 * Predicates receive an `unknown` candidate because the checker accepts any
 * later candidate value. Predicate implementations should narrow candidate
 * locally before reading type-specific members.
 *
 * @typeParam Value - Expected value configured on assertion factory
 *
 * @example
 * ```ts
 * const predicate: SatisfiesOrThrowPredicate<string> = ({ candidate, value, }) =>
 *   ((typeof candidate) === 'string')
 *   && (candidate.toLowerCase() === value);
 * ```
 */
export type SatisfiesOrThrowPredicate<Value,> = (
  parameters: SatisfiesOrThrowPredicateParameters<unknown, Value>,
) => boolean;

/**
 * Async-capable custom predicate used by `satisfiesOrThrowAsync`.
 *
 * @typeParam Value - Expected value configured on assertion factory
 *
 * @example
 * ```ts
 * const predicate: SatisfiesOrThrowAsyncPredicate<string> = async ({
 *   candidate,
 *   value,
 * }) =>
 *   ((typeof candidate) === 'string') && (candidate.toLowerCase() === value);
 * ```
 */
export type SatisfiesOrThrowAsyncPredicate<Value,> = (
  parameters: SatisfiesOrThrowPredicateParameters<unknown, Value>,
) => boolean | Promise<boolean>;

/**
 * Options for default `Object.is(candidate, value)` satisfaction checks.
 *
 * @typeParam Value - Expected value compared through `Object.is`
 *
 * @example
 * ```ts
 * const options: SatisfiesOrThrowEqualityOptions<'ready'> = {
 *   value: 'ready',
 * };
 * ```
 */
export type SatisfiesOrThrowEqualityOptions<Value,> = {
  readonly value: Value;
  readonly predicate?: undefined;
};

/**
 * Options for synchronous custom-predicate satisfaction checks.
 *
 * @typeParam Value - Expected value passed into custom predicate
 *
 * @example
 * ```ts
 * const options: SatisfiesOrThrowPredicateOptions<string> = {
 *   value: 'ready',
 *   predicate: ({ candidate, value, }) =>
 *     ((typeof candidate) === 'string') && (candidate.toLowerCase() === value),
 * };
 * ```
 */
export type SatisfiesOrThrowPredicateOptions<Value,> = {
  readonly value: Value;
  readonly predicate: SatisfiesOrThrowPredicate<Value>;
};

/**
 * Options accepted by `satisfiesOrThrow`.
 *
 * @typeParam Value - Expected value configured on assertion factory
 *
 * @example
 * ```ts
 * const options: SatisfiesOrThrowOptions<string> = {
 *   value: 'ready',
 *   predicate: ({ candidate, value, }) => candidate === value,
 * };
 * ```
 */
export type SatisfiesOrThrowOptions<Value,> =
  | SatisfiesOrThrowEqualityOptions<Value>
  | SatisfiesOrThrowPredicateOptions<Value>;

/**
 * Options for async-capable custom-predicate satisfaction checks.
 *
 * @typeParam Value - Expected value passed into custom predicate
 *
 * @example
 * ```ts
 * const options: SatisfiesOrThrowAsyncPredicateOptions<string> = {
 *   value: 'ready',
 *   predicate: async ({ candidate, value, }) => candidate === value,
 * };
 * ```
 */
export type SatisfiesOrThrowAsyncPredicateOptions<Value,> = {
  readonly value: Value;
  readonly predicate: SatisfiesOrThrowAsyncPredicate<Value>;
};

/**
 * Options accepted by `satisfiesOrThrowAsync`.
 *
 * @typeParam Value - Expected value configured on assertion factory
 *
 * @example
 * ```ts
 * const options: SatisfiesOrThrowAsyncOptions<string> = {
 *   value: 'ready',
 *   predicate: async ({ candidate, value, }) => candidate === value,
 * };
 * ```
 */
export type SatisfiesOrThrowAsyncOptions<Value,> =
  | SatisfiesOrThrowEqualityOptions<Value>
  | SatisfiesOrThrowAsyncPredicateOptions<Value>;

/**
 * Builds a synchronous assertion function from an expected value and optional predicate.
 *
 * Without a predicate, the returned checker uses `Object.is(candidate, value)`
 * and narrows successful candidates to the intersection of candidate and value
 * types. With a predicate, the returned checker passes `{ candidate, value }`
 * into the predicate and returns the candidate unchanged when predicate returns
 * `true`.
 *
 * @param options - Expected value and optional synchronous predicate
 *
 * @returns Checker returning candidate when satisfaction check passes
 *
 * @throws Error when predicate returns non-boolean result
 *
 * @example
 * Default equality:
 * ```ts
 * const ready = satisfiesOrThrow({ value: 'ready' as const, })(raw,);
 * // ready is typed as 'ready' when raw was unknown.
 * ```
 *
 * @example
 * Custom predicate:
 * ```ts
 * const readyish = satisfiesOrThrow({
 *   value: 'ready',
 *   predicate: ({ candidate, value, }) =>
 *     ((typeof candidate) === 'string') && (candidate.toLowerCase() === value),
 * })('READY',);
 * // readyish is the original candidate, 'READY'.
 * ```
 */
export function satisfiesOrThrow<const Value,>(
  options: SatisfiesOrThrowEqualityOptions<Value>,
): <const Candidate,>(candidate: Candidate) => Candidate & Value;
export function satisfiesOrThrow<const Value,>(
  options: SatisfiesOrThrowPredicateOptions<Value>,
): <const Candidate,>(candidate: Candidate) => Candidate;
/**
 * Implements `satisfiesOrThrow` overloads.
 *
 * @param options - Expected value and optional synchronous predicate
 *
 * @returns Checker returning candidate when satisfaction check passes
 *
 * @example
 * ```ts
 * satisfiesOrThrow({ value: 'ready', })('ready',);
 * ```
 */
export function satisfiesOrThrow<const Value,>(
  options: SatisfiesOrThrowOptions<Value>,
):
  | (<const Candidate,>(candidate: Candidate) => Candidate & Value)
  | (<const Candidate,>(candidate: Candidate) => Candidate) {
  if (options.predicate === undefined) {
    return function judgeSatisfiesEquality<const Candidate,>(
      candidate: Candidate,
    ): Candidate & Value {
      if (!Object.is(
        candidate,
        options.value,
      ))
        throw new Error(
          `Expected candidate to satisfy ${String(options.value,)}, got ${String(
            candidate,
          )}`,
        );
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Object.is proves candidate and configured value are the same runtime value
      return candidate as Candidate & Value;
    };
  }

  return function judgeSatisfiesPredicate<const Candidate,>(
    candidate: Candidate,
  ): Candidate {
    /**
     * Raw predicate result, checked at runtime to protect JavaScript callers
     * and unsafe casts.
     */
    const result = options.predicate({
      candidate,
      value: options.value,
    },);
    if ((typeof result) !== 'boolean')
      throw new Error(
        `Expected ${satisfiesOrThrow.name} predicate to return boolean, got ${
          typeof result
        }; use ${satisfiesOrThrowAsync.name} for async predicates`,
      );
    if (!result)
      throw new Error(
        `Expected candidate to satisfy ${String(options.value,)}, got ${String(
          candidate,
        )}`,
      );
    return candidate;
  };
}

/**
 * Builds an async assertion function from an expected value and optional predicate.
 *
 * Without a predicate, the returned checker uses `Object.is(candidate, value)`
 * and narrows successful candidates to the intersection of candidate and value
 * types. With a predicate, the returned checker passes `{ candidate, value }`
 * into the predicate and returns the candidate unchanged when awaited predicate
 * result is `true`.
 *
 * @param options - Expected value and optional async-capable predicate
 *
 * @returns Checker returning candidate when satisfaction check passes
 *
 * @throws Error when awaited predicate result is non-boolean
 *
 * @example
 * Default equality:
 * ```ts
 * const ready = await satisfiesOrThrowAsync({ value: 'ready' as const, })(raw,);
 * // ready is typed as 'ready' when raw was unknown.
 * ```
 *
 * @example
 * Custom predicate:
 * ```ts
 * const readyish = await satisfiesOrThrowAsync({
 *   value: 'ready',
 *   predicate: async ({ candidate, value, }) =>
 *     ((typeof candidate) === 'string') && (candidate.toLowerCase() === value),
 * })('READY',);
 * // readyish is the original candidate, 'READY'.
 * ```
 */
export function satisfiesOrThrowAsync<const Value,>(
  options: SatisfiesOrThrowEqualityOptions<Value>,
): <const Candidate,>(candidate: Candidate) => Promise<Candidate & Value>;
export function satisfiesOrThrowAsync<const Value,>(
  options: SatisfiesOrThrowAsyncPredicateOptions<Value>,
): <const Candidate,>(candidate: Candidate) => Promise<Candidate>;
/**
 * Implements `satisfiesOrThrowAsync` overloads.
 *
 * @param options - Expected value and optional async-capable predicate
 *
 * @returns Checker returning candidate when satisfaction check passes
 *
 * @example
 * ```ts
 * await satisfiesOrThrowAsync({ value: 'ready', })('ready',);
 * ```
 */
export function satisfiesOrThrowAsync<const Value,>(
  options: SatisfiesOrThrowAsyncOptions<Value>,
):
  | (<const Candidate,>(candidate: Candidate) => Promise<Candidate & Value>)
  | (<const Candidate,>(candidate: Candidate) => Promise<Candidate>) {
  if (options.predicate === undefined) {
    return async function judgeSatisfiesEqualityAsync<const Candidate,>(
      candidate: Candidate,
    ): Promise<Candidate & Value> {
      /**
       * Whether candidate equals configured value under default equality.
       */
      const result = await Promise.resolve(
        Object.is(
          candidate,
          options.value,
        ),
      );
      if (!result)
        throw new Error(
          `Expected candidate to satisfy ${String(options.value,)}, got ${String(
            candidate,
          )}`,
        );
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Object.is proves candidate and configured value are the same runtime value
      return candidate as Candidate & Value;
    };
  }

  return async function judgeSatisfiesPredicateAsync<const Candidate,>(
    candidate: Candidate,
  ): Promise<Candidate> {
    /**
     * Awaited predicate result, checked at runtime to protect JavaScript callers
     * and unsafe casts.
     */
    const result = await options.predicate({
      candidate,
      value: options.value,
    },);
    if ((typeof result) !== 'boolean')
      throw new Error(
        `Expected ${satisfiesOrThrowAsync.name} predicate to return boolean, got ${
          typeof result
        }`,
      );
    if (!result)
      throw new Error(
        `Expected candidate to satisfy ${String(options.value,)}, got ${String(
          candidate,
        )}`,
      );
    return candidate;
  };
}
