/**
 Source iterator selection and shutdown for the concurrent mappers.
 
 Reproduces upstream `p-map`'s iterator probing in its exact access order,
 so a hostile or exotic input throws the same failure at the same probe, and
 keeps upstream's detached iterator shutdown semantics: closing a source
 never blocks the caller and never surfaces the source's close failure.
 
 @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { InvalidInputError, } from './errors.ts';
import {
  iteratorProbe,
  type MapInput,
} from './mapper.ts';

//region Types

/**
 Iterator pulled by the concurrent mappers: synchronous or asynchronous,
 yielding elements or element promises.
 
 @typeParam Element - element type after awaiting an iterated item
 */
export type SourceIterator<Element> =
  | Iterator<Element | Promise<Element>, unknown, undefined>
  | AsyncIterator<Element | Promise<Element>, unknown, undefined>;

//endregion Types

//region Selection

/**
 Validates one input against upstream `p-map`'s acceptance rule, probing the
 synchronous iterator slot first exactly as upstream does.
 
 @typeParam Element - element type after awaiting an iterated item
 
 @param iterable - Inputs as typed by the public API.
 
 @throws InvalidInputError when the input exposes neither iterator slot.
 
 @throws TypeError from the probe itself when the input is `null` or
 `undefined`, matching upstream `p-map`'s property access.
 
 @example
 ```ts
 validateInput([1, 2,],);
 ```
 */
export function validateInput<Element>(iterable: MapInput<Element>,): void {
  /**
   Both iterator slots, probed in upstream `p-map`'s access order so an
   exotic input throws at the same probe.
   */
  const probe = iteratorProbe(iterable,);
  if ((probe[Symbol.iterator] === undefined)
    && (probe[Symbol.asyncIterator] === undefined))
    throw new InvalidInputError(iterable,);
}

/**
 Selects the iterator for one input, preferring the asynchronous slot exactly
 as upstream `p-map` does.
 
 Callers run {@link validateInput} first: upstream validates input,
 mapper,
 and concurrency before creating the iterator, and an input's iterator
 factory must not run before those checks.
 
 @typeParam Element - element type after awaiting an iterated item
 
 @param iterable - Inputs as typed by the public API.
 
 @returns The input's async iterator when present, else its sync iterator.
 
 @example
 ```ts
 const iterator = selectIterator([1, 2,],);
 ```
 */
export function selectIterator<Element>(iterable: MapInput<Element>,): SourceIterator<Element> {
  /**
   Both iterator slots, probed in upstream `p-map`'s selection order.
   */
  const probe = iteratorProbe(iterable,);
  /**
   Asynchronous iterator factory when the input is async. Captured into one
   binding so the branch below narrows it; each factory is called with the
   probe as receiver, exactly like upstream `p-map`'s method calls.
   */
  const asyncFactory = probe[Symbol.asyncIterator];
  if (asyncFactory !== undefined)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the probe type models both slots as optional; this branch holds the asynchronous one
    return asyncFactory.call(probe,) as AsyncIterator<Element | Promise<Element>, unknown, undefined>;
  /**
   Synchronous iterator factory; {@link validateInput} proved the slot
   present once the asynchronous one is absent.
   */
  const syncFactory = nonNullishOrThrow(probe[Symbol.iterator],);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the probe type models both slots as optional; validateInput proved the synchronous one present here
  return syncFactory.call(probe,) as Iterator<Element | Promise<Element>, unknown, undefined>;
}

//endregion Selection

//region Shutdown

/**
 Closes one source iterator through its `return` method, so the source can
 release its resources the way `for await` does on early exit.
 
 Detached on purpose: callers must not await this, so a source blocked inside
 `next()` can never block them. Upstream `p-map` swallows the close failure
 outright; this fork logs it instead of discarding it, then continues the
 same way.
 
 @typeParam Element - element type after awaiting an iterated item
 
 @param iterator - Source iterator to close.
 
 @example
 ```ts
 closeIterator(iterator,);
 ```
 */
export async function closeIterator<Element>(iterator: SourceIterator<Element>,): Promise<void> {
  try {
    await iterator.return?.();
  }
  catch (error) {
    // Swallowed like upstream `p-map`, because the close runs detached and a
    // rethrow would surface as an unhandled rejection; the caught value is
    // logged so the failure is never silently discarded.
    /**
     Logger carrying this function's name as its tag.
     */
    const log = tagged({
      tag: closeIterator.name,
    },);
    log.warn(`ignoring iterator close failure: ${caughtValueText(error,)}`,);
  }
}

//endregion Shutdown
