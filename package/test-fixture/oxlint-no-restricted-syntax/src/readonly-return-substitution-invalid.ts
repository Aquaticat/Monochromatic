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
 * Writes a property through a returned element.
 *
 * This was pinned as a boundary with a caution beside it: under `readonly Row[]` an
 * element property write is legal, so the offer looked honest and withholding it looked
 * like a precision loss the return substitution should not cause.
 *
 * The caution was answered by measurement rather than by argument, because the question is
 * not what `readonly Row[]` permits but what this analysis already does. An element
 * property write with no call anywhere in it:
 *
 * ```text
 * writeElementPropertyDirectly     mutated=[0]   const first = rows[0]; first.label = 'x';
 * writeElementPropertyThroughCall  mutated=[0]   const first = handBack(rows,)[0]; ...
 * ```
 *
 * The direct form already attributed the write to the parameter and always had, so the
 * offer was already withheld for it. Following the result through the local made this case
 * agree with its own direct equivalent instead of disagreeing with it, which is the
 * opposite of the regression the caution warned about.
 *
 * Whether an element property write should withhold an ARRAY parameter's shallow offer at
 * all is a real question and a different one. It predates every stage of this work, it
 * applies to the direct form first, and it is about slot granularity for array elements
 * rather than about result substitution.
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

/**
 * Writes through a local holding a returned piece of caller state.
 *
 * A local hides the call from the write completely: the target's root is an identifier,
 * so stripping access layers finds no call, and `discoverAliasOrigins` gave the binding no
 * origins because its own walk stops at a call too. Closing it needs the binding to record
 * which call filled it, which is a different fact from which parameter it can reach.
 *
 * @param config - Structure the caller owns and this callable writes into.
 *
 * @example
 * ```ts
 * writeThroughHeldResult({ row: { label: '', }, },);
 * ```
 */
export function writeThroughHeldResult(config: Config,): void {
  /**
   * Row this callable holds after the call handed it back.
   */
  const local = firstRow(config,);
  local.label = 'written';
}

/**
 * Writes through an alias of a local holding a returned piece of caller state.
 *
 * One hop further than `writeThroughHeldResult`, and here to prove the alias hop rather
 * than assume it. The binding map converges the same way the origin map does, so an alias
 * of an alias costs a pass and nothing else, and a fix that only read declarations
 * directly initialized by a call would pass the shape above and fail this one.
 *
 * @param config - Structure the caller owns and this callable writes into.
 *
 * @example
 * ```ts
 * writeThroughAliasedResult({ row: { label: '', }, },);
 * ```
 */
export function writeThroughAliasedResult(config: Config,): void {
  /**
   * Row this callable holds after the call handed it back.
   */
  const local = firstRow(config,);
  /**
   * Second name for the same row.
   */
  const alias = local;
  alias.label = 'written';
}

/**
 * Writes through a local holding a freshly built row.
 *
 * The control for the local shapes. The binding does record which call filled it, and that
 * callee's returned set is empty, so substitution hands over nothing and the offer stands.
 * Withholding here would mean the fix withholds from every local fed by any call.
 *
 * @param config - Structure read to seed a fresh row.
 *
 * @example
 * ```ts
 * writeThroughHeldFresh({ row: { label: '', }, },);
 * ```
 */
export function writeThroughHeldFresh(config: Config,): void {
  /**
   * Row this callable owns, allocated by the callee.
   */
  const local = freshRow(config,);
  local.label = 'written';
}

/**
 * Reads through a local holding a returned piece of caller state.
 *
 * The other control. A binding fed by a call records the call whatever happens next, so
 * this shape proves the recording alone changes nothing: only a write or a store consults
 * it.
 *
 * @param config - Structure whose label length is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * readHeldResult({ row: { label: '', }, },);
 * ```
 */
export function readHeldResult(config: Config,): number {
  /**
   * Row this callable holds after the call handed it back.
   */
  const local = firstRow(config,);
  return local.label
    .length;
}
