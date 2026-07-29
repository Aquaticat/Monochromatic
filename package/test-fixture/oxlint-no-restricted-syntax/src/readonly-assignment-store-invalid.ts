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
