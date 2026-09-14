//region Local producer origin controls

/**
 * Invokes callback with exact generic value.
 *
 * @param value - Value supplied to callback.
 *
 * @param inspect - Callback reading supplied value.
 *
 * @returns callback result.
 */
function inspectGeneric<const Value, Result,>({
  value,
  inspect,
}: {
  readonly value: Value;
  readonly inspect: (value: Value) => Result;
}): Result {
  return inspect(value,);
}

/**
 * Produces one inferred mutable row through actual return flow.
 *
 * @returns inferred row.
 */
function makeProducedRow() {
  return { count: 0, };
}

/**
 * Produces inferred row through local binding returned by callable.
 *
 * @returns inferred row through binding.
 */
function makeBoundProducedRow() {
  /** Local binding whose identity reaches return. */
  const row = { count: 0, };
  return row;
}

/**
 * Exercises local expression and genuine return producer attribution.
 *
 * @param condition - Selects distinct local union branches.
 */
export function localOriginControls(condition: boolean,): void {
  /** Local array whose element type originates in this expression. */
  const localRows = [{ count: 0, },];
  localRows.map(function inspectLocalArray(localArrayRow,) {
    return localArrayRow.count;
  },);

  void Promise.resolve({ count: 0, },)
    .then(function inspectLocalPromise(localPromiseRow,) {
      return localPromiseRow.count;
    },);

  inspectGeneric({
    value: { count: 0, },
    inspect(localGenericRow,) {
      return localGenericRow.count;
    },
  },);

  [1,].reduce(
    function inspectLocalSeed(localSeedRow, value,) {
      return { count: localSeedRow.count + value, };
    },
    { count: 0, },
  );

  /** Two local expression producers that must not collapse to enclosing callable. */
  const localUnion = condition
    ? { left: 0, }
    : { right: 0, };
  [localUnion,].filter(function inspectLocalUnion(localUnionRow,) {
    return ('left' in localUnionRow) || ('right' in localUnionRow);
  },);

  [makeProducedRow(),].map(function inspectReturnedRow(returnedRow,) {
    return returnedRow.count;
  },);
  [makeBoundProducedRow(),].map(function inspectBoundReturnedRow(boundReturnedRow,) {
    return boundReturnedRow.count;
  },);
}

//endregion Local producer origin controls
