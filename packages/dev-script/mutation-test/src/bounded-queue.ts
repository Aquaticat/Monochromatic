/**
 * Bounded concurrency queue for host mutation orchestration.
 *
 * @example
 * ```ts
 * await runBounded({ items: [1], concurrency: 1, worker: async ({ item }) => item });
 * ```
 */

/**
 * Sentinel for missing bounded worker result.
 */
const MISSING_RESULT = Symbol('missing bounded worker result');

/**
 * Indexed work item used by bounded concurrency fanout.
 */
type IndexedItem<Item> = {
  readonly item: Item;
  readonly index: number;
};

/**
 * Indexed worker result used to restore input order.
 */
type IndexedResult<Result> = {
  readonly index: number;
  readonly result: Result;
};

/**
 * Worker callback type for bounded queue.
 */
type BoundedWorker<Item, Result> = (options: {
  readonly item: Item;
  readonly index: number;
}) => Promise<Result>;

/**
 * Converts input items into index-carrying work items.
 *
 * @param items - Input work items.
 *
 * @returns Indexed work items.
 *
 * @example
 * ```ts
 * indexedItems(['a']);
 * ```
 */
function indexedItems<Item>(items: readonly Item[],): readonly IndexedItem<Item>[] {
  return items.map(function indexedItem(
    item,
    index,
  ): IndexedItem<Item> {
    return {
      item,
      index,
    };
  },);
}

/**
 * Groups indexed items by worker slot.
 *
 * @param options - Items and requested concurrency.
 *
 * @returns Indexed item groups.
 *
 * @example
 * ```ts
 * groupedItems({ items: ['a'], concurrency: 1 });
 * ```
 */
function groupedItems<Item>(options: {
  readonly items: readonly Item[];
  readonly concurrency: number;
},): readonly (readonly IndexedItem<Item>[])[] {
  /**
   * Input items to group for bounded processing.
   */
  const { items, } = options;
  /**
   * Indexed item list preserving original order.
   */
  const indexed = indexedItems(items,);
  /**
   * Active worker count, capped by item count.
   */
  const workerCount = Math.min(
    options.concurrency,
    items.length,
  );

  return Array.from(
    { length: workerCount, },
    function groupForWorker(
      _,
      workerIndex,
    ): readonly IndexedItem<Item>[] {
      return indexed.filter(function belongsToWorker(
        _item,
        index,
      ): boolean {
        return (index % workerCount) === workerIndex;
      },);
    },
  );
}

/**
 * Runs one indexed work item.
 *
 * @param options - Indexed item and worker callback.
 *
 * @returns Indexed worker result.
 *
 * @example
 * ```ts
 * await runIndexedItem({ workItem: { item: 'a', index: 0 }, worker: async ({ item }) => item });
 * ```
 */
async function runIndexedItem<Item, Result>(options: {
  readonly workItem: IndexedItem<Item>;
  readonly worker: BoundedWorker<Item, Result>;
},): Promise<IndexedResult<Result>> {
  /**
   * Current indexed work item.
   */
  const { workItem, } = options;
  /**
   * Result returned for current work item.
   */
  const result = await options.worker({
    item: workItem.item,
    index: workItem.index,
  },);
  return {
    index: workItem.index,
    result,
  };
}

/**
 * Runs one worker group sequentially.
 *
 * @param options - Worker group and worker function.
 *
 * @returns Indexed worker results.
 *
 * @example
 * ```ts
 * await runWorkerGroup({ group: [{ item: 'a', index: 0 }], worker: async ({ item }) => item });
 * ```
 */
function runWorkerGroup<Item, Result>(options: {
  readonly group: readonly IndexedItem<Item>[];
  readonly worker: BoundedWorker<Item, Result>;
},): Promise<readonly IndexedResult<Result>[]> {
  /**
   * Worker group to run sequentially.
   */
  const { group, } = options;
  /**
   * Promise resolving to indexed group results.
   */
  const groupResults = group.reduce(
    async function runNext(
      previousPromise,
      workItem,
    ): Promise<readonly IndexedResult<Result>[]> {
      /**
       * Results completed before current work item.
       */
      const previous = await previousPromise;
      /**
       * Result for current indexed work item.
       */
      const result = await runIndexedItem({
        workItem,
        worker: options.worker,
      },);
      return [
        ...previous,
        result,
      ];
    },
    Promise.resolve([] as readonly IndexedResult<Result>[]),
  );
  return groupResults;
}

/**
 * Converts indexed results into input order.
 *
 * @param options - Original items and indexed results.
 *
 * @returns Results in original item order.
 *
 * @example
 * ```ts
 * orderedResults({ items: ['a'], indexedResults: [{ index: 0, result: 1 }] });
 * ```
 */
function orderedResults<Result>(options: {
  readonly items: readonly unknown[];
  readonly indexedResults: readonly IndexedResult<Result>[];
},): readonly Result[] {
  /**
   * Indexed result list to convert into a lookup map.
   */
  const { indexedResults, } = options;
  /**
   * Original items whose indexes determine output order.
   */
  const { items, } = options;
  /**
   * Map entries keyed by original input index.
   */
  const entries = indexedResults.map(function resultEntry(indexedResult,): readonly [
    number,
    Result,
  ] {
    return [
      indexedResult.index,
      indexedResult.result,
    ];
  },);
  /**
   * Results keyed by original input index.
   */
  const resultByIndex = new Map(entries,);

  return items.map(function resultAtIndex(
    _item,
    index,
  ): Result {
    /**
     * Result lookup for current input index.
     */
    const result = resultByIndex.get(index,) ?? MISSING_RESULT;

    if (result === MISSING_RESULT)
      throw new Error(`Missing result at index ${String(index,)}`,);

    return result;
  },);
}

/**
 * Runs async work with bounded concurrency while preserving item order.
 *
 * @param options - Items, worker count, and worker function.
 *
 * @returns Results in input order.
 *
 * @example
 * ```ts
 * await runBounded({ items: [1], concurrency: 1, worker: async ({ item }) => item });
 * ```
 */
export async function runBounded<Item, Result>(options: {
  readonly items: readonly Item[];
  readonly concurrency: number;
  readonly worker: BoundedWorker<Item, Result>;
},): Promise<readonly Result[]> {
  /**
   * Work groups run concurrently, with sequential work inside each group.
   */
  const groups = groupedItems({
    items: options.items,
    concurrency: options.concurrency,
  },);
  /**
   * Promises for each worker group.
   */
  const groupRuns = groups.map(function runGroup(group,): Promise<readonly IndexedResult<Result>[]> {
    return runWorkerGroup({
      group,
      worker: options.worker,
    },);
  },);
  /**
   * Indexed results from every worker group.
   */
  const indexedResults = (await Promise.all(groupRuns,)).flat();

  return orderedResults({
    items: options.items,
    indexedResults,
  },);
}
