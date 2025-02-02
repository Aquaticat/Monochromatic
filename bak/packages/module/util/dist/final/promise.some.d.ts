import type { Promisable } from 'type-fest';
import { type MaybeAsyncIterable } from './arrayLike.ts';
/**
 @remarks
 */
export declare function somePromises<T_input>(predicate: (input: T_input) => Promisable<boolean>, promises: MaybeAsyncIterable<Promisable<T_input>>): Promise<boolean>;
