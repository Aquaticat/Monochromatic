/**
 * Writes that reach caller state through a callee's returned parameter.
 *
 * Every mutating case here was offered `readonly` before caller-side substitution
 * existed, because `directReturned` recorded which parameters a result can carry and
 * nothing consumed the fact. The offer was false rather than imprecise: applying
 * `readonly Row[]` to `structuralThroughLaunderedReturn` type-checked under TypeScript
 * 7.0.2 and executing it grew the caller's array from one element to two.
 *
 * The controls carry the other half. A callee returning a freshly built array shares no
 * identity with its argument, so a caller mutating that result writes nothing the caller
 * owns, and attributing it would withhold an honest offer.
 *
 * @module
 */

/**
 * Mutable element shape.
 */
type Row = {
  label: string;
};

/**
 * Hands the caller's own array straight back.
 *
 * @param rows - Rows handed back unchanged.
 *
 * @returns same array.
 *
 * @example
 * ```ts
 * handBack([],);
 * ```
 */
function handBack(rows: Row[],): Row[] {
  return rows;
}

/**
 * Hands back the result of another callable that hands its parameter back.
 *
 * @param rows - Rows handed back through two callables.
 *
 * @returns same array.
 *
 * @example
 * ```ts
 * handBackTwice([],);
 * ```
 */
function handBackTwice(rows: Row[],): Row[] {
  return handBack(rows,);
}

/**
 * Builds a fresh array, sharing no identity with its argument.
 *
 * Written without `map` on purpose. A member call taking a caller-supplied callback opens
 * an opaque boundary of its own, which would withhold the offer for a reason that has
 * nothing to do with return substitution, and a control withheld for the wrong reason
 * cannot discriminate anything.
 *
 * @param rows - Rows whose count decides whether a fresh element is added.
 *
 * @returns newly allocated array.
 *
 * @example
 * ```ts
 * buildFresh([],);
 * ```
 */
function buildFresh(rows: Row[],): Row[] {
  /**
   * Array this callable allocates and owns.
   */
  const fresh: Row[] = [];
  if (rows.length > 0)
    fresh.push({ label: 'fresh', },);
  return fresh;
}

/**
 * Grows the caller's array through one returning callable.
 *
 * @param rows - Rows the caller owns and this callable grows.
 *
 * @example
 * ```ts
 * growThroughReturn([],);
 * ```
 */
export function growThroughReturn(rows: Row[],): void {
  handBack(rows,)
    .push({ label: 'appended', },);
}

/**
 * Grows the caller's array through two returning callables.
 *
 * @param rows - Rows the caller owns and this callable grows.
 *
 * @example
 * ```ts
 * growThroughTwoReturns([],);
 * ```
 */
export function growThroughTwoReturns(rows: Row[],): void {
  handBackTwice(rows,)
    .push({ label: 'appended', },);
}

/**
 * Grows a freshly built array, which the caller does not own.
 *
 * @param rows - Rows read to seed a fresh array.
 *
 * @example
 * ```ts
 * growFresh([],);
 * ```
 */
export function growFresh(rows: Row[],): void {
  buildFresh(rows,)
    .push({ label: 'appended', },);
}

/**
 * Grows the caller's array directly, with no returning callable between.
 *
 * @param rows - Rows the caller owns and this callable grows.
 *
 * @example
 * ```ts
 * growDirectly([],);
 * ```
 */
export function growDirectly(rows: Row[],): void {
  rows.push({ label: 'appended', },);
}

/**
 * Reads through a returning callable without changing anything.
 *
 * @param rows - Rows whose length is measured.
 *
 * @returns element count.
 *
 * @example
 * ```ts
 * measureThroughReturn([],);
 * ```
 */
export function measureThroughReturn(rows: Row[],): number {
  return handBack(rows,)
    .length;
}
