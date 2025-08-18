import type { Weightful } from "./weightful.basic.ts";

/**
 * Represents a simple container that holds a value.
 *
 * @typeParam T - Type of value contained in the box
 *
 * @example
 * ```ts
 * const numberBox: Box<number> = { value: 42 };
 * const stringBox: Box<string> = { value: "hello" };
 * ```
 */
export type Box<T = unknown,> = {
  value: T;
} & Partial<Weightful>;
