import type { Arrayful } from "./arrayful.basic";
import type { IterableSync, MaybeAsyncIterable } from "./iterable.basic";

export type ToArrayable<T = unknown> = Arrayful<T> | MaybeAsyncIterable<T>;

export type ToArrayableSync<T = unknown> = Arrayful<T> | IterableSync<T>;
