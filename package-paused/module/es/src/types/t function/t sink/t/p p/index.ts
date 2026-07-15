import type { Promisable, } from 'type-fest';

/**
 * Generic sink function type accepting any value, returning sync or async.
 */
export type $<T = unknown, Returns = unknown,> = (value: T,) => Promisable<Returns>;
