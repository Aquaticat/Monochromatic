import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
export declare function reduceArrayLikeAsync<T_accumulated, T_element>(initialValue: T_accumulated, reducer: (accumulator: T_accumulated, currentValue: T_element, currentIndex?: number, array?: T_element[]) => Promisable<T_accumulated>, arrayLike: MaybeAsyncIterable<T_element>, internalCurrentIndex?: number): Promise<T_accumulated>;
export declare function reduceArrayLike<T_accumulated, T_element>(initialValue: T_accumulated, reducer: (accumulator: T_accumulated, currentValue: T_element, currentIndex?: number, array?: T_element[]) => T_accumulated, arrayLike: Iterable<T_element>): T_accumulated;
