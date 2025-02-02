import {
  chunksArray,
  isArray,
  logtapeGetLogger,
  mapArrayLike,
  type MaybeAsyncIterable,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

const l = logtapeGetLogger(['m', 'promise.some']);

// TODO: Find out if the use of generics here forces promises to be of the same type while calling the function.

// TODO: Write the tests.

// TODO: Make callback be able to accept something returning boolean.

/**
 @remarks
 */
/* @__NO_SIDE_EFFECTS__ */ export async function somePromises<T_input,>(
  // TODO: Change the type to not allow a Promise-accepting callback to be passed in.
  //       The callback always operates on unwrapped values.
  predicate: (input: T_input) => Promisable<boolean>,
  promises: MaybeAsyncIterable<Promisable<T_input>>,
): Promise<boolean> {
  if (isArray(promises)) {
    // Chunks the array of promises

    // TODO: Figure out the optimal val for shards. Using 2 for now.

    // TODO: Write partial so
    //       `pipe((chunk) => mapArrayLike(callback, chunk), Promise.race)`
    //       can be rewritten in point-free form

    // TODO: Promise<false> doesn't mean reject.
    //       Migrate not-or-throw into this module and use that.

    // FIXME: Why is mapArrayLike inferring any for chunk?

    // TODO: I wrote the algorithm. But is it really faster? Test it.

    /*
    const chunks = chunksArray(promises, 2);
    const chunkedResults = mapArrayLike(
      pipe((chunk: [any, any]) => mapArrayLike(callback, chunk), Promise.race),
      chunks,
    );
    */

    try {
      const promiseRaceResult: boolean = await Promise.any(
        mapArrayLike(
          async function callbackThrowing(input: T_input) {
            const awaitedInput = await input;
            const callbackResult = await predicate(awaitedInput);
            if (!callbackResult) {
              throw new Error(
                `callback ${String(predicate)} evals to false for ${awaitedInput}`,
              );
            }
            return callbackResult;
          },
          promises,
        ),
      );
      return promiseRaceResult;
    } catch (promiseRaceError) {
      l.info`${promiseRaceError}`;
      return false;
    }
  }

  // If what we're dealing with is not an array but just a iterable,
  // iterate per normal.
  // Cannot really optimize here.
  // If we try to shard it, we'd have to read the whole iterable first.

  // Turns out even the value is awaited already in for await loops.
  // It's not just for iterating AsyncIterable
  for await (const promise of promises) {
    try {
      await predicate(promise);
      return true;
    } catch (callbackError) {
      l.info`${callbackError}`;
    }
  }
  return false;
}
