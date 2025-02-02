import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable, Tuple } from './arrayLike.type.ts';
export declare function arrayFromAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element> & {
    length: number;
}>(arrayLike: T_arrayLike): Promise<Tuple<T_element, T_arrayLike['length']>>;
export declare function arrayFromAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>>(arrayLike: T_arrayLike): Promise<T_element[]>;
export declare function arrayFromAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element> & {
    length: number;
}>(arrayLike: T_arrayLike, mapFn: (element: T_element, index?: number) => Promisable<T_mappedElement>): Promise<T_mappedElement[]>;
export declare function arrayFromAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>>(arrayLike: T_arrayLike, mapFn: (element: T_element, index?: number) => Promisable<T_mappedElement>): Promise<(T_arrayLike extends {
    length: number;
} ? Tuple<T_mappedElement, T_arrayLike['length']> : T_mappedElement[])>;
export declare function arrayFrom<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element> & {
    length: number;
}>(arrayLike: T_arrayLike): Tuple<T_element, T_arrayLike['length']>;
export declare function arrayFrom<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element>>(arrayLike: T_arrayLike): T_element[];
export declare function arrayFrom<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element> & {
    length: number;
}>(arrayLike: T_arrayLike, mapFn: (element: T_element, index?: number) => T_mappedElement): Tuple<T_mappedElement, T_arrayLike['length']>;
export declare function arrayFrom<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element>>(arrayLike: T_arrayLike, mapFn: (element: T_element, index?: number) => T_mappedElement): T_mappedElement[];
