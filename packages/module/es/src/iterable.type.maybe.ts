/**
 * Represents a value that can be either an asynchronous or synchronous iterable of elements.
 * This type is useful for scenarios where a function or method needs to accept or return an iterable
 * that may produce elements synchronously or asynchronously.
 *
 * The type combines both [AsyncIterable] and [Iterable] interfaces, allowing developers to work
 * with a unified abstraction regardless of the iteration mechanism.
 *
 * @template element - The type of elements yielded by the iterable, consistent across both sync and async variants.
 */
export type MaybeAsyncIterable<element,> =
  | AsyncIterable<element>
  | Iterable<element>;
