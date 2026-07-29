/**
 * Stores of a verified member result, which the escape test must classify.
 *
 * The store cases were offered `readonly` before `assignmentStoreEscapes` existed,
 * because every caller of `useEscapes` hands it `valueConsumer` of the node and that
 * ascends the right operand of an assignment, so the branch meant to classify a store
 * could never receive one. The local and in-place cases are the controls that must stay
 * discharged, since widening the classification to cover them would report every alias.
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
 * Holder the caller owns, reached by property.
 */
type Sink = {
  value: Row | undefined;
};

/**
 * Stores a member result into a caller-owned property.
 *
 * @param rows - Rows whose first element is stored.
 *
 * @param sink - Holder receiving that element.
 *
 * @example
 * ```ts
 * storeIntoProperty([], { value: undefined, },);
 * ```
 */
export function storeIntoProperty(rows: Row[], sink: Sink,): void {
  sink.value = rows.at(0,);
}

/**
 * Stores a member result into a caller-owned element position.
 *
 * @param rows - Rows whose first element is stored.
 *
 * @param slots - Holder receiving that element.
 *
 * @example
 * ```ts
 * storeIntoElement([], [],);
 * ```
 */
export function storeIntoElement(rows: Row[], slots: (Row | undefined)[],): void {
  slots[0] = rows.at(0,);
}

/**
 * Assigns a member result to a plain local, which never leaves the callable.
 *
 * @param rows - Rows whose first label is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * assignToLocal([],);
 * ```
 */
export function assignToLocal(rows: Row[],): number {
  /**
   * Local holding the looked-up row.
   */
  let held: Row | undefined;
  held = rows.at(0,);
  return held?.label
    .length ?? 0;
}

/**
 * Reads a member result in place, never binding it.
 *
 * @param rows - Rows whose first label is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * readInPlace([],);
 * ```
 */
export function readInPlace(rows: Row[],): number {
  return rows.at(0,)
    ?.label
    .length ?? 0;
}

/**
 * Module binding declared outside every callable body.
 */
let escaped: Row | undefined;

/**
 * Stores a member result into a binding declared outside the callable.
 *
 * The case that exposed the root walk. `targetIsCallableLocal` asks whether the target's
 * declaration sits inside the body, and for a module binding the ascent runs past the
 * source file, whose `parent` is `undefined` in this AST while `Node` types it otherwise.
 * The walk stepped onto that and threw, the demand index caught it, and the whole callable
 * was omitted from the effect index rather than analysed. So the store classification this
 * fixture exists for was unreachable here for the one target kind it most needed to cover.
 *
 * @param rows - Rows whose first element is stored beyond every callable.
 *
 * @example
 * ```ts
 * storeIntoModuleBinding([],);
 * ```
 */
export function storeIntoModuleBinding(rows: Row[],): void {
  escaped = rows.at(0,);
}

/**
 * Reports what the module binding holds, so the store above is not dead.
 *
 * @returns stored label, empty when nothing was stored.
 *
 * @example
 * ```ts
 * escapedLabel();
 * ```
 */
export function escapedLabel(): string {
  return escaped?.label ?? '';
}

/**
 * Stores a member result into another parameter of the same callable.
 *
 * A parameter is local to the callable in every sense a reader would mean, and its
 * declaration nonetheless sits beside the body rather than inside it, so a containment
 * test against the body answers no and the transfer is classified as an escape. The value
 * never leaves, so this must discharge exactly as `assignToLocal` does.
 *
 * @param rows - Rows whose first element is copied.
 *
 * @param temporary - Parameter reused as scratch space.
 *
 * @returns label length after the copy.
 *
 * @example
 * ```ts
 * storeIntoParameter([], undefined,);
 * ```
 */
export function storeIntoParameter(rows: Row[], temporary: Row | undefined,): number {
  temporary = rows.at(0,);
  return temporary?.label
    .length ?? 0;
}

/**
 * Wider element shape, so an object rest over it leaves something behind.
 */
type Wide = {
  label: string;
  count: number;
};

/**
 * Seed standing in for an absent element, owned by this module rather than a caller.
 */
const SEED: Wide = {
  label: '',
  count: 0,
};

/**
 * Binding a rest object holds nothing of the caller's, and is recorded as a holder anyway.
 */
let restHeld: { count: number; } | undefined;

/**
 * Stores an object rest of a member result, which carries only primitive state.
 *
 * A rest pattern allocates a fresh object, so `remainder` shares no identity with the
 * caller's element and storing it grants nothing. `recordLeaf` records any leaf whose type
 * can carry mutable state, and a fresh object of primitive properties passes that test, so
 * the rest joins the holder set and its escape keeps receiver opacity on `wide`.
 *
 * @param wide - Elements whose first element is destructured.
 *
 * @returns label length read through the destructured primitive.
 *
 * @example
 * ```ts
 * storeRestOverPrimitiveState([],);
 * ```
 */
export function storeRestOverPrimitiveState(wide: Wide[],): number {
  const { label, ...remainder } = wide.at(0,) ?? SEED;
  restHeld = remainder;
  return label.length;
}

/**
 * Reports what the rest binding holds, so the store above is not dead.
 *
 * @returns stored count, or zero when nothing was stored.
 *
 * @example
 * ```ts
 * restHeldCount();
 * ```
 */
export function restHeldCount(): number {
  return restHeld?.count ?? 0;
}
