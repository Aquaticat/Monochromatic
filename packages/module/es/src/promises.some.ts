import type { Promisable, } from 'type-fest';
import { isArray, } from './array.basic.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import { chunksArray, } from './iterable.chunks.ts';
import { logtapeGetLogger, } from './logtape.shared.ts';

const l = logtapeGetLogger(['m', 'promise.some',],);

const processShard = async <const T,>(shard: Promisable<T>[],
  predicate: (input: T,) => Promisable<boolean>,): Promise<true> =>
{
  try {
    await Promise.any(
      shard.map(async function returnTrueOrThrow(input: Promisable<T>,): Promise<true> {
        const resolvedInput = await input;
        const result = await predicate(resolvedInput,);
        if (!result)
          throw new Error('Predicate returned false',);
        return true;
      },),
    );
    return true;
  }
  catch (error: unknown) {
    throw new Error(`No matching items in shard with error ${String(error,)}`,);
  }
};

/**
 * Checks if any value in an iterable of promises satisfies the predicate.
 *
 * @param predicate - Function to test each resolved value
 * @param promises - Collection of promises or values to check
 * @param shardSize - Optional size for promise shards
 * @returns true if any value passes the test, false otherwise
 */
export async function somePromises<const T,>(
  predicate: (input: T,) => Promisable<boolean>,
  promises: MaybeAsyncIterable<Promisable<T>>,
  shardSize = 1000,
): Promise<boolean> {
  if (isArray(promises,)) {
    // For small arrays, don't bother sharding
    if (promises.length <= shardSize) {
      try {
        await processShard(promises, predicate,);
        return true;
      }
      catch (error) {
        l.info`all shards rejected (all predicates returned false) with error: ${error}`;
        return false;
      }
    }

    // For larger arrays, split into chunks and process in parallel
    const chunks = chunksArray(promises as [any, ...any[],], shardSize,);

    try {
      // Use Promise.any to detect the first successful chunk
      await Promise.any(chunks.map(function processChunk(chunk,): Promise<boolean> {
        return processShard(chunk, predicate,);
      },),);
      return true;
    }
    catch (error) {
      l.info`all shards rejected (all predicates returned false) with error: ${error}`;
      return false;
    }
  }

  // Handle AsyncIterable case
  for await (const item of promises) {
    try {
      if (await predicate(item,))
        return true;
    }
    catch (error) {
      l.info`Error evaluating predicate: ${error}`;
      // Continue to next item if predicate throws
    }
  }

  return false;

  // Helper function to process a single shard
}
