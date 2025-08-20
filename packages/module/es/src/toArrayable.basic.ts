import type { Arrayful, } from './arrayful.basic';
import type {
  IterableSync,
  MaybeAsyncIterable,
} from './iterable.basic';

export type ToArrayable<T = unknown,> = { readonly array: T[]; } | MaybeAsyncIterable<T>;

export type ToArrayableSync<T = unknown,> = { readonly array: T[]; } | IterableSync<T>;
