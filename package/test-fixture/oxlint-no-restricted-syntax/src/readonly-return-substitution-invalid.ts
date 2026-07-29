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

/**
 * Writes a property through a returned element, which substitution does not yet reach.
 *
 * Pins a known boundary rather than a fixed defect. The deferred recording sits in
 * `effect-collection-member-effect.ts`, so it fires for a collection member call on a
 * returned result. A property write travels through `inspectDirectWrite` instead, and
 * a write through a local holding the result is the alias hop that still records nothing.
 *
 * Not demonstrated to be a false offer. Under `readonly Row[]` an element property write
 * is legal, exactly as the retraction recorded in the planning document established, so
 * the honest offer here is the shallow one. The structural shape is where it would bite.
 *
 * @param rows - Rows whose first label is rewritten.
 *
 * @example
 * ```ts
 * writePropertyThroughReturn([],);
 * ```
 */
export function writePropertyThroughReturn(rows: Row[],): void {
  /**
   * Row handed back by the returning callable.
   */
  const first = handBack(rows,)[0];
  if (first !== undefined)
    first.label = 'changed';
}

/**
 * Structural holder whose interior a callee can hand back.
 */
type Config = {
  row: Row;
};

/**
 * Hands back a piece of the caller's own structure.
 *
 * Offering `readonly` here stays honest. This callable writes nothing, and handing the
 * caller a value the caller already reaches grants no capability. What the offer depends
 * on is the caller substituting through the returned fact, which is the whole point of
 * recording it.
 *
 * @param config - Structure whose row is handed back.
 *
 * @returns caller's own row.
 *
 * @example
 * ```ts
 * firstRow({ row: { label: '', }, },);
 * ```
 */
function firstRow(config: Config,): Row {
  return config.row;
}

/**
 * Builds a fresh row, sharing no identity with its argument.
 *
 * @param config - Structure read to decide the fresh label.
 *
 * @returns newly allocated row.
 *
 * @example
 * ```ts
 * freshRow({ row: { label: '', }, },);
 * ```
 */
function freshRow(config: Config,): Row {
  /**
   * Row this callable allocates and owns.
   */
  const fresh: Row = { label: 'fresh', };
  if (config.row
    .label
    .length
    === 0)
    fresh.label = 'empty';
  return fresh;
}

/**
 * Writes a property straight onto a returned piece of caller state.
 *
 * The shape that falsified the write path. Both this parameter and `firstRow`'s were
 * offered `ReadonlyDeep`, applying both compiled, and running the pair mutated the
 * caller's row. Assignability ignores `readonly` property modifiers, so `firstRow`
 * declaring `Row` launders the deeply readonly value back into a mutable one silently.
 *
 * @param config - Structure the caller owns and this callable writes into.
 *
 * @example
 * ```ts
 * writeThroughOwnedCall({ row: { label: '', }, },);
 * ```
 */
export function writeThroughOwnedCall(config: Config,): void {
  firstRow(config,)
    .label = 'written';
}

/**
 * Deletes a property from a returned piece of caller state.
 *
 * A second write form through the same seam, present because `inspectDirectWrite` serves
 * three syntactic shapes and a fix that reached only assignment would be a fix for one of
 * them.
 *
 * @param config - Structure the caller owns and this callable deletes from.
 *
 * @example
 * ```ts
 * deleteThroughOwnedCall({ row: { label: '', }, },);
 * ```
 */
export function deleteThroughOwnedCall(config: Config,): void {
  /* The cast is what makes the operand deletable, since `label` is not optional on `Row`.
   * What matters for this fixture is the operand shape reaching `inspectDirectWrite` with
   * a call under its access layers, which the cast does not change. */
  delete (firstRow(config,) as Partial<Row>).label;
}

/**
 * Writes onto a freshly built row, which the caller does not own.
 *
 * The control that keeps the fix from being a blanket withholding. `freshRow` allocates,
 * so its returned set is empty and substitution adds nothing, leaving the offer standing.
 *
 * @param config - Structure read to seed a fresh row.
 *
 * @example
 * ```ts
 * writeThroughFreshCall({ row: { label: '', }, },);
 * ```
 */
export function writeThroughFreshCall(config: Config,): void {
  freshRow(config,)
    .label = 'written';
}
