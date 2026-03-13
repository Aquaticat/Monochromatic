/**
 * Concurrently maps an async or sync iterable through an async function,
 * collecting results into an array.
 *
 * Iterates through all elements first, launching each mapping call immediately,
 * then awaits all results with `Promise.all`. Order of the output array matches
 * the order of the input iterable.
 *
 * @param fn - Async function applied to each element
 *
 * @param iterable - Sync or async iterable of input elements
 *
 * @returns Promise resolving to an array of mapped results
 *
 * @example
 * Fetch multiple URLs concurrently:
 * ```ts
 * const responses = await $(
 *   async (url: string) => (await fetch(url)).text(),
 *   ['https://a.com', 'https://b.com'],
 * );
 * ```
 *
 * @example
 * Read directory entries:
 * ```ts
 * const contents = await $(
 *   async (entry: Dirent) => readFile(join(entry.parentPath, entry.name), 'utf8'),
 *   dirEntries,
 * );
 * ```
 */
export async function $<T, R,>(
  fn: (item: T,) => Promise<R>,
  iterable: AsyncIterable<T> | Iterable<T>,
): Promise<R[]> {
  // Each `fn` call starts executing immediately (promises are eager, not lazy).
  // `Promise.all` only collects already-running results — it does not "activate" them.
  // `Array.fromAsync` is not suitable here: it awaits each mapped value sequentially,
  // which would serialize the work and lose concurrency.
  const promises: Promise<R>[] = [];
  for await (const item of iterable) {
    promises.push(fn(item,),);
  }
  return Promise.all(promises,);
}
