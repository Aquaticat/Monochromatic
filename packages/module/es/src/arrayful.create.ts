import type { UnknownRecord } from 'type-fest';
import type { Arrayful, } from './arrayful.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

/**
 * Creates an Arrayful object that properly implements IterableSync by delegating iteration to the array.
 * @param array - Array to be wrapped in an Arrayful
 * @param originalObject - Original object to preserve properties and type identity
 * @returns Arrayful object with proper IterableSync implementation
 */
export function createArrayful<const TArray extends readonly unknown[] = readonly unknown[], TOriginal extends object = UnknownRecord,>(
  { array, obj, l = getDefaultLogger(), }: {
    array: TArray;
    obj: TOriginal;
  } & Partial<Logged>,
): TArray extends (infer T) ? TOriginal & Arrayful<T> : never {
  l.debug(createArrayful.name);

  return Object.assign(obj, {array, [Symbol.iterator]: array[Symbol.iterator]},) as any;
}
