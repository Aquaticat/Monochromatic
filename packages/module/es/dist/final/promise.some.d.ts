import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
/**
 @remarks
 */
export declare function somePromises<T_input>(predicate: (input: T_input) => Promisable<boolean>, promises: MaybeAsyncIterable<Promisable<T_input>>): Promise<boolean>;
