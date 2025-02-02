import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable, Tuple } from './arrayLike.type.ts';
export declare function mapArrayLikeAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element> & {
    length: number;
}>(mappingFn: (input: T_element, index?: number, array?: Tuple<T_element, T_arrayLike['length']>) => Promisable<T_mappedElement>, arrayLike: T_arrayLike): Promise<Tuple<T_mappedElement, T_arrayLike['length']>>;
export declare function mapArrayLikeAsync<T_element, T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>>(mappingFn: (input: T_element, index?: number, array?: T_element[]) => Promisable<T_mappedElement>, arrayLike: T_arrayLike): Promise<T_mappedElement[]>;
export declare function mapArrayLike<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element> & {
    length: number;
}>(mappingFn: (input: T_element, index?: number, array?: Tuple<T_element, T_arrayLike['length']>) => T_mappedElement, arrayLike: T_arrayLike): Tuple<T_mappedElement, T_arrayLike['length']>;
export declare function mapArrayLike<T_element, T_mappedElement, T_arrayLike extends Iterable<T_element>>(mappingFn: (input: T_element, index?: number, array?: T_element[]) => T_mappedElement, arrayLike: T_arrayLike): T_mappedElement[];
