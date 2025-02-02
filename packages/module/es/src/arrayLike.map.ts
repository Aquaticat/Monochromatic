import type {
  MaybeAsyncIterable,
  Tuple,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

// TODO: Support infinite Iterables by writing a * version of this fn.
// TODO: Investigate if doing that makes sense for other ArrayLike methods.
// MAYBE: Switch to IteratorObject from Iterator https://devblogs.microsoft.com/typescript/announcing-typescript-5-6-rc/

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<T_element,
  T_mappedElement,
  T_arrayLike extends MaybeAsyncIterable<T_element> & { length: number; },>(
  mappingFn: (input: T_element, index?: number,
    array?: Tuple<T_element, T_arrayLike['length']>) => Promisable<T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<
  Tuple<T_mappedElement, T_arrayLike['length']>
>;

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<T_element,
  T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: (input: T_element, index?: number,
    array?: T_element[]) => Promisable<T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<T_element,
  T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: (input: T_element, index?: number, //
    // MAYBE: Had to type it as | T_arrayLike here, which is completely incorrect.
    // Figure out why.
    array?: T_element[] | T_arrayLike) => Promisable<T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]> {
  return await Array.fromAsync(arrayLike, mappingFn);
}

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<T_element, T_mappedElement,
  T_arrayLike extends Iterable<T_element> & { length: number; },>(
  mappingFn: (input: T_element, index?: number,
    array?: Tuple<T_element, T_arrayLike['length']>) => T_mappedElement,
  arrayLike: T_arrayLike,
): Tuple<T_mappedElement, T_arrayLike['length']>;

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<T_element, T_mappedElement,
  T_arrayLike extends Iterable<T_element>,>(
  mappingFn: (input: T_element, index?: number, array?: T_element[]) => T_mappedElement,
  arrayLike: T_arrayLike,
): T_mappedElement[];

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<T_element, T_mappedElement,
  T_arrayLike extends (Iterable<T_element> | Iterable<T_element> & { length: number; }),>(
  mappingFn: (input: T_element, index?: number, //
    // MAYBE: Had to type it as | T_arrayLike here, which is completely incorrect.
    // Figure out why.
    array?: T_element[] | T_arrayLike) => T_mappedElement,
  arrayLike: T_arrayLike,
): T_mappedElement[] {
  return Array.from(arrayLike, mappingFn);
}
