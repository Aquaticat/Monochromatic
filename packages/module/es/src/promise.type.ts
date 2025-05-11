import type { Promisable } from 'type-fest';

export type NotPromise<T = any,> = Exclude<T, Promise<any>>;

export type Predicate = (input: unknown) => boolean;

export type PredicateAsync = (input: unknown) => Promise<boolean>;

export type PredicateMaybeAsync = (input: unknown) => Promisable<boolean>;

export type PromisableFunction<T extends (...inputs: any) => any,> = (
  ...inputs: Parameters<T>
) => Promisable<ReturnType<T>>;
