/**
 * Deterministic bounded asynchronous mapping.
 *
 * @module
 */

/**
 * Asynchronously maps values through deterministic lanes while preserving input order.
 *
 * @param values - ordered input values
 *
 * @param concurrency - maximum active asynchronous lanes
 *
 * @param map - mapper receiving one value and its stable input index
 *
 * @returns mapped values in input order
 *
 * @example
 * ```ts
 * await mapBounded({ values: ['a'], concurrency: 1, map: async ({ value }) => value.length });
 * ```
 */
export async function mapBounded<const Value, Result>({
  values,
  concurrency,
  map,
}: {
  readonly values: readonly Value[];
  readonly concurrency: number;
  readonly map: (input: Readonly<{
    value: Value;
    index: number;
  }>) => Promise<Result>;
},): Promise<readonly Result[]> {
  if ((concurrency < 1) || (!Number.isInteger(concurrency)))
    throw new TypeError('Bounded map concurrency must be a positive integer.',);
  /**
   * Active lane count bounded by configured cap and input count.
   */
  const laneCount = Math.min(
    concurrency,
    values.length,
  );
  if (laneCount === 0)
    return [];
  /**
   * Indexed value lanes retaining deterministic input positions.
   */
  const lanes = Array.from(
    { length: laneCount, },
    function createLane(
      _unused,
      laneIndex,
    ) {
      return values.flatMap(function assignValue(
        value,
        index,
      ) {
        return (index % laneCount) === laneIndex
          ? [{
            index,
            value,
          },]
          : [];
      },);
    },
  );
  /**
   * Independently mapped lanes with asynchronous work sequenced per lane.
   */
  const loadedLanes = await Promise.all(lanes.map(async function mapLane(lane,) {
    /**
     * Results accumulated in current lane order.
     */
    const loaded: {
      index: number;
      result: Result;
    }[] = [];
    /* oxlint-disable no-await-in-loop -- Each bounded lane deliberately sequences asynchronous resource use. */
    for (const entry of lane) {
      loaded.push({
        index: entry.index,
        result: await map({
          value: entry.value,
          index: entry.index,
        },),
      },);
    }
    /* oxlint-enable no-await-in-loop */
    return loaded;
  },),);
  return loadedLanes
    .flat()
    .toSorted(function byInputIndex(
      left,
      right,
    ) {
      return left.index - right.index;
    },)
    .map(function resultFromEntry(entry,) {
      return entry.result;
    },);
}
