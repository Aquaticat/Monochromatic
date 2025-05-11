import type {
  MaybeAsyncIterable,
  Tuple,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
import type { PromisableFunction } from './promise.type.ts';

// TODO: Support infinite Iterables by writing a * version of this fn. (Done)
//       Investigate if doing that makes sense for other ArrayLike methods.

export type MappingFunctionWithElement<T_element, T_mappedElement,> = (
  element: T_element,
) => T_mappedElement;
export type MappingFunctionWithElementAndIndex<T_element, T_mappedElement,> = (
  element: T_element,
  index: number,
) => T_mappedElement;
export type MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement,> = (
  element: T_element,
  index: number,
  array: T_element[],
) => T_mappedElement;
export type MappingFunction<T_element, T_mappedElement,> =
  | MappingFunctionWithElement<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndex<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement>;
export type MappingFunctionPromisable<T_element, T_mappedElement,> =
  | PromisableFunction<MappingFunctionWithElement<T_element, T_mappedElement>>
  | PromisableFunction<MappingFunctionWithElementAndIndex<T_element, T_mappedElement>>
  | PromisableFunction<
    MappingFunctionWithElementAndIndexAndArray<T_element, T_mappedElement>
  >;
export type MappingFunctionNoArray<T_element, T_mappedElement,> =
  | MappingFunctionWithElement<T_element, T_mappedElement>
  | MappingFunctionWithElementAndIndex<T_element, T_mappedElement>;
export type MappingFunctionNoArrayPromisable<T_element, T_mappedElement,> =
  | PromisableFunction<MappingFunctionWithElement<T_element, T_mappedElement>>
  | PromisableFunction<MappingFunctionWithElementAndIndex<T_element, T_mappedElement>>;

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<const T_element,
  const T_mappedElement,
  const T_arrayLike extends MaybeAsyncIterable<T_element> & { length: number; },>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<
  Tuple<T_mappedElement, T_arrayLike['length']>
>;

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<const T_element,
  const T_mappedElement, const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function mapArrayLikeAsync<const T_element,
  const T_mappedElement, const T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  mappingFn: MappingFunctionPromisable<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Promise<T_mappedElement[]> {
  const arr: T_element[] = await Array.fromAsync(arrayLike);
  return await Promise.all(
    arr.map(
      function mapper(element: T_element, index: number,
        array: T_element[]): Promisable<T_mappedElement>
      {
        return mappingFn(element, index, array);
      },
    ),
  );
}

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<const T_element,
  const T_mappedElement,
  const T_arrayLike extends Iterable<T_element> & { length: number; },>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): Tuple<T_mappedElement, T_arrayLike['length']>;

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<const T_element,
  const T_mappedElement, const T_arrayLike extends Iterable<T_element>,>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): T_mappedElement[];

/* @__NO_SIDE_EFFECTS__ */ export function mapArrayLike<const T_element,
  const T_mappedElement,
  const T_arrayLike
    extends (Iterable<T_element> | Iterable<T_element> & { length: number; }),>(
  mappingFn: MappingFunction<T_element, T_mappedElement>,
  arrayLike: T_arrayLike,
): T_mappedElement[] {
  const arr: T_element[] = [...arrayLike];
  return arr.map(mappingFn);
}

/* @__NO_SIDE_EFFECTS__ */
export function* mapArrayLikeGen<const T_element, const T_mappedElement,>(
  mappingFn: MappingFunctionNoArray<T_element, T_mappedElement>,
  arrayLike: Iterable<T_element>,
): Generator<T_mappedElement> {
  let index = 0;
  for (const element of arrayLike) {
    yield mappingFn(element, index++);
  }
}

/* @__NO_SIDE_EFFECTS__ */
export async function* mapArrayLikeAsyncGen<const T_element, const T_mappedElement,>(
  mappingFn: MappingFunctionNoArrayPromisable<T_element, T_mappedElement>,
  arrayLike: MaybeAsyncIterable<T_element>,
): AsyncGenerator<T_mappedElement> {
  let index = 0;
  for await (const element of arrayLike) {
    yield await mappingFn(element, index++);
  }
}
