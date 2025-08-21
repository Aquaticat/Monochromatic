import type { Promisable, } from 'type-fest';

/**
 * Synchronous function that accepts single value and returns result.
 * Represents basic synchronous data sink.
 * @template T - Type of value to sink.
 * @template Returns - Type of value returned.
 * @param value - to be processed.
 * @returns Result of processing.
 */
export type $Sync<T = unknown, Returns = unknown,> = (
  { value, l, }: { value: T; } & Logged,
) => Returns;

/**
 * Asynchronous function that accepts single value and returns result.
 * Represents basic asynchronous data sink.
 * @template T - Type of value to sink.
 * @template Returns - Type of value returned.
 * @param value - to be processed.
 * @returns Result of processing.
 */
export type $<T = unknown, Returns = unknown,> = (value: T,) => Promisable<Returns>;

/**
 * Synchronous function that accepts single string value and returns result.
 * Represents basic synchronous string data sink.
 * @template Returns - Type of value returned.
 * @param value - string to be processed.
 * @returns Result of processing.
 */
export type $StringSync<Returns = unknown,> = (value: string,) => Returns;

/**
 * Asynchronous function that accepts single string value and returns result.
 * Represents basic asynchronous string data sink.
 * @template Returns - Type of value returned.
 * @param value - string to be processed.
 * @returns Result of processing.
 */
export type $String<Returns = unknown,> = (value: string,) => Promisable<Returns>;
