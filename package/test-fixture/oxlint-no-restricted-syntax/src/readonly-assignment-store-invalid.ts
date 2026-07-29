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
 * Binding a rest object holds nothing of the caller's.
 */
let restHeld: { count: number; } | undefined;

/**
 * Stores an object rest of a member result, which carries only primitive state.
 *
 * A rest pattern allocates a fresh object, so `remainder` shares no identity with the
 * caller's element, and every property it copied is a primitive the caller cannot reach
 * through it. Storing it grants nothing. Before `objectRestHoldsNothing`, `recordLeaf`
 * recorded any leaf whose own type can carry mutable state, which a fresh object of
 * primitive properties passes, so the rest joined the holder set and its escape kept
 * receiver opacity on `wide`.
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

/**
 * Element shape whose rest keeps a caller-owned reference.
 */
type Nested = {
  label: string;
  inner: Row;
};

/**
 * Seed standing in for an absent nested element, owned by this module.
 */
const NESTED_SEED: Nested = {
  label: '',
  inner: { label: '', },
};

/**
 * Binding a rest object holds a caller-owned reference through.
 */
let nestedHeld: { inner: Row; } | undefined;

/**
 * Stores an object rest that copies a reference rather than only primitives.
 *
 * The control for `storeRestOverPrimitiveState`. A property copy of a reference is the
 * caller's same object, so this rest does hold caller state and its escape must keep
 * receiver opacity. Without this case, discharging every object rest would look correct.
 *
 * @param items - Elements whose first element is destructured.
 *
 * @returns label length read through the destructured primitive.
 *
 * @example
 * ```ts
 * storeRestOverCarriedState([],);
 * ```
 */
export function storeRestOverCarriedState(items: Nested[],): number {
  const { label, ...remainder } = items.at(0,) ?? NESTED_SEED;
  nestedHeld = remainder;
  return label.length;
}

/**
 * Reports what the nested rest binding holds, so the store above is not dead.
 *
 * @returns stored inner label, or empty when nothing was stored.
 *
 * @example
 * ```ts
 * nestedHeldLabel();
 * ```
 */
export function nestedHeldLabel(): string {
  return nestedHeld?.inner
    .label ?? '';
}

/**
 * Binding a rest over an unresolved shape reaches, whose members nothing enumerated.
 */
let genericHeld: object | undefined;

/**
 * Stores an object rest taken over a constrained type parameter.
 *
 * The shape of the rest is a mapped type over `keyof T`, and an unresolved `keyof T`
 * enumerates to nothing. Nothing enumerated must not read as nothing carried, so this
 * case exists to tell those two apart: `T extends Row` may resolve through its
 * constraint, and answering discharge here would be a proof by failure to look.
 *
 * @param items - Elements whose first element is destructured.
 *
 * @param seed - Element standing in for an absent first element.
 *
 * @returns label length read through the destructured primitive.
 *
 * @example
 * ```ts
 * storeRestOverGenericState([], { label: '', },);
 * ```
 */
export function storeRestOverGenericState<T extends Row,>(items: T[], seed: T,): number {
  const { label, ...remainder } = items.at(0,) ?? seed;
  genericHeld = remainder;
  return label.length;
}

/**
 * Stores an object rest taken over an unconstrained type parameter.
 *
 * The companion to `storeRestOverGenericState`, with nothing for the checker to resolve
 * through. If the constrained case answers correctly and this one does not, the guard is
 * reading the constraint rather than establishing that the shape was enumerable.
 *
 * @param items - Elements whose first element is destructured.
 *
 * @param seed - Element standing in for an absent first element.
 *
 * @returns count of members the rest carried.
 *
 * @example
 * ```ts
 * storeRestOverUnconstrainedState([], {},);
 * ```
 */
export function storeRestOverUnconstrainedState<T,>(items: T[], seed: T,): number {
  const { ...remainder } = items.at(0,) ?? seed;
  genericHeld = remainder;
  return Object.keys(remainder,).length;
}

/**
 * Reports what the generic rest binding holds, so the stores above are not dead.
 *
 * @returns count of members currently stored.
 *
 * @example
 * ```ts
 * genericHeldSize();
 * ```
 */
export function genericHeldSize(): number {
  return Object.keys(genericHeld ?? {},).length;
}
